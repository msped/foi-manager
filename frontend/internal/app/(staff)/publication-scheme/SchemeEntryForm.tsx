"use client";

import { useActionState, useState } from "react";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import RichTextEditor from "@/components/ui/RichTextEditor";
import {
  SCHEME_CATEGORIES,
  type PublicationSchemeEntry,
  type SchemeCategory,
} from "@/lib/types";
import { createEntryAction, updateEntryAction, type ActionState } from "./actions";

const INITIAL: ActionState = {};

/**
 * Add and edit share this form.
 *
 * The description is a TipTap editor rather than a textarea, so its value lives
 * in React state and rides along in a hidden input — a contenteditable is not a
 * form control and posts nothing on its own.
 */
export default function SchemeEntryForm({
  entry,
}: {
  entry?: PublicationSchemeEntry;
}) {
  const [state, formAction, pending] = useActionState(
    entry ? updateEntryAction : createEntryAction,
    INITIAL
  );
  const [description, setDescription] = useState(entry?.description ?? "");
  const [category, setCategory] = useState<SchemeCategory>(
    entry?.category ?? "who_we_are"
  );

  return (
    <form action={formAction}>
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <input type="hidden" name="description" value={description} />

      {state.error && (
        <div className="govuk-error-summary" tabIndex={-1}>
          <div role="alert">
            <h2 className="govuk-error-summary__title">There is a problem</h2>
            <div className="govuk-error-summary__body">
              <p className="govuk-body">{state.error}</p>
            </div>
          </div>
        </div>
      )}

      <FormField label="Title" htmlFor="title">
        <input
          className="govuk-input"
          id="title"
          name="title"
          type="text"
          maxLength={300}
          defaultValue={entry?.title ?? ""}
        />
      </FormField>

      <FormField
        label="Class of information"
        htmlFor="category"
        hint="The seven classes come from the Information Commissioner's model publication scheme."
      >
        <select
          className="govuk-select"
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as SchemeCategory)}
        >
          {SCHEME_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Description"
        hint="What this information is, in a sentence or two. This is shown on the portal and is used to match the entry against requests people are writing."
      >
        <RichTextEditor
          value={description}
          onChange={setDescription}
          minHeight={140}
        />
      </FormField>

      <div className="foi-row" style={{ gap: 8 }}>
        <Button type="submit" disabled={pending}>
          {entry ? "Save changes" : "Create entry"}
        </Button>
        <Button href="/publication-scheme" variant="secondary">
          Cancel
        </Button>
      </div>
    </form>
  );
}
