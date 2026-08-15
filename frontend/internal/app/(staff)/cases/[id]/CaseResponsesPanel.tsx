"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/ui/RichTextEditor";
import { fmtDate } from "@/lib/utils";
import { createCaseResponse, updateCaseResponse, sendCaseResponse } from "@/lib/services/cases";
import { CARET_SENTINEL, type CaseResponse, type ResponseSeed } from "@/lib/types";

/** Any {{variable}} left in a draft would reach the requester literally. */
function unresolvedVariables(html: string): string[] {
  const found = html.match(/\{\{\s*\w+\s*\}\}/g) ?? [];
  return [...new Set(found)];
}

interface Props {
  caseId: number;
  responses: CaseResponse[];
  seed: ResponseSeed;
  requesterEmail: string;
  isClosed?: boolean;
  onEditorFocus?: (ref: RichTextEditorHandle) => void;
}

export interface CaseResponsesPanelHandle {
  insertContent: (html: string) => void;
}

function ResponseRow({ resp, caseId, onEditorFocus, isClosed, subject, requesterEmail }: {
  resp: CaseResponse;
  caseId: number;
  onEditorFocus?: (ref: RichTextEditorHandle) => void;
  isClosed?: boolean;
  subject: string;
  requesterEmail: string;
}) {
  const router = useRouter();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [expanded, setExpanded] = useState(resp.status === "draft" || resp.status === "sending" || resp.status === "failed");
  const [body, setBody] = useState(resp.body);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const leftover = unresolvedVariables(body);

  function handleExpand() {
    setExpanded(v => {
      if (!v && editorRef.current) onEditorFocus?.(editorRef.current);
      return !v;
    });
  }

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
    setConfirming(false);
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
        <button className="govuk-link govuk-body-s" onClick={handleExpand}>
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
                <RichTextEditor
                  ref={editorRef}
                  value={body}
                  onChange={setBody}
                  minHeight={180}
                  onFocus={() => editorRef.current && onEditorFocus?.(editorRef.current)}
                />
              </div>
              <div className="foi-spread">
                <span style={{ fontSize: 13, color: "var(--govuk-secondary-text-colour)" }}>
                  {saved ? "Saved." : ""}
                </span>
                <div className="foi-row">
                  <Button variant="secondary" size="small" disabled={isPending} onClick={handleSave}>
                    {isPending ? "Saving…" : "Save draft"}
                  </Button>
                  <Button size="small" disabled={isPending} onClick={() => setConfirming(true)}>
                    {resp.status === "failed" ? "Retry send →" : "Send to requester →"}
                  </Button>
                </div>
              </div>

              {confirming && (
                <Modal title="Send response to requester?" onClose={() => setConfirming(false)} width={760}>
                  <dl className="govuk-body-s" style={{ margin: "0 0 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <dt style={{ fontWeight: 600, minWidth: 64 }}>To</dt>
                      <dd style={{ margin: 0 }} className="foi-mono">{requesterEmail}</dd>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <dt style={{ fontWeight: 600, minWidth: 64 }}>Subject</dt>
                      <dd style={{ margin: 0 }}>{subject}</dd>
                    </div>
                  </dl>

                  <div
                    className="foi-rich-content"
                    style={{
                      border: "1px solid var(--govuk-border-colour)",
                      padding: 16,
                      maxHeight: 380,
                      overflowY: "auto",
                      fontSize: 14,
                      marginBottom: 16,
                    }}
                    dangerouslySetInnerHTML={{ __html: body }}
                  />

                  {leftover.length > 0 && (
                    <p className="govuk-error-message">
                      This draft still contains unresolved variables: {leftover.join(", ")}. Remove or
                      replace them before sending.
                    </p>
                  )}

                  <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
                    This is exactly what the requester will receive. Sending cannot be undone.
                  </p>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button variant="secondary" size="small" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                    <Button size="small" disabled={isPending || leftover.length > 0} onClick={handleSend}>
                      Send now →
                    </Button>
                  </div>
                </Modal>
              )}
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

const CaseResponsesPanel = forwardRef<CaseResponsesPanelHandle, Props>(function CaseResponsesPanel(
  { caseId, responses, seed, requesterEmail, isClosed },
  ref,
) {
  const router = useRouter();
  const newDraftEditorRef = useRef<RichTextEditorHandle>(null);
  const activeEditorRef = useRef<RichTextEditorHandle | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Seed the new-draft editor from the case_response template and drop the
  // caret where {{response_body}} was. Runs once the editor has mounted.
  useEffect(() => {
    if (!showForm) return;
    newDraftEditorRef.current?.setContentWithCaret(seed.body, CARET_SENTINEL);
  }, [showForm, seed.body]);

  function handleNewDraft() {
    setError(null);
    setBody(seed.body);
    setShowForm(true);
  }

  useImperativeHandle(ref, () => ({
    insertContent: (html: string) => {
      const target = activeEditorRef.current ?? newDraftEditorRef.current;
      target?.insertContent(html);
    },
  }));

  function handleEditorFocus(editorRef: RichTextEditorHandle) {
    activeEditorRef.current = editorRef;
  }

  function handleCreate(e: React.SubmitEvent<HTMLFormElement>) {
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
            <ResponseRow
              key={r.id}
              resp={r}
              caseId={caseId}
              onEditorFocus={handleEditorFocus}
              isClosed={isClosed}
              subject={seed.subject}
              requesterEmail={requesterEmail}
            />
          ))}
        </div>
      )}

      <div className="foi-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="govuk-heading-s" style={{ margin: 0 }}>
            {drafts.length > 0 ? `Drafts (${drafts.length})` : "Response drafts"}
          </h3>
          {!showForm && !isClosed && (
            <Button variant="secondary" size="small" onClick={handleNewDraft}>
              New draft
            </Button>
          )}
        </div>

        {!seed.template_configured && !isClosed && (
          <div
            className="govuk-body-s"
            style={{
              borderLeft: "4px solid var(--govuk-warning-colour, #f47738)",
              background: "var(--govuk-template-background-colour)",
              padding: "10px 12px",
              marginBottom: 12,
            }}
          >
            No case response template is configured, so new drafts start empty. Set one up in{" "}
            <a className="govuk-link" href="/settings">Settings → Email Templates</a> to pre-fill the
            greeting, appeal rights and sign-off.
          </div>
        )}

        {drafts.length === 0 && !showForm && (
          <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
            No draft responses. Sending to{" "}
            <span className="foi-mono">{requesterEmail}</span>.
          </p>
        )}

        {drafts.map(r => (
          <ResponseRow
            key={r.id}
            resp={r}
            caseId={caseId}
            onEditorFocus={handleEditorFocus}
            isClosed={isClosed}
            subject={seed.subject}
            requesterEmail={requesterEmail}
          />
        ))}

        {showForm && (
          <form onSubmit={handleCreate} style={{ borderTop: drafts.length > 0 ? "1px solid var(--govuk-border-colour)" : undefined, paddingTop: drafts.length > 0 ? 12 : 0 }}>
            {error && <p className="govuk-error-message">{error}</p>}
            <FormField label="Response body" htmlFor="resp-body">
              <RichTextEditor
                ref={newDraftEditorRef}
                value={body}
                onChange={setBody}
                placeholder="Write your response…"
                minHeight={200}
                onFocus={() => newDraftEditorRef.current && handleEditorFocus(newDraftEditorRef.current)}
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
});

export default CaseResponsesPanel;
