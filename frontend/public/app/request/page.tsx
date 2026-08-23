import type { Metadata } from "next";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import ContactEmail from "@/components/ContactEmail";
import PostalAddress from "@/components/PostalAddress";
import { contact } from "@/lib/branding";
import RequestForm from "./RequestForm";

export const metadata: Metadata = {
  title: "Make a request",
  description:
    "Ask for recorded information under the Freedom of Information Act 2000.",
};

/**
 * Below the form, and collapsed.
 *
 * Not in the right-hand column, which stays empty: anything beside a form
 * competes with finishing it, and on a narrow screen that column falls below
 * the form anyway. Collapsed rather than open because the people who need it
 * are the minority who cannot use the form, and the rest should not have to
 * read past it.
 *
 * It has to exist somewhere, though. Section 8 makes a request valid if it is
 * in writing — the form is a convenience this service offers, not a condition
 * it may impose.
 */
function OtherWays() {
  // With neither route configured there is nothing to disclose, and an empty
  // "other ways" section is worse than none.
  if (!contact.foiEmail && !contact.postalAddress) return null;

  return (
    <details className="govuk-details">
      <summary className="govuk-details__summary">
        <span className="govuk-details__summary-text">
          Other ways to make a request
        </span>
      </summary>
      <div className="govuk-details__text">
        <p className="govuk-body">
          You do not have to use this form. A Freedom of Information request
          only has to be in writing, so an email or a letter is just as valid
          and we will treat it exactly the same way. The 20 working days run
          from the day we receive it, whichever way you send it.
        </p>

        {contact.foiEmail && (
          <p className="govuk-body">
            Email <ContactEmail email={contact.foiEmail} />.
          </p>
        )}

        {contact.postalAddress && (
          <>
            <p className="govuk-body">Or write to us at:</p>
            <PostalAddress lines={contact.postalAddress} />
          </>
        )}

        <p className="govuk-body govuk-!-margin-bottom-0">
          However you write to us, give us your real name and describe the
          information you want. You do not have to say why you want it.
        </p>
      </div>
    </details>
  );
}

export default function RequestPage() {
  return (
    <>
      <Breadcrumbs items={[{ href: "/", text: "Home" }, { text: "Make a request" }]} />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <RequestForm />
          <OtherWays />
        </div>
      </div>
    </>
  );
}
