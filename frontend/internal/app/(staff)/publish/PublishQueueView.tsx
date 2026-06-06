"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublishQueueItem, RejectedEntry } from "@/lib/types";
import {
  saveEntryAction,
  publishEntryAction,
  rejectEntryAction,
  unrejectEntryAction,
} from "./actions";
import { fmtDate } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import RichTextEditor from "@/components/ui/RichTextEditor";

type FormState = {
  title: string;
  summary: string;
  response_text: string;
  date_received: string;
  date_responded: string;
  exemption_ids: number[];
  attachment_ids: number[];
};

function toDateString(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

function stripFirstParagraph(html: string): string {
  const end = html.indexOf("</p>");
  if (end === -1) return html;
  return html.slice(end + 4).trimStart();
}

function initialFormState(item: PublishQueueItem): FormState {
  if (item.disclosure_log_entry) {
    const e = item.disclosure_log_entry;
    return {
      title: e.title,
      summary: e.summary,
      response_text: e.response_text,
      date_received: e.date_received,
      date_responded: e.date_responded,
      exemption_ids: e.exemptions,
      attachment_ids: e.attachments,
    };
  }
  return {
    title: item.summary,
    summary: item.request_text,
    response_text: stripFirstParagraph(item.sent_response?.rendered_body ?? ""),
    date_received: toDateString(item.submitted_at),
    date_responded: toDateString(item.sent_response?.sent_at),
    exemption_ids: item.exemptions.map((e) => e.id),
    attachment_ids: [],
  };
}

interface Props {
  queue: PublishQueueItem[];
  rejected: RejectedEntry[];
}

export default function PublishQueueView({ queue, rejected }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"queue" | "rejected">("queue");
  const [selectedRef, setSelectedRef] = useState<string | null>(queue[0]?.ref ?? null);
  const [entryId, setEntryId] = useState<number | null>(
    () => queue[0]?.disclosure_log_entry?.id ?? null
  );
  const [form, setForm] = useState<FormState | null>(
    () => (queue[0] ? initialFormState(queue[0]) : null)
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [unrejecting, setUnrejecting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = queue.find((q) => q.ref === selectedRef) ?? null;

  function selectItem(item: PublishQueueItem) {
    setSelectedRef(item.ref);
    setEntryId(item.disclosure_log_entry?.id ?? null);
    setForm(initialFormState(item));
    setError(null);
    setShowRejectForm(false);
    setRejectReason("");
  }

  function updateForm(patch: Partial<FormState>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : null));
  }

  async function handleSave() {
    if (!selectedItem || !form) return;
    setSaving(true);
    setError(null);
    try {
      const entry = await saveEntryAction({
        case_id: selectedItem.id,
        entry_id: entryId,
        ...form,
      });
      setEntryId(entry.id);
      router.refresh();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!selectedItem || !form) return;
    setPublishing(true);
    setError(null);
    try {
      const entry = await saveEntryAction({
        case_id: selectedItem.id,
        entry_id: entryId,
        ...form,
      });
      await publishEntryAction(entry.id);
      setSelectedRef(null);
      setForm(null);
      setEntryId(null);
      router.refresh();
    } catch {
      setError("Failed to publish. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleReject() {
    if (!selectedItem) return;
    if (!rejectReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setRejecting(true);
    setError(null);
    try {
      await rejectEntryAction(selectedItem.id, entryId, rejectReason.trim());
      setSelectedRef(null);
      setForm(null);
      setEntryId(null);
      setShowRejectForm(false);
      setRejectReason("");
      router.refresh();
    } catch {
      setError("Failed to reject. Please try again.");
    } finally {
      setRejecting(false);
    }
  }

  async function handleUnreject(id: number) {
    setUnrejecting(id);
    try {
      await unrejectEntryAction(id);
      router.refresh();
    } catch {
      setError("Failed to move back to queue. Please try again.");
    } finally {
      setUnrejecting(null);
    }
  }

  const busy = saving || publishing || rejecting;

  return (
    <div>
      <div className="foi-tabs" role="tablist" style={{ marginBottom: 24 }}>
        <button
          role="tab"
          aria-selected={activeTab === "queue"}
          className={`foi-tab-btn${activeTab === "queue" ? " active" : ""}`}
          onClick={() => setActiveTab("queue")}
        >
          Queue
          {queue.length > 0 && (
            <span className="nav-badge" style={{ marginLeft: 6, background: "rgba(0,0,0,0.12)", color: "inherit" }}>
              {queue.length}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "rejected"}
          className={`foi-tab-btn${activeTab === "rejected" ? " active" : ""}`}
          onClick={() => setActiveTab("rejected")}
        >
          Rejected
          {rejected.length > 0 && (
            <span className="nav-badge" style={{ marginLeft: 6, background: "rgba(0,0,0,0.12)", color: "inherit" }}>
              {rejected.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "queue" && (
        queue.length === 0 ? (
          <div className="foi-card" style={{ textAlign: "center", padding: 40 }}>
            <p className="govuk-body">No cases are currently waiting to be published.</p>
          </div>
        ) : (
          <div className="foi-grid-sidebar" style={{ gridTemplateColumns: "300px 1fr" }}>
            {/* Queue list */}
            <div>
              <p
                className="govuk-body-s"
                style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 8 }}
              >
                {queue.length} in queue
              </p>
              <div className="foi-col" style={{ gap: 8 }}>
                {queue.map((item) => (
                  <button
                    key={item.ref}
                    onClick={() => selectItem(item)}
                    style={{
                      textAlign: "left",
                      padding: 14,
                      border:
                        item.ref === selectedRef
                          ? "2px solid #0b0c0c"
                          : "1px solid var(--govuk-border-colour)",
                      background: item.ref === selectedRef ? "#fff" : "#f9f9f9",
                      cursor: "pointer",
                      font: "inherit",
                      color: "inherit",
                      width: "100%",
                    }}
                  >
                    <div className="foi-row" style={{ gap: 6, marginBottom: 6 }}>
                      <span
                        className="foi-mono"
                        style={{ fontSize: 11, color: "var(--govuk-secondary-text-colour)" }}
                      >
                        {item.ref}
                      </span>
                      <Tag colour={item.disclosure_log_entry ? "yellow" : "grey"}>
                        {item.disclosure_log_entry ? "Draft" : "New"}
                      </Tag>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      {item.summary || item.request_text.slice(0, 60)}
                    </div>
                    {item.sent_response?.sent_at && (
                      <div
                        className="govuk-body-s"
                        style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}
                      >
                        Responded {fmtDate(item.sent_response.sent_at)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Detail / form */}
            {selectedItem && form ? (
              <div className="foi-col">
                {error && (
                  <div className="govuk-error-summary" aria-labelledby="error-summary-title" role="alert">
                    <p className="govuk-body" style={{ margin: 0 }}>
                      {error}
                    </p>
                  </div>
                )}

                <div className="foi-card">
                  <div className="foi-spread" style={{ marginBottom: 16 }}>
                    <span
                      className="foi-mono govuk-body-s"
                      style={{ color: "var(--govuk-secondary-text-colour)" }}
                    >
                      {selectedItem.ref}
                    </span>
                    <div className="foi-row">
                      <Button
                        variant="warning"
                        size="small"
                        onClick={() => {
                          setShowRejectForm((v) => !v);
                          setError(null);
                        }}
                        disabled={busy}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={handleSave}
                        disabled={busy}
                      >
                        {saving ? "Saving…" : "Save draft"}
                      </Button>
                      <Button size="small" onClick={handlePublish} disabled={busy}>
                        {publishing ? "Publishing…" : "Publish"}
                      </Button>
                    </div>
                  </div>

                  {showRejectForm && (
                    <div
                      style={{
                        background: "#fff4e6",
                        border: "1px solid #f47738",
                        padding: 16,
                        marginBottom: 16,
                      }}
                    >
                      <div className="govuk-form-group" style={{ marginBottom: 12 }}>
                        <label className="govuk-label govuk-!-font-weight-bold" htmlFor="reject-reason">
                          Reason for not publishing
                        </label>
                        <textarea
                          id="reject-reason"
                          className="govuk-textarea"
                          rows={3}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="e.g. Contains commercially sensitive information"
                        />
                      </div>
                      <div className="foi-row">
                        <Button
                          variant="warning"
                          size="small"
                          onClick={handleReject}
                          disabled={rejecting}
                        >
                          {rejecting ? "Rejecting…" : "Confirm rejection"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setShowRejectForm(false);
                            setRejectReason("");
                            setError(null);
                          }}
                          disabled={rejecting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="govuk-form-group">
                    <label className="govuk-label" htmlFor="dl-title">
                      Title
                    </label>
                    <input
                      id="dl-title"
                      className="govuk-input"
                      value={form.title}
                      onChange={(e) => updateForm({ title: e.target.value })}
                    />
                  </div>

                  <div className="govuk-form-group">
                    <label className="govuk-label" htmlFor="dl-summary">
                      Summary of request
                    </label>
                    <textarea
                      id="dl-summary"
                      className="govuk-textarea"
                      rows={4}
                      value={form.summary}
                      onChange={(e) => updateForm({ summary: e.target.value })}
                    />
                  </div>

                  <div className="govuk-form-group">
                    <label className="govuk-label" htmlFor="dl-response">
                      Response
                    </label>
                    <RichTextEditor
                      value={form.response_text}
                      onChange={(html) => updateForm({ response_text: html })}
                      minHeight={240}
                    />
                  </div>

                  <div className="foi-row" style={{ gap: 24 }}>
                    <div className="govuk-form-group" style={{ flex: 1 }}>
                      <label className="govuk-label" htmlFor="dl-date-received">
                        Date received
                      </label>
                      <input
                        id="dl-date-received"
                        type="date"
                        className="govuk-input"
                        value={form.date_received}
                        onChange={(e) => updateForm({ date_received: e.target.value })}
                      />
                    </div>
                    <div className="govuk-form-group" style={{ flex: 1 }}>
                      <label className="govuk-label" htmlFor="dl-date-responded">
                        Date responded
                      </label>
                      <input
                        id="dl-date-responded"
                        type="date"
                        className="govuk-input"
                        value={form.date_responded}
                        onChange={(e) => updateForm({ date_responded: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {selectedItem.exemptions.length > 0 && (
                  <div className="foi-card">
                    <h3 className="govuk-heading-s">Exemptions to publish</h3>
                    <div className="govuk-checkboxes govuk-checkboxes--small">
                      {selectedItem.exemptions.map((ex) => (
                        <div key={ex.id} className="govuk-checkboxes__item">
                          <input
                            type="checkbox"
                            id={`ex-${ex.id}`}
                            className="govuk-checkboxes__input"
                            checked={form.exemption_ids.includes(ex.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...form.exemption_ids, ex.id]
                                : form.exemption_ids.filter((id) => id !== ex.id);
                              updateForm({ exemption_ids: ids });
                            }}
                          />
                          <label htmlFor={`ex-${ex.id}`} className="govuk-label govuk-checkboxes__label">
                            {ex.code_display}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.documents.length > 0 && (
                  <div className="foi-card">
                    <h3 className="govuk-heading-s">Attachments to publish</h3>
                    <p className="govuk-body-s">Select documents to include in the public disclosure.</p>
                    <div className="govuk-checkboxes govuk-checkboxes--small">
                      {selectedItem.documents.map((doc) => (
                        <div key={doc.id} className="govuk-checkboxes__item">
                          <input
                            type="checkbox"
                            id={`doc-${doc.id}`}
                            className="govuk-checkboxes__input"
                            checked={form.attachment_ids.includes(doc.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...form.attachment_ids, doc.id]
                                : form.attachment_ids.filter((id) => id !== doc.id);
                              updateForm({ attachment_ids: ids });
                            }}
                          />
                          <label htmlFor={`doc-${doc.id}`} className="govuk-label govuk-checkboxes__label">
                            {doc.original_filename}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="foi-card">
                <p className="govuk-body">Select a case from the queue to begin.</p>
              </div>
            )}
          </div>
        )
      )}

      {activeTab === "rejected" && (
        rejected.length === 0 ? (
          <div className="foi-card" style={{ textAlign: "center", padding: 40 }}>
            <p className="govuk-body">No rejected items.</p>
          </div>
        ) : (
          <div className="foi-card" style={{ padding: 0 }}>
            {error && (
              <div className="govuk-error-summary" role="alert" style={{ margin: 16 }}>
                <p className="govuk-body" style={{ margin: 0 }}>{error}</p>
              </div>
            )}
            <table className="govuk-table" style={{ marginBottom: 0 }}>
              <thead className="govuk-table__head">
                <tr className="govuk-table__row">
                  <th className="govuk-table__header" style={{ width: 120 }}>Case</th>
                  <th className="govuk-table__header">Reason</th>
                  <th className="govuk-table__header" style={{ width: 160 }}>Rejected by</th>
                  <th className="govuk-table__header" style={{ width: 120 }}>When</th>
                  <th className="govuk-table__header" style={{ width: 160 }}></th>
                </tr>
              </thead>
              <tbody className="govuk-table__body">
                {rejected.map((item) => (
                  <tr key={item.id} className="govuk-table__row">
                    <td className="govuk-table__cell">
                      <span className="foi-mono govuk-body-s">{item.case_ref}</span>
                      {item.title && (
                        <div className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginTop: 2 }}>
                          {item.title}
                        </div>
                      )}
                    </td>
                    <td className="govuk-table__cell govuk-body-s">{item.rejection_reason}</td>
                    <td className="govuk-table__cell govuk-body-s">{item.rejected_by_name ?? "—"}</td>
                    <td className="govuk-table__cell govuk-body-s">
                      {item.rejected_at ? fmtDate(item.rejected_at) : "—"}
                    </td>
                    <td className="govuk-table__cell">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleUnreject(item.id)}
                        disabled={unrejecting === item.id}
                      >
                        {unrejecting === item.id ? "Moving…" : "Move to queue"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
