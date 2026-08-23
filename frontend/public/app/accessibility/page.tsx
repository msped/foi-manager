import type { Metadata } from "next";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import ContactEmail from "@/components/ContactEmail";
import { branding, contact } from "@/lib/branding";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Accessibility statement",
  description: "Accessibility statement for this Freedom of Information service.",
};

/**
 * The facts an accessibility statement needs that no one can derive from code.
 *
 * Compliance status and known problems come from an audit of the deployed
 * service against WCAG 2.2 AA. Nobody can fill these in from the source: the
 * answer depends on the organisation's own content, its branding colours and
 * the assistive technology it tested with. Publishing an unaudited statement
 * claiming full compliance is a false statement in a document the
 * accessibility regulations require to be accurate — so the default is null,
 * and the page says plainly that no audit has happened.
 *
 * Complete this once the service has been tested, and review it at least
 * annually thereafter.
 */
const AUDIT: {
  /** ISO date the statement was first prepared, after testing. */
  preparedOn: string | null;
  /** ISO date of the most recent review. */
  lastReviewedOn: string | null;
  /** From a real audit, not an assumption. */
  complianceStatus: "full" | "partial" | "none" | null;
  /** Who tested it and how — "an internal review", "an audit by X". */
  testedBy: string | null;
  /** Known problems, each with the WCAG criterion it fails. */
  knownProblems: readonly string[];
} = {
  preparedOn: null,
  lastReviewedOn: null,
  complianceStatus: null,
  testedBy: null,
  knownProblems: [],
};

const COMPLIANCE_WORDING = {
  full: "This service is fully compliant with the Web Content Accessibility Guidelines version 2.2 AA standard.",
  partial:
    "This service is partially compliant with the Web Content Accessibility Guidelines version 2.2 AA standard, because of the non-compliances listed below.",
  none: "This service is not compliant with the Web Content Accessibility Guidelines version 2.2 AA standard. The non-compliances are listed below.",
} as const;

