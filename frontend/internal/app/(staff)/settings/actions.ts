"use server";

import { revalidatePath } from "next/cache";
import djangoClient from "@/lib/services/django";
import type { ApiUser, BankHoliday, EmailTemplate, Mailbox, UserSearchResult } from "@/lib/types";

export async function createRequesterCategory(name: string): Promise<{ error?: string }> {
  try {
    const { data: existing } = await djangoClient.get<{ id: number; order: number }[]>("/requester-categories/");
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(c => c.order)) + 1 : 0;
    await djangoClient.post("/requester-categories/", { name: name.trim(), order: nextOrder });
    revalidatePath("/settings");
    return {};
  } catch {
    return { error: "Failed to create category." };
  }
}

export async function updateRequesterCategory(id: number, name: string): Promise<{ error?: string }> {
  try {
    await djangoClient.patch(`/requester-categories/${id}/`, { name: name.trim() });
    revalidatePath("/settings");
    return {};
  } catch {
    return { error: "Failed to update category." };
  }
}

export async function deleteRequesterCategory(id: number): Promise<{ error?: string }> {
  try {
    await djangoClient.delete(`/requester-categories/${id}/`);
    revalidatePath("/settings");
    return {};
  } catch {
    return { error: "Failed to delete category." };
  }
}

export async function createBankHoliday(
  body: { country: string; name: string; date: string },
): Promise<{ data?: BankHoliday; error?: string }> {
  try {
    const { data } = await djangoClient.post<BankHoliday>("/bank-holidays/", body);
    revalidatePath("/settings");
    return { data };
  } catch {
    return { error: "Failed to add bank holiday." };
  }
}

export async function deleteBankHoliday(id: number): Promise<{ error?: string }> {
  try {
    await djangoClient.delete(`/bank-holidays/${id}/`);
    revalidatePath("/settings");
    return {};
  } catch {
    return { error: "Failed to delete bank holiday." };
  }
}

export async function createMailbox(name: string, email: string): Promise<{ data?: Mailbox; error?: string }> {
  try {
    const { data } = await djangoClient.post<Mailbox>("/mailboxes/", { name: name.trim(), email: email.trim() });
    revalidatePath("/settings");
    return { data };
  } catch {
    return { error: "Failed to create mailbox." };
  }
}

export async function updateMailboxAction(id: number, name: string, email: string): Promise<{ error?: string }> {
  try {
    await djangoClient.patch(`/mailboxes/${id}/`, { name: name.trim(), email: email.trim() });
    revalidatePath("/settings");
    return {};
  } catch {
    return { error: "Failed to update mailbox." };
  }
}

export async function deleteMailboxAction(id: number): Promise<{ error?: string }> {
  try {
    await djangoClient.delete(`/mailboxes/${id}/`);
    revalidatePath("/settings");
    return {};
  } catch {
    return { error: "Failed to delete mailbox." };
  }
}

export async function createEmailTemplateAction(
  body: { name: string; type: "consultation" | "requester"; description: string; subject: string; body: string },
): Promise<{ data?: EmailTemplate; error?: string }> {
  try {
    const { data } = await djangoClient.post<EmailTemplate>("/email-templates/", body);
    revalidatePath("/settings");
    return { data };
  } catch {
    return { error: "Failed to create template." };
  }
}

export async function updateEmailTemplateAction(
  id: number,
  body: Partial<{ name: string; type: "consultation" | "requester"; description: string; subject: string; body: string }>,
): Promise<{ error?: string }> {
  try {
    await djangoClient.patch(`/email-templates/${id}/`, body);
    revalidatePath("/settings");
    return {};
  } catch {
    return { error: "Failed to update template." };
  }
}

export async function deleteEmailTemplateAction(id: number): Promise<{ error?: string }> {
  try {
    await djangoClient.delete(`/email-templates/${id}/`);
    revalidatePath("/settings");
    return {};
  } catch {
    return { error: "Failed to delete template." };
  }
}

export async function updateUserAction(
  id: number,
  body: Partial<{ role: "foi_team" | "assignee"; is_active: boolean }>,
): Promise<{ data?: ApiUser; error?: string }> {
  try {
    const { data } = await djangoClient.patch<ApiUser>(`/users/${id}/`, body);
    revalidatePath("/settings");
    return { data };
  } catch {
    return { error: "Failed to update user." };
  }
}

export async function searchUsersAction(query: string): Promise<{ data?: UserSearchResult[]; error?: string }> {
  try {
    const { data } = await djangoClient.get<UserSearchResult[]>(`/users/search/?search=${encodeURIComponent(query)}`);
    return { data };
  } catch {
    return { error: "Search failed." };
  }
}
