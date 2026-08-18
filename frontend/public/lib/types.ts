/** Types for the public portal. These mirror the `public/` Django endpoints
 *  only — they are intentionally narrower than the internal app's types,
 *  because the public serializers omit casework fields. */

export interface PublicExemption {
  code: string;
  code_display: string;
}

export interface PublicAttachment {
  id: number;
  original_filename: string;
  /** Absolute URL to the file, built by DRF from MEDIA_URL. */
  file: string;
}

export interface DisclosureLogListItem {
  id: number;
  case_ref: string;
  title: string;
  summary: string;
  date_received: string | null;
  date_responded: string | null;
  published_at: string | null;
  exemptions: PublicExemption[];
}

export interface DisclosureLogEntry extends DisclosureLogListItem {
  response_text: string;
  attachments: PublicAttachment[];
}

/** DRF PageNumberPagination envelope. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DisclosureLogFilters {
  exemptions: PublicExemption[];
  years: number[];
}

/** Mirrors `PublicationSchemeEntry.Category` on the backend. */
export type SchemeCategory =
  | "who_we_are"
  | "finances"
  | "priorities"
  | "decisions"
  | "policies"
  | "lists_registers"
  | "services";

export interface PublicationSchemeEntry {
  id: number;
  title: string;
  category: SchemeCategory;
  description: string;
  /** Either a link out or an uploaded document — an entry may have both. */
  url: string;
  document: string | null;
}
