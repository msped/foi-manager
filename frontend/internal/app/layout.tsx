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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="govuk-template">
      <body className="govuk-template__body" suppressHydrationWarning>
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
