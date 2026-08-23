/**
 * Service branding.
 *
 * This app uses the GOV.UK Design System but is not a GOV.UK-branded service,
 * so it does not use the Crown logo or logotype — those are reserved for
 * services on gov.uk. Adopting organisations set their own name here.
 */
// `||` rather than `??` on purpose: an env var set to an empty string is a
// misconfiguration, not a choice. `??` would take it literally and render an
// unbranded header; `||` falls back to the defaults below.
export const branding = {
  organisationName: process.env.NEXT_PUBLIC_ORGANISATION_NAME || "Your Organisation",
  serviceName: process.env.NEXT_PUBLIC_SERVICE_NAME || "FOI Manager",
  /** Browser chrome colour. GDS blue unless the organisation overrides it. */
  themeColour: process.env.NEXT_PUBLIC_THEME_COLOUR || "#1d70b8",
} as const;
