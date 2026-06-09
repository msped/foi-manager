"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { StatusTag, Tag } from "@/components/ui/Tag";
import AiPanel from "@/components/ui/AiPanel";
import ConsultationsPanel from "./ConsultationsPanel";
import CaseResponsesPanel from "./CaseResponsesPanel";
import DisclosureLogPanel from "./DisclosureLogPanel";
import { fmtDate, daysUntil } from "@/lib/utils";
import {
  acknowledgeCase, addCaseNote, assignCase,
  pauseClock, resumeClock, transitionCase,
} from "@/lib/services/cases";
import type { ApiUser, CaseDetail } from "@/lib/types";

const AUDIT_ACTION_LABEL: Record<string, string> = {
  acknowledged: "Case acknowledged",
  status_change: "Status changed",
  clock_paused: "Clock paused",
  clock_resumed: "Clock resumed",
  email_sent: "Email sent",
  consultation_message_sent: "Consultation message sent",
};

function fmtAuditAction(action: string, detail: Record<string, unknown>): string {
  const label = AUDIT_ACTION_LABEL[action] ?? action.replace(/_/g, " ");
  if (action === "status_change") {
    return `${label}: ${detail.from} → ${detail.to}`;
  }
  if (action === "email_sent") {
    const type = String(detail.type ?? "").replace(/_/g, " ");
    return `${label} (${type}) to ${detail.to ?? "unknown"}`;
  }
  return label;
}

const TABS = [
  { id: "overview",      label: "Overview" },
  { id: "consultations", label: "Consultations" },
  { id: "response",      label: "Response" },
  { id: "audit",         label: "Audit" },
];


interface Props {
  c: CaseDetail;
  foiTeam: ApiUser[];
}

