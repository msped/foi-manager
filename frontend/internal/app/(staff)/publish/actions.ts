"use server";

import { revalidatePath } from "next/cache";
import {
  createDisclosureLogEntry,
  deleteDisclosureLogEntry,
  publishDisclosureLogEntry,
  unpublishDisclosureLogEntry,
  updateDisclosureLogEntry,
} from "@/lib/services/publications";
import type { DisclosureLogEntry } from "@/lib/types";

export type EntryFormData = {
  case_id: number;
  entry_id: number | null;
  title: string;
  summary: string;
  response_text: string;
  date_received: string;
  date_responded: string;
  exemption_ids: number[];
  attachment_ids: number[];
};

export async function saveEntryAction(data: EntryFormData): Promise<DisclosureLogEntry> {
  const base = {
    title: data.title,
    summary: data.summary,
    response_text: data.response_text,
    date_received: data.date_received,
    date_responded: data.date_responded,
    exemptions: data.exemption_ids,
    attachments: data.attachment_ids,
  };
  const entry = data.entry_id
    ? await updateDisclosureLogEntry(data.entry_id, base)
    : await createDisclosureLogEntry({ ...base, case: data.case_id });
  revalidatePath("/publish");
  return entry;
}

export async function publishEntryAction(id: number): Promise<DisclosureLogEntry> {
  const entry = await publishDisclosureLogEntry(id);
  revalidatePath("/publish");
  return entry;
}

export async function unpublishEntryAction(id: number): Promise<DisclosureLogEntry> {
  const entry = await unpublishDisclosureLogEntry(id);
  revalidatePath("/publish");
  return entry;
}

export async function deleteEntryAction(id: number): Promise<void> {
  await deleteDisclosureLogEntry(id);
  revalidatePath("/publish");
}
