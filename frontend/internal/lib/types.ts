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

export type RequesterType = "individual" | "journalist" | "business" | "mp" | "ngo" | "other";

export interface ApiUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "foi_team" | "assignee";
  department: string;
}

export interface Department {
  id: number;
  name: string;
  internal_deadline_days: number;
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
  department_name: string | null;
  assignee_name: string | null;
  submitted_at: string;
  statutory_deadline: string | null;
  is_overdue: boolean;
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
  department: Department | null;
  assignee: number | null;
  assignee_name: string | null;
  submitted_at: string;
  acknowledged_at: string | null;
  statutory_deadline: string | null;
  clock_paused: boolean;
  clock_paused_days: number;
  is_overdue: boolean;
  outcome: string;
  notes: CaseNote[];
  audit_events: CaseAuditEvent[];
}

/** DRF paginated list response */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
