/**
 * HireParrot brand primitives — wordmark + standalone mark.
 *
 * Both components render the SVG assets at /public/brand/. The wordmark
 * is the full lockup (orange parrot + "HireParrot" type). The mark is
 * the parrot only, square-ish viewBox — used for favicons, button
 * avatars, and tight slots where the wordmark is too wide.
 *
 * The orange parrot keeps its colour in both light and dark contexts;
 * only the "HireParrot" word switches (black on light, white on dark)
 * via the `inverse` prop, which selects the alt SVG file.
 */

import { cn } from "@/lib/utils";

const WORDMARK_SRC = {
  default: "/brand/hireparrot-wordmark.svg",       // orange mark + black text
  inverse: "/brand/hireparrot-wordmark-light.svg", // orange mark + white text
};
const MARK_SRC = "/brand/hireparrot-mark.svg";

export interface BrandMarkProps {
  className?: string;
  /** Pixel size for both width + height (mark is square-ish, ~1.56:1). */
  size?: number;
  /** Kept for API compatibility — the SVG asset already has the brand
   *  orange baked in, so this prop is a no-op now. */
  outline?: boolean;
  /** Kept for API compat. */
  inverse?: boolean;
}

export function BrandMark({
  className,
  size = 28,
  // outline + inverse intentionally ignored — see above.
}: BrandMarkProps) {
  return (
    <img
      src={MARK_SRC}
      alt=""
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
      style={{ height: size, width: "auto", display: "inline-block" }}
    />
  );
}

export interface BrandWordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  inverse?: boolean;
  /** Legacy props from the old name.com-style wordmark — no longer
   *  meaningful (the SVG is one piece). Kept so existing call sites
   *  don't break TypeScript. */
  hideMark?: boolean;
  hideTld?: boolean;
}

const HEIGHTS_PX: Record<NonNullable<BrandWordmarkProps["size"]>, number> = {
  sm: 22,
  md: 32,
  lg: 44,
};

export function BrandWordmark({
  className,
  size = "md",
  inverse = false,
}: BrandWordmarkProps) {
  const h = HEIGHTS_PX[size];
  return (
    <img
      src={inverse ? WORDMARK_SRC.inverse : WORDMARK_SRC.default}
      alt="HireParrot"
      height={h}
      className={cn("inline-block shrink-0 select-none", className)}
      style={{ height: h, width: "auto", display: "inline-block" }}
    />
  );
}
