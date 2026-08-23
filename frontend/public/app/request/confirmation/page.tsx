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

        {/* Do not promise an email here. Nothing is sent when a request is
            submitted: the acknowledgement goes out when a member of the FOI
            team picks the case up, which is a deliberate design decision and
            not a delay to apologise for. This page used to claim a copy had
            been emailed, which meant anyone who checked their inbox had reason
            to think the request had failed. */}
        <p className="govuk-body">
          Write down your reference number, or take a copy of this page. We will
          email you at the address you gave us when a member of our team picks
          up your request, and that email will confirm the reference too.
        </p>

        <h2 className="govuk-heading-m">What happens next</h2>

        <p className="govuk-body">
          We must respond within 20 working days of receiving your request —
          that clock started today, not when we get in touch. If we need to
          check what you have asked for, we will contact you, and the 20 working
          days start again from the date you reply.
        </p>

        <p className="govuk-body">
          You can{" "}
          <Link className="govuk-link" href="/track">
            check the progress of your request
          </Link>{" "}
          at any time using the email address you gave us.
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
