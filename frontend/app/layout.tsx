import type { Metadata } from "next";

import { AuthToast } from "@/components/auth-toast";

import "./globals.css";

export const metadata: Metadata = {
  title: "HireParrot — AI-driven hiring with verifiable interviews",
  description:
    "HireParrot turns hiring from resume-based screening into skill, behaviour and "
    + "claim-validation through AI-graded video interviews — every candidate report "
    + "comes with a signed, scannable verification code.",
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
