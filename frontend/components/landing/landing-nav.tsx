"use client";

/**
 * Landing-page navigation — uses the landing CSS classes (.nav, .btn,
 * .btn-ghost, .btn-primary) so it visually matches the marketing skin, but
 * swaps the static "Sign in" button for an auth-aware control:
 *
 *   - logged out                → "Sign in" (links to /login)
 *   - logged-in HR user         → avatar dropdown → Recruiter dashboard, Sign out
 *   - logged-in candidate       → avatar dropdown → My applications, Sign out
 *
 * The avatar shows the first letter of the user's display name.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { clearCandidate, clearHr } from "@/lib/auth-store";
import { useAuth } from "@/lib/use-auth";

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "#how", label: "How it works" },
  { href: "#report", label: "The AI report" },
  { href: "#why", label: "Why teams switch" },
  { href: "#fraud", label: "Anti-fraud" },
  { href: "#integrations", label: "Integrations" },
  { href: "#industries", label: "Industries" },
];

function initialOf(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed[0]!.toUpperCase();
}

interface UserCtx {
  displayName: string;
  email: string | null;
  initial: string;
  dashboardHref: string;
  dashboardLabel: string;
  signOut: () => void;
}

function useNavUserContext(): UserCtx | null {
  const { isHrLoggedIn, isCandidateLoggedIn, hr, candidate } = useAuth();

  if (isHrLoggedIn && hr) {
    const displayName = (hr.name as string) || hr.email?.split("@")[0] || "Recruiter";
    return {
      displayName,
      email: (hr.email as string | undefined) ?? null,
      initial: initialOf(displayName),
      dashboardHref: "/dashboard",
      dashboardLabel: "Recruiter dashboard",
      signOut: () => {
        clearHr();
        window.location.href = "/";
      },
    };
  }

  if (isCandidateLoggedIn && candidate) {
    const displayName = (candidate.name as string) || candidate.email?.split("@")[0] || "Candidate";
    return {
      displayName,
      email: (candidate.email as string | undefined) ?? null,
      initial: initialOf(displayName),
      dashboardHref: "/my-dashboard",
      dashboardLabel: "My applications",
      signOut: () => {
        clearCandidate();
        window.location.href = "/";
      },
    };
  }

  return null;
}

function AuthCta({ user, mobile = false }: { user: UserCtx | null; mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Click-outside to close the dropdown
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <Link href="/login" className="btn btn-ghost">
        Sign in
      </Link>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={`Account menu for ${user.displayName}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--ink)",
          color: "var(--bg)",
          fontFamily: "var(--sans)",
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: 0,
          border: "1px solid var(--line)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {user.initial}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: mobile ? "auto" : 0,
            left: mobile ? 0 : "auto",
            minWidth: 220,
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-lg)",
            padding: 8,
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: "10px 12px 8px",
              borderBottom: "1px solid var(--line-2)",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontFamily: "var(--sans)",
                fontWeight: 600,
                fontSize: 14,
                color: "var(--ink)",
                lineHeight: 1.2,
              }}
            >
              {user.displayName}
            </div>
            {user.email && (
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  marginTop: 2,
                  wordBreak: "break-all",
                }}
              >
                {user.email}
              </div>
            )}
          </div>
          <Link
            href={user.dashboardHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: "10px 12px",
              borderRadius: "var(--r)",
              fontFamily: "var(--sans)",
              fontSize: 14,
              color: "var(--ink)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {user.dashboardLabel}
          </Link>
          <Link
            href="/jobs"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: "10px 12px",
              borderRadius: "var(--r)",
              fontFamily: "var(--sans)",
              fontSize: 14,
              color: "var(--ink)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Browse jobs
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              user.signOut();
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: "var(--r)",
              border: "none",
              background: "transparent",
              fontFamily: "var(--sans)",
              fontSize: 14,
              color: "var(--ink-2)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function LandingNav() {
  const user = useNavUserContext();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open (matches original behaviour)
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const arrow = (
    <svg className="arrow" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <header className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="wrap nav-inner">
        <Link href="/" className="logo">
          <span className="logo-mark" />
          <span>HireParrot</span>
        </Link>
        <nav className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav-cta">
          <AuthCta user={user} />
          <Link href="/jobs" className="btn btn-primary">
            Try now
            {arrow}
          </Link>
        </div>
        <button
          type="button"
          className={`nav-burger${mobileOpen ? " open" : ""}`}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
        >
          <span /><span /><span />
        </button>
      </div>
      <div
        className={`nav-mobile${mobileOpen ? " open" : ""}`}
        aria-hidden={!mobileOpen}
      >
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}>
            {l.label}
          </a>
        ))}
        <div className="nav-mobile-cta">
          <AuthCta user={user} mobile />
          <Link
            href="/jobs"
            className="btn btn-primary"
            onClick={() => setMobileOpen(false)}
          >
            Try it now →
          </Link>
        </div>
      </div>
    </header>
  );
}
