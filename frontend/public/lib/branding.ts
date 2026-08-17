/**
 * Service branding for the public-facing portal.
 *
 * This app uses the GOV.UK Design System but is not a GOV.UK-branded service,
 * so it does not use the Crown logo or logotype — those are reserved for
 * services on gov.uk. Adopting organisations set their own name here.
 */
export const branding = {
  organisationName: process.env.NEXT_PUBLIC_ORGANISATION_NAME ?? "FOI Manager",
  serviceName: process.env.NEXT_PUBLIC_SERVICE_NAME ?? "Freedom of Information",
  /** Browser chrome colour. GDS blue unless the organisation overrides it. */
  themeColour: process.env.NEXT_PUBLIC_THEME_COLOUR ?? "#1d70b8",
} as const;
