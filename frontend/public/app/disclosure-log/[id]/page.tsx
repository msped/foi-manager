import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import { getDisclosureLogEntry } from "@/lib/services/publications";
import type { DisclosureLogEntry } from "@/lib/types";
import { sanitizeResponseHtml } from "@/lib/sanitize";
import { fmtDate } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

async function fetchEntry(id: string): Promise<DisclosureLogEntry> {
  try {
    return await getDisclosureLogEntry(id);
  } catch {
    // The endpoint only ever returns published entries, so a miss here covers
    // both "no such entry" and "not published" — neither should be confirmed.
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const entry = await getDisclosureLogEntry(id);
    return { title: entry.title || entry.case_ref };
  } catch {
    return { title: "Disclosure log" };
  }
}

export default async function DisclosureLogEntryPage({ params }: Props) {
  const { id } = await params;
  const entry = await fetchEntry(id);
  const responseHtml = sanitizeResponseHtml(entry.response_text);

  return (
    <>
      <Breadcrumbs
        items={[
          { href: "/", text: "Home" },
          { href: "/disclosure-log", text: "Disclosure log" },
          { text: entry.case_ref },
        ]}
      />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <h1 className="govuk-heading-l">
            <span className="govuk-caption-l">{entry.case_ref}</span>
            {entry.title || "Freedom of Information response"}
          </h1>

          {entry.summary && <p className="govuk-body-l">{entry.summary}</p>}

          <dl className="govuk-summary-list">
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Reference</dt>
              <dd className="govuk-summary-list__value">{entry.case_ref}</dd>
            </div>
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Request received</dt>
              <dd className="govuk-summary-list__value">
                {fmtDate(entry.date_received)}
              </dd>
            </div>
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Response sent</dt>
              <dd className="govuk-summary-list__value">
                {fmtDate(entry.date_responded)}
              </dd>
            </div>
            {entry.exemptions.length > 0 && (
              <div className="govuk-summary-list__row">
                <dt className="govuk-summary-list__key">Exemptions applied</dt>
                <dd className="govuk-summary-list__value">
                  <ul className="govuk-list govuk-!-margin-bottom-0">
                    {entry.exemptions.map((e) => (
                      <li key={e.code}>{e.code_display}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>

          <h2 className="govuk-heading-m">Our response</h2>
          {responseHtml ? (
            <div
              className="foi-rich-content"
              // Sanitised server-side in lib/sanitize.ts.
              dangerouslySetInnerHTML={{ __html: responseHtml }}
            />
          ) : (
            <p className="govuk-body">
              The full response is available in the attached documents.
            </p>
          )}

          {entry.attachments.length > 0 && (
            <>
              <h2 className="govuk-heading-m">Documents</h2>
              <ul className="govuk-list">
                {entry.attachments.map((a) => (
                  <li key={a.id}>
                    <a className="govuk-link" href={a.file} download>
                      {a.original_filename}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          <hr className="govuk-section-break govuk-section-break--l govuk-section-break--visible" />

          <p className="govuk-body">
            If this does not answer your question, you can{" "}
            <Link className="govuk-link" href="/request">
              make your own Freedom of Information request
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
