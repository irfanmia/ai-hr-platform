/**
 * HireParrot brand primitives — wordmark + standalone mark.
 *
 * The "mark" is a minimal parrot silhouette in brand green. It pairs with
 * the lowercase "hireparrot" wordmark in Mulish Bold (matches name.com's
 * Proxima-Bold-lowercase-with-tld-accent style — except we use ".com" as
 * the green accent, not the parrot).
 *
 * Used in: PublicNav header, DashboardSidebar header, login pages,
 * verify page, and any other surface that needs the brand.
 */

import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  className?: string;
  size?: number;
  /** If true, render outline-only on a dark surface (for the dark sidebar). */
  inverse?: boolean;
}

/**
 * Minimal parrot icon — head + curved beak + eye dot. Pure SVG, currentColor
 * so it inherits text colour.
 */
export function BrandMark({ className, size = 28, inverse = false }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
      role="img"
      aria-label="HireParrot mark"
    >
      {/* Body / head — soft rounded silhouette */}
      <path
        d="M22.5 6c-3.6 0-6.6 2-8.1 4.8C13.4 11.6 13 13 13 14.5c0 .5.1 1 .2 1.4l-3.5 3.5c-.7.7-.7 1.8 0 2.5l.4.4c.6.6 1.5.7 2.2.2l3.6-2.4c.7.3 1.5.4 2.4.4 4.7 0 8.5-3.7 8.5-8.3 0-.7-.1-1.4-.3-2 .8-.5 1.5-1.2 1.5-1.7 0-.6-.6-.7-1.6-.7-.4 0-.9 0-1.4.1A8.5 8.5 0 0022.5 6z"
        fill={inverse ? "transparent" : "#1EAA50"}
        stroke={inverse ? "currentColor" : "transparent"}
        strokeWidth={inverse ? 1.5 : 0}
      />
      {/* Beak — small triangle, accent green */}
      <path
        d="M12.5 14.5l-3 1.5 3 1.5z"
        fill={inverse ? "currentColor" : "#048132"}
      />
      {/* Eye dot */}
      <circle cx="20.5" cy="11.5" r="1.1" fill={inverse ? "#048132" : "#FFFFFF"} />
    </svg>
  );
}

export interface BrandWordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** True on dark surfaces — wordmark goes light, accent stays brand. */
  inverse?: boolean;
  /** Hide the parrot mark (e.g. if the layout already has one nearby). */
  hideMark?: boolean;
  /** Show just the wordmark text without ".com" accent. */
  hideTld?: boolean;
}

const sizeClasses = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};
const markSizes = { sm: 22, md: 26, lg: 34 };

/**
 * Full wordmark: parrot mark + "hireparrot" + ".com" accent. Inspired by
 * name.com's lowercase Proxima-Bold-with-tld treatment — same visual
 * pattern, applied to our brand. The ".com" is rendered in brand green
 * even when the rest of the word is dark, mimicking the dot-tld accent.
 *
 * On a dark sidebar pass `inverse` to flip the wordmark to white.
 */
export function BrandWordmark({
  className,
  size = "md",
  inverse = false,
  hideMark = false,
  hideTld = false,
}: BrandWordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-bold tracking-tight",
        sizeClasses[size],
        inverse ? "text-white" : "text-slate-900",
        className,
      )}
    >
      {!hideMark && <BrandMark size={markSizes[size]} inverse={inverse} />}
      <span className="select-none">
        hireparrot
        {!hideTld && (
          <span className={inverse ? "text-indigo-300" : "text-indigo-700"}>
            .com
          </span>
        )}
      </span>
    </span>
  );
}
