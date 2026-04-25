/**
 * HireParrot brand primitives — wordmark + standalone mark.
 *
 * The mark is a low-poly origami-style parrot, traced from the user-supplied
 * source artwork. Two variants:
 *   - "filled"  (default) — solid silhouette, best at small sizes (nav,
 *                            favicon, button avatars). Reads cleanly down
 *                            to ~16px.
 *   - "outline" — line-art version of the same paths, used when the
 *                 brand wants more breathing room (hero sections, big
 *                 splash blocks). Stroke uses currentColor.
 *
 * Renders in brand green by default; pass `inverse` to flip to white-on-dark
 * for the dashboard sidebar.
 *
 * If we later want to swap to the original PNG artwork (e.g. you upload
 * `/public/brand/parrot-filled.png`), replace the <svg> inside <BrandMark/>
 * with <img src="/brand/parrot-filled.png" …/>; the CSS-driven recolor
 * trick (filter: brightness(0) saturate(100%) invert(…) sepia(…)…) can be
 * tricky for arbitrary brand greens, so prefer SVG when feasible.
 */

import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  className?: string;
  size?: number;
  /** Outline variant for hero/large display contexts. Default false. */
  outline?: boolean;
  /** Inverse colour for dark surfaces (sidebar). */
  inverse?: boolean;
}

/**
 * Geometric parrot mark — bird in profile, facing right, with a long
 * down-left tail. Composed of polygons that stack like origami folds.
 *
 * Coordinates traced approximately from the supplied source artwork.
 * The mark sits inside a 100×100 viewBox; any rendering size scales it.
 */
export function BrandMark({
  className,
  size = 28,
  outline = false,
  inverse = false,
}: BrandMarkProps) {
  // Brand green-700 by default. Inverse → currentColor (lets the dark
  // sidebar drive the colour through `text-white`).
  const fill = inverse ? "currentColor" : "#1EAA50";
  const accent = inverse ? "currentColor" : "#048132";

  // For the outline variant we use stroke instead of fill. Stroke width
  // is tuned so it looks balanced at small sizes without going hairline.
  const strokeProps = outline
    ? { fill: "none", stroke: fill, strokeWidth: 4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const }
    : { fill, stroke: "none" };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
      role="img"
      aria-label="HireParrot mark"
    >
      {/* Top back/wing stripe — parallelogram */}
      <polygon points="55,24 78,22 82,30 60,33" {...strokeProps} />

      {/* Middle wing stripe — wider parallelogram */}
      <polygon points="50,36 80,30 86,42 56,47" {...strokeProps} />

      {/* Bottom body wedge */}
      <polygon points="56,47 86,42 78,55 60,55" {...strokeProps} />

      {/* Beak — small forward-pointing triangle */}
      <polygon points="80,22 92,28 80,30" {...strokeProps} />

      {/* Tail — long thin parallelogram heading down-left */}
      <polygon points="14,80 24,72 52,46 42,54" {...strokeProps} />

      {/* Chest droplet — small downward triangle below the body */}
      <polygon points="64,55 70,68 67,55" {...(outline ? strokeProps : { fill: accent, stroke: "none" })} />

      {/* Eye — tiny dot, only visible on filled variant (negative space
          inside the head reads as the eye). Skipped on outline. */}
      {!outline && (
        <circle cx="78" cy="27" r="0.9" fill="#FFFFFF" />
      )}
    </svg>
  );
}

export interface BrandWordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  inverse?: boolean;
  hideMark?: boolean;
  hideTld?: boolean;
}

const sizeClasses = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};
const markSizes = { sm: 22, md: 28, lg: 38 };

/**
 * Full wordmark: parrot mark + "hireparrot" + ".com" accent.
 * Inspired by name.com's lowercase Proxima-Bold-with-tld treatment.
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
