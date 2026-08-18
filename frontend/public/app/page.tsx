import Link from "next/link";
import { branding } from "@/lib/branding";

export default function HomePage() {
  return (
    <div className="govuk-grid-row">
      <div className="govuk-grid-column-two-thirds">
        <h1 className="govuk-heading-xl">
          Request information from {branding.organisationName}
        </h1>

        <p className="govuk-body-l">
          The Freedom of Information Act 2000 gives you the right to ask for any
          recorded information we hold.
        </p>

        <Link
          href="/request"
          role="button"
          draggable={false}
          className="govuk-button govuk-button--start"
          data-module="govuk-button"
        >
          Start now
          <svg
            className="govuk-button__start-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="17.5"
            height="19"
            viewBox="0 0 33 40"
            aria-hidden="true"
            focusable="false"
          >
            <path fill="currentColor" d="M0 0h13l20 20-20 20H0l20-20z" />
          </svg>
        </Link>

        <h2 className="govuk-heading-m">Before you request</h2>

        <p className="govuk-body">
          We already publish a lot of information. Check both of the following
          before you ask us — what you need may be available straight away.
          They are two separate things:
        </p>

        <h3 className="govuk-heading-s govuk-!-margin-bottom-1">
          <Link className="govuk-link" href="/publication-scheme">
            Publication scheme
          </Link>
        </h3>
        <p className="govuk-body">
          Information we publish routinely on our own initiative, without anyone
          having to ask — our structure, spending, policies, performance and the
          registers we keep. Every public authority must have one under section
          19 of the Act.
        </p>

        <h3 className="govuk-heading-s govuk-!-margin-bottom-1">
          <Link className="govuk-link" href="/disclosure-log">
            Disclosure log
          </Link>
        </h3>
        <p className="govuk-body">
          Our responses to individual Freedom of Information requests that other
          people have already made. If someone has asked your question before,
          the answer will be here.
        </p>

        <h2 className="govuk-heading-m">What happens next</h2>

        <p className="govuk-body">
          We must respond within 20 working days of receiving your request. If we
          need to clarify what you have asked for, that time starts again from the
          date you reply.
        </p>

        <p className="govuk-body">
          Some information is exempt from release — for example, personal data
          about other people, or information that would prejudice a criminal
          investigation. If we withhold anything, we will tell you which exemption
          applies and why.
        </p>

        <div className="govuk-inset-text">
          You do not have to give a reason for your request. You must give us
          your real name and an email address we can send the response to. An
          email address is all we need — you do not have to give us a postal
          address.
        </div>
      </div>

      <div className="govuk-grid-column-one-third">
        <h2 className="govuk-heading-m">Related</h2>
        <ul className="govuk-list">
          <li>
            <Link className="govuk-link" href="/publication-scheme">
              Publication scheme
            </Link>
          </li>
          <li>
            <Link className="govuk-link" href="/disclosure-log">
              Disclosure log
            </Link>
          </li>
          <li>
            <a
              className="govuk-link"
              href="https://ico.org.uk/for-the-public/official-information/"
              rel="noreferrer"
            >
              Your rights under FOI (ICO)
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
