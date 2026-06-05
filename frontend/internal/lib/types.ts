export type CaseStatus =
  | "new"
  | "acknowledged"
  | "with_department"
  | "drafting"
  | "review"
  | "with_applicant"
  | "internal_review"
  | "referred"
  | "published"
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

export type EmailTemplateType = "consultation" | "requester";

export interface EmailTemplate {
  id: number;
  name: string;
  type: EmailTemplateType;
  description: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
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
}

/** DRF paginated list response */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
