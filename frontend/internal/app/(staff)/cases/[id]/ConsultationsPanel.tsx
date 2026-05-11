"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import { fmtDate } from "@/lib/utils";
import { sendConsultation, reassignConsultation, markConsultationResponded, withdrawConsultation } from "./actions";
import type { CaseConsultation, Department, ApiUser } from "@/lib/types";

const STATUS_COLOUR: Record<string, "yellow" | "green" | "grey"> = {
  pending: "yellow",
  responded: "green",
  withdrawn: "grey",
};

interface Props {
  caseId: number;
  consultations: CaseConsultation[];
  departments: Department[];
  users: ApiUser[];
}

function ConsultationRow({
  c,
  caseId,
  users,
}: {
  c: CaseConsultation;
  caseId: number;
  users: ApiUser[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState(c.response ?? "");

  function handleReassign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await reassignConsultation(caseId, c.id, fd);
      if (result?.error) setError(result.error);
    });
  }

  function handleRespond(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await markConsultationResponded(caseId, c.id, responseText);
      if (result?.error) setError(result.error);
    });
  }

  function handleWithdraw() {
    startTransition(async () => {
      const result = await withdrawConsultation(caseId, c.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--govuk-border-colour)", paddingBottom: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Tag colour={STATUS_COLOUR[c.status] ?? "grey"}>
          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
        </Tag>
        <span className="govuk-body-s" style={{ fontWeight: 600, flex: 1 }}>
          {c.department_name ?? "No department"}
        </span>
        <button
          className="govuk-link govuk-body-s"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? "Hide" : "Details"}
        </button>
      </div>

      <div className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
        {c.assignee_name ?? <em>Unassigned</em>}
        {c.due_date && ` · Due ${fmtDate(c.due_date)}`}
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--govuk-border-colour)" }}>
          <p className="govuk-body-s" style={{ fontWeight: 600, marginBottom: 4 }}>Scope</p>
          <p className="govuk-body-s" style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}>{c.scope}</p>

          {error && <p className="govuk-error-message">{error}</p>}

          {c.status === "pending" && (
            <>
              <form onSubmit={handleReassign} style={{ marginBottom: 10 }}>
                <FormField label="Reassign to" htmlFor={`reassign-${c.id}`}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      id={`reassign-${c.id}`}
                      name="assignee"
                      className="govuk-select"
                      defaultValue={c.assignee ?? ""}
                      style={{ flex: 1 }}
                    >
                      <option value="">— Unassigned —</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.email}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="secondary" size="small" disabled={isPending}>
                      Save
                    </Button>
                  </div>
                </FormField>
              </form>

              <form onSubmit={handleRespond}>
                <FormField label="Response / notes" htmlFor={`response-${c.id}`}>
                  <textarea
                    id={`response-${c.id}`}
                    className="govuk-textarea"
                    rows={3}
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                  />
                </FormField>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button type="submit" size="small" disabled={isPending}>Mark responded</Button>
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
            </>
          )}

          {c.status === "responded" && c.response && (
            <>
              <p className="govuk-body-s" style={{ fontWeight: 600, marginBottom: 4 }}>Response</p>
              <p className="govuk-body-s" style={{ whiteSpace: "pre-wrap" }}>{c.response}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConsultationsPanel({ caseId, consultations, departments, users }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await sendConsultation(caseId, fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setShowForm(false);
        setError(null);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  const active = consultations.filter(c => c.status !== "withdrawn");

  return (
    <div className="foi-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 className="govuk-heading-s" style={{ margin: 0 }}>Consultations</h3>
        {!showForm && (
          <Button variant="secondary" size="small" onClick={() => setShowForm(true)}>
            Send →
          </Button>
        )}
      </div>

      {active.length === 0 && !showForm && (
        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
          No consultations sent.
        </p>
      )}

      {active.map(c => (
        <ConsultationRow key={c.id} c={c} caseId={caseId} users={users} />
      ))}

      {showForm && (
        <form onSubmit={handleSend} style={{ borderTop: active.length > 0 ? "1px solid var(--govuk-border-colour)" : undefined, paddingTop: active.length > 0 ? 12 : 0 }}>
          <p className="govuk-heading-s" style={{ marginBottom: 12 }}>Send consultation</p>
          {error && <p className="govuk-error-message">{error}</p>}

          <FormField label="Department" htmlFor="cons-department">
            <select id="cons-department" name="department" className="govuk-select" defaultValue="">
              <option value="">— Departmental mailbox —</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Assign to person" hint="Optional — leave blank to send to the department mailbox." htmlFor="cons-assignee">
            <select id="cons-assignee" name="assignee" className="govuk-select" defaultValue="">
              <option value="">— Unassigned —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.email}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Scope" hint="What specifically do you need this department to respond to?" htmlFor="cons-scope">
            <textarea id="cons-scope" name="scope" className="govuk-textarea" rows={4} required />
          </FormField>

          <FormField label="Internal deadline" hint="Optional." htmlFor="cons-due-date">
            <input id="cons-due-date" name="due_date" type="date" className="govuk-input govuk-input--width-10" />
          </FormField>

          <div style={{ display: "flex", gap: 8 }}>
            <Button type="submit" size="small" disabled={isPending}>
              {isPending ? "Sending…" : "Send consultation"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => { setShowForm(false); setError(null); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
