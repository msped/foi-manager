"use client";

import { useActionState } from "react";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { fmtDate } from "@/lib/utils";
import type { PublicationSchemeEntry } from "@/lib/types";
import {
  deleteEntryAction,
  publishEntryAction,
  unpublishEntryAction,
  type ActionState,
} from "./actions";

const INITIAL: ActionState = {};

/**
 * Publish, unpublish and delete, with the record of who published it.
 *
 * Publishing can be refused — an entry with no links points nowhere — so this
 * has somewhere to show the reason. Nothing about editing is gated: an entry
 * that is already live can be changed, and those changes are public straight
 * away. The draft state guards the first publication only.
 */
export default function PublishControls({
  entry,
}: {
  entry: PublicationSchemeEntry;
}) {
  const published = entry.status === "published";
  const [state, formAction, pending] = useActionState(
    published ? unpublishEntryAction : publishEntryAction,
    INITIAL
  );

  return (
    <section className="foi-card govuk-!-margin-top-6">
      <div className="foi-spread">
        <h2 className="govuk-heading-m govuk-!-margin-bottom-0">Status</h2>
        {published ? <Tag colour="green">Published</Tag> : <Tag colour="grey">Draft</Tag>}
      </div>

      <p className="govuk-body govuk-!-margin-top-2">
        {published ? (
          <>
            On the portal
            {entry.published_at && <> since {fmtDate(entry.published_at)}</>}
            {entry.published_by_name && <>, published by {entry.published_by_name}</>}
            .
          </>
        ) : (
          <>
            Not on the portal. Drafts are also left out of the suggestions shown
            to people writing a request.
          </>
        )}
      </p>

      {state.error && (
        <p className="govuk-error-message">
          <span className="govuk-visually-hidden">Error:</span> {state.error}
        </p>
      )}

      <div className="foi-row" style={{ gap: 8 }}>
        <form action={formAction}>
          <input type="hidden" name="id" value={entry.id} />
          <Button
            type="submit"
            variant={published ? "secondary" : "primary"}
            disabled={pending}
          >
            {published ? "Unpublish" : "Publish"}
          </Button>
        </form>

        <form action={deleteEntryAction}>
          <input type="hidden" name="id" value={entry.id} />
          <Button type="submit" variant="warning">
            Delete entry
          </Button>
        </form>
      </div>

      <p className="govuk-body-s govuk-hint govuk-!-margin-top-2">
        Deleting an entry removes its uploaded files from storage as well.
      </p>
    </section>
  );
}
