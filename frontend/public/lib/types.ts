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

/** One of the verified requester's own cases.
 *
 *  Mirrors `PublicTrackedCaseSerializer`. Note what is not here: the response
 *  body, deliberately, and no casework fields at all. `status` and `outcome`
 *  arrive as finished public prose — the backend owns that vocabulary, so
 *  nothing in this app should map or re-word them. */
export interface TrackedCase {
  ref: string;
  request_text: string;
  status: string;
  /** Empty until a response has been sent. */
  outcome: string;
  submitted_at: string;
  /** Null while the clock is paused, when the stored date is knowingly stale. */
  statutory_deadline: string | null;
  clock_paused: boolean;
  is_overdue: boolean;
  /** Set only where the response has been published to the disclosure log. */
  disclosure_log_id: number | null;
}

export interface TrackedCases {
  email: string;
  results: TrackedCase[];
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
