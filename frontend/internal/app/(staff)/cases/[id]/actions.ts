"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createConsultation, updateConsultation, deleteConsultation } from "@/lib/services/cases";

function handleError(error: unknown): { error: string } {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401 || status === 403) redirect("/login");
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return { error: detail ?? "Something went wrong." };
}

export async function sendConsultation(
  caseId: number,
  formData: FormData,
): Promise<{ error: string } | void> {
  const departmentId = formData.get("department") as string;
  const assigneeId = formData.get("assignee") as string;
  const scope = (formData.get("scope") as string).trim();
  const dueDate = formData.get("due_date") as string;

  if (!scope) return { error: "Scope is required." };

  try {
    await createConsultation(caseId, {
      department: departmentId ? Number(departmentId) : null,
      assignee: assigneeId ? Number(assigneeId) : null,
      scope,
      due_date: dueDate || null,
    });
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function reassignConsultation(
  caseId: number,
  consultationId: number,
  formData: FormData,
): Promise<{ error: string } | void> {
  const assigneeId = formData.get("assignee") as string;
  try {
    await updateConsultation(caseId, consultationId, {
      assignee: assigneeId ? Number(assigneeId) : null,
    });
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function markConsultationResponded(
  caseId: number,
  consultationId: number,
  response: string,
): Promise<{ error: string } | void> {
  try {
    await updateConsultation(caseId, consultationId, { status: "responded", response });
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function withdrawConsultation(
  caseId: number,
  consultationId: number,
): Promise<{ error: string } | void> {
  try {
    await deleteConsultation(caseId, consultationId);
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}
