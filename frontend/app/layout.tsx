import type { Metadata } from "next";

import { AuthToast } from "@/components/auth-toast";

import "./globals.css";

const SITE_URL = "https://hireparrot.com";
const SITE_TITLE = "HireParrot — Hire from how they answer, not what they wrote.";
const SITE_DESCRIPTION =
  "AI-graded video interviews that verify identity, score skills, and "
  + "surface inconsistencies — before you ever schedule a call. Every "
  + "candidate report ships with a signed, publicly-verifiable QR code.";

export const metadata: Metadata = {
  // metadataBase resolves any relative image URLs (incl. og:image) to
  // absolute https://hireparrot.com/... so previews work in Slack/Discord/
  // WhatsApp/etc., which require absolute URLs.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · HireParrot",
  },
  description: SITE_DESCRIPTION,
  applicationName: "HireParrot",
  authors: [{ name: "HireParrot", url: SITE_URL }],
  creator: "HireParrot",
  publisher: "HireParrot",

  // Open Graph — Facebook, LinkedIn, Slack, WhatsApp, Discord, etc.
  openGraph: {
    type: "website",
    siteName: "HireParrot",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",     // resolved against metadataBase
        width: 1200,
        height: 630,
        alt: "HireParrot — AI-graded video interviews",
        type: "image/png",
      },
    ],
  },

  // Twitter Card — large summary card with the same hero image
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },

  // Favicons + PWA-style touch icons. Next.js App Router also picks up
  // app/icon.svg + app/apple-icon.svg automatically; declaring them here
  // is belt-and-braces for crawlers that read <head> directly.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon.svg" },
    ],
  },

  // Theme colour for mobile browser chrome (matches our cream surface
  // on light / dark ink #0c0e10 on dark).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e10" },
  ],

  // Robots: allow indexing everywhere by default; routes that need
  // privacy can set their own metadata.robots = { index: false }.
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AuthToast />
      </body>
    </html>
  );
}
