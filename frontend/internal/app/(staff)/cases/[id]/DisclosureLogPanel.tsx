"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseDisclosureLogEntry } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { unpublishCaseEntryAction, unrejectCaseEntryAction } from "./actions";

interface Props {
  entry: CaseDisclosureLogEntry;
  caseId: number;
}

export default function DisclosureLogPanel({ entry, caseId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnpublish() {
    setBusy(true);
    setError(null);
    try {
      await unpublishCaseEntryAction(entry.id, caseId);
      router.refresh();
    } catch {
      setError("Failed to unpublish. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnreject() {
    setBusy(true);
    setError(null);
    try {
      await unrejectCaseEntryAction(entry.id, caseId);
      router.refresh();
    } catch {
      setError("Failed to move back to queue. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="foi-card">
      <h3 className="govuk-heading-s">Disclosure log</h3>
      {error && (
        <p className="govuk-error-message" style={{ marginBottom: 8 }}>{error}</p>
      )}
      {entry.status === "published" && (
        <>
          <dl className="govuk-summary-list govuk-summary-list--no-border" style={{ marginBottom: 12 }}>
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Status</dt>
              <dd className="govuk-summary-list__value">
                <Tag colour="green">Published</Tag>
              </dd>
            </div>
            {entry.published_at && (
              <>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Date</dt>
                  <dd className="govuk-summary-list__value">
                    {fmtDate(entry.published_at)}
                  </dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">By</dt>
                  <dd className="govuk-summary-list__value">
                    {entry.published_by_name ?? "—"}
                  </dd>
                </div>
              </>
            )}
          </dl>
          <Button variant="warning" size="small" disabled={busy} onClick={handleUnpublish}>
            {busy ? "Unpublishing…" : "Unpublish"}
          </Button>
        </>
      )}
      {entry.status === "rejected" && (
        <>
          <dl className="govuk-summary-list govuk-summary-list--no-border" style={{ marginBottom: 12 }}>
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Status</dt>
              <dd className="govuk-summary-list__value">
                <Tag colour="red">Not published</Tag>
              </dd>
            </div>
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Reason</dt>
              <dd className="govuk-summary-list__value">{entry.rejection_reason}</dd>
            </div>
            {entry.rejected_at && (
              <div className="govuk-summary-list__row">
                <dt className="govuk-summary-list__key">Decided</dt>
                <dd className="govuk-summary-list__value">
                  {fmtDate(entry.rejected_at)}
                  {entry.rejected_by_name && ` by ${entry.rejected_by_name}`}
                </dd>
              </div>
            )}
          </dl>
          <Button variant="secondary" size="small" disabled={busy} onClick={handleUnreject}>
            {busy ? "Moving…" : "Move back to queue"}
          </Button>
        </>
      )}
      {entry.status === "draft" && (
        <dl className="govuk-summary-list govuk-summary-list--no-border" style={{ marginBottom: 0 }}>
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">Status</dt>
            <dd className="govuk-summary-list__value">
              <Tag colour="yellow">Draft</Tag>
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
