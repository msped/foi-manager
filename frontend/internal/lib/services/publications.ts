import djangoClient from "./django";
import type {
  DisclosureLogEntry,
  DisclosureLogListItem,
  Paginated,
  PublicationSchemeEntry,
  PublicationSchemeItem,
  PublishQueueItem,
  RejectedEntry,
} from "@/lib/types";

export async function getPublishQueue(): Promise<PublishQueueItem[]> {
  const { data } = await djangoClient.get<PublishQueueItem[]>(
    "/publications/disclosure-log/queue/"
  );
  return data;
}

export async function getRejectedQueue(): Promise<RejectedEntry[]> {
  const { data } = await djangoClient.get<RejectedEntry[]>(
    "/publications/disclosure-log/rejected/"
  );
  return data;
}

export async function getDisclosureLog(): Promise<DisclosureLogListItem[]> {
  const { data } = await djangoClient.get<DisclosureLogListItem[]>(
    "/publications/disclosure-log/"
  );
  return data;
}

export async function createDisclosureLogEntry(payload: {
  case: number;
  title: string;
  summary: string;
  response_text: string;
  date_received: string;
  date_responded: string;
  exemptions: number[];
  attachments: number[];
}): Promise<DisclosureLogEntry> {
  const { data } = await djangoClient.post<DisclosureLogEntry>(
    "/publications/disclosure-log/",
    payload
  );
  return data;
}

export async function updateDisclosureLogEntry(
  id: number,
  payload: Partial<{
    title: string;
    summary: string;
    response_text: string;
    date_received: string;
    date_responded: string;
    exemptions: number[];
    attachments: number[];
  }>
): Promise<DisclosureLogEntry> {
  const { data } = await djangoClient.patch<DisclosureLogEntry>(
    `/publications/disclosure-log/${id}/`,
    payload
  );
  return data;
}

export async function publishDisclosureLogEntry(id: number): Promise<DisclosureLogEntry> {
  const { data } = await djangoClient.post<DisclosureLogEntry>(
    `/publications/disclosure-log/${id}/publish/`
  );
  return data;
}

export async function unpublishDisclosureLogEntry(id: number): Promise<DisclosureLogEntry> {
  const { data } = await djangoClient.post<DisclosureLogEntry>(
    `/publications/disclosure-log/${id}/unpublish/`
  );
  return data;
}

export async function rejectDisclosureLogEntry(
  id: number,
  reason: string
): Promise<DisclosureLogEntry> {
  const { data } = await djangoClient.post<DisclosureLogEntry>(
    `/publications/disclosure-log/${id}/reject/`,
    { reason }
  );
  return data;
}

export async function rejectCaseDisclosureLog(
  caseId: number,
  reason: string
): Promise<DisclosureLogEntry> {
  const { data } = await djangoClient.post<DisclosureLogEntry>(
    `/publications/disclosure-log/reject_case/`,
    { case: caseId, reason }
  );
  return data;
}

export async function unrejectDisclosureLogEntry(id: number): Promise<DisclosureLogEntry> {
  const { data } = await djangoClient.post<DisclosureLogEntry>(
    `/publications/disclosure-log/${id}/unreject/`
  );
  return data;
}

export async function deleteDisclosureLogEntry(id: number): Promise<void> {
  await djangoClient.delete(`/publications/disclosure-log/${id}/`);
}

// --- Publication scheme ---

/**
 * Every scheme entry, drafts included.
 *
 * This route is `IsFOITeam` throughout — it used to allow anonymous reads, and
 * must not again, because it is now the only one that returns unpublished work.
 * The portal reads `publications/public/scheme/` instead.
 *
 * Asks for the whole scheme in one request, like the public page: entries are
 * rendered grouped under all seven categories rather than a page at a time.
 */
export async function listSchemeEntries(): Promise<PublicationSchemeEntry[]> {
  const { data } = await djangoClient.get<Paginated<PublicationSchemeEntry>>(
    "/publications/scheme/",
    { params: { page_size: 200 } }
  );
  return data.results;
}

export async function getSchemeEntry(id: number): Promise<PublicationSchemeEntry> {
  const { data } = await djangoClient.get<PublicationSchemeEntry>(
    `/publications/scheme/${id}/`
  );
  return data;
}

export async function createSchemeEntry(payload: {
  title: string;
  category: string;
  description: string;
}): Promise<PublicationSchemeEntry> {
  const { data } = await djangoClient.post<PublicationSchemeEntry>(
    "/publications/scheme/",
    payload
  );
  return data;
}

export async function updateSchemeEntry(
  id: number,
  payload: Partial<{ title: string; category: string; description: string }>
): Promise<PublicationSchemeEntry> {
  const { data } = await djangoClient.patch<PublicationSchemeEntry>(
    `/publications/scheme/${id}/`,
    payload
  );
  return data;
}

export async function deleteSchemeEntry(id: number): Promise<void> {
  await djangoClient.delete(`/publications/scheme/${id}/`);
}

/** Refused by the API if the entry has no items — a published entry that
 *  points nowhere reads as information being withheld. */
export async function publishSchemeEntry(
  id: number
): Promise<PublicationSchemeEntry> {
  const { data } = await djangoClient.post<PublicationSchemeEntry>(
    `/publications/scheme/${id}/publish/`
  );
  return data;
}

export async function unpublishSchemeEntry(
  id: number
): Promise<PublicationSchemeEntry> {
  const { data } = await djangoClient.post<PublicationSchemeEntry>(
    `/publications/scheme/${id}/unpublish/`
  );
  return data;
}

export async function createSchemeLink(payload: {
  entry: number;
  label: string;
  url: string;
  sort_order: number;
}): Promise<PublicationSchemeItem> {
  const { data } = await djangoClient.post<PublicationSchemeItem>(
    "/publications/scheme-items/",
    { ...payload, kind: "link" }
  );
  return data;
}

/**
 * Upload a document as a new item.
 *
 * `FormData` rather than JSON, and the content type is left unset on purpose —
 * axios fills in `multipart/form-data` along with the boundary, which cannot be
 * written by hand.
 */
export async function createSchemeDocument(
  entryId: number,
  label: string,
  sortOrder: number,
  file: File
): Promise<PublicationSchemeItem> {
  const body = new FormData();
  body.append("entry", String(entryId));
  body.append("kind", "document");
  body.append("label", label);
  body.append("sort_order", String(sortOrder));
  body.append("document", file);

  const { data } = await djangoClient.post<PublicationSchemeItem>(
    "/publications/scheme-items/",
    body
  );
  return data;
}

export async function updateSchemeItem(
  id: number,
  payload: Partial<{ label: string; url: string; sort_order: number }>
): Promise<PublicationSchemeItem> {
  const { data } = await djangoClient.patch<PublicationSchemeItem>(
    `/publications/scheme-items/${id}/`,
    payload
  );
  return data;
}

/** Deletes the stored file as well as the row — see `publications/signals.py`.
 *  With uploads served straight from an open media root, this is the only way
 *  to take a document back. */
export async function deleteSchemeItem(id: number): Promise<void> {
  await djangoClient.delete(`/publications/scheme-items/${id}/`);
}
