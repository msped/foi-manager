import axios, { type InternalAxiosRequestConfig } from "axios";

const isServer = typeof window === "undefined";

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

const baseURL = isServer
  ? `${process.env.DJANGO_API_URL ?? "http://localhost:8000"}/api/v1`
  : `${process.env.NEXT_PUBLIC_DJANGO_API_URL ?? "http://localhost:8000"}/api/v1`;

const djangoClient = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

djangoClient.interceptors.request.use(async (config) => {
  let token: string | undefined;

  if (isServer) {
    try {
      const { headers } = await import("next/headers");
      const { auth } = await import("@/lib/auth");
      const session = await auth.api.getSession({ headers: await headers() });
      token = (session?.user as { access_token?: string })?.access_token;
    } catch {
      // outside a request context — no token
    }
  } else {
    if (clientToken !== null) {
      token = clientToken;
    } else {
      const { authClient } = await import("@/lib/auth-client");
      const { data } = await authClient.getSession();
      token = (data?.user as { access_token?: string })?.access_token ?? undefined;
      clientToken = token ?? null;
    }
  }

  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface RetryConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

djangoClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Server-side: no refresh attempt — let server component catch and redirect
    if (isServer || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const original = error.config as RetryConfig;

    if (original._retried) {
      clientToken = null;
      window.location.href = "/login";
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshSubscribers.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(djangoClient(original));
        });
      });
    }

    original._retried = true;
    isRefreshing = true;

    try {
      const { authClient } = await import("@/lib/auth-client");
      const result = await authClient.$fetch("/refresh-django-token", { method: "POST" });
      const newToken =
        (result as { data?: { access_token?: string }; access_token?: string })?.data?.access_token ??
        (result as { access_token?: string })?.access_token;

      if (!newToken) throw new Error("No token in refresh response");

      clientToken = newToken;
      onRefreshed(newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return djangoClient(original);
    } catch {
      clientToken = null;
      refreshSubscribers = [];
      window.location.href = "/login";
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

export default djangoClient;
