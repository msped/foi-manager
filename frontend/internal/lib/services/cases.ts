import djangoClient from "./django";
import type {
  BankHoliday, CaseConsultation, CaseDetail, CaseListItem, CaseResponse,
  ConsultationMessage, Department, EmailTemplate, Mailbox, Paginated,
} from "@/lib/types";

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
  body: { mailbox?: number | null; assignee?: number | null; scope: string; due_date?: string | null },
): Promise<CaseConsultation> {
  const { data } = await djangoClient.post<CaseConsultation>(`/cases/${caseId}/consultations/`, body);
  return data;
}

export async function updateConsultation(
  caseId: number | string,
  consultationId: number,
  body: Partial<{ mailbox: number | null; assignee: number | null; status: string; due_date: string | null }>,
): Promise<CaseConsultation> {
  const { data } = await djangoClient.patch<CaseConsultation>(`/cases/${caseId}/consultations/${consultationId}/`, body);
  return data;
}

export async function listConsultationMessages(
  consultationId: number,
): Promise<ConsultationMessage[]> {
  const { data } = await djangoClient.get<ConsultationMessage[]>(`/consultations/${consultationId}/messages/`);
  return data;
}

export async function sendConsultationMessage(
  consultationId: number,
  body: string,
): Promise<ConsultationMessage> {
  const { data } = await djangoClient.post<ConsultationMessage>(`/consultations/${consultationId}/messages/`, { body });
  return data;
}

export async function listCaseResponses(caseId: number | string): Promise<CaseResponse[]> {
  const { data } = await djangoClient.get<CaseResponse[]>(`/cases/${caseId}/responses/`);
  return data;
}

export async function createCaseResponse(caseId: number | string, body: string): Promise<CaseResponse> {
  const { data } = await djangoClient.post<CaseResponse>(`/cases/${caseId}/responses/`, { body });
  return data;
}

export async function updateCaseResponse(
  caseId: number | string,
  responseId: number,
  body: string,
): Promise<CaseResponse> {
  const { data } = await djangoClient.patch<CaseResponse>(`/cases/${caseId}/responses/${responseId}/`, { body });
  return data;
}

export async function sendCaseResponse(caseId: number | string, responseId: number): Promise<CaseResponse> {
  const { data } = await djangoClient.post<CaseResponse>(`/cases/${caseId}/responses/${responseId}/send/`);
  return data;
}

export async function listMailboxes(search?: string): Promise<Mailbox[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  const { data } = await djangoClient.get<Mailbox[]>(`/mailboxes/${qs}`);
  return data;
}

export async function createMailbox(body: { name: string; email: string }): Promise<Mailbox> {
  const { data } = await djangoClient.post<Mailbox>("/mailboxes/", body);
  return data;
}

export async function updateMailbox(id: number, body: Partial<{ name: string; email: string }>): Promise<Mailbox> {
  const { data } = await djangoClient.patch<Mailbox>(`/mailboxes/${id}/`, body);
  return data;
}

export async function deleteMailbox(id: number): Promise<void> {
  await djangoClient.delete(`/mailboxes/${id}/`);
}

export async function listEmailTemplates(type?: "consultation" | "requester"): Promise<EmailTemplate[]> {
  const qs = type ? `?type=${type}` : "";
  const { data } = await djangoClient.get<EmailTemplate[]>(`/email-templates/${qs}`);
  return data;
}

export async function createEmailTemplate(
  body: { name: string; type: "consultation" | "requester"; description?: string; subject: string; body: string },
): Promise<EmailTemplate> {
  const { data } = await djangoClient.post<EmailTemplate>("/email-templates/", body);
  return data;
}

export async function updateEmailTemplate(
  id: number,
  body: Partial<{ name: string; type: "consultation" | "requester"; description: string; subject: string; body: string }>,
): Promise<EmailTemplate> {
  const { data } = await djangoClient.patch<EmailTemplate>(`/email-templates/${id}/`, body);
  return data;
}

export async function deleteEmailTemplate(id: number): Promise<void> {
  await djangoClient.delete(`/email-templates/${id}/`);
}

export async function assignCase(caseId: number | string, assigneeId: number | null): Promise<void> {
  await djangoClient.patch(`/cases/${caseId}/`, { assignee: assigneeId });
}

export async function acknowledgeCase(caseId: number | string): Promise<void> {
  await djangoClient.post(`/cases/${caseId}/acknowledge/`);
}

export async function pauseClock(caseId: number | string): Promise<void> {
  await djangoClient.post(`/cases/${caseId}/pause_clock/`);
}

export async function resumeClock(caseId: number | string): Promise<void> {
  await djangoClient.post(`/cases/${caseId}/resume_clock/`);
}

export async function transitionCase(caseId: number | string, status: string): Promise<void> {
  await djangoClient.post(`/cases/${caseId}/transition/`, { status });
}

export async function listBankHolidays(params?: { country?: string; year?: string }): Promise<BankHoliday[]> {
  const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
  const { data } = await djangoClient.get<BankHoliday[]>(`/bank-holidays/${qs}`);
  return data;
}

export async function createBankHoliday(body: { country: string; name: string; date: string }): Promise<BankHoliday> {
  const { data } = await djangoClient.post<BankHoliday>("/bank-holidays/", body);
  return data;
}

export async function deleteBankHoliday(id: number): Promise<void> {
  await djangoClient.delete(`/bank-holidays/${id}/`);
}
