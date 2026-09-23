"use client";

import { useActionState, useState } from "react";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import { Tag } from "@/components/ui/Tag";
import type { PublicationSchemeItem } from "@/lib/types";
import { addItemAction, deleteItemAction, type ActionState } from "./actions";

const INITIAL: ActionState = {};

/**
 * The links and files under one entry.
 *
 * An entry routinely carries a dozen of these — spending data published
 * monthly, accounts and salaries annually — which is the reason they are their
 * own records rather than one link and one file on the entry.
 *
 * There is no reordering. New items land at the bottom, and the list renders in
 * the order they were added; if that turns out to be wrong often enough to
 * matter, `sort_order` is already there to drive it.
 */
export default function SchemeItemsPanel({
  entryId,
  items,
}: {
  entryId: number;
  items: PublicationSchemeItem[];
}) {
  const [state, formAction, pending] = useActionState(addItemAction, INITIAL);
  const [kind, setKind] = useState<"link" | "document">("link");

  // The first item may go unlabelled — it is shown under the entry's own title,
  // which reads correctly while it is the only one. A second unlabelled item
  // would give the entry two identical links.
  const labelRequired = items.length > 0;

  return (
    <section className="foi-card govuk-!-margin-top-6">
      <h2 className="govuk-heading-m">Links and files</h2>

      {items.length === 0 ? (
        <p className="govuk-body govuk-hint">
          Nothing added yet. An entry needs at least one link or file before it
          can be published.
        </p>
      ) : (
        <table className="govuk-table">
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <th scope="col" className="govuk-table__header">
                Label
              </th>
              <th scope="col" className="govuk-table__header">
                Points at
              </th>
              <th scope="col" className="govuk-table__header govuk-!-width-one-quarter">
                <span className="govuk-visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {items.map((item) => (
              <tr key={item.id} className="govuk-table__row">
                <td className="govuk-table__cell">
                  {item.display_label}{" "}
                  <Tag colour={item.kind === "document" ? "blue" : "grey"}>
                    {item.kind === "document" ? "File" : "Link"}
                  </Tag>
                </td>
                <td className="govuk-table__cell">
                  <a
                    className="govuk-link"
                    href={item.kind === "link" ? item.url : (item.document ?? "#")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.kind === "link" ? item.url : item.filename}
                  </a>
                </td>
                <td className="govuk-table__cell">
                  {/* A plain form post rather than a confirm dialog. Deleting
                      an item also deletes the stored file, which is the only
                      way to withdraw a document — so the wording says so. */}
                  <form action={deleteItemAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="entry" value={entryId} />
                    <Button type="submit" variant="warning" size="small">
                      Remove
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {items.some((i) => i.kind === "document") && (
        <p className="govuk-body-s govuk-hint">
          Removing a file deletes it from storage. That is the only way to take a
          document off the internet once it has been uploaded — unpublishing the
          entry does not do it.
        </p>
      )}

      <h3 className="govuk-heading-s">Add a link or a file</h3>

      {state.error && (
        <p className="govuk-error-message">
          <span className="govuk-visually-hidden">Error:</span> {state.error}
        </p>
      )}

      {/* No encType. React sets it on a form whose action is a function, and
          setting it here is an error rather than a redundancy. Server action
          forms always post as FormData, which is what makes the file input
          below arrive as a File. */}
      <form action={formAction}>
        <input type="hidden" name="entry" value={entryId} />
        <input type="hidden" name="sort_order" value={items.length} />
        {/* Separate from `sort_order` even though both derive from the count
            today. They answer different questions, and if reordering ever
            lands, sort_order stops being the number of items. */}
        {labelRequired && <input type="hidden" name="has_items" value="1" />}

        <div className="govuk-radios govuk-radios--inline" data-module="govuk-radios">
          {(["link", "document"] as const).map((option) => (
            <div className="govuk-radios__item" key={option}>
              <input
                className="govuk-radios__input"
                id={`kind-${option}`}
                name="kind"
                type="radio"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
              />
              <label className="govuk-label govuk-radios__label" htmlFor={`kind-${option}`}>
                {option === "link" ? "A web page" : "Upload a file"}
              </label>
            </div>
          ))}
        </div>

        <FormField
          label={labelRequired ? "Label" : "Label (optional)"}
          htmlFor="label"
          hint={
            labelRequired
              ? "What this is called on the portal, like 'Annual accounts 2024 to 2025'. Required, because this entry already has an item and unlabelled ones are all shown under the entry's title."
              : "What this is called on the portal, like 'Annual accounts 2024 to 2025'. Leave blank to use the entry title."
          }
        >
          <input
            className="govuk-input"
            id="label"
            name="label"
            type="text"
            maxLength={300}
            required={labelRequired}
          />
        </FormField>

        {kind === "link" ? (
          <FormField label="Web address" htmlFor="url">
            <input
              className="govuk-input"
              id="url"
              name="url"
              type="url"
              placeholder="https://"
            />
          </FormField>
        ) : (
          <FormField
            label="File"
            htmlFor="document"
            hint="Uploaded files are published at an address nobody can guess, but they are not behind a login. Do not upload anything that should not be public."
          >
            <input
              className="govuk-file-upload"
              id="document"
              name="document"
              type="file"
            />
          </FormField>
        )}

        <Button type="submit" variant="secondary" disabled={pending}>
          Add
        </Button>
      </form>
    </section>
  );
}
