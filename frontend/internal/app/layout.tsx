import type { Metadata, Viewport } from "next";
import Script from "next/script";
import SessionProvider from "@/components/SessionProvider";
import GovukInit from "@/components/GovukInit";
import { branding } from "@/lib/branding";
import "./globals.scss";

export const metadata: Metadata = {
  title: "FOI Manager — Internal",
  description: "Freedom of Information case management",
  // The govuk-frontend asset set these used to point at is the GOV.UK crown,
  // which is reserved for services on gov.uk. See public/icon.svg.
  // app/manifest.ts emits its own <link rel="manifest">, so none is declared.
  icons: {
    icon: [{ url: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: branding.themeColour,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Feature-detect script from the GOV.UK Frontend template. Runs before
// hydration so JS-only styles don't flash.
const GOVUK_SUPPORTED_SCRIPT =
  "document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');";

// Repoints the Design System's brand colour at the organisation's own.
//
// govuk-frontend v6 resolves every functional colour through a CSS custom
// property — `govuk-functional-colour(brand)` compiles to
// `var(--govuk-brand-colour, #1d70b8)` — and declares the defaults on `:root`.
// So the brand colour is a runtime value, and one declaration here recolours
// every consumer of it: the header background, the footer's top border, the
// notification banner, and inverse button text. The service navigation reads it
// too, but only through its `--inverse` modifier, which this app never applies —
// its normal background is `surface-background`, which stays blue-derived.
//
// `:root:root` rather than `:root` on purpose. govuk-frontend declares its
// default at `:root`, specificity (0,1,0), and nothing guarantees this element
// is emitted after that stylesheet. Repeating the selector raises specificity
// to (0,2,0) so the override wins outright instead of relying on source order.
//
// Interpolation is safe because lib/branding validates the value as a hex
// colour and falls back to the default otherwise.
const BRAND_COLOUR = `:root:root{--govuk-brand-colour:${branding.themeColour}}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="govuk-template">
      <body className="govuk-template__body" suppressHydrationWarning>
        {/*
          `href` and `precedence` are what make React hoist this into <head>
          and dedupe it, rather than leaving a <style> loose in the body.
        */}
        <style
          href="foi-brand-colour"
          precedence="high"
          dangerouslySetInnerHTML={{ __html: BRAND_COLOUR }}
        />
        <Script
          id="govuk-frontend-supported"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: GOVUK_SUPPORTED_SCRIPT }}
        />
        <GovukInit />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
