import djangoClient from "./django";
import type {
  DisclosureLogEntry,
  DisclosureLogListItem,
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
