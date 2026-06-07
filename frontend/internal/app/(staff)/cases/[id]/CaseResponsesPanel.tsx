"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { fmtDate } from "@/lib/utils";
import { createCaseResponse, updateCaseResponse, sendCaseResponse } from "@/lib/services/cases";
import type { CaseResponse, EmailTemplate } from "@/lib/types";

interface TemplateVars {
  ref: string;
  requester_name: string;
  requester_email: string;
  submitted_at: string;
  statutory_deadline: string;
  request_summary: string;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function applyVars(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{ref\}\}/g, escHtml(vars.ref))
    .replace(/\{\{requester_name\}\}/g, escHtml(vars.requester_name))
    .replace(/\{\{requester_email\}\}/g, escHtml(vars.requester_email))
    .replace(/\{\{submitted_at\}\}/g, escHtml(vars.submitted_at))
    .replace(/\{\{statutory_deadline\}\}/g, escHtml(vars.statutory_deadline))
    .replace(/\{\{request_summary\}\}/g, escHtml(vars.request_summary));
}

interface Props {
  caseId: number;
  responses: CaseResponse[];
  emailTemplates: EmailTemplate[];
  templateVars: TemplateVars;
  isClosed?: boolean;
}

function ResponseRow({ resp, caseId, isClosed }: { resp: CaseResponse; caseId: number; isClosed?: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(resp.status === "draft" || resp.status === "sending" || resp.status === "failed");
  const [body, setBody] = useState(resp.body);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      try {
        await updateCaseResponse(caseId, resp.id, body);
        setSaved(true);
        setError(null);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? "Failed to save.");
      }
    });
  }

  function handleSend() {
    if (!confirm(`Send this response to the requester? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await sendCaseResponse(caseId, resp.id);
        router.refresh();
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? "Failed to send.");
      }
    });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--govuk-border-colour)", paddingBottom: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Tag colour={resp.status === "sent" ? "green" : resp.status === "failed" ? "red" : resp.status === "sending" ? "blue" : "yellow"}>
          {resp.status === "sent" ? "Sent" : resp.status === "failed" ? "Failed" : resp.status === "sending" ? "Sending…" : "Draft"}
        </Tag>
        <span className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", flex: 1 }}>
          {resp.status === "sent" && resp.sent_at
            ? `Sent ${fmtDate(resp.sent_at)}`
            : `Created ${fmtDate(resp.created_at)}`}
          {resp.created_by_name && ` by ${resp.created_by_name}`}
        </span>
        <button
          className="govuk-link govuk-body-s"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded && (
        <div>
          {error && <p className="govuk-error-message">{error}</p>}
          {resp.status === "failed" && (
            <p className="govuk-error-message" style={{ marginBottom: 8 }}>
              Sending failed after multiple attempts. Check your email configuration, then try again.
            </p>
          )}
          {resp.status === "sending" && (
            <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 8 }}>
              This response is queued for sending — please wait.
            </p>
          )}
          {(resp.status === "draft" || resp.status === "failed") && !isClosed ? (
            <>
              <div style={{ marginBottom: 8 }}>
                <RichTextEditor value={body} onChange={setBody} minHeight={180} />
              </div>
              <div className="foi-spread">
                <span style={{ fontSize: 13, color: "var(--govuk-secondary-text-colour)" }}>
                  {saved ? "Saved." : ""}
                </span>
                <div className="foi-row">
                  <Button variant="secondary" size="small" disabled={isPending} onClick={handleSave}>
                    {isPending ? "Saving…" : "Save draft"}
                  </Button>
                  <Button size="small" disabled={isPending} onClick={handleSend}>
                    {resp.status === "failed" ? "Retry send →" : "Send to requester →"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div
              className="foi-rich-content govuk-body-s"
              style={{ fontSize: 14 }}
              dangerouslySetInnerHTML={{ __html: resp.body }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function CaseResponsesPanel({ caseId, responses, emailTemplates, templateVars, isClosed }: Props) {
  const router = useRouter();
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
      try {
        await createCaseResponse(caseId, body);
        setShowForm(false);
        setBody("");
        setError(null);
        router.refresh();
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? "Failed to save draft.");
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
            <ResponseRow key={r.id} resp={r} caseId={caseId} isClosed={isClosed} />
          ))}
        </div>
      )}

      <div className="foi-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="govuk-heading-s" style={{ margin: 0 }}>
            {drafts.length > 0 ? `Drafts (${drafts.length})` : "Response drafts"}
          </h3>
          {!showForm && !isClosed && (
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
          <ResponseRow key={r.id} resp={r} caseId={caseId} isClosed={isClosed} />
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
                    .filter(t => t.type === "requester")
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
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Write your response…"
                minHeight={200}
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
