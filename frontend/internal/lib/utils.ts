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
  with_applicant:  { label: "With applicant",   govukColour: "orange" },
  internal_review: { label: "Internal review",  govukColour: "purple" },
  referred:        { label: "Referred to ICO",  govukColour: "pink" },
  published:       { label: "Published",        govukColour: "green" },
  exempt:          { label: "Refused",          govukColour: "red" },
  closed:          { label: "Closed",           govukColour: "grey" },
};
