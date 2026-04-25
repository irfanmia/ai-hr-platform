/**
 * HireParrot marketing landing page (route: /).
 *
 * Built from the Claude-Design HTML handoff (frontend/public/landing/styles.css
 * + components/landing/body.ts). The marketing body is server-rendered
 * verbatim via dangerouslySetInnerHTML so we keep one source of truth for
 * the ~1000-line markup; the auth-aware nav and JS interactions are layered
 * on top as React components.
 *
 * The whole tree is wrapped in `.hp-page` because the landing CSS is scoped
 * under that class — without it we'd inherit the rest of the app's globals
 * (Mulish font, Tailwind base) and the design would look wrong.
 */
import { LandingBootstrap } from "@/components/landing/landing-bootstrap";
import { LandingNav } from "@/components/landing/landing-nav";
import { LANDING_BODY_HTML } from "@/components/landing/body";

export default function HomePage() {
  return (
    <>
      {/* Scoped landing-page stylesheet — everything inside .hp-page picks
          up these styles; nothing leaks to /jobs or /login. */}
      <link rel="stylesheet" href="/landing/styles.css" />
      {/* Display fonts used by the landing design (Inter Tight, Fraunces, etc.).
          Mulish (the rest-of-app font) stays loaded by globals.css. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500&family=Fraunces:ital,wght@0,300;0,400;1,300;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
      />

      <div className="hp-page">
        <LandingNav />
        <div dangerouslySetInnerHTML={{ __html: LANDING_BODY_HTML }} />
      </div>

      <LandingBootstrap />
    </>
  );
}
