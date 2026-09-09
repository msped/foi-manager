"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import SummaryCard from "@/components/govuk/SummaryCard";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/ui/RichTextEditor";
import { fmtDate } from "@/lib/utils";
import { createCaseResponse, updateCaseResponse, sendCaseResponse } from "@/lib/services/cases";
import {
  CARET_SENTINEL,
  CASE_OUTCOME_OPTIONS,
  type CaseOutcome,
  type CaseResponse,
  type ResponseSeed,
  type ResponseSeedBlock,
} from "@/lib/types";

/** Any {{variable}} left in a draft would reach the requester literally. */
function unresolvedVariables(html: string): string[] {
  const found = html.match(/\{\{\s*\w+\s*\}\}/g) ?? [];
  return [...new Set(found)];
}

function TemplateRow({ template, onInsert, inserted }: {
  template: ResponseSeedBlock;
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

/**
 * Template blocks for one editor, collapsed until asked for.
 *
 * Lives beside the editor it writes into rather than as a panel-level card, so
 * there is no question of which draft an Insert lands in. The inserted set is
 * advisory and scoped to this editing session — reloading clears it.
 */
function TemplatePicker({ blocks, onInsert }: {
  blocks: ResponseSeedBlock[];
  onInsert: (html: string) => void;
}) {
  const [insertedIds, setInsertedIds] = useState<Set<number>>(new Set());

  if (blocks.length === 0) {
    return (
      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
        No response templates configured. Add them in <a href="/settings" className="govuk-link">Settings</a>.
      </p>
    );
  }

  const suggested = blocks.filter(b => b.suggested);
  const other = blocks.filter(b => !b.suggested);
  const claimedCodes = new Set(suggested.map(b => b.exemption_code));
  const addressedCodes = new Set(
    suggested.filter(b => insertedIds.has(b.id)).map(b => b.exemption_code),
  );

  function insert(block: ResponseSeedBlock) {
    onInsert(block.body);
    setInsertedIds(prev => new Set(prev).add(block.id));
  }

  return (
    <details className="govuk-details" style={{ marginBottom: 8 }}>
      <summary className="govuk-details__summary">
        <span className="govuk-details__summary-text">Insert a template</span>
      </summary>
      <div className="govuk-details__text">
        {suggested.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 className="govuk-body-s" style={{ fontWeight: 700, marginBottom: 2 }}>
              Suggested for this case
            </h4>
            <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", fontSize: 12, marginBottom: 4 }}>
              {addressedCodes.size} of {claimedCodes.size} claimed exemption
              {claimedCodes.size === 1 ? "" : "s"} addressed
            </p>
            <div className="foi-col" style={{ gap: 0 }}>
              {suggested.map(b => (
                <TemplateRow
                  key={b.id}
                  template={b}
                  inserted={insertedIds.has(b.id)}
                  onInsert={() => insert(b)}
                />
              ))}
            </div>
          </div>
        )}
        {other.length > 0 && (
          <div>
            {suggested.length > 0 && (
              <h4 className="govuk-body-s" style={{ fontWeight: 700, marginBottom: 2 }}>
                All templates
              </h4>
            )}
            <div className="foi-col" style={{ gap: 0 }}>
              {other.map(b => (
                <TemplateRow key={b.id} template={b} onInsert={() => insert(b)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

interface Props {
  caseId: number;
  responses: CaseResponse[];
  seed: ResponseSeed;
  requesterEmail: string;
  isClosed?: boolean;
}

function ResponseRow({ resp, caseId, isClosed, subject, requesterEmail, blocks }: {
  resp: CaseResponse;
  caseId: number;
  isClosed?: boolean;
  subject: string;
  requesterEmail: string;
  blocks: ResponseSeedBlock[];
}) {
  const router = useRouter();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [expanded, setExpanded] = useState(resp.status === "draft" || resp.status === "sending" || resp.status === "failed");
  const [body, setBody] = useState(resp.body);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // No default. The outcome becomes the public record of how this request
  // ended and feeds transparency statistics, so it is a decision the officer
  // makes rather than one they accept by not noticing a pre-filled select.
  const [outcome, setOutcome] = useState<CaseOutcome | "">("");
  const leftover = unresolvedVariables(body);

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
    if (!outcome) return;
    setConfirming(false);
    startTransition(async () => {
      try {
        await sendCaseResponse(caseId, resp.id, outcome);
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
        <button className="govuk-link govuk-body-s" onClick={() => setExpanded(v => !v)}>
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
                />
              </div>
              <TemplatePicker
                blocks={blocks}
                onInsert={html => editorRef.current?.insertContent(html)}
              />
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

                  <FormField
                    label="How did this request end?"
                    htmlFor={`outcome-${resp.id}`}
                    hint="Recorded against the case and shown to the requester when they check their request. Used for transparency statistics."
                  >
                    <select
                      id={`outcome-${resp.id}`}
                      className="govuk-select"
                      value={outcome}
                      onChange={e => setOutcome(e.target.value as CaseOutcome | "")}
                    >
                      <option value="">Choose an outcome</option>
                      {CASE_OUTCOME_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FormField>

                  <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
                    This is exactly what the requester will receive. Sending cannot be undone.
                  </p>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button variant="secondary" size="small" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      disabled={isPending || leftover.length > 0 || !outcome}
                      onClick={handleSend}
                    >
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

export default function CaseResponsesPanel({
  caseId, responses, seed, requesterEmail, isClosed,
}: Props) {
  const router = useRouter();
  const newDraftEditorRef = useRef<RichTextEditorHandle>(null);
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
        <SummaryCard title={`Sent responses (${sent.length})`} headingLevel={3}>
          {sent.map(r => (
            <ResponseRow
              key={r.id}
              resp={r}
              caseId={caseId}
              isClosed={isClosed}
              subject={seed.subject}
              requesterEmail={requesterEmail}
              blocks={seed.blocks}
            />
          ))}
        </SummaryCard>
      )}

      <SummaryCard
        title={drafts.length > 0 ? `Drafts (${drafts.length})` : "Response drafts"}
        headingLevel={3}
        actions={!showForm && !isClosed && (
          <Button variant="secondary" size="small" onClick={handleNewDraft}>
            New draft
          </Button>
        )}
      >

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
            isClosed={isClosed}
            subject={seed.subject}
            requesterEmail={requesterEmail}
            blocks={seed.blocks}
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
              />
            </FormField>
            <TemplatePicker
              blocks={seed.blocks}
              onInsert={html => newDraftEditorRef.current?.insertContent(html)}
            />
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
      </SummaryCard>
    </div>
  );
}
