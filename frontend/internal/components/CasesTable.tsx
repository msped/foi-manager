"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusTag, Tag } from "./ui/Tag";
import { fmtDate, daysUntil } from "@/lib/utils";
import type { CaseListItem } from "@/lib/types";

const TABS = [
  { id: "all",        label: "All"        },
  { id: "mine",       label: "Mine"       },
  { id: "unassigned", label: "Unassigned" },
  { id: "review",     label: "In review"  },
  { id: "overdue",    label: "Overdue"    },
];

interface Props {
  cases: CaseListItem[];
  currentUserName: string;
}

export default function CasesTable({ cases, currentUserName }: Props) {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  let filtered = cases;

  if (tab === "mine")       filtered = filtered.filter(c => c.assignee_name === currentUserName);
  if (tab === "unassigned") filtered = filtered.filter(c => !c.assignee_name);
  if (tab === "review")     filtered = filtered.filter(c => c.status === "review");
  if (tab === "overdue")    filtered = filtered.filter(c => c.is_overdue);

  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(c =>
      c.ref.toLowerCase().includes(ql) ||
      c.summary.toLowerCase().includes(ql) ||
      c.requester_name.toLowerCase().includes(ql) ||
      (c.department_name ?? "").toLowerCase().includes(ql)
    );
  }

  const tabCount = (id: string) => {
    if (id === "all")        return cases.length;
    if (id === "mine")       return cases.filter(c => c.assignee_name === currentUserName).length;
    if (id === "unassigned") return cases.filter(c => !c.assignee_name).length;
    if (id === "review")     return cases.filter(c => c.status === "review").length;
    if (id === "overdue")    return cases.filter(c => c.is_overdue).length;
    return 0;
  };

  return (
    <>
      <div className="foi-tabs" role="tablist" style={{ marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`foi-tab-btn${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span
              className="govuk-tag govuk-tag--grey"
              style={{ marginLeft: 8, fontSize: 11, verticalAlign: "middle" }}
            >
              {tabCount(t.id)}
            </span>
          </button>
        ))}
      </div>

      <div className="foi-row" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
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

      <div className="foi-card" style={{ padding: 0 }}>
        <table className="govuk-table" style={{ marginBottom: 0 }}>
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <th className="govuk-table__header" style={{ width: 140 }}>Reference</th>
              <th className="govuk-table__header">Summary</th>
              <th className="govuk-table__header">Department</th>
              <th className="govuk-table__header">Assigned to</th>
              <th className="govuk-table__header">Status</th>
              <th className="govuk-table__header">Deadline</th>
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {filtered.length === 0 ? (
              <tr className="govuk-table__row">
                <td className="govuk-table__cell" colSpan={6} style={{ textAlign: "center", color: "var(--govuk-secondary-text-colour)", padding: 32 }}>
                  No cases match your search.
                </td>
              </tr>
            ) : filtered.map(c => {
              const days = daysUntil(c.statutory_deadline);
              return (
                <tr key={c.id} className="govuk-table__row">
                  <td className="govuk-table__cell">
                    <Link href={`/cases/${c.id}`} className="govuk-link foi-mono">
                      {c.ref}
                    </Link>
                  </td>
                  <td className="govuk-table__cell">
                    <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 14 }}>
                      {c.summary || c.request_text.slice(0, 60) + "…"}
                    </div>
                    <div className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
                      {c.requester_name} · {fmtDate(c.submitted_at)}
                    </div>
                  </td>
                  <td className="govuk-table__cell">
                    {c.department_name
                      ? <Tag colour="grey">{c.department_name}</Tag>
                      : <Tag colour="yellow">No dept</Tag>}
                  </td>
                  <td className="govuk-table__cell">
                    {c.assignee_name
                      ? <span style={{ fontSize: 13 }}>{c.assignee_name}</span>
                      : <Tag colour="orange">Unassigned</Tag>}
                  </td>
                  <td className="govuk-table__cell">
                    <StatusTag status={c.status} />
                  </td>
                  <td className="govuk-table__cell">
                    {days !== null ? (
                      <span style={{ fontSize: 13 }}>
                        {days < 0
                          ? <strong style={{ color: "var(--govuk-error-colour)" }}>{-days}d overdue</strong>
                          : days <= 3
                            ? <strong style={{ color: "#b25800" }}>{days}d left</strong>
                            : `${days}d`}
                        <br />
                        <span style={{ color: "var(--govuk-secondary-text-colour)", fontSize: 12 }}>
                          {fmtDate(c.statutory_deadline)}
                        </span>
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
