"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { StatusTag, Tag } from "@/components/ui/Tag";
import AiPanel from "@/components/ui/AiPanel";
import ConsultationsPanel from "./ConsultationsPanel";
import CaseResponsesPanel, { type CaseResponsesPanelHandle } from "./CaseResponsesPanel";
import DisclosureLogPanel from "./DisclosureLogPanel";
import { fmtDate, daysUntil, isTerminalStatus } from "@/lib/utils";
import RichTextEditor from "@/components/ui/RichTextEditor";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import {
  acknowledgeCase, addCaseNote, assignCase,
  pauseClock, resumeClock, transitionCase,
  sendClarificationRequest, receiveClarification,
} from "@/lib/services/cases";
import type { ApiUser, CaseDetail, ResponseSeed } from "@/lib/types";

const AUDIT_ACTION_LABEL: Record<string, string> = {
  acknowledged: "Case acknowledged",
  status_change: "Status changed",
  clock_paused: "Clock paused",
  clock_resumed: "Clock resumed",
  clarification_received: "Clarification received",
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

function TemplateAsideRow({ template, onInsert, inserted }: {
  template: { id: number; name: string; body: string };
  onInsert: () => void;
  inserted?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--govuk-border-colour)", padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {inserted !== undefined && (
          <span
            aria-hidden="true"
            style={{ color: inserted ? "var(--govuk-success-colour, #00703c)" : "var(--govuk-secondary-text-colour)", flexShrink: 0 }}
          >
            {inserted ? "✓" : "○"}
          </span>
        )}
        <span className="govuk-body-s" style={{ flex: 1, fontWeight: 500, margin: 0 }}>{template.name}</span>
        <button className="govuk-link govuk-body-s" onClick={() => setPreview(v => !v)}>
          {preview ? "Hide" : "Preview"}
        </button>
        <button className="govuk-link govuk-body-s" onClick={onInsert}>Insert</button>
      </div>
      {preview && (
        <div
          className="foi-rich-content"
          style={{ marginTop: 8, fontSize: 12, padding: "8px 10px", background: "var(--govuk-template-background-colour)", borderLeft: "3px solid var(--govuk-border-colour)" }}
          dangerouslySetInnerHTML={{ __html: template.body }}
        />
      )}
    </div>
  );
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
  seed: ResponseSeed;
}

