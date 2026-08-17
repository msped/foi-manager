"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusTag } from "./ui/Tag";
import { assignCase } from "@/lib/services/cases";
import { fmtDate, daysUntil, isTerminalStatus } from "@/lib/utils";
import type { ApiUser, CaseListItem } from "@/lib/types";

const TABS = [
  { id: "all",        label: "All"        },
  { id: "mine",       label: "Mine"       },
  { id: "unassigned", label: "Unassigned" },
  { id: "review",     label: "In review"  },
  { id: "overdue",    label: "Overdue"    },
];

function userLabel(u: ApiUser): string {
  const name = `${u.first_name} ${u.last_name}`.trim();
  return name || u.email;
}

interface Props {
  cases: CaseListItem[];
  activeTab: string;
  foiTeam?: ApiUser[];
}

export default function CasesTable({ cases, activeTab, foiTeam = [] }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [isPending, startTransition] = useTransition();
  const [assignError, setAssignError] = useState<string | null>(null);
  const canAssign = activeTab === "unassigned" && foiTeam.length > 0;

  function handleAssign(caseId: number, assigneeId: number) {
    setAssignError(null);
    startTransition(async () => {
      try {
        await assignCase(caseId, assigneeId);
        // The case drops out of this tab once it has an owner.
        router.refresh();
      } catch {
        setAssignError("Could not assign the case. Try again.");
      }
    });
  }

  const filtered = q
    ? cases.filter(c => {
        const ql = q.toLowerCase();
        return (
          c.ref.toLowerCase().includes(ql) ||
          c.summary.toLowerCase().includes(ql) ||
          c.requester_name.toLowerCase().includes(ql)
        );
      })
    : cases;

  return (
    <>
      {/*
        Navigation, not a tab widget: each entry changes the `tab` query param
        and refetches on the server, which govuk-frontend's Tabs module cannot
        drive — it only shows and hides panels already in the page.

        It reuses the govuk-tabs classes purely for appearance, so it matches
        the real tabs elsewhere in the service. That is safe because the tab
        styling keys off `.govuk-frontend-supported` on <body>, not off
        `data-module`. No tab ARIA is claimed: this is a nav landmark holding
        ordinary links, with the current one marked by aria-current, and it
        works without JavaScript.
      */}
      <nav className="govuk-tabs" aria-label="Filter cases">
        <h2 className="govuk-tabs__title">Filter</h2>
        <ul className="govuk-tabs__list">
          {TABS.map(t => (
            <li
              key={t.id}
              className={`govuk-tabs__list-item${activeTab === t.id ? " govuk-tabs__list-item--selected" : ""}`}
            >
              <Link
                className="govuk-tabs__tab"
                href={`/cases?tab=${t.id}`}
                aria-current={activeTab === t.id ? "page" : undefined}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {assignError && (
        <p className="govuk-error-message">{assignError}</p>
      )}

      <div className="foi-row govuk-!-margin-bottom-4" style={{ flexWrap: "wrap" }}>
        <input
          className="govuk-input"
          style={{ maxWidth: 360 }}
          placeholder="Search by ref, summary, or requester…"
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label="Search cases"
        />
        <span className="govuk-body-s" style={{ marginLeft: "auto", color: "var(--govuk-secondary-text-colour)", alignSelf: "center" }}>
          {filtered.length} {filtered.length === 1 ? "case" : "cases"}
        </span>
      </div>

      <table className="govuk-table">
        <thead className="govuk-table__head">
          <tr className="govuk-table__row">
            <th scope="col" className="govuk-table__header">Reference</th>
            <th scope="col" className="govuk-table__header">Summary</th>
            <th scope="col" className="govuk-table__header">Status</th>
            <th scope="col" className="govuk-table__header">Assigned</th>
            <th scope="col" className="govuk-table__header">Deadline</th>
          </tr>
        </thead>
        <tbody className="govuk-table__body">
          {filtered.length === 0 ? (
            <tr className="govuk-table__row">
              <td className="govuk-table__cell" colSpan={5}>
                {cases.length === 0 && activeTab === "unassigned"
                  ? "Every open case has an owner."
                  : "No cases match your search."}
              </td>
            </tr>
          ) : filtered.map(c => {
            const days = isTerminalStatus(c.status) ? null : daysUntil(c.statutory_deadline);
            return (
              <tr key={c.id} className="govuk-table__row">
                <td className="govuk-table__cell">
                  <Link href={`/cases/${c.id}`} className="govuk-link foi-mono">
                    {c.ref}
                  </Link>
                </td>
                <td className="govuk-table__cell">
                  <strong>{c.summary || c.request_text.slice(0, 60) + "…"}</strong>
                  <br />
                  <span className="govuk-hint govuk-!-margin-bottom-0">
                    {c.requester_name} · {fmtDate(c.submitted_at)}
                  </span>
                </td>
                <td className="govuk-table__cell">
                  <StatusTag status={c.status} />
                </td>
                <td className="govuk-table__cell">
                  {canAssign && !c.assignee_name ? (
                    <>
                      <label className="govuk-visually-hidden" htmlFor={`assign-${c.id}`}>
                        Assign case {c.ref}
                      </label>
                      <select
                        className="govuk-select"
                        id={`assign-${c.id}`}
                        value=""
                        disabled={isPending}
                        onChange={e => {
                          if (e.target.value) handleAssign(c.id, Number(e.target.value));
                        }}
                      >
                        <option value="">Assign to…</option>
                        {foiTeam.map(u => (
                          <option key={u.id} value={u.id}>{userLabel(u)}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    c.assignee_name ?? <span className="govuk-hint govuk-!-margin-bottom-0">Unassigned</span>
                  )}
                </td>
                <td className="govuk-table__cell">
                  {days !== null ? (
                    <>
                      {days < 0
                        ? <strong className="govuk-error-message govuk-!-margin-bottom-0">{-days} days overdue</strong>
                        : days <= 3
                          ? <strong>{days} days left</strong>
                          : `${days} days`}
                      <br />
                      <span className="govuk-hint govuk-!-margin-bottom-0">
                        {fmtDate(c.statutory_deadline)}
                      </span>
                    </>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
