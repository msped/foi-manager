import Link from "next/link";

export interface NavItem {
  href: string;
  text: string;
  /** Renders as the current page (aria-current="page"). */
  current?: boolean;
  /** Renders as within the current section (aria-current="true"). */
  active?: boolean;
  /** How many things behind this link need attention. Renders a red govuk-tag;
   *  omit or pass 0 for none. */
  count?: number;
}

interface ServiceNavigationProps {
  serviceName?: string;
  serviceUrl?: string;
  navigation?: NavItem[];
  navigationId?: string;
  menuButtonText?: string;
  ariaLabel?: string;
  /** Rendered at the end of the width container, after the nav. */
  end?: React.ReactNode;
}

/** Port of govuk-frontend's service-navigation component (v6.1.0). */
export default function ServiceNavigation({
  serviceName,
  serviceUrl,
  navigation = [],
  navigationId = "navigation",
  menuButtonText = "Menu",
  ariaLabel = "Service information",
  end,
}: ServiceNavigationProps) {
  const collapseOnMobile = navigation.length > 1;

  const inner = (
    <div className="govuk-width-container">
      <div className="govuk-service-navigation__container">
        {serviceName && (
          <span className="govuk-service-navigation__service-name">
            {serviceUrl ? (
              <Link href={serviceUrl} className="govuk-service-navigation__link">
                {serviceName}
              </Link>
            ) : (
              <span className="govuk-service-navigation__text">{serviceName}</span>
            )}
          </span>
        )}

        {navigation.length > 0 && (
          <nav
            aria-label={menuButtonText}
            className="govuk-service-navigation__wrapper"
          >
            {collapseOnMobile && (
              <button
                type="button"
                className="govuk-service-navigation__toggle govuk-js-service-navigation-toggle"
                aria-controls={navigationId}
                hidden
                aria-hidden="true"
              >
                {menuButtonText}
              </button>
            )}

            <ul className="govuk-service-navigation__list" id={navigationId}>
              {navigation.map((item) => {
                const isActive = item.active || item.current;
                // Active links are wrapped in <strong> so the current item stays
                // identifiable for users who override colours.
                const label = isActive ? (
                  <strong className="govuk-service-navigation__active-fallback">
                    {item.text}
                  </strong>
                ) : (
                  item.text
                );

                // govuk-tag rather than a bespoke badge: it is the Design
                // System's component for this, and its negative vertical
                // margins are there so it cannot grow its container — which is
                // what a nav bar needs.
                //
                // Sits outside the <strong> above, which exists only to mark the
                // active item. Colour alone cannot carry meaning, so the count
                // is repeated for screen readers as part of the link text.
                const badge = item.count ? (
                  <>
                    {" "}
                    <strong className="govuk-tag govuk-tag--red" aria-hidden="true">
                      {item.count}
                    </strong>
                    <span className="govuk-visually-hidden">
                      , {item.count} {item.count === 1 ? "item needs" : "items need"}{" "}
                      attention
                    </span>
                  </>
                ) : null;

                return (
                  <li
                    key={item.href}
                    className={`govuk-service-navigation__item${
                      isActive ? " govuk-service-navigation__item--active" : ""
                    }`}
                  >
                    <Link
                      className="govuk-service-navigation__link"
                      href={item.href}
                      aria-current={
                        item.current ? "page" : item.active ? "true" : undefined
                      }
                    >
                      {label}
                      {badge}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>

      {end}
    </div>
  );

  // A service name (or end slot) needs a labelled landmark; without one the
  // inner <nav> is landmark enough on its own.
  if (serviceName || end) {
    return (
      <section
        aria-label={ariaLabel}
        className="govuk-service-navigation"
        data-module="govuk-service-navigation"
      >
        {inner}
      </section>
    );
  }

  return (
    <div className="govuk-service-navigation" data-module="govuk-service-navigation">
      {inner}
    </div>
  );
}
