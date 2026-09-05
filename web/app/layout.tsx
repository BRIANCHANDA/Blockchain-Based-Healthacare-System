/**
 * Root layout — wraps every page in the portal.
 *
 * Import order of the two stylesheets matters: design-tokens.css defines the
 * custom properties (--brand, --text-primary, --r-md, --elev-1 and the rest)
 * that globals.css and every component then consume, so it must come first.
 *
 * Colours, radii, shadows and fonts are referenced only as var(--token)
 * throughout the portal. Adding a raw hex value anywhere downstream breaks that
 * single source of truth — add a token here instead.
 */

import type { Metadata } from "next";
import "./design-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedLink Zambia",
  description:
    "Blockchain-based Healthcare Information System — Copperbelt University",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
