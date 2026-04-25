"use client";

/**
 * Tiny, dependency-free SVG radar chart. Given a list of
 * { label, value } pairs (value 0–100), draws a polygon on a polar grid.
 *
 * Why not recharts? The rest of the app doesn't use a chart library; adding
 * one just for this view bloats the bundle. ~80 lines of SVG here.
 *
 * Design:
 *   - White-on-slate grid with 5 rings at 20/40/60/80/100%
 *   - N axis spokes evenly distributed
 *   - Colour polygon filled with 20% alpha + full-colour outline
 *   - Dot at each vertex for tactile feel
 *   - Labels outside each axis; automatically positioned away from the
 *     centre so they don't overlap the polygon
 *   - SVG viewBox is responsive — caller sets the wrapper width.
 */

import { useMemo } from "react";

export interface RadarPoint {
  label: string;
  value: number; // 0..100
}

export interface SkillRadarProps {
  data: RadarPoint[];
  /** Colour for polygon fill/stroke. Default: indigo-600. */
  color?: string;
  /** Max spokes to show — extras are dropped. Keeps layout readable. */
  maxSpokes?: number;
  /** If true, don't show numeric value chips next to labels. */
  hideValueChips?: boolean;
}

export function SkillRadar({
  data,
  color = "#1EAA50",
  maxSpokes = 8,
  hideValueChips = false,
}: SkillRadarProps) {
  const points = data.slice(0, maxSpokes);
  const n = points.length;

  // Nothing to draw. Render an empty placeholder so the calling layout
  // doesn't collapse to 0 height.
  if (n < 3) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
        Need at least 3 skills to draw a radar chart.
      </div>
    );
  }

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 48; // leave room for labels

  // Pre-compute angle + coordinates per point so we can memo across renders
  const { vertices, axes, labelPositions } = useMemo(() => {
    const vs: { x: number; y: number; value: number }[] = [];
    const ax: { x: number; y: number }[] = [];
    const lp: { x: number; y: number; anchor: "start" | "middle" | "end" }[] = [];
    for (let i = 0; i < n; i++) {
      const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n; // start at top, go clockwise
      const v = Math.max(0, Math.min(100, points[i].value)) / 100;
      vs.push({
        x: cx + r * v * Math.cos(angle),
        y: cy + r * v * Math.sin(angle),
        value: points[i].value,
      });
      ax.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
      const lbx = cx + (r + 18) * Math.cos(angle);
      const lby = cy + (r + 18) * Math.sin(angle);
      const anchor: "start" | "middle" | "end" =
        Math.abs(Math.cos(angle)) < 0.1 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
      lp.push({ x: lbx, y: lby, anchor });
    }
    return { vertices: vs, axes: ax, labelPositions: lp };
  }, [n, cx, cy, r, points]);

  const polygon = vertices.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full" role="img" aria-label="Skill radar chart">
        {/* Grid rings */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((t) => (
          <polygon
            key={t}
            points={Array.from({ length: n }, (_, i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
              return `${cx + r * t * Math.cos(a)},${cy + r * t * Math.sin(a)}`;
            }).join(" ")}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}
        {/* Axes */}
        {axes.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {/* Data polygon */}
        <polygon
          points={polygon}
          fill={color}
          fillOpacity="0.18"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Vertex dots */}
        {vertices.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} />
        ))}
        {/* Labels */}
        {points.map((p, i) => (
          <g key={i}>
            <text
              x={labelPositions[i].x}
              y={labelPositions[i].y}
              textAnchor={labelPositions[i].anchor}
              dominantBaseline="middle"
              className="fill-slate-700"
              style={{ fontSize: 11, fontWeight: 500 }}
            >
              {p.label}
            </text>
            {!hideValueChips && (
              <text
                x={labelPositions[i].x}
                y={labelPositions[i].y + 13}
                textAnchor={labelPositions[i].anchor}
                dominantBaseline="middle"
                className="fill-slate-400"
                style={{ fontSize: 10 }}
              >
                {p.value}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
