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

/** One published response offered to someone part-way through writing a request.
 *
 *  Mirrors `RequestSuggestionSerializer`. Narrower than `DisclosureLogListItem`
 *  on purpose: no exemptions. On a staff panel an exemption code is precedent;
 *  on a card shown to a requester mid-journey it is jargon attached to
 *  something they have not read, and it reads as a warning that their own
 *  request will be refused.
 *
 *  There is no relevance score, and there is not meant to be one — see the note
 *  at the top of `apps/ai_assistant/serializers.py`. */
export interface RequestSuggestion {
  id: number;
  case_ref: string;
  title: string;
  date_responded: string | null;
  /** The published request, cut to about 300 characters. */
  preview: string;
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

/** One thing to go and read, under a scheme entry.
 *
 *  Mirrors `PublicSchemeItemSerializer`. `label` is the backend's
 *  `display_label`, which falls back to the entry's title — so it is never
 *  empty, and a link on the page always has text. */
export interface PublicationSchemeItem {
  id: number;
  kind: "link" | "document";
  label: string;
  url: string;
  document: string | null;
}

export interface PublicationSchemeEntry {
  id: number;
  title: string;
  category: SchemeCategory;
  /** HTML, authored by staff. Sanitise before rendering. */
  description: string;
  /** An entry holds however many links and files make it up — spending data
   *  published monthly accumulates twelve a year under one entry. */
  items: PublicationSchemeItem[];
  published_at: string | null;
  updated_at: string;
}

/** A scheme entry offered to someone part-way through writing a request.
 *
 *  Mirrors `SchemeSuggestionSerializer`. Carries its items, unlike
 *  `RequestSuggestion`, because the scheme has no per-entry page — the links
 *  have to be on the deflection screen or the suggestion goes nowhere. */
export interface SchemeSuggestion {
  id: number;
  title: string;
  category: SchemeCategory;
  category_display: string;
  /** HTML. Sanitise before rendering. */
  description: string;
  items: PublicationSchemeItem[];
}
