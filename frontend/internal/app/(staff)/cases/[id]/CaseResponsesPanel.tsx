"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import { fmtDate } from "@/lib/utils";
import { saveCaseResponseAction, sendCaseResponseAction } from "./actions";
import type { CaseResponse, EmailTemplate } from "@/lib/types";

interface TemplateVars {
  ref: string;
  requester_name: string;
  requester_email: string;
  submitted_at: string;
  statutory_deadline: string;
  request_summary: string;
}

function applyVars(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{ref\}\}/g, vars.ref)
    .replace(/\{\{requester_name\}\}/g, vars.requester_name)
    .replace(/\{\{requester_email\}\}/g, vars.requester_email)
    .replace(/\{\{submitted_at\}\}/g, vars.submitted_at)
    .replace(/\{\{statutory_deadline\}\}/g, vars.statutory_deadline)
    .replace(/\{\{request_summary\}\}/g, vars.request_summary);
}

interface Props {
  caseId: number;
  responses: CaseResponse[];
  emailTemplates: EmailTemplate[];
  templateVars: TemplateVars;
}

function ResponseRow({ resp, caseId }: { resp: CaseResponse; caseId: number }) {
  const [expanded, setExpanded] = useState(resp.status === "draft");
  const [body, setBody] = useState(resp.body);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      const result = await saveCaseResponseAction(caseId, body, resp.id);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSaved(true);
        setError(null);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  function handleSend() {
    if (!confirm(`Send this response to the requester? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await sendCaseResponseAction(caseId, resp.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--govuk-border-colour)", paddingBottom: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Tag colour={resp.status === "sent" ? "green" : "yellow"}>
          {resp.status === "sent" ? "Sent" : "Draft"}
        </Tag>
        <span className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", flex: 1 }}>
          {resp.status === "sent" && resp.sent_at
            ? `Sent ${fmtDate(resp.sent_at)}`
            : `Created ${fmtDate(resp.created_at)}`}
          {resp.created_by_name && ` by ${resp.created_by_name}`}
        </span>
        <button
          className="govuk-link govuk-body-s"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded && (
        <div>
          {error && <p className="govuk-error-message">{error}</p>}
          {resp.status === "draft" ? (
            <>
              <textarea
                className="govuk-textarea"
                rows={8}
                value={body}
                onChange={e => setBody(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div className="foi-spread">
                <span style={{ fontSize: 13, color: "var(--govuk-secondary-text-colour)" }}>
                  {saved ? "Saved." : ""}
                </span>
                <div className="foi-row">
                  <Button variant="secondary" size="small" disabled={isPending} onClick={handleSave}>
                    {isPending ? "Saving…" : "Save draft"}
                  </Button>
                  <Button size="small" disabled={isPending} onClick={handleSend}>
                    Send to requester →
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, margin: 0 }}>
              {resp.body}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function CaseResponsesPanel({ caseId, responses, emailTemplates, templateVars }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(templateId: string) {
    const t = emailTemplates.find(t => String(t.id) === templateId);
    if (t) setBody(applyVars(t.body, templateVars));
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveCaseResponseAction(caseId, body);
      if ("error" in result) {
        setError(result.error);
      } else {
        setShowForm(false);
        setBody("");
        setError(null);
      }
    });
  }

  const drafts = responses.filter(r => r.status === "draft");
  const sent = responses.filter(r => r.status === "sent");

  return (
    <div className="foi-col">
      {sent.length > 0 && (
        <div className="foi-card">
          <h3 className="govuk-heading-s">Sent responses ({sent.length})</h3>
          {sent.map(r => (
            <ResponseRow key={r.id} resp={r} caseId={caseId} />
          ))}
        </div>
      )}

      <div className="foi-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="govuk-heading-s" style={{ margin: 0 }}>
            {drafts.length > 0 ? `Drafts (${drafts.length})` : "Response drafts"}
          </h3>
          {!showForm && (
            <Button variant="secondary" size="small" onClick={() => setShowForm(true)}>
              New draft
            </Button>
          )}
        </div>

        {drafts.length === 0 && !showForm && (
          <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
            No draft responses. Sending to{" "}
            <span className="foi-mono">{templateVars.requester_email}</span>.
          </p>
        )}

        {drafts.map(r => (
          <ResponseRow key={r.id} resp={r} caseId={caseId} />
        ))}

        {showForm && (
          <form onSubmit={handleCreate} style={{ borderTop: drafts.length > 0 ? "1px solid var(--govuk-border-colour)" : undefined, paddingTop: drafts.length > 0 ? 12 : 0 }}>
            {error && <p className="govuk-error-message">{error}</p>}

            {emailTemplates.length > 0 && (
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  className="govuk-select"
                  defaultValue=""
                  style={{ width: "auto" }}
                  onChange={e => applyTemplate(e.target.value)}
                >
                  <option value="">Insert template…</option>
                  {emailTemplates
                    .filter(t => t.type === "response")
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <span className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
                  Templates replace the current draft text.
                </span>
              </div>
            )}

            <FormField label="Response body" htmlFor="resp-body">
              <textarea
                id="resp-body"
                className="govuk-textarea"
                rows={8}
                value={body}
                onChange={e => setBody(e.target.value)}
                required
              />
            </FormField>

            <div style={{ display: "flex", gap: 8 }}>
              <Button type="submit" size="small" disabled={isPending}>
                {isPending ? "Saving…" : "Save draft"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => { setShowForm(false); setError(null); setBody(""); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
