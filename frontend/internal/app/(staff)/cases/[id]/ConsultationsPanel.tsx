"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import RichTextEditor from "@/components/ui/RichTextEditor";
import RecipientSearch, { type RecipientResult } from "@/components/ui/RecipientSearch";
import { fmtDate } from "@/lib/utils";
import {
  createConsultation, updateConsultation, sendConsultationMessage,
} from "@/lib/services/cases";
import type { CaseConsultation } from "@/lib/types";

const STATUS_COLOUR: Record<string, "yellow" | "green" | "grey"> = {
  open: "yellow",
  closed: "green",
  withdrawn: "grey",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  withdrawn: "Withdrawn",
};

interface Props {
  caseId: number;
  consultations: CaseConsultation[];
  requestText: string;
  isClosed?: boolean;
}

function ConsultationRow({ c, caseId, isClosed }: { c: CaseConsultation; caseId: number; isClosed?: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msgBody, setMsgBody] = useState("");

  function handleWithdraw() {
    startTransition(async () => {
      try {
        await updateConsultation(caseId, c.id, { status: "withdrawn" });
        router.refresh();
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? "Something went wrong.");
      }
    });
  }

  function handleClose() {
    startTransition(async () => {
      try {
        await updateConsultation(caseId, c.id, { status: "closed" });
        router.refresh();
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? "Something went wrong.");
      }
    });
  }

  function handleSendMessage(e: React.SubmitEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await sendConsultationMessage(c.id, msgBody);
        setMsgBody("");
        router.refresh();
      } catch {
        setError("Failed to send message.");
      }
    });
  }

  const recipientLabel = c.assignee_name
    ? c.assignee_name
    : c.mailbox_name
      ? `${c.mailbox_name} <${c.mailbox_email}>`
      : "Unknown recipient";

  const lastMessage = c.messages.at(-1);
  const hasAssigneeReply = c.status === "open" && lastMessage?.author_role === "assignee";

  return (
    <div className="foi-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Tag colour={STATUS_COLOUR[c.status] ?? "grey"}>
          {STATUS_LABEL[c.status] ?? c.status}
        </Tag>
        {hasAssigneeReply && (
          <Tag colour="green">Reply received</Tag>
        )}
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{recipientLabel}</span>
        {c.due_date && (
          <span className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
            Due {fmtDate(c.due_date)}
          </span>
        )}
        <button
          className="govuk-link govuk-body-s"
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
                  <div className="foi-rich-content govuk-body-s" style={{ marginBottom: 0 }} dangerouslySetInnerHTML={{ __html: m.body }} />
                </div>
              ))}
            </div>
          )}

          {error && <p className="govuk-error-message">{error}</p>}

          {c.status === "open" && !isClosed && c.assignee && (
            <form onSubmit={handleSendMessage} style={{ marginBottom: 10 }}>
              <FormField label="Send message" htmlFor={`msg-${c.id}`}>
                <RichTextEditor
                  value={msgBody}
                  onChange={setMsgBody}
                  placeholder="Type a message…"
                  minHeight={80}
                />
              </FormField>
              <div style={{ display: "flex", gap: 6 }}>
                <Button type="submit" size="small" disabled={isPending || msgBody === "<p></p>" || msgBody.trim() === ""}>
                  {isPending ? "Sending…" : "Send message"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  disabled={isPending}
                  onClick={handleClose}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="warning"
                  size="small"
                  disabled={isPending}
                  onClick={handleWithdraw}
                >
                  Withdraw
                </Button>
              </div>
            </form>
          )}

          {c.status === "open" && !isClosed && !c.assignee && (
            <div style={{ display: "flex", gap: 6 }}>
              <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={isPending}
                onClick={handleClose}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="warning"
                size="small"
                disabled={isPending}
                onClick={handleWithdraw}
              >
                Withdraw
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConsultationsPanel({ caseId, consultations, requestText, isClosed }: Readonly<Props>) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<RecipientResult | null>(null);
  const [scope, setScope] = useState(requestText);
  const [dueDate, setDueDate] = useState("");

  function handleSend(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!recipient) { setError("Select a recipient."); return; }
    if (!scope.trim()) { setError("Scope is required."); return; }

    startTransition(async () => {
      try {
        await createConsultation(caseId, {
          mailbox: recipient.type === "mailbox" ? recipient.data.id : null,
          assignee: recipient.type === "user" ? recipient.data.id : null,
          scope,
          due_date: dueDate || null,
        });
        setShowForm(false);
        setError(null);
        setRecipient(null);
        setScope(requestText);
        setDueDate("");
        router.refresh();
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? "Failed to send consultation.");
      }
    });
  }

  const active = consultations.filter(c => c.status !== "withdrawn");

  return (
    <div className="foi-col">
      <div className="foi-spread">
        <h2 className="govuk-heading-m" style={{ marginBottom: 0 }}>Consultations</h2>
        {!showForm && !isClosed && (
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
        <ConsultationRow key={c.id} c={c} caseId={caseId} isClosed={isClosed} />
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

          <FormField label="Scope" hint="Edit to the specific part of this request you need a response on." htmlFor="cons-scope">
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
              onClick={() => { setShowForm(false); setError(null); setRecipient(null); setScope(requestText); setDueDate(""); }}
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
