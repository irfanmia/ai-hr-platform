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
import { LANDING_BODY_HTML } from "@/components/landing/body";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      {/* Fraunces is only used by the landing body (italic-serif headlines).
          Loaded here so it's not paid for on dashboard / job pages. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;1,300;1,400&display=swap"
      />

      <SiteHeader />
      <div className="hp-page">
        <div dangerouslySetInnerHTML={{ __html: LANDING_BODY_HTML }} />
      </div>

      <LandingBootstrap />
    </>
  );
}
