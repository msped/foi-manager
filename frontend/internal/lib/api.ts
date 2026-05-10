import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { ApiUser, CaseDetail, CaseListItem, Department, Paginated } from "./types";

const DJANGO = process.env.DJANGO_API_URL ?? "http://localhost:8000";

async function getDjangoToken(): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: await headers() });
  return (session?.user as any)?.access_token ?? undefined;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getDjangoToken();

  const res = await fetch(`${DJANGO}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status} on ${path}`);
  }

  return res.json() as Promise<T>;
}

export async function getMe(): Promise<ApiUser> {
  return apiFetch<ApiUser>("/auth/user/");
}

export async function listCases(params?: Record<string, string>): Promise<Paginated<CaseListItem>> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<Paginated<CaseListItem>>(`/cases/${qs}`);
}

export async function getCase(id: number | string): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/cases/${id}/`);
}

export async function listUsers(): Promise<ApiUser[]> {
  return apiFetch<ApiUser[]>("/users/");
}

export async function listDepartments(): Promise<Department[]> {
  return apiFetch<Department[]>("/departments/");
}
