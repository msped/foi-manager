import djangoClient from "./django";
import type { CaseConsultation, CaseDetail, CaseListItem, Department, Paginated } from "@/lib/types";

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

export async function createConsultation(
  caseId: number | string,
  body: { department?: number | null; assignee?: number | null; scope: string; due_date?: string | null },
): Promise<CaseConsultation> {
  const { data } = await djangoClient.post<CaseConsultation>(`/cases/${caseId}/consultations/`, body);
  return data;
}

export async function updateConsultation(
  caseId: number | string,
  consultationId: number,
  body: Partial<{ department: number | null; assignee: number | null; status: string; response: string; due_date: string | null }>,
): Promise<CaseConsultation> {
  const { data } = await djangoClient.patch<CaseConsultation>(`/cases/${caseId}/consultations/${consultationId}/`, body);
  return data;
}

export async function deleteConsultation(caseId: number | string, consultationId: number): Promise<void> {
  await djangoClient.delete(`/cases/${caseId}/consultations/${consultationId}/`);
}
