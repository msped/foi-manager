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
          Check the{" "}
          <Link className="govuk-link" href="/disclosure-log">
            disclosure log
          </Link>{" "}
          first. We publish our responses to previous requests there, so the
          information you want may already be available.
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
          You do not have to give a reason for your request, but you must give us
          a real name and an address we can reply to.
        </div>
      </div>

      <div className="govuk-grid-column-one-third">
        <h2 className="govuk-heading-m">Related</h2>
        <ul className="govuk-list">
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
