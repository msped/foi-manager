"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { StatusTag, Tag } from "@/components/ui/Tag";
import AiPanel from "@/components/ui/AiPanel";
import FormField from "@/components/ui/FormField";
import { fmtDate, daysUntil } from "@/lib/utils";
import type { CaseDetail } from "@/lib/types";

const TABS = [
  { id: "overview",  label: "Overview" },
  { id: "comms",     label: "Communications" },
  { id: "drafting",  label: "Drafting" },
  { id: "audit",     label: "Audit" },
];

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState("overview");
  const [c, setC] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${params.id}`)
      .then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setC)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <>
        <header className="staff-header">
          <div className="staff-header-crumbs">
            <Link href="/cases" className="govuk-link">Cases</Link>
          </div>
          <h1 className="govuk-heading-l">Loading…</h1>
        </header>
        <div className="staff-body">
          <p className="govuk-body" style={{ color: "var(--govuk-secondary-text-colour)" }}>Loading case…</p>
        </div>
      </>
    );
  }

  if (error || !c) {
    return (
      <>
        <header className="staff-header">
          <Link href="/cases" className="govuk-link">← Back to cases</Link>
        </header>
        <div className="staff-body">
          <div className="govuk-error-summary" role="alert">
            <h2 className="govuk-error-summary__title">Could not load case</h2>
            <div className="govuk-error-summary__body">
              <p className="govuk-body">Error {error}. The case may not exist or you may not have permission.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const days = daysUntil(c.statutory_deadline);

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
          <Button variant="secondary" size="small">Save</Button>
          <Button size="small">Open redaction →</Button>
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
                      <dd className="govuk-summary-list__value">{c.requester_name} ({c.requester_type})</dd>
                    </div>
                    <div className="govuk-summary-list__row">
                      <dt className="govuk-summary-list__key">Clock</dt>
                      <dd className="govuk-summary-list__value">
                        {c.clock_paused
                          ? <Tag colour="yellow">Paused ({c.clock_paused_days} days)</Tag>
                          : <Tag colour="green">Running</Tag>}
                      </dd>
                    </div>
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
                  <textarea className="govuk-textarea" rows={2} placeholder="Add a note…" aria-label="Internal note" />
                  <Button variant="secondary" size="small" style={{ marginTop: 8 }}>Add note</Button>
                </div>
              </div>
            )}

            {tab === "comms" && (
              <div className="foi-col">
                <div className="foi-card">
                  <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
                    Email communications will appear here once the email integration is connected.
                  </p>
                </div>
                <div className="foi-card">
                  <h3 className="govuk-heading-s">Reply to applicant</h3>
                  <textarea className="govuk-textarea" rows={4} placeholder="Type your reply…" aria-label="Reply" />
                  <div className="foi-spread" style={{ marginTop: 10 }}>
                    <select className="govuk-select" defaultValue="" style={{ width: "auto" }}>
                      <option value="">Use template…</option>
                      <option>Acknowledgement v3</option>
                      <option>Clarification request</option>
                      <option>Extension notice (s.10)</option>
                    </select>
                    <div className="foi-row">
                      <Button variant="secondary" size="small">Save draft</Button>
                      <Button size="small">Send</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "drafting" && (
              <div className="foi-col">
                <div className="foi-card">
                  <h2 className="govuk-heading-s">Response materials</h2>
                  <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>No documents uploaded yet.</p>
                  <div className="foi-upload-target">Drop files here or click to upload</div>
                </div>
                <div className="foi-card">
                  <h2 className="govuk-heading-s">Response letter</h2>
                  <FormField label="Outcome" htmlFor="outcome">
                    <select className="govuk-select" id="outcome" defaultValue={c.outcome || ""}>
                      <option value="">— Select outcome —</option>
                      <option value="full">Information disclosed in full</option>
                      <option value="partial">Information disclosed in part</option>
                      <option value="exempt">Information withheld</option>
                      <option value="not-held">Information not held</option>
                    </select>
                  </FormField>
                  <FormField label="Letter body" hint="Inserted into the response template." htmlFor="letter">
                    <textarea id="letter" className="govuk-textarea" rows={6} placeholder="Draft your response letter here…" />
                  </FormField>
                  <div className="foi-spread">
                    <Button variant="secondary" size="small">↻ Draft with AI</Button>
                    <div className="foi-row">
                      <Button variant="secondary">Save draft</Button>
                      <Button>Send for review →</Button>
                    </div>
                  </div>
                </div>
              </div>
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
                        <td className="govuk-table__cell govuk-body-s">{e.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="foi-col">
            <div className="foi-card">
              <h3 className="govuk-heading-s">Assignment</h3>
              <dl className="govuk-summary-list govuk-summary-list--no-border">
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Case officer</dt>
                  <dd className="govuk-summary-list__value">{c.assignee_name ?? <Tag colour="orange">Unassigned</Tag>}</dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Department</dt>
                  <dd className="govuk-summary-list__value">{c.department?.name ?? <Tag colour="yellow">Not assigned</Tag>}</dd>
                </div>
              </dl>
            </div>

            <div className="foi-card">
              <h3 className="govuk-heading-s">Timeline</h3>
              <dl className="govuk-summary-list govuk-summary-list--no-border">
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Received</dt>
                  <dd className="govuk-summary-list__value">{fmtDate(c.submitted_at)}</dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Acknowledged</dt>
                  <dd className="govuk-summary-list__value">{c.acknowledged_at ? fmtDate(c.acknowledged_at) : <Tag colour="grey">Pending</Tag>}</dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Due</dt>
                  <dd className="govuk-summary-list__value"><strong>{fmtDate(c.statutory_deadline)}</strong></dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Days remaining</dt>
                  <dd className="govuk-summary-list__value">
                    {days !== null ? (
                      <Tag colour={days < 0 ? "red" : days <= 5 ? "yellow" : "green"}>
                        {days < 0 ? `${-days}d overdue` : `${days}d`}
                      </Tag>
                    ) : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="foi-card">
              <h3 className="govuk-heading-s">Actions</h3>
              <div className="foi-col" style={{ gap: 8 }}>
                {c.status === "new" && <Button>Acknowledge receipt</Button>}
                <Button variant="secondary">Pause clock</Button>
                <Button variant="secondary">Change status</Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
