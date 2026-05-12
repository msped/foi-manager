"use server";

import { revalidatePath } from "next/cache";
import djangoClient from "@/lib/services/django";
import type { BankHoliday } from "@/lib/types";

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
