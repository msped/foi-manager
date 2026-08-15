export type CaseStatus =
  | "new"
  | "acknowledged"
  | "with_department"
  | "drafting"
  | "review"
  | "with_applicant"
  | "internal_review"
  | "referred"
  | "exempt"
  | "closed";

export type RequesterType = string;

export interface ApiUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "foi_team" | "assignee";
  department: string;
  is_active: boolean;
}

export interface Department {
  id: number;
  name: string;
  internal_deadline_days: number;
}

export type BankHolidayCountry = "england" | "wales" | "scotland" | "northern_ireland";

export interface BankHoliday {
  id: number;
  country: BankHolidayCountry;
  name: string;
  date: string;
}

export type ConsultationStatus = "open" | "closed" | "withdrawn";

export interface AssigneeConsultation {
  id: number;
  case_ref: string;
  scope: string;
  status: ConsultationStatus;
  created_at: string;
  messages: ConsultationMessage[];
}

export interface ConsultationMessage {
  id: number;
  author_name: string | null;
  author_role: "foi_team" | "assignee" | null;
  body: string;
  created_at: string;
}

export interface CaseConsultation {
  id: number;
  assignee: number | null;
  assignee_name: string | null;
  mailbox: number | null;
  mailbox_name: string | null;
  mailbox_email: string | null;
  scope: string;
  status: ConsultationStatus;
  due_date: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  messages: ConsultationMessage[];
}

export type CaseResponseStatus = "draft" | "sending" | "sent" | "failed";