export default function AccessibilityPage() {
  const compliance = AUDIT.complianceStatus
    ? COMPLIANCE_WORDING[AUDIT.complianceStatus]
    : null;
  const audited = AUDIT.preparedOn !== null && compliance !== null;

  return (
    <>
      <Breadcrumbs
        items={[{ href: "/", text: "Home" }, { text: "Accessibility statement" }]}
      />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <h1 className="govuk-heading-xl">Accessibility statement</h1>

          <p className="govuk-body-l">
            This statement covers the {branding.serviceName} service run by{" "}
            {branding.organisationName}. It does not cover any other website we
            operate.
          </p>

          {!audited && (
            <div className="govuk-warning-text">
              <span className="govuk-warning-text__icon" aria-hidden="true">
                !
              </span>
              <strong className="govuk-warning-text__text">
                <span className="govuk-visually-hidden">Warning</span>
                This statement is not finished. This service has not yet been
                tested for accessibility, so we cannot yet say how accessible it
                is. It must be tested and this statement completed before the
                service is used by the public.
              </strong>
            </div>
          )}

          <h2 className="govuk-heading-m">Using this service</h2>

          <p className="govuk-body">
            We want as many people as possible to be able to use this service.
            You should be able to:
          </p>

          <ul className="govuk-list govuk-list--bullet">
            <li>change colours, contrast levels and fonts in your browser</li>
            <li>zoom in up to 400% without the text spilling off the screen</li>
            <li>navigate the whole service using just a keyboard</li>
            <li>navigate the whole service using speech recognition software</li>
            <li>
              listen to the service using a screen reader, including the most
              recent versions of JAWS, NVDA and VoiceOver
            </li>
          </ul>

          <p className="govuk-body">
            We have also tried to make the text as simple as possible to
            understand. The Freedom of Information Act uses some unavoidable
            legal language, and where we have to use it we explain what it
            means.
          </p>

          <p className="govuk-body">
            Every part of this service — making a request, checking its
            progress, and searching what we have published — works without
            JavaScript. If your browser or your connection cannot run it, or you
            have turned it off, nothing here stops working.
          </p>

          <p className="govuk-body">
            <a
              className="govuk-link"
              href="https://mcmw.abilitynet.org.uk/"
              rel="noreferrer"
            >
              AbilityNet
            </a>{" "}
            has advice on making your device easier to use if you have a
            disability.
          </p>

          <h2 className="govuk-heading-m">How accessible this service is</h2>

          {compliance ? (
            <>
              <p className="govuk-body">{compliance}</p>
              {AUDIT.knownProblems.length > 0 && (
                <>
                  <h3 className="govuk-heading-s">
                    Non-accessible content
                  </h3>
                  <ul className="govuk-list govuk-list--bullet">
                    {AUDIT.knownProblems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="govuk-body">
              We have not yet tested this service against the Web Content
              Accessibility Guidelines, so we cannot yet tell you how accessible
              it is or list the parts that are not. We will publish that here
              once we have.
            </p>
          )}

          <p className="govuk-body">
            Some of what we publish comes from documents produced elsewhere in
            the organisation, or supplied to us. Where a released document is
            not accessible, tell us using the details below and we will provide
            what it contains in a form you can use.
          </p>

          <h2 className="govuk-heading-m">
            If you need information in a different format
          </h2>

          <p className="govuk-body">
            You do not have to use this website to make a Freedom of Information
            request. The Act says a request only has to be in writing, so a
            letter or an ordinary email is just as valid as this form, and we
            will not treat it differently.
          </p>

          <p className="govuk-body">
            If you need our response, or anything we have published, in a
            different format — large print, easy read, audio, braille, or a more
            accessible electronic document — contact{" "}
            <ContactEmail email={contact.foiEmail} />. Tell us the format you
            need. We will consider your request and reply within 20 working
            days.
          </p>

          {contact.postalAddress && (
            <>
              <p className="govuk-body">You can also write to us:</p>
              <p className="govuk-body">
                {contact.postalAddress.map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </p>
            </>
          )}

          <h2 className="govuk-heading-m">Reporting accessibility problems</h2>

          <p className="govuk-body">
            We are always looking to improve this service. If you find a problem
            that is not listed on this page, or you think we are not meeting the
            accessibility requirements, contact{" "}
            <ContactEmail email={contact.foiEmail} /> and tell us what happened,
            what you were trying to do, and what device or software you were
            using.
          </p>

          <h2 className="govuk-heading-m">Enforcement procedure</h2>

          <p className="govuk-body">
            The Equality and Human Rights Commission enforces the Public Sector
            Bodies (Websites and Mobile Applications) (No. 2) Accessibility
            Regulations 2018. If you are not happy with how we respond to your
            complaint, contact the{" "}
            <a
              className="govuk-link"
              href="https://www.equalityadvisoryservice.com/"
              rel="noreferrer"
            >
              Equality Advisory and Support Service
            </a>
            . In Northern Ireland, contact the{" "}
            <a
              className="govuk-link"
              href="https://www.equalityni.org/"
              rel="noreferrer"
            >
              Equality Commission for Northern Ireland
            </a>
            .
          </p>

          <h2 className="govuk-heading-m">
            Technical information about this service&rsquo;s accessibility
          </h2>

          <p className="govuk-body">
            {branding.organisationName} is committed to making this service
            accessible, in accordance with the Public Sector Bodies (Websites
            and Mobile Applications) (No. 2) Accessibility Regulations 2018.
          </p>

          <p className="govuk-body">
            This service is built with the GOV.UK Design System, whose
            components are developed and tested for accessibility against the
            Web Content Accessibility Guidelines version 2.2 AA standard.
            Building on it does not by itself make a service compliant, which is
            why the section above reports on this service as a whole.
          </p>

          <h2 className="govuk-heading-m">Preparation of this statement</h2>

          {audited ? (
            <>
              <p className="govuk-body">
                This statement was prepared on {fmtDate(AUDIT.preparedOn)}.
                {AUDIT.lastReviewedOn &&
                  ` It was last reviewed on ${fmtDate(AUDIT.lastReviewedOn)}.`}
              </p>
              {AUDIT.testedBy && (
                <p className="govuk-body">
                  This service was last tested by {AUDIT.testedBy}.
                </p>
              )}
            </>
          ) : (
            <p className="govuk-body">
              This statement has not yet been completed, because the service has
              not yet been tested. It will record the date of preparation, the
              date of the most recent review, and who carried out the testing.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
