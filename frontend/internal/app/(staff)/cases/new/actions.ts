"use server";

import { redirect } from "next/navigation";
import djangoClient from "@/lib/services/django";
import type { CaseDetail } from "@/lib/types";

export interface CreateCaseResult {
  error: string | null;
}

export async function createCase(formData: FormData): Promise<CreateCaseResult> {
  const departmentId = formData.get("department_id") as string;
  const submittedAt = formData.get("submitted_at") as string;
  const body: Record<string, unknown> = {
    requester_name: (formData.get("requester_name") as string).trim(),
    requester_email: (formData.get("requester_email") as string).trim(),
    requester_type: formData.get("requester_type"),
    received_by: formData.get("received_by"),
    submitted_at: submittedAt || new Date().toISOString().split("T")[0],
    request_text: (formData.get("request_text") as string).trim(),
    summary: (formData.get("summary") as string).trim(),
  };
  if (departmentId) body.department_id = Number(departmentId);

  try {
    const { data } = await djangoClient.post<CaseDetail>("/cases/", body);
    redirect(`/cases/${data.id}`);
  } catch (error: unknown) {
    const digest = (error as { digest?: string })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) redirect("/login");
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    return { error: detail ?? "Failed to create case." };
  }
}
