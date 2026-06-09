"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
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
    <div>
      {consultation.status === "open" && (
        <div className="foi-card">
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
        </div>
      )}

      {consultation.status === "closed" && (
        <div className="foi-card">
          <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
            This consultation has been closed by the FOI team.
          </p>
        </div>
      )}

      {messages.length === 0 ? (
        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginTop: 8 }}>
          No messages yet.
        </p>
      ) : (
        <div className="foi-card">
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                paddingBottom: 16,
                marginBottom: 16,
                borderBottom: "1px solid var(--govuk-border-colour, #f0f0f0)",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{m.author_name ?? "Unknown"}</span>
                <span style={{ fontSize: 11, color: "var(--govuk-secondary-text-colour)" }}>
                  {m.author_role === "foi_team" ? "FOI team" : "You"} · {fmtDate(m.created_at)}
                </span>
              </div>
              <div
                className="foi-rich-content govuk-body-s"
                style={{ marginBottom: 0 }}
                dangerouslySetInnerHTML={{ __html: m.body }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