export default function CaseDetailView({ c, foiTeam }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const days = daysUntil(c.statutory_deadline);

  const response_sent = c.responses.find(r => r.status === "sent");

  function withAction(fn: () => Promise<void>) {
    setActionError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setActionError(detail ?? "Something went wrong.");
      }
    });
  }

  function handleAddNote(e: React.SubmitEvent) {
    e.preventDefault();
    withAction(async () => {
      await addCaseNote(c.id, noteBody);
      setNoteBody("");
    });
  }

  const activeConsultations = c.consultations.filter(con => con.status !== "withdrawn").length;

  return (
    <>
      <header className="staff-header">
        <div>
          <div className="staff-header-crumbs">
            <Link href="/cases" className="govuk-link">Cases</Link>
            {" · "}
            <span className="foi-mono">{c.ref}</span>
          </div>
          <h1 className="govuk-heading-m" style={{ marginBottom: 0 }}>{c.summary || c.request_text.slice(0, 80)}</h1>
        </div>
        <div className="staff-header-actions">
          <StatusTag status={c.status} />

        </div>
      </header>

      <div className="staff-body">
        <div className="foi-tabs" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`foi-tab-btn${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "consultations" && activeConsultations > 0 && (
                <span className="nav-badge" style={{ marginLeft: 6, background: "rgba(0,0,0,0.12)", color: "inherit" }}>
                  {activeConsultations}
                </span>
              )}
              {t.id === "response" && c.responses.length > 0 && (
                <span className="nav-badge" style={{ marginLeft: 6, background: "rgba(0,0,0,0.12)", color: "inherit" }}>
                  {c.responses.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="foi-grid-2" style={{ alignItems: "start" }}>
          <div>
            {tab === "overview" && (
              <div className="foi-col">
                <div className="foi-card">
                  <h2 className="govuk-heading-s">Request</h2>
                  <p className="govuk-body">{c.request_text}</p>
                  <hr className="govuk-section-break govuk-section-break--s govuk-section-break--visible" />
                  <dl className="govuk-summary-list govuk-summary-list--no-border">
                    <div className="govuk-summary-list__row">
                      <dt className="govuk-summary-list__key">Submitted</dt>
                      <dd className="govuk-summary-list__value">{fmtDate(c.submitted_at)} via {c.received_by}</dd>
                    </div>
                    <div className="govuk-summary-list__row">
                      <dt className="govuk-summary-list__key">Statutory deadline</dt>
                      <dd className="govuk-summary-list__value">{fmtDate(c.statutory_deadline)}</dd>
                    </div>
                    <div className="govuk-summary-list__row">
                      <dt className="govuk-summary-list__key">Requester</dt>
                      <dd className="govuk-summary-list__value">{c.requester_name} · {c.requester_email} · {c.requester_type}</dd>
                    </div>
                    <div className="govuk-summary-list__row">
                      <dt className="govuk-summary-list__key">Assigned to</dt>
                      <dd className="govuk-summary-list__value">
                        {c.assignee_name ?? <span style={{ color: "var(--govuk-secondary-text-colour)" }}>Unassigned</span>}
                      </dd>
                    </div>
                    {c.status !== "closed" && (
                      <div className="govuk-summary-list__row">
                        <dt className="govuk-summary-list__key">Clock</dt>
                        <dd className="govuk-summary-list__value">
                          {c.clock_paused
                            ? <Tag colour="yellow">Paused ({c.clock_paused_days} days)</Tag>
                            : <Tag colour="green">Running</Tag>}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <AiPanel title="Risk & precedent" micro="AI assessment">
                  <p className="govuk-body-s">
                    AI exemption suggestions and precedent search will be available once the AI assistant is connected.
                  </p>
                  <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
                    Any suggestions are advisory only. Apply the public interest test where relevant.
                  </p>
                </AiPanel>

                <div className="foi-card">
                  <h3 className="govuk-heading-s">Internal notes</h3>
                  {c.notes.length === 0
                    ? <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>No notes yet.</p>
                    : c.notes.map(n => (
                      <div key={n.id} style={{ paddingBottom: 10, borderBottom: "1px solid var(--govuk-border-colour)", marginBottom: 10 }}>
                        <div className="govuk-body-s">{n.body}</div>
                        <div style={{ fontSize: 12, color: "var(--govuk-secondary-text-colour)" }}>
                          {n.author_name} · {fmtDate(n.created_at)}
                        </div>
                      </div>
                    ))
                  }
                  {c.status !== "closed" && (
                    <form onSubmit={handleAddNote}>
                      <textarea
                        className="govuk-textarea"
                        rows={2}
                        placeholder="Add a note…"
                        aria-label="Internal note"
                        value={noteBody}
                        onChange={e => setNoteBody(e.target.value)}
                        required
                      />
                      <Button type="submit" variant="secondary" size="small" disabled={isPending} style={{ marginTop: 8 }}>
                        Add note
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {tab === "consultations" && (
              <ConsultationsPanel
                caseId={c.id}
                consultations={c.consultations}
                requestText={c.request_text}
                isClosed={c.status === "closed"}
              />
            )}

            {tab === "response" && (
              <CaseResponsesPanel
                caseId={c.id}
                responses={c.responses}
                isClosed={c.status === "closed"}
                templateVars={{
                  ref: c.ref,
                  requester_name: c.requester_name,
                  requester_email: c.requester_email,
                  submitted_at: fmtDate(c.submitted_at),
                  statutory_deadline: fmtDate(c.statutory_deadline),
                  request_summary: c.summary || c.request_text.slice(0, 200),
                }}
              />
            )}

            {tab === "audit" && (
              <div className="foi-card" style={{ padding: 0 }}>
                <table className="govuk-table" style={{ marginBottom: 0 }}>
                  <thead className="govuk-table__head">
                    <tr className="govuk-table__row">
                      <th className="govuk-table__header" style={{ width: 160 }}>When</th>
                      <th className="govuk-table__header" style={{ width: 160 }}>Who</th>
                      <th className="govuk-table__header">Action</th>
                    </tr>
                  </thead>
                  <tbody className="govuk-table__body">
                    {c.audit_events.length === 0 ? (
                      <tr className="govuk-table__row">
                        <td className="govuk-table__cell" colSpan={3} style={{ textAlign: "center", color: "var(--govuk-secondary-text-colour)", padding: 24 }}>
                          No audit events yet.
                        </td>
                      </tr>
                    ) : c.audit_events.map(e => (
                      <tr key={e.id} className="govuk-table__row">
                        <td className="govuk-table__cell govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
                          {fmtDate(e.timestamp)}
                        </td>
                        <td className="govuk-table__cell govuk-body-s">{e.actor_name ?? "System"}</td>
                        <td className="govuk-table__cell govuk-body-s">{fmtAuditAction(e.action, e.detail)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="foi-col">
            <div className="foi-card">
              <h3 className="govuk-heading-s">Timeline</h3>
              <dl className="govuk-summary-list govuk-summary-list--no-border">
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Received</dt>
                  <dd className="govuk-summary-list__value">{fmtDate(c.submitted_at)}</dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Acknowledged</dt>
                  <dd className="govuk-summary-list__value">
                    {c.acknowledged_at ? fmtDate(c.acknowledged_at) : <Tag colour="grey">Pending</Tag>}
                  </dd>
                </div>
                {response_sent ? '' : <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Due</dt>
                  <dd className="govuk-summary-list__value"><strong>{fmtDate(c.statutory_deadline)}</strong></dd>
                </div>}
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">{c.status === "closed" ? "Response sent" : "Days remaining"}</dt>
                  <dd className="govuk-summary-list__value">
                    {response_sent ? fmtDate(response_sent.sent_at) : days !== null ? (
                      <Tag colour={days < 0 ? "red" : days <= 5 ? "yellow" : "green"}>
                        {days < 0 ? `${-days}d overdue` : `${days}d`}
                      </Tag>
                    ) : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="foi-card">
              <h3 className="govuk-heading-s">Assigned to</h3>
              <select
                className="govuk-select"
                defaultValue={c.assignee ?? ""}
                style={{ width: "100%", marginBottom: 8 }}
                onChange={e => {
                  const val = e.target.value;
                  withAction(() => assignCase(c.id, val ? Number(val) : null));
                }}
              >
                <option value="">— Unassigned —</option>
                {foiTeam.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="foi-card">
              <h3 className="govuk-heading-s">Actions</h3>
              {actionError && <p className="govuk-error-message" style={{ marginBottom: 8 }}>{actionError}</p>}
              <div className="foi-col" style={{ gap: 8 }}>
                {c.status === "new" && (
                  <Button
                    disabled={isPending}
                    onClick={() => withAction(() => acknowledgeCase(c.id))}
                  >
                    Acknowledge receipt
                  </Button>
                )}
                {c.status !== "closed" && (c.clock_paused ? (
                  <Button
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => withAction(() => resumeClock(c.id))}
                  >
                    Resume clock
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => withAction(() => pauseClock(c.id))}
                  >
                    Pause clock
                  </Button>
                ))}

                {c.status === "closed" && (
                  <Button
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => withAction(() => transitionCase(c.id, "internal_review"))}
                  >
                    Start internal review
                  </Button>
                )}
              </div>
            </div>

            {c.disclosure_log_entry && (
              <DisclosureLogPanel entry={c.disclosure_log_entry} caseId={c.id} />
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
