import Link from "next/link";
import Logo from "./Logo";

interface HeaderProps {
  /** Link target for the organisation name. */
  homepageUrl?: string;
  organisationName?: string;
  /**
   * Renders the GOV.UK Crown and logotype. Only for services on gov.uk —
   * everyone else uses their own organisation name. Off by default.
   */
  showGovukLogo?: boolean;
  containerFullWidth?: boolean;
}

/** Port of govuk-frontend's header component (v6.1.0). */
export default function Header({
  homepageUrl = "/",
  organisationName,
  showGovukLogo = false,
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
            {showGovukLogo && (
              <Logo classes="govuk-header__logotype" ariaLabelText="GOV.UK" />
            )}
            {organisationName && (
              <span className="govuk-header__product-name">{organisationName}</span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
