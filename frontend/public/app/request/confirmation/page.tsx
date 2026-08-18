import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Request sent",
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  // Reached directly, without having sent anything.
  if (!ref) redirect("/request");

  return (
    <div className="govuk-grid-row">
      <div className="govuk-grid-column-two-thirds">
        <div className="govuk-panel govuk-panel--confirmation">
          <h1 className="govuk-panel__title">Request sent</h1>
          <div className="govuk-panel__body">
            Your reference number
            <br />
            <strong>{ref}</strong>
          </div>
        </div>

        <p className="govuk-body">
          We have emailed you a copy of your request. Keep your reference number
          — you will need it to ask us about your request.
        </p>

        <h2 className="govuk-heading-m">What happens next</h2>

        <p className="govuk-body">
          We must respond within 20 working days of receiving your request. If we
          need to check what you have asked for, we will contact you, and the 20
          working days start again from the date you reply.
        </p>

        <p className="govuk-body">
          If we cannot release some of the information, we will tell you which
          exemption applies and why.
        </p>

        <h2 className="govuk-heading-m">While you wait</h2>

        <p className="govuk-body">
          You may find related information already published in our{" "}
          <Link className="govuk-link" href="/publication-scheme">
            publication scheme
          </Link>{" "}
          or{" "}
          <Link className="govuk-link" href="/disclosure-log">
            disclosure log
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
