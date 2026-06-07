"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { createCase } from "@/lib/services/cases";

interface Props {
  requesterCategories: { id: number; name: string }[];
}

export default function NewCaseForm({ requesterCategories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const errs: Record<string, string> = {};
    if (!(fd.get("requester_name") as string).trim()) errs.requester_name = "Enter the requester's name";
    if (!(fd.get("requester_email") as string).trim()) errs.requester_email = "Enter the requester's email address";
    if (!(fd.get("request_text") as string).trim()) errs.request_text = "Enter the request text";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setServerError(null);

    const submittedAt = fd.get("submitted_at") as string;
    startTransition(async () => {
      try {
        const result = await createCase({
          requester_name: (fd.get("requester_name") as string).trim(),
          requester_email: (fd.get("requester_email") as string).trim(),
          requester_type: fd.get("requester_type") as string,
          received_by: fd.get("received_by") as string,
          submitted_at: submittedAt || new Date().toISOString().split("T")[0],
          request_text: (fd.get("request_text") as string).trim(),
          summary: (fd.get("summary") as string).trim(),
        });
        router.push(`/cases/${result.id}`);
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setServerError(detail ?? "Failed to create case.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="govuk-error-summary" role="alert">
          <h2 className="govuk-error-summary__title">There is a problem</h2>
          <div className="govuk-error-summary__body">
            <p className="govuk-body">{serverError}</p>
          </div>
        </div>
      )}

      <FormField label="Requester name" htmlFor="requester_name" error={errors.requester_name}>
        <input
          id="requester_name"
          name="requester_name"
          type="text"
          className={`govuk-input${errors.requester_name ? " govuk-input--error" : ""}`}
          autoComplete="off"
        />
      </FormField>

      <FormField label="Requester email" htmlFor="requester_email" error={errors.requester_email}>
        <input
          id="requester_email"
          name="requester_email"
          type="email"
          className={`govuk-input${errors.requester_email ? " govuk-input--error" : ""}`}
          autoComplete="off"
        />
      </FormField>

      <FormField label="Requester type" htmlFor="requester_type">
        <select id="requester_type" name="requester_type" className="govuk-select" defaultValue="">
          <option value="">— Select type —</option>
          {requesterCategories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Received by" htmlFor="received_by">
        <select id="received_by" name="received_by" className="govuk-select" defaultValue="email">
          <option value="email">Email</option>
          <option value="post">Post</option>
          <option value="other">Other</option>
        </select>
      </FormField>

      <FormField
        label="Date received"
        hint="The date the request was actually received — the statutory deadline is calculated from this date."
        htmlFor="submitted_at"
      >
        <input
          id="submitted_at"
          name="submitted_at"
          type="date"
          className="govuk-input govuk-input--width-10"
          defaultValue={today}
          max={today}
        />
      </FormField>

      <FormField
        label="Request text"
        hint="The exact wording of the FOI request."
        htmlFor="request_text"
        error={errors.request_text}
      >
        <textarea
          id="request_text"
          name="request_text"
          className={`govuk-textarea${errors.request_text ? " govuk-textarea--error" : ""}`}
          rows={6}
        />
      </FormField>

      <FormField label="Summary" hint="A brief internal summary (optional)." htmlFor="summary">
        <textarea id="summary" name="summary" className="govuk-textarea" rows={2} />
      </FormField>

      <div className="foi-row" style={{ marginTop: 24 }}>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create case"}
        </Button>
        <Button variant="secondary" href="/cases">Cancel</Button>
      </div>
    </form>
  );
}
