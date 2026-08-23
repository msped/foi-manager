import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import ContactEmail from "@/components/ContactEmail";
import { branding, contact } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How we use the personal information you give us when you make a Freedom of Information request.",
};

/**
 * The one fact this notice needs that cannot be read off the code.
 *
 * Retention comes from the adopting organisation's own retention schedule —
 * there is no sensible default, and guessing would put an unkeepable promise
 * in a document people rely on. Left null, the page says so and warns that the
 * notice is incomplete, which is the state a pre-launch deployment is actually
 * in.
 */
const RETENTION_PERIOD: string | null = null;

/** Everything below is derived from what the service genuinely does. If the
 *  request form, the disclosure log serialiser or the tracking session change
 *  what they collect or publish, this notice has to change with them. */
export default function PrivacyPage() {
  const incomplete = !RETENTION_PERIOD || !contact.dpoEmail || !contact.foiEmail;

  return (
    <>
      <Breadcrumbs
        items={[{ href: "/", text: "Home" }, { text: "Privacy notice" }]}
      />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <h1 className="govuk-heading-xl">Privacy notice</h1>

          <p className="govuk-body-l">
            How {branding.organisationName} uses the personal information you
            give us when you make or check a Freedom of Information request.
          </p>

          {incomplete && (
            <div className="govuk-warning-text">
              <span className="govuk-warning-text__icon" aria-hidden="true">
                !
              </span>
              <strong className="govuk-warning-text__text">
                <span className="govuk-visually-hidden">Warning</span>
                This notice is not finished. Some details specific to this
                organisation have not been filled in yet. It must be completed
                before the service is used by the public.
              </strong>
            </div>
          )}

          <h2 className="govuk-heading-m">Who controls your information</h2>

          <p className="govuk-body">
            {branding.organisationName} is the data controller for the
            information described here. Our data protection officer can be
            contacted at <ContactEmail email={contact.dpoEmail} />.
          </p>

          <h2 className="govuk-heading-m">What we collect</h2>

          <h3 className="govuk-heading-s">When you make a request</h3>

          <ul className="govuk-list govuk-list--bullet">
            <li>your name</li>
            <li>your email address</li>
            <li>the information you have asked us for, in your own words</li>
          </ul>

          <p className="govuk-body">
            The Act requires us to have your real name and an address for
            correspondence before a request is valid, which is why those two
            fields are not optional. We do not ask why you want the information,
            and you do not have to tell us.
          </p>

          <h3 className="govuk-heading-s">When you check a request</h3>

          <ul className="govuk-list govuk-list--bullet">
            <li>your email address</li>
            <li>
              the codes we have sent to it recently, and whether they were used
            </li>
          </ul>

          <p className="govuk-body">
            We keep a short record of recently issued codes because it is what
            stops someone requesting codes for your address over and over. Those
            records are deleted automatically. See our{" "}
            <Link className="govuk-link" href="/cookies">
              cookies page
            </Link>{" "}
            for the cookie that keeps you signed in afterwards.
          </p>

          <h2 className="govuk-heading-m">Why we are allowed to use it</h2>

          <p className="govuk-body">
            We process this information to comply with a legal obligation — our
            duty under section 1 of the Freedom of Information Act 2000 to
            answer requests for recorded information. Under the UK General Data
            Protection Regulation this is Article 6(1)(c).
          </p>

          <p className="govuk-body">
            Because our basis is a legal obligation rather than consent, we
            cannot act on a withdrawal of consent — but the other rights below
            still apply.
          </p>

          <h2 className="govuk-heading-m">What we do with it</h2>

          <p className="govuk-body">
            Staff handling your request can see your name, your email address
            and what you asked for. To answer you we often have to ask
            colleagues in other teams to find the information, and where we do,
            they see the wording of your request.
          </p>

          <p className="govuk-body">
            We use your email address to acknowledge your request, to ask you to
            clarify it if we are not sure what you mean, and to send you our
            response.
          </p>

          <h2 className="govuk-heading-m">What we publish</h2>

          <p className="govuk-body">
            We may publish our response in the{" "}
            <Link className="govuk-link" href="/disclosure-log">
              disclosure log
            </Link>
            , because an answer given to one person is in principle an answer
            available to everyone. When we do, we publish the reference number,
            what was asked for, our response and any documents released with it.
          </p>

          <p className="govuk-body">
            <strong>
              We do not publish your name or your email address in the
              disclosure log.
            </strong>{" "}
            If your request itself contains information that would identify you
            — for example if you have described your own circumstances in it —
            we will edit that out or decide not to publish, rather than publish
            it as written.
          </p>

          <h2 className="govuk-heading-m">Who else sees it</h2>

          <p className="govuk-body">
            We do not sell your information or use it for marketing. We share it
            outside {branding.organisationName} only where we have to:
          </p>

          <ul className="govuk-list govuk-list--bullet">
            <li>
              with another public authority, if your request is partly about
              information they hold and we need to consult them
            </li>
            <li>
              with the Information Commissioner&rsquo;s Office, if you complain
              to them about how we handled your request
            </li>
            <li>where a court orders us to, or the law otherwise requires it</li>
          </ul>

          <h2 className="govuk-heading-m">How long we keep it</h2>

          <p className="govuk-body">
            {RETENTION_PERIOD ? (
              RETENTION_PERIOD
            ) : (
              <span className="govuk-hint govuk-!-display-inline">
                [retention period not published]
              </span>
            )}
          </p>

          <p className="govuk-body">
            We keep the request itself for longer than we keep your contact
            details, because the case record is what shows how we applied the
            Act and lets us answer a later complaint or appeal about it.
          </p>

          <h2 className="govuk-heading-m">Your rights</h2>

          <p className="govuk-body">You have the right to:</p>

          <ul className="govuk-list govuk-list--bullet">
            <li>ask for a copy of the personal information we hold about you</li>
            <li>ask us to correct it if it is wrong</li>
            <li>ask us to delete it, in some circumstances</li>
            <li>ask us to restrict how we use it, in some circumstances</li>
            <li>object to our using it, in some circumstances</li>
          </ul>

          <p className="govuk-body">
            Some of these are limited where we have a legal duty to keep a
            record. We cannot, for example, delete the case file for a request
            that is still open or still open to appeal. If we cannot do what you
            have asked, we will tell you why.
          </p>

          <p className="govuk-body">
            To exercise any of these rights, contact{" "}
            <ContactEmail email={contact.dpoEmail} />.
          </p>

          <h2 className="govuk-heading-m">If you are unhappy</h2>

          <p className="govuk-body">
            Tell us first, at <ContactEmail email={contact.foiEmail} />, and we
            will look into it. You can also complain directly to the{" "}
            <a
              className="govuk-link"
              href="https://ico.org.uk/make-a-complaint/"
              rel="noreferrer"
            >
              Information Commissioner&rsquo;s Office
            </a>
            , which regulates data protection in the UK. You do not have to come
            to us first.
          </p>
        </div>
      </div>
    </>
  );
}
