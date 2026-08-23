import Link from "next/link";

interface HeaderProps {
  /** Link target for the organisation name. */
  homepageUrl?: string;
  organisationName?: string;
  containerFullWidth?: boolean;
}

/**
 * Port of govuk-frontend's header component (v6.1.0), minus the GOV.UK Crown
 * and logotype. Those are reserved for services on gov.uk, so the organisation
 * name is the only brand element here — see lib/branding.
 */
export default function Header({
  homepageUrl = "/",
  organisationName,
  containerFullWidth = false,
}: HeaderProps) {
  return (
    <div className="govuk-header">
      <div
        className={`govuk-header__container ${
          containerFullWidth
            ? "govuk-header__container--full-width"
            : "govuk-width-container"
        }`}
      >
        <div className="govuk-header__logo">
          <Link href={homepageUrl} className="govuk-header__homepage-link">
            {organisationName && (
              <span className="govuk-header__product-name">{organisationName}</span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
