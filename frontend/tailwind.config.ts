import type { Config } from "tailwindcss";

/**
 * Brand palette — modelled on name.com's identity (green-forward, dark text,
 * pill buttons, Mulish typography). The `brand` palette is the source of
 * truth. We also override Tailwind's built-in `indigo` palette with the same
 * green values so the existing codebase (which uses `indigo-500`, `indigo-600`,
 * `bg-indigo-50` etc. extensively for accent colours) automatically picks up
 * the new brand without a giant find-and-replace sweep.
 */
const brand = {
  50:  "#EEFBEF",
  100: "#D9F6DC",
  200: "#BEEEC1",   // == name.com green-300 — accent / hover bg
  300: "#A2E5A8",
  400: "#84DD8E",
  500: "#6EDA78",   // == name.com green-500 — PRIMARY
  600: "#4BC85A",
  700: "#1EAA50",   // == name.com green-700 — link / pressed
  800: "#147A3D",
  900: "#048132",   // == name.com green-900 — strong accent / titles
  950: "#04471D",
};

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        destructive: "hsl(var(--destructive))",

        // Canonical brand palette — use these in any new code.
        brand,

        // Auto-rebrand the existing UI: every `indigo-*` class in the
        // codebase resolves to the brand green from now on. Keeps churn tiny.
        indigo: brand,
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // Mulish is the closest free open-source match to Proxima Nova
        // (which name.com self-hosts under licence). System stack is the
        // fallback while the webfont is loading.
        sans: [
          "var(--font-sans)",
          "Mulish",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      boxShadow: {
        soft: "0 20px 60px -24px rgba(15, 23, 42, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
