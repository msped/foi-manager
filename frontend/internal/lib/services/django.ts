import axios, { type InternalAxiosRequestConfig } from "axios";
import { authClient } from "@/lib/auth-client";

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
let clientToken: string | null = null;

export function setClientToken(token: string | null) {
  clientToken = token;
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

const REFRESH_TIMEOUT_MS = 15000;

interface RetryConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

type SessionUser = { access_token?: string };

const djangoClient = () => {
  const host =
    typeof window === "undefined"
      ? (process.env.DJANGO_API_URL ?? "http://localhost:8000")
      : (process.env.NEXT_PUBLIC_DJANGO_API_URL ?? "http://localhost:8000");

  const instance = axios.create({
    baseURL: `${host}/api/v1`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  instance.interceptors.request.use(async (config) => {
    let token: string | undefined;

    if (typeof window === "undefined") {
      try {
        const { getSession } = await import("@/lib/auth");
        const session = await getSession();
        token = (session?.user as SessionUser | undefined)?.access_token;
      } catch {
        // outside Next.js request context
      }
    } else {
      if (clientToken !== null) {
        token = clientToken;
      } else {
        const { data } = await authClient.getSession();
        token = (data?.user as SessionUser | undefined)?.access_token ?? undefined;
        clientToken = token ?? null;
      }
    }

    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (
        typeof window === "undefined" ||
        (window as Window & { Cypress?: unknown }).Cypress ||
        error.response?.status !== 401
      ) {
        return Promise.reject(error);
      }

      const original = error.config as RetryConfig;

      if (original._retried) {
        window.location.href = "/api/force-logout";
        return new Promise(() => {});
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(instance(original));
          });
        });
      }

      original._retried = true;
      isRefreshing = true;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

      try {
        const result = await authClient.$fetch("/refresh-django-token", {
          method: "POST",
          fetchOptions: { signal: controller.signal },
        });

        if ((result as { error?: unknown }).error) throw new Error("Refresh failed");

        const newToken = (result as { data?: { access_token?: string } }).data?.access_token;
        if (!newToken) throw new Error("No token");

        clientToken = newToken;
        onRefreshed(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return instance(original);
      } catch {
        clientToken = null;
        refreshSubscribers = [];
        window.location.href = "/api/force-logout";
        return new Promise(() => {});
      } finally {
        clearTimeout(timeout);
        isRefreshing = false;
      }
    }
  );

  return instance;
};

export default djangoClient();
