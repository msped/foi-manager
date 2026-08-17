"use client";

import { useState, useTransition } from "react";
import SummaryCard from "@/components/govuk/SummaryCard";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import { fmtDate } from "@/lib/utils";
import { saveCruAdvice } from "@/lib/services/cases";
import type { CaseCRUAdvice } from "@/lib/types";

interface Props {
  caseId: number;
  advice: CaseCRUAdvice | null;
}

/**
 * CRU advice from the NPCC Central Referral Unit. The referral itself happens
 * outside this system, so every field is entered by hand — a date in
 * "request sent" is what records that a referral was made.
 */
export default function CruAdvicePanel({ caseId, advice }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [requestSentAt, setRequestSentAt] = useState(advice?.request_sent_at ?? "");
  const [receivedAt, setReceivedAt] = useState(advice?.received_at ?? "");
  const [body, setBody] = useState(advice?.advice ?? "");

  const requested = Boolean(advice?.request_sent_at);
  const received = Boolean(advice?.received_at);

  function openEditor() {
    setRequestSentAt(advice?.request_sent_at ?? "");
    setReceivedAt(advice?.received_at ?? "");
    setBody(advice?.advice ?? "");
    setError(null);
    setEditing(true);
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveCruAdvice(caseId, {
          request_sent_at: requestSentAt || null,
          received_at: receivedAt || null,
          advice: body,
        });
        setEditing(false);
        router.refresh();
      } catch (err) {
        const data = (err as { response?: { data?: Record<string, string | string[]> } })
          ?.response?.data;
        const first = data
          ? Object.values(data).flat()[0]
          : undefined;
        setError(first ?? "Could not save CRU advice.");
      }
    });
  }

  return (
    <SummaryCard
      title="CRU advice"
      headingLevel={3}
      actions={requested && (
        received
          ? <Tag colour="green">Received</Tag>
          : <Tag colour="yellow">Awaiting</Tag>
      )}
    >

      {error && <p className="govuk-error-message" style={{ marginBottom: 8 }}>{error}</p>}

      {!editing ? (
        <>
          {!requested && !received && !advice?.advice ? (
            <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
              No referral to the NPCC Central Referral Unit recorded.
            </p>
          ) : (
            <>
              <dl className="govuk-summary-list govuk-summary-list--no-border govuk-!-margin-bottom-2">
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Request sent</dt>
                  <dd className="govuk-summary-list__value">
                    {advice?.request_sent_at ? fmtDate(advice.request_sent_at) : "—"}
                  </dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Advice received</dt>
                  <dd className="govuk-summary-list__value">
                    {advice?.received_at ? fmtDate(advice.received_at) : "—"}
                  </dd>
                </div>
              </dl>
              {advice?.advice && (
                <div
                  className="govuk-body-s"
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "var(--govuk-template-background-colour)",
                    borderLeft: "4px solid var(--govuk-border-colour)",
                    padding: "10px 12px",
                    maxHeight: 420,
                    overflowY: "auto",
                    margin: "0 0 12px",
                    fontSize: 14,
                  }}
                >
                  {advice.advice}
                </div>
              )}
            </>
          )}
          <Button variant="secondary" size="small" disabled={isPending} onClick={openEditor}>
            {requested || received || advice?.advice ? "Update CRU advice" : "Record CRU advice"}
          </Button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <FormField
              label="CRU request sent"
              hint="The date the referral was sent to the NPCC."
              htmlFor="cru-sent"
            >
              <input
                id="cru-sent"
                type="date"
                className="govuk-input govuk-input--width-10"
                value={requestSentAt}
                onChange={e => setRequestSentAt(e.target.value)}
              />
            </FormField>
            <FormField
              label="Advice received"
              hint="Leave blank until the CRU replies."
              htmlFor="cru-received"
            >
              <input
                id="cru-received"
                type="date"
                className="govuk-input govuk-input--width-10"
                value={receivedAt}
                onChange={e => setReceivedAt(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Advice" hint="Paste the advice from the CRU." htmlFor="cru-advice">
            <textarea
              id="cru-advice"
              className="govuk-textarea"
              rows={8}
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </FormField>
          <div style={{ display: "flex", gap: 6 }}>
            <Button type="submit" size="small" disabled={isPending}>Save</Button>
            <Button
              type="button"
              variant="secondary"
              size="small"
              disabled={isPending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </SummaryCard>
  );
}
