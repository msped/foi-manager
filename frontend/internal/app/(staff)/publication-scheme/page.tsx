import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeader from "@/components/govuk/PageHeader";
import { Tag } from "@/components/ui/Tag";
import { listSchemeEntries } from "@/lib/services/publications";
import { getMe } from "@/lib/services/users";
import { SCHEME_CATEGORIES, type PublicationSchemeEntry } from "@/lib/types";

export const metadata: Metadata = { title: "Publication scheme — FOI Manager" };

/**
 * Every class renders whether or not anything sits under it.
 *
 * The same choice the public page makes, for a different reason. There it tells
 * a visitor we publish nothing in that class; here it tells staff there is a
 * gap to fill, which is most of the maintenance work a section 19 scheme needs.
 */
function CategorySection({
  label,
  entries,
}: {
  label: string;
  entries: PublicationSchemeEntry[];
}) {
  return (
    <section className="govuk-!-margin-bottom-6">
      <h2 className="govuk-heading-m govuk-!-margin-bottom-2">{label}</h2>

      {entries.length === 0 ? (
        <p className="govuk-body govuk-hint">Nothing in this class yet.</p>
      ) : (
        <table className="govuk-table govuk-!-margin-bottom-0">
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <th scope="col" className="govuk-table__header">
                Title
              </th>
              <th scope="col" className="govuk-table__header govuk-!-width-one-quarter">
                Links and files
              </th>
              <th scope="col" className="govuk-table__header govuk-!-width-one-quarter">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {entries.map((entry) => (
              <tr key={entry.id} className="govuk-table__row">
                <td className="govuk-table__cell">
                  <Link
                    href={`/publication-scheme/${entry.id}`}
                    className="govuk-link"
                  >
                    {entry.title}
                  </Link>
                </td>
                <td className="govuk-table__cell">
                  {entry.items.length === 0 ? (
                    // Worth calling out rather than showing a bare zero: an
                    // entry with nothing attached cannot be published, and this
                    // is where someone finds out before they try.
                    <span className="govuk-hint govuk-!-margin-bottom-0">None</span>
                  ) : (
                    entry.items.length
                  )}
                </td>
                <td className="govuk-table__cell">
                  {entry.status === "published" ? (
                    <Tag colour="green">Published</Tag>
                  ) : (
                    <Tag colour="grey">Draft</Tag>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function PublicationSchemePage() {
  const me = await getMe();
  if (me.role !== "foi_team") redirect("/dashboard");

  const entries = await listSchemeEntries().catch(() => []);
  const drafts = entries.filter((e) => e.status === "draft").length;

  return (
    <>
      <PageHeader title="Publication scheme" />

      <p className="govuk-body">
        Information published as a matter of course under section 19 of the Act,
        so nobody has to request it. Drafts are not on the portal and are not
        offered to people writing a request.
      </p>

      {drafts > 0 && (
        <p className="govuk-body">
          <Tag colour="grey">
            {drafts} draft{drafts === 1 ? "" : "s"}
          </Tag>
        </p>
      )}

      <p className="govuk-body">
        <Link
          href="/publication-scheme/new"
          className="govuk-button"
          data-module="govuk-button"
        >
          Add an entry
        </Link>
      </p>

      {SCHEME_CATEGORIES.map((category) => (
        <CategorySection
          key={category.key}
          label={category.label}
          entries={entries.filter((e) => e.category === category.key)}
        />
      ))}
    </>
  );
}
