import djangoClient from "./django";
import type {
  DisclosureLogEntry,
  DisclosureLogFilters,
  DisclosureLogListItem,
  Paginated,
  PublicationSchemeEntry,
} from "@/lib/types";

export interface DisclosureLogQuery {
  search?: string;
  exemption?: string;
  year?: string;
  page?: number;
}

export async function listDisclosureLog(
  query: DisclosureLogQuery = {}
): Promise<Paginated<DisclosureLogListItem>> {
  const { data } = await djangoClient.get<Paginated<DisclosureLogListItem>>(
    "/publications/public/disclosure-log/",
    // Empty strings would send `?search=` and defeat the backend's `.strip()`
    // guard, so drop anything falsy before it reaches the query string.
    {
      params: Object.fromEntries(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== "")
      ),
    }
  );
  return data;
}

export async function getDisclosureLogEntry(
  id: string | number
): Promise<DisclosureLogEntry> {
  const { data } = await djangoClient.get<DisclosureLogEntry>(
    `/publications/public/disclosure-log/${id}/`
  );
  return data;
}

export async function getDisclosureLogFilters(): Promise<DisclosureLogFilters> {
  const { data } = await djangoClient.get<DisclosureLogFilters>(
    "/publications/public/disclosure-log/filters/"
  );
  return data;
}

/**
 * The publication scheme is rendered in full, grouped by category, so it asks
 * for the backend's `max_page_size` in one request rather than paginating.
 * If a scheme ever outgrows that, this needs to page properly.
 *
 * `public/scheme/` rather than `scheme/`. The staff route is the only one that
 * returns drafts and is now closed to anonymous callers entirely; this one is
 * filtered to published entries unconditionally, with no branch that could be
 * got wrong later.
 */
export async function listPublicationScheme(): Promise<PublicationSchemeEntry[]> {
  const { data } = await djangoClient.get<Paginated<PublicationSchemeEntry>>(
    "/publications/public/scheme/",
    { params: { page_size: 200 } }
  );
  return data.results;
}