export interface CaseResponse {
  id: number;
  body: string;
  status: CaseResponseStatus;
  sent_at: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Mailbox {
  id: number;
  name: string;
  email: string;
}

export type EmailTemplateType = "assignee" | "consultation" | "requester";

export type EmailTemplatePurpose =
  | "acknowledgement"
  | "case_response"
  | "consultation_notification"
  | "consultation_message"
  | "case_assignment"
  | "clarification_request";

export interface ResponseTemplate {
  id: number;
  name: string;
  /** FOIA section this block justifies, e.g. "s40". Blank for general explainers. */
  exemption_code: string;
  body: string;
  created_at: string;
  updated_at: string;
}

/** A response block, pre-rendered by the server for a specific case. */
export interface ResponseSeedBlock {
  id: number;
  name: string;
  exemption_code: string;
  body: string;
  /** True when the case claims this block's exemption. */
  suggested: boolean;
}

/** Base letter + blocks used to seed a new response draft. */
export interface ResponseSeed {
  body: string;
  subject: string;
  template_configured: boolean;
  blocks: ResponseSeedBlock[];
}

/** Marks where the officer's content begins in a seeded draft. Must match
 *  CARET_SENTINEL in backend/apps/cases/email_utils.py. */
export const CARET_SENTINEL = "⟦FOI-CARET⟧";

/** UK FOIA exemption sections. Mirrors CaseExemption.Code in
 *  backend/apps/cases/models.py — statutory, so it does not drift. */
export const EXEMPTION_CODES: { code: string; label: string }[] = [
  { code: "s12", label: "s.12 — Cost of compliance limit" },
  { code: "s14", label: "s.14 — Vexatious or repeated request" },
  { code: "s21", label: "s.21 — Information accessible by other means" },
  { code: "s22", label: "s.22 — Intended for future publication" },
  { code: "s23", label: "s.23 — Information supplied by security bodies" },
  { code: "s24", label: "s.24 — National security" },
  { code: "s26", label: "s.26 — Defence" },
  { code: "s27", label: "s.27 — International relations" },
  { code: "s28", label: "s.28 — Relations within the UK" },
  { code: "s29", label: "s.29 — The economy" },
  { code: "s30", label: "s.30 — Investigations and proceedings" },
  { code: "s31", label: "s.31 — Law enforcement" },
  { code: "s32", label: "s.32 — Court records" },
  { code: "s33", label: "s.33 — Audit functions" },
  { code: "s34", label: "s.34 — Parliamentary privilege" },
  { code: "s35", label: "s.35 — Formulation of government policy" },
  { code: "s36", label: "s.36 — Prejudice to effective conduct of public affairs" },
  { code: "s37", label: "s.37 — Communications with the Crown" },
  { code: "s38", label: "s.38 — Health and safety" },
  { code: "s39", label: "s.39 — Environmental information" },
  { code: "s40", label: "s.40 — Personal information" },
  { code: "s41", label: "s.41 — Information provided in confidence" },
  { code: "s42", label: "s.42 — Legal professional privilege" },
  { code: "s43", label: "s.43 — Commercial interests" },
  { code: "s44", label: "s.44 — Prohibitions on disclosure" },
];

/** Variables available inside response blocks. Mirrors _base_context()
 *  in backend/apps/cases/email_utils.py. {{request_text}} is the requester's
 *  original request, escaped and line-broken for HTML. */
export const RESPONSE_BLOCK_VARIABLES = [
  "ref",
  "requester_name",
  "request_text",
  "submitted_at",
  "statutory_deadline",
  "organisation_name",
  "foi_contact_email",
].map(v => `{{${v}}}`);

export interface CaseClarification {
  id: number;
  sent_at: string | null;
  received_at: string | null;
  notes: string;
}

export interface NotificationPreferences {
  notify_on_case_assignment: boolean;
}

export interface EmailTemplate {
  id: number;
  purpose: EmailTemplatePurpose;
  name: string;
  type: EmailTemplateType;
  description: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplatePurposeInfo {
  purpose: EmailTemplatePurpose;
  label: string;
  description: string;
  type: EmailTemplateType;
  variables: string[];
  template: EmailTemplate | null;
}

export interface Notification {
  id: number;
  message: string;
  link: string;
  read: boolean;
  created_at: string;
}

export interface UserSearchResult {
  id: number;
  email: string;
  full_name: string;
  role: "foi_team" | "assignee";
}

export interface CaseNote {
  id: number;
  body: string;
  author_name: string | null;
  created_at: string;
}

export interface CaseAuditEvent {
  id: number;
  action: string;
  actor_name: string | null;
  detail: Record<string, unknown>;
  timestamp: string;
}

/** Shape returned by CaseListSerializer (flat, minimal) */
export interface CaseListItem {
  id: number;
  ref: string;
  status: CaseStatus;
  requester_name: string;
  requester_type: RequesterType;
  request_text: string;
  summary: string;
  submitted_at: string;
  statutory_deadline: string | null;
  is_overdue: boolean;
  assignee: number | null;
  assignee_name: string | null;
}

export interface CaseDisclosureLogEntry {
  id: number;
  status: "draft" | "published" | "rejected";
  title: string;
  rejection_reason: string;
  published_at: string | null;
  published_by_name: string | null;
  rejected_at: string | null;
  rejected_by_name: string | null;
}

/** Shape returned by CaseDetailSerializer (nested department, notes, audit) */
export interface CaseDetail {
  id: number;
  ref: string;
  status: CaseStatus;
  received_by: string;
  requester_name: string;
  requester_email: string;
  requester_type: RequesterType;
  request_text: string;
  summary: string;
  submitted_at: string;
  acknowledged_at: string | null;
  statutory_deadline: string | null;
  clock_paused: boolean;
  clock_paused_days: number;
  is_overdue: boolean;
  outcome: string;
  assignee: number | null;
  assignee_name: string | null;
  notes: CaseNote[];
  audit_events: CaseAuditEvent[];
  consultations: CaseConsultation[];
  responses: CaseResponse[];
  clarification: CaseClarification | null;
  disclosure_log_entry: CaseDisclosureLogEntry | null;
}

/** DRF paginated list response */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// --- Disclosure log ---

export interface DisclosureLogExemptionBrief {
  id: number;
  code: string;
  code_display: string;
}

export interface DisclosureLogAttachmentBrief {
  id: number;
  original_filename: string;
  is_public: boolean;
}

export interface DisclosureLogEntryDraft {
  id: number;
  title: string;
  summary: string;
  response_text: string;
  date_received: string;
  date_responded: string;
  exemptions: number[];
  attachments: number[];
  status: "draft" | "published" | "rejected";
  published_at: string | null;
}

export interface QueueSentResponse {
  id: number;
  rendered_body: string;
  sent_at: string | null;
}

export interface PublishQueueItem {
  id: number;
  ref: string;
  summary: string;
  request_text: string;
  submitted_at: string;
  sent_response: QueueSentResponse | null;
  exemptions: DisclosureLogExemptionBrief[];
  documents: DisclosureLogAttachmentBrief[];
  disclosure_log_entry: DisclosureLogEntryDraft | null;
}

export interface DisclosureLogEntry {
  id: number;
  case: number;
  case_ref: string;
  title: string;
  summary: string;
  response_text: string;
  date_received: string;
  date_responded: string;
  exemptions: number[];
  exemptions_detail: DisclosureLogExemptionBrief[];
  attachments: number[];
  attachments_detail: DisclosureLogAttachmentBrief[];
  status: "draft" | "published" | "rejected";
  published_by: number | null;
  published_by_name: string | null;
  published_at: string | null;
  rejection_reason: string;
  rejected_by: number | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RejectedEntry {
  id: number;
  case_id: number;
  case_ref: string;
  title: string;
  rejection_reason: string;
  rejected_by_name: string | null;
  rejected_at: string | null;
}

export interface DisclosureLogListItem {
  id: number;
  case_id: number;
  case_ref: string;
  title: string;
  date_responded: string;
  published_by_name: string | null;
  published_at: string | null;
}