export default function CaseDetailView({ c, foiTeam, seed }: Props) {
  const router = useRouter();
  const responsePanelRef = useRef<CaseResponsesPanelHandle>(null);
  const [tab, setTab] = useState("overview");
  const [isPending, startTransition] = useTransition();
  // Advisory only, and scoped to this editing session — reloading clears it.
  const [insertedBlocks, setInsertedBlocks] = useState<Set<number>>(new Set());

  const suggestedBlocks = seed.blocks.filter(b => b.suggested);
  const otherBlocks = seed.blocks.filter(b => !b.suggested);
  const claimedCodes = new Set(suggestedBlocks.map(b => b.exemption_code));
  const addressedCodes = new Set(
    suggestedBlocks.filter(b => insertedBlocks.has(b.id)).map(b => b.exemption_code),
  );

  function insertBlock(block: { id: number; body: string }) {
    responsePanelRef.current?.insertContent(block.body);
    setInsertedBlocks(prev => new Set(prev).add(block.id));
  }
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [showClarificationForm, setShowClarificationForm] = useState(false);
  const [clarificationBody, setClarificationBody] = useState("");
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [clarificationReceivedAt, setClarificationReceivedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [clarificationNotes, setClarificationNotes] = useState("");
  const terminal = isTerminalStatus(c.status);
  const days = terminal ? null : daysUntil(c.statutory_deadline);

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
                ref={responsePanelRef}
                caseId={c.id}
                responses={c.responses}
                isClosed={c.status === "closed"}
                seed={seed}
                requesterEmail={c.requester_email}
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
            {tab === "response" && (
              <div className="foi-card">
                <h3 className="govuk-heading-s">Response templates</h3>
                {seed.blocks.length === 0 ? (
                  <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
                    No templates configured. Add them in <a href="/settings" className="govuk-link">Settings</a>.
                  </p>
                ) : (
                  <>
                    {suggestedBlocks.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <h4 className="govuk-body-s" style={{ fontWeight: 700, marginBottom: 2 }}>
                          Suggested for this case
                        </h4>
                        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", fontSize: 12, marginBottom: 4 }}>
                          {addressedCodes.size} of {claimedCodes.size} claimed exemption
                          {claimedCodes.size === 1 ? "" : "s"} addressed
                        </p>
                        <div className="foi-col" style={{ gap: 0 }}>
                          {suggestedBlocks.map(b => (
                            <TemplateAsideRow
                              key={b.id}
                              template={b}
                              inserted={insertedBlocks.has(b.id)}
                              onInsert={() => insertBlock(b)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {otherBlocks.length > 0 && (
                      <div>
                        {suggestedBlocks.length > 0 && (
                          <h4 className="govuk-body-s" style={{ fontWeight: 700, marginBottom: 2 }}>
                            All templates
                          </h4>
                        )}
                        <div className="foi-col" style={{ gap: 0 }}>
                          {otherBlocks.map(b => (
                            <TemplateAsideRow key={b.id} template={b} onInsert={() => insertBlock(b)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {tab !== "response" && (<>
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
                {response_sent || terminal ? '' : <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Due</dt>
                  <dd className="govuk-summary-list__value"><strong>{fmtDate(c.statutory_deadline)}</strong></dd>
                </div>}
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">
                    {response_sent ? "Response sent" : terminal ? "Closed" : "Days remaining"}
                  </dt>
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
                {c.status !== "closed" && c.status !== "with_applicant" && (c.clock_paused ? (
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

                {c.status !== "closed" && c.status !== "with_applicant" && !showClarificationForm && (
                  <Button
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => setShowClarificationForm(true)}
                  >
                    Send clarification request
                  </Button>
                )}

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

              {showClarificationForm && (
                <Modal
                  title="Send clarification request"
                  onClose={() => { setShowClarificationForm(false); setClarificationBody(""); }}
                  width={820}
                >
                  <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
                    Sending this email will pause the statutory clock and move the case to <strong>Awaiting Clarification</strong>. The clock restarts when you mark the clarification as received.
                  </p>

                  <div style={{ marginBottom: 20 }}>
                    <h3 className="govuk-body-s" style={{ fontWeight: 700, marginBottom: 4 }}>
                      Original request
                      <span style={{ fontWeight: 400, color: "var(--govuk-secondary-text-colour)", marginLeft: 8 }}>
                        {c.ref} · received {fmtDate(c.submitted_at)}
                      </span>
                    </h3>
                    <div
                      className="govuk-body-s"
                      style={{
                        whiteSpace: "pre-wrap",
                        background: "var(--govuk-template-background-colour)",
                        borderLeft: "4px solid var(--govuk-border-colour)",
                        padding: "10px 12px",
                        maxHeight: 200,
                        overflowY: "auto",
                        margin: 0,
                        fontSize: 14,
                      }}
                    >
                      {c.request_text}
                    </div>
                  </div>
                  <form
                    onSubmit={(e: React.SubmitEvent<HTMLFormElement>) => {
                      e.preventDefault();
                      withAction(async () => {
                        await sendClarificationRequest(c.id, clarificationBody);
                        setShowClarificationForm(false);
                        setClarificationBody("");
                      });
                    }}
                  >
                    <FormField label="Message to requester" htmlFor="clarif-body">
                      <RichTextEditor
                        value={clarificationBody}
                        onChange={setClarificationBody}
                        minHeight={240}
                        placeholder="Explain what additional information is needed to process this request…"
                      />
                    </FormField>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button type="submit" disabled={isPending}>Send &amp; pause clock</Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => { setShowClarificationForm(false); setClarificationBody(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Modal>
              )}
            </div>

            {c.status === "with_applicant" && (
              <div className="foi-card">
                <h3 className="govuk-heading-s">Clarification</h3>
                {c.clarification?.sent_at && (
                  <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
                    Request sent {fmtDate(c.clarification.sent_at)}
                  </p>
                )}
                {!showReceiveForm ? (
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={isPending}
                    onClick={() => setShowReceiveForm(true)}
                  >
                    Mark clarification received
                  </Button>
                ) : (
                  <form
                    onSubmit={(e: React.SubmitEvent<HTMLFormElement>) => {
                      e.preventDefault();
                      withAction(async () => {
                        await receiveClarification(c.id, clarificationReceivedAt, clarificationNotes);
                        setShowReceiveForm(false);
                      });
                    }}
                  >
                    <FormField label="Date received" htmlFor="clarif-date">
                      <input
                        id="clarif-date"
                        type="date"
                        className="govuk-input govuk-input--width-10"
                        value={clarificationReceivedAt}
                        onChange={e => setClarificationReceivedAt(e.target.value)}
                        required
                      />
                    </FormField>
                    <FormField label="Clarification notes" hint="What did the requester say?" htmlFor="clarif-notes">
                      <textarea
                        id="clarif-notes"
                        className="govuk-textarea"
                        rows={3}
                        value={clarificationNotes}
                        onChange={e => setClarificationNotes(e.target.value)}
                      />
                    </FormField>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button type="submit" size="small" disabled={isPending}>Confirm &amp; restart clock</Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={() => setShowReceiveForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {c.disclosure_log_entry && (
              <DisclosureLogPanel entry={c.disclosure_log_entry} caseId={c.id} />
            )}
            </>)}
          </aside>
        </div>
      </div>
    </>
  );
}
