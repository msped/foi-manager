"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import RecipientSearch, { type RecipientResult } from "@/components/ui/RecipientSearch";
import { fmtDate } from "@/lib/utils";
import {
  sendConsultation, withdrawConsultation,
  sendConsultationMessageAction,
} from "./actions";
import type { CaseConsultation } from "@/lib/types";

const STATUS_COLOUR: Record<string, "yellow" | "green" | "grey" | "orange"> = {
  pending: "yellow",
  awaiting_clarification: "orange",
  responded: "green",
  withdrawn: "grey",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  awaiting_clarification: "Awaiting clarification",
  responded: "Responded",
  withdrawn: "Withdrawn",
};

interface Props {
  caseId: number;
  consultations: CaseConsultation[];
}

function ConsultationRow({ c, caseId }: { c: CaseConsultation; caseId: number }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msgBody, setMsgBody] = useState("");

  function handleWithdraw() {
    startTransition(async () => {
      const result = await withdrawConsultation(caseId, c.id);
      if (result?.error) setError(result.error);
    });
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await sendConsultationMessageAction(caseId, c.id, msgBody);
      if (result?.error) setError(result.error);
      else setMsgBody("");
    });
  }

  const recipientLabel = c.assignee_name
    ? c.assignee_name
    : c.mailbox_name
      ? `${c.mailbox_name} <${c.mailbox_email}>`
      : "Unknown recipient";

  return (
    <div className="foi-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Tag colour={STATUS_COLOUR[c.status] ?? "grey"}>
          {STATUS_LABEL[c.status] ?? c.status}
        </Tag>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{recipientLabel}</span>
        {c.due_date && (
          <span className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
            Due {fmtDate(c.due_date)}
          </span>
        )}
        <button
          className="govuk-link govuk-body-s"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--govuk-border-colour, #cecece)" }}>
          <p className="govuk-body-s" style={{ fontWeight: 600, marginBottom: 4 }}>Scope</p>
          <p className="govuk-body-s" style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}>{c.scope}</p>

          {c.messages.length > 0 && (
            <div style={{ borderLeft: "3px solid var(--govuk-border-colour)", paddingLeft: 10, marginBottom: 12 }}>
              {c.messages.map(m => (
                <div key={m.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--govuk-secondary-text-colour)", marginBottom: 2 }}>
                    {m.author_name ?? "Unknown"} · {fmtDate(m.created_at)}
                  </div>
                  <p className="govuk-body-s" style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{m.body}</p>
                </div>
              ))}
            </div>
          )}

          {error && <p className="govuk-error-message">{error}</p>}

          {c.status !== "withdrawn" && c.assignee && (
            <form onSubmit={handleSendMessage} style={{ marginBottom: 10 }}>
              <FormField label="Send message" htmlFor={`msg-${c.id}`}>
                <textarea
                  id={`msg-${c.id}`}
                  className="govuk-textarea"
                  rows={2}
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  placeholder="Type a message…"
                />
              </FormField>
              <div style={{ display: "flex", gap: 6 }}>
                <Button type="submit" size="small" disabled={isPending || !msgBody.trim()}>
                  {isPending ? "Sending…" : "Send message"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  disabled={isPending}
                  onClick={handleWithdraw}
                >
                  Withdraw
                </Button>
              </div>
            </form>
          )}

          {c.status !== "withdrawn" && !c.assignee && (
            <Button
              type="button"
              variant="secondary"
              size="small"
              disabled={isPending}
              onClick={handleWithdraw}
            >
              Withdraw
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConsultationsPanel({ caseId, consultations }: Readonly<Props>) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<RecipientResult | null>(null);
  const [scope, setScope] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!recipient) { setError("Select a recipient."); return; }

    const fd = new FormData();
    if (recipient.type === "mailbox") fd.set("mailbox", String(recipient.data.id));
    else fd.set("assignee", String(recipient.data.id));
    fd.set("scope", scope);
    if (dueDate) fd.set("due_date", dueDate);

    startTransition(async () => {
      const result = await sendConsultation(caseId, fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setShowForm(false);
        setError(null);
        setRecipient(null);
        setScope("");
        setDueDate("");
      }
    });
  }

  const active = consultations.filter(c => c.status !== "withdrawn");

  return (
    <div className="foi-col">
      <div className="foi-spread">
        <h2 className="govuk-heading-m" style={{ marginBottom: 0 }}>Consultations</h2>
        {!showForm && (
          <Button variant="secondary" size="small" onClick={() => setShowForm(true)}>
            Send consultation →
          </Button>
        )}
      </div>

      {active.length === 0 && !showForm && (
        <div className="foi-card">
          <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
            No consultations sent yet. Use this tab to send parts of this request to other departments or named individuals for a response.
          </p>
        </div>
      )}

      {active.map(c => (
        <ConsultationRow key={c.id} c={c} caseId={caseId} />
      ))}

      {showForm && (
        <div className="foi-card">
        <form
          onSubmit={handleSend}
        >
          <p className="govuk-heading-s" style={{ marginBottom: 12 }}>Send consultation</p>
          {error && <p className="govuk-error-message">{error}</p>}

          <FormField label="Recipient" hint="Search for a departmental mailbox or named person." htmlFor="cons-recipient">
            <RecipientSearch onSelect={setRecipient} />
          </FormField>

          <FormField label="Scope" hint="What specifically do you need this party to respond to?" htmlFor="cons-scope">
            <textarea
              id="cons-scope"
              className="govuk-textarea"
              rows={4}
              value={scope}
              onChange={e => setScope(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Internal deadline" hint="Optional." htmlFor="cons-due-date">
            <input
              id="cons-due-date"
              type="date"
              className="govuk-input govuk-input--width-10"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </FormField>

          <div style={{ display: "flex", gap: 8 }}>
            <Button type="submit" size="small" disabled={isPending || !recipient}>
              {isPending ? "Sending…" : "Send consultation"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => { setShowForm(false); setError(null); setRecipient(null); setScope(""); setDueDate(""); }}
            >
              Cancel
            </Button>
          </div>
        </form>
        </div>
      )}
    </div>
  );
}
