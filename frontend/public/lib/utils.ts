export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Must match `DisclosureLogPagination.page_size` on the backend. Used to work
 * out how many pages the result set spans, since DRF returns a total count
 * rather than a page count.
 */
export const PAGE_SIZE = 10;
