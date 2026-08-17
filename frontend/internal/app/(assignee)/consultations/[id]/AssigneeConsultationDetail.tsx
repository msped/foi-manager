"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import SummaryCard from "@/components/govuk/SummaryCard";
import FormField from "@/components/ui/FormField";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { fmtDate } from "@/lib/utils";
import { sendConsultationMessage } from "@/lib/services/cases";
import type { AssigneeConsultation } from "@/lib/types";

interface Props {
  consultation: AssigneeConsultation;
}

export default function AssigneeConsultationDetail({ consultation }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEmpty = body.replace(/<[^>]+>/g, "").trim() === "";

  function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    if (isEmpty) { setError("Message cannot be empty."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await sendConsultationMessage(consultation.id, body);
        setBody("");
        router.refresh();
      } catch {
        setError("Failed to send message. Please try again.");
      }
    });
  }

  const messages = [...consultation.messages].reverse();

  return (
    <>
      {consultation.status === "open" && (
        <SummaryCard title="Reply">
          <form onSubmit={handleSubmit}>
            {error && <p className="govuk-error-message">{error}</p>}
            <FormField label="Send a message" htmlFor="msg-body">
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Type your message…"
                minHeight={120}
                disabled={isPending}
              />
            </FormField>
            <Button type="submit" disabled={isPending || isEmpty}>
              {isPending ? "Sending…" : "Send message"}
            </Button>
          </form>
        </SummaryCard>
      )}

      {consultation.status === "closed" && (
        <div className="govuk-inset-text">
          This consultation has been closed by the FOI team.
        </div>
      )}

      {messages.length === 0 ? (
        <p className="govuk-body">No messages yet.</p>
      ) : (
        <SummaryCard title="Messages">
          {messages.map((m, i) => (
            <div key={m.id}>
              <p className="govuk-body govuk-!-margin-bottom-1">
                <strong>{m.author_name ?? "Unknown"}</strong>{" "}
                <span className="govuk-hint govuk-!-display-inline">
                  {m.author_role === "foi_team" ? "FOI team" : "You"} · {fmtDate(m.created_at)}
                </span>
              </p>
              <div
                className="foi-rich-content"
                dangerouslySetInnerHTML={{ __html: m.body }}
              />
              {i < messages.length - 1 && (
                <hr className="govuk-section-break govuk-section-break--m govuk-section-break--visible" />
              )}
            </div>
          ))}
        </SummaryCard>
      )}
    </>
  );
}
