/**
 * Service branding.
 *
 * This app uses the GOV.UK Design System but is not a GOV.UK-branded service,
 * so it does not use the Crown logo or logotype — those are reserved for
 * services on gov.uk. Adopting organisations set their own name here.
 */
/** The Design System default, used whenever the env var is unset or unusable. */
const GDS_BLUE = "#1d70b8";

/**
 * Accepts a hex colour, or falls back.
 *
 * Validated rather than escaped because the value is interpolated into a
 * `<style>` element in the root layout. A brand colour has no legitimate reason
 * to contain braces or semicolons, so anything that is not a plain hex colour
 * is a misconfiguration and takes the default — the app renders GDS blue rather
 * than emitting whatever the variable happened to contain.
 */
function hexColour(value: string | undefined): string {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value ?? "") ? value! : GDS_BLUE;
}

// `||` rather than `??` on purpose: an env var set to an empty string is a
// misconfiguration, not a choice. `??` would take it literally and render an
// unbranded header; `||` falls back to the defaults below.
export const branding = {
  organisationName: process.env.NEXT_PUBLIC_ORGANISATION_NAME || "Your Organisation",
  serviceName: process.env.NEXT_PUBLIC_SERVICE_NAME || "FOI Manager",
  /**
   * Brand colour, driving two separate things:
   *
   *   - the header and service navigation background, via the
   *     `--govuk-brand-colour` custom property set in app/layout.tsx
   *   - the browser chrome, via `<meta name="theme-color">` and the manifest
   *
   * Must stay dark enough for white text (roughly 4.5:1 against white). The
   * Design System uses `brand` both as a background under white text and as
   * text on white inverse buttons, so a light value fails in both directions.
   */
  themeColour: hexColour(process.env.NEXT_PUBLIC_THEME_COLOUR),
} as const;
