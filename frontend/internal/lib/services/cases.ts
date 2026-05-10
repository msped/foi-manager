import djangoClient from "./django";
import type { CaseDetail, CaseListItem, Department, Paginated } from "@/lib/types";

export async function listCases(params?: Record<string, string>): Promise<Paginated<CaseListItem>> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const { data } = await djangoClient.get<Paginated<CaseListItem>>(`/cases/${qs}`);
  return data;
}

export async function getCase(id: number | string): Promise<CaseDetail> {
  const { data } = await djangoClient.get<CaseDetail>(`/cases/${id}/`);
  return data;
}

export async function listDepartments(): Promise<Department[]> {
  const { data } = await djangoClient.get<Department[]>("/departments/");
  return data;
}

export async function listRequesterCategories(): Promise<{ id: number; name: string; order: number }[]> {
  const { data } = await djangoClient.get<{ id: number; name: string; order: number }[]>("/requester-categories/");
  return data;
}
