import Link from "next/link";
import PageHeader from "@/components/govuk/PageHeader";
import { getDisclosureLog } from "@/lib/services/publications";
import { fmtDate } from "@/lib/utils";

export default async function DisclosurePage() {
  const entries = await getDisclosureLog();

  return (
    <>
      <PageHeader title="Disclosure log" />

      {entries.length === 0 ? (
        <p className="govuk-body">No entries have been published yet.</p>
      ) : (
        <table className="govuk-table">
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <th scope="col" className="govuk-table__header govuk-!-width-one-quarter">Case</th>
              <th scope="col" className="govuk-table__header">Title</th>
              <th scope="col" className="govuk-table__header">Published</th>
              <th scope="col" className="govuk-table__header">Published by</th>
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {entries.map((entry) => (
              <tr key={entry.id} className="govuk-table__row">
                <td className="govuk-table__cell">
                  <Link href={`/cases/${entry.case_id}`} className="govuk-link foi-mono">
                    {entry.case_ref}
                  </Link>
                </td>
                <td className="govuk-table__cell">{entry.title}</td>
                <td className="govuk-table__cell">
                  {entry.published_at ? fmtDate(entry.published_at) : "—"}
                </td>
                <td className="govuk-table__cell">{entry.published_by_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
