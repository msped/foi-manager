import type { MetadataRoute } from "next";
import { branding } from "@/lib/branding";

/**
 * Web app manifest.
 *
 * Replaces the one govuk-frontend ships in its assets folder, which named the
 * GOV.UK crown icons — those are reserved for services on gov.uk, so they are
 * no longer copied into public/assets. See public/icon.svg.
 *
 * A route rather than a static file so the name and theme colour follow the
 * same NEXT_PUBLIC_* branding vars as the rest of the app. Next.js emits the
 * <link rel="manifest"> itself, so the layout does not declare one.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${branding.serviceName} — ${branding.organisationName}`,
    short_name: branding.serviceName,
    description:
      "Make a Freedom of Information request and browse previously released information.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: branding.themeColour,
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        // An SVG scales to whatever the platform asks for, so one entry covers
        // the 192/512 sizes a static icon set would need separate files for.
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
