/**
 * Service branding for the public-facing portal.
 *
 * This app uses the GOV.UK Design System but is not a GOV.UK-branded service,
 * so it does not use the Crown logo or logotype — those are reserved for
 * services on gov.uk. Adopting organisations set their own name here.
 */
// `||` rather than `??` on purpose: an env var set to an empty string is a
// misconfiguration, not a choice. `??` would take it literally and render an
// unbranded header; `||` falls back to the defaults below.
export const branding = {
  organisationName: process.env.NEXT_PUBLIC_ORGANISATION_NAME || "Your Org",
  serviceName: process.env.NEXT_PUBLIC_SERVICE_NAME || "Freedom of Information",
  /** Browser chrome colour. GDS blue unless the organisation overrides it. */
  themeColour: process.env.NEXT_PUBLIC_THEME_COLOUR || "#1d70b8",
} as const;

/** Splits a pipe-separated env var into lines, or null if it is not set. */
function lines(value: string | undefined): readonly string[] | null {
  const parts = (value ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

/**
 * Contact details the statutory pages need.
 *
 * Deliberately unlike `branding`, which falls back to a placeholder name: there
 * is no safe default for an address. A privacy notice naming an invented
 * inbox is worse than one admitting none is published, and the accessibility
 * regulations require a route that actually reaches someone. So these are null
 * when unset, and every consumer has to render the missing case honestly.
 *
 * The FOI inbox is also a statutory obligation in its own right — section 8
 * requires requests in writing by any means, so an organisation cannot publish
 * only a web form.
 */
export const contact = {
  /** Where FOI requests and correspondence go. */
  foiEmail: process.env.NEXT_PUBLIC_FOI_EMAIL || null,
  /** Pipe-separated: "FOI Team|1 Example Street|Exampleton|AB1 2CD". */
  postalAddress: lines(process.env.NEXT_PUBLIC_POSTAL_ADDRESS),
  /** Data protection officer, named in the privacy notice. */
  dpoEmail: process.env.NEXT_PUBLIC_DPO_EMAIL || null,
} as const;
