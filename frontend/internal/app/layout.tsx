import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOI Manager — Internal",
  description: "Freedom of Information case management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/govuk-frontend.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
