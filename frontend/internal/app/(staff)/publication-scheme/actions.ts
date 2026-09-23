"use server";

import { isAxiosError } from "axios";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSchemeDocument,
  createSchemeEntry,
  createSchemeLink,
  deleteSchemeEntry,
  deleteSchemeItem,
  publishSchemeEntry,
  unpublishSchemeEntry,
  updateSchemeEntry,
} from "@/lib/services/publications";

export interface ActionState {
  error?: string;
}

/** DRF puts field errors in a dict and everything else under `detail`. The
 *  publish refusal is a `detail`, and it is the one message here that has to
 *  reach the user verbatim — it says what is missing. */
function messageFrom(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string }
      | Record<string, string[]>
      | undefined;
    if (data && typeof data === "object") {
      if ("detail" in data && typeof data.detail === "string") return data.detail;
      const first = Object.values(data)[0];
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
  }
  return fallback;
}

export async function createEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "");

  if (!title) return { error: "Enter a title" };
  if (!category) return { error: "Choose a class of information" };

  let id: number;
  try {
    const entry = await createSchemeEntry({ title, category, description });
    id = entry.id;
  } catch (error) {
    return { error: messageFrom(error, "The entry could not be created.") };
  }

  revalidatePath("/publication-scheme");
  // Straight to the edit page rather than back to the list. A new entry is a
  // draft with nothing attached, and the next thing anyone needs to do is add
  // the links — which is the one thing the list page cannot do.
  redirect(`/publication-scheme/${id}`);
}

export async function updateEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "");

  if (!title) return { error: "Enter a title" };

  try {
    await updateSchemeEntry(id, { title, category, description });
  } catch (error) {
    return { error: messageFrom(error, "The entry could not be saved.") };
  }

  revalidatePath("/publication-scheme");
  revalidatePath(`/publication-scheme/${id}`);
  return {};
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  await deleteSchemeEntry(id);
  revalidatePath("/publication-scheme");
  redirect("/publication-scheme");
}

export async function publishEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = Number(formData.get("id"));
  try {
    await publishSchemeEntry(id);
  } catch (error) {
    // Most often "add a link or a document before publishing this entry",
    // which is the refusal doing its job rather than a failure.
    return { error: messageFrom(error, "The entry could not be published.") };
  }
  revalidatePath("/publication-scheme");
  revalidatePath(`/publication-scheme/${id}`);
  return {};
}

export async function unpublishEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = Number(formData.get("id"));
  try {
    await unpublishSchemeEntry(id);
  } catch (error) {
    return { error: messageFrom(error, "The entry could not be unpublished.") };
  }
  revalidatePath("/publication-scheme");
  revalidatePath(`/publication-scheme/${id}`);
  return {};
}

/**
 * Add a link or a file to an entry.
 *
 * One action for both kinds because the form is one form — a radio picks which
 * fields apply, and splitting it would mean two nearly identical actions that
 * could drift.
 *
 * `sort_order` is the current item count, so new items land at the bottom in
 * the order they were added. Nothing reorders them yet.
 */
export async function addItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const entryId = Number(formData.get("entry"));
  const kind = String(formData.get("kind") ?? "link");
  const label = String(formData.get("label") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  // The API enforces this too, and that is the check that counts. Repeated
  // here so the message arrives without a round trip, and — for an upload —
  // without pushing the file across the wire first only to be refused.
  if (!label && formData.get("has_items")) {
    return {
      error:
        "Give this a label. The entry already has an item, and without labels they would all be shown under the entry's title.",
    };
  }

  try {
    if (kind === "document") {
      const file = formData.get("document");
      if (!(file instanceof File) || file.size === 0) {
        return { error: "Choose a file to upload" };
      }
      await createSchemeDocument(entryId, label, sortOrder, file);
    } else {
      const url = String(formData.get("url") ?? "").trim();
      if (!url) return { error: "Enter a web address" };
      await createSchemeLink({ entry: entryId, label, url, sort_order: sortOrder });
    }
  } catch (error) {
    return { error: messageFrom(error, "The item could not be added.") };
  }

  revalidatePath("/publication-scheme");
  revalidatePath(`/publication-scheme/${entryId}`);
  return {};
}

/** Removes the stored file too. With uploads served from an open media root,
 *  this is the only way to withdraw a document once it has been added. */
export async function deleteItemAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const entryId = Number(formData.get("entry"));
  await deleteSchemeItem(id);
  revalidatePath("/publication-scheme");
  revalidatePath(`/publication-scheme/${entryId}`);
}
