import type { CaseStatus } from "./types";

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

/**
 * Statuses where the case is finished — the statutory clock has stopped, so a
 * deadline in the past is history rather than a breach. Mirrors the terminal
 * statuses excluded by `Case.is_overdue` on the backend.
 */
export const TERMINAL_STATUSES: readonly CaseStatus[] = ["exempt", "closed"];

export function isTerminalStatus(status: CaseStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function userInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

interface StatusMeta {
  label: string;
  govukColour: string; // govuk-tag--{colour}
}

export const STATUS_META: Record<CaseStatus, StatusMeta> = {
  new:             { label: "New",              govukColour: "grey" },
  acknowledged:    { label: "Acknowledged",     govukColour: "blue" },
  with_department: { label: "With department",  govukColour: "light-blue" },
  drafting:        { label: "Drafting",         govukColour: "turquoise" },
  review:          { label: "In review",        govukColour: "yellow" },
  with_applicant:  { label: "Awaiting clarification", govukColour: "orange" },
  internal_review: { label: "Internal review",  govukColour: "purple" },
  referred:        { label: "Referred to ICO",  govukColour: "pink" },
  exempt:          { label: "Refused",          govukColour: "red" },
  closed:          { label: "Closed",           govukColour: "grey" },
};
