"use client";

/**
 * Global site header — the landing-page nav, reused on every route.
 *
 * What it does:
 *   - Loads the scoped landing stylesheet (idempotent — Next.js dedupes the
 *     <link> tag, so this is cheap even when many pages mount it).
 *   - Loads the display-font set used by the nav (Inter Tight, etc.).
 *   - Wraps <LandingNav /> in a `.hp-page` host so the landing CSS variables
 *     and selectors take effect ONLY inside the nav — the rest of the page
 *     (Tailwind / globals.css surface) is untouched.
 *
 * Why a thin wrapper rather than copy-pasting the nav into every page:
 *   single source of truth. If we tweak menu links or the auth dropdown,
 *   we change one component and every page picks it up.
 *
 * The nav is `position: sticky; top: 0` from the landing CSS — the body is
 * the scrolling container on every route, so sticky behaviour works
 * uniformly without extra config.
 */
import { LandingNav } from "@/components/landing/landing-nav";

export function SiteHeader() {
  return (
    <>
      <link rel="stylesheet" href="/landing/styles.css" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap"
      />
      <div className="hp-page">
        <LandingNav />
      </div>
    </>
  );
}
