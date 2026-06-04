"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  acknowledgeCase, assignCase, createConsultation, pauseClock, resumeClock,
  sendCaseResponse as svcSendCaseResponse, sendConsultationMessage,
  transitionCase, updateConsultation,
} from "@/lib/services/cases";
import djangoClient from "@/lib/services/django";
import type { CaseNote, CaseResponse } from "@/lib/types";

function handleError(error: unknown): { error: string } {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401 || status === 403) redirect("/login");
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return { error: detail ?? "Something went wrong." };
}

export async function sendConsultationMessageAction(
  caseId: number,
  consultationId: number,
  body: string,
): Promise<{ error: string } | void> {
  if (!body.trim()) return { error: "Message cannot be empty." };
  try {
    await sendConsultationMessage(consultationId, body);
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function sendConsultation(
  caseId: number,
  formData: FormData,
): Promise<{ error: string } | void> {
  const mailboxId = formData.get("mailbox") as string;
  const assigneeId = formData.get("assignee") as string;
  const scope = (formData.get("scope") as string).trim();
  const dueDate = formData.get("due_date") as string;

  if (!scope) return { error: "Scope is required." };
  if (!mailboxId && !assigneeId) return { error: "Select a mailbox or assignee." };

  try {
    await createConsultation(caseId, {
      mailbox: mailboxId ? Number(mailboxId) : null,
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

export async function withdrawConsultation(
  caseId: number,
  consultationId: number,
): Promise<{ error: string } | void> {
  try {
    await updateConsultation(caseId, consultationId, { status: "withdrawn" });
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function closeConsultation(
  caseId: number,
  consultationId: number,
): Promise<{ error: string } | void> {
  try {
    await updateConsultation(caseId, consultationId, { status: "closed" });
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function addCaseNote(
  caseId: number,
  body: string,
): Promise<{ error: string } | void> {
  if (!body.trim()) return { error: "Note cannot be empty." };
  try {
    await djangoClient.post<CaseNote>(`/cases/${caseId}/notes/`, { body });
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function assignCaseAction(
  caseId: number,
  assigneeId: number | null,
): Promise<{ error: string } | void> {
  try {
    await assignCase(caseId, assigneeId);
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function acknowledgeCaseAction(caseId: number): Promise<{ error: string } | void> {
  try {
    await acknowledgeCase(caseId);
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function pauseClockAction(caseId: number): Promise<{ error: string } | void> {
  try {
    await pauseClock(caseId);
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function resumeClockAction(caseId: number): Promise<{ error: string } | void> {
  try {
    await resumeClock(caseId);
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function transitionCaseAction(
  caseId: number,
  status: string,
): Promise<{ error: string } | void> {
  try {
    await transitionCase(caseId, status);
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}

export async function saveCaseResponseAction(
  caseId: number,
  body: string,
  responseId?: number,
): Promise<{ error: string; id?: number } | { id: number }> {
  try {
    let resp: CaseResponse;
    if (responseId) {
      const { data } = await djangoClient.patch<CaseResponse>(`/cases/${caseId}/responses/${responseId}/`, { body });
      resp = data;
    } else {
      const { data } = await djangoClient.post<CaseResponse>(`/cases/${caseId}/responses/`, { body });
      resp = data;
    }
    revalidatePath(`/cases/${caseId}`);
    return { id: resp.id };
  } catch (error) {
    return handleError(error) as { error: string };
  }
}

export async function sendCaseResponseAction(
  caseId: number,
  responseId: number,
): Promise<{ error: string } | void> {
  try {
    await svcSendCaseResponse(caseId, responseId);
    revalidatePath(`/cases/${caseId}`);
  } catch (error) {
    return handleError(error);
  }
}
