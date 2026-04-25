"use client";

/**
 * Last-resort error boundary — Next.js invokes this only when the error is
 * catastrophic enough that even the root layout failed to render. It must
 * therefore include its own <html> and <body> tags.
 *
 * If the user sees this, something truly broke. We keep it minimal (inline
 * styles, no component imports) so it works even if the Tailwind bundle or
 * a design-system import is what crashed.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#f8fafc",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 24,
            padding: "2rem",
            textAlign: "center",
            boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#0f172a", margin: 0 }}>
            The site crashed
          </h1>
          <p style={{ marginTop: 8, color: "#64748b", fontSize: 14 }}>
            A fatal error broke the page before it could render. Try reloading — if this keeps
            happening, email support@wayneintelligence.com.
          </p>
          {error?.digest && (
            <p
              style={{
                marginTop: 14,
                color: "#64748b",
                fontSize: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                background: "#f1f5f9",
                borderRadius: 12,
                padding: "4px 10px",
                display: "inline-block",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 22,
              background: "#1EAA50",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
