import type { Metadata } from "next";

import { AuthToast } from "@/components/auth-toast";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI HR Platform",
  description: "AI-powered HR platform built with Next.js and Django",
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
