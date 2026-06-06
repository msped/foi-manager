import Link from "next/link";
import { getDisclosureLog } from "@/lib/services/publications";
import { fmtDate } from "@/lib/utils";

export default async function DisclosurePage() {
  const entries = await getDisclosureLog();

  return (
    <>
      <header className="staff-header">
        <h1 className="govuk-heading-l">Disclosure log</h1>
      </header>
      <div className="staff-body">
        {entries.length === 0 ? (
          <div className="foi-card" style={{ textAlign: "center", padding: 40 }}>
            <p className="govuk-body">No entries have been published yet.</p>
          </div>
        ) : (
          <div className="foi-card" style={{ padding: 0 }}>
            <table className="govuk-table" style={{ marginBottom: 0 }}>
              <thead className="govuk-table__head">
                <tr className="govuk-table__row">
                  <th className="govuk-table__header" style={{ width: 120 }}>Case</th>
                  <th className="govuk-table__header">Title</th>
                  <th className="govuk-table__header" style={{ width: 160 }}>Published</th>
                  <th className="govuk-table__header" style={{ width: 180 }}>Published by</th>
                </tr>
              </thead>
              <tbody className="govuk-table__body">
                {entries.map((entry) => (
                  <tr key={entry.id} className="govuk-table__row">
                    <td className="govuk-table__cell">
                      <Link href={`/cases/${entry.case_id}`} className="govuk-link foi-mono govuk-body-s">
                        {entry.case_ref}
                      </Link>
                    </td>
                    <td className="govuk-table__cell govuk-body-s">{entry.title}</td>
                    <td className="govuk-table__cell govuk-body-s">
                      {entry.published_at ? fmtDate(entry.published_at) : "—"}
                    </td>
                    <td className="govuk-table__cell govuk-body-s">
                      {entry.published_by_name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
