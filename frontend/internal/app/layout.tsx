import type { Metadata, Viewport } from "next";
import Script from "next/script";
import SessionProvider from "@/components/SessionProvider";
import GovukInit from "@/components/GovukInit";
import { branding } from "@/lib/branding";
import "./globals.scss";

export const metadata: Metadata = {
  title: "FOI Manager — Internal",
  description: "Freedom of Information case management",
  icons: {
    icon: [
      { url: "/assets/images/favicon.ico", sizes: "48x48" },
      { url: "/assets/images/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: "/assets/images/govuk-icon-180.png",
    other: [{ rel: "mask-icon", url: "/assets/images/govuk-icon-mask.svg", color: branding.themeColour }],
  },
  manifest: "/assets/manifest.json",
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
