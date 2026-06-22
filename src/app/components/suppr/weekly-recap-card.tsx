"use client";

import * as React from "react";

/**
 * WeeklyRecapCard — the shareable Sloe weekly recap (ENG-1225 gap #4), the
 * viral-growth artifact from the TikTok/IG plan. A self-contained SVG card on
 * the v3 "brand lacquer" surface (deep-plum gradient + frost bloom,
 * `Sloe-App.html` L2404-2406) carrying the week's on-target days, a 7-day
 * sparkline, a short narrative, and the `sloe.co` watermark.
 *
 * It renders as ONE `<svg>` so Save/Share can rasterise it to a PNG with no
 * dependency (serialise → <img> → canvas → blob). The card is purely
 * presentational; the host supplies the week's real stats.
 */
export interface WeeklyRecapCardProps {
  /** e.g. "16–22 Jun" */
  weekLabel: string;
  /** Days on target this week, 0–7. */
  onTargetDays: number;
  /** 7 daily calories (Mon→Sun) for the sparkline; null = no log that day. */
  dailyCalories: (number | null)[];
  /** Target calories — the sparkline baseline. */
  targetCalories: number;
  /** One-line narrative, e.g. "A steady, consistent week." */
  narrative: string;
  /** Square (1:1) for feed posts, or portrait (4:5) for stories. */
  ratio?: "square" | "portrait";
  /** px width of the rendered card (height derives from ratio). */
  width?: number;
  className?: string;
}

const PLUM_A = "#6a4b7a";
const PLUM_B = "#3b2a4d";
const PLUM_C = "#1d1329";
const SAGE = "#93C08C";
const FROST = "#C9C2D6";

export function WeeklyRecapCard({
  weekLabel,
  onTargetDays,
  dailyCalories,
  targetCalories,
  narrative,
  ratio = "portrait",
  width = 320,
  className,
}: WeeklyRecapCardProps) {
  const uid = React.useId().replace(/:/g, "");
  // Authoring viewBox: 1080 wide (Instagram-grade); 1080×1080 or 1080×1350.
  const VW = 1080;
  const VH = ratio === "square" ? 1080 : 1350;
  const height = Math.round((width * VH) / VW);

  // Sparkline geometry — 7 bars across a band near the lower third.
  const plotX = 120;
  const plotW = VW - 240;
  const plotBottom = VH - 360;
  const plotH = 300;
  const maxCal = Math.max(targetCalories * 1.25, ...dailyCalories.map((d) => d ?? 0), 1);
  const barGap = 26;
  const barW = (plotW - barGap * 6) / 7;
  const targetY = plotBottom - (targetCalories / maxCal) * plotH;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VW} ${VH}`}
      className={className}
      data-testid="weekly-recap-card"
      role="img"
      aria-label={`Sloe weekly recap, ${weekLabel}: ${onTargetDays} of 7 days on target. ${narrative}`}
    >
      <defs>
        <linearGradient id={`wr-bg-${uid}`} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor={PLUM_A} />
          <stop offset="64%" stopColor={PLUM_B} />
          <stop offset="100%" stopColor={PLUM_C} />
        </linearGradient>
        <radialGradient id={`wr-bloom-${uid}`} cx="50%" cy="-14%" r="80%">
          <stop offset="0%" stopColor={FROST} stopOpacity="0.16" />
          <stop offset="56%" stopColor={FROST} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`wr-bar-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SAGE} />
          <stop offset="100%" stopColor={SAGE} stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Lacquer ground + frost bloom */}
      <rect x="0" y="0" width={VW} height={VH} rx="0" fill={`url(#wr-bg-${uid})`} />
      <rect x="0" y="0" width={VW} height={VH} fill={`url(#wr-bloom-${uid})`} />

      {/* Eyebrow + wordmark */}
      <text x="120" y="200" fill="#FFFFFF" fillOpacity="0.62" fontSize="34" fontWeight="700" letterSpacing="6" fontFamily="Inter, sans-serif">
        YOUR WEEK · {weekLabel.toUpperCase()}
      </text>

      {/* Hero stat — on-target days, serif */}
      <text x="120" y="430" fill="#FFFFFF" fontSize="240" fontWeight="600" fontFamily="Newsreader, Georgia, serif">
        {onTargetDays}
        <tspan fontSize="120" fillOpacity="0.7">/7</tspan>
      </text>
      <text x="120" y="510" fill="#FFFFFF" fillOpacity="0.82" fontSize="46" fontWeight="500" fontFamily="Inter, sans-serif">
        days on target
      </text>

      {/* Narrative */}
      <text x="120" y="620" fill="#FFFFFF" fillOpacity="0.78" fontSize="40" fontFamily="Newsreader, Georgia, serif" fontStyle="italic">
        {narrative.length > 52 ? `${narrative.slice(0, 51)}…` : narrative}
      </text>

      {/* Target baseline */}
      <line x1={plotX} y1={targetY} x2={plotX + plotW} y2={targetY} stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="3" strokeDasharray="10 12" />

      {/* 7-day sparkline */}
      {dailyCalories.map((cal, i) => {
        const x = plotX + i * (barW + barGap);
        if (cal == null || cal <= 0) {
          return <rect key={i} x={x} y={plotBottom - 8} width={barW} height={8} rx={4} fill="#FFFFFF" fillOpacity="0.18" />;
        }
        const h = Math.max(10, (cal / maxCal) * plotH);
        const over = cal > targetCalories;
        return (
          <rect
            key={i}
            x={x}
            y={plotBottom - h}
            width={barW}
            height={h}
            rx={12}
            fill={over ? "#E08A5F" : `url(#wr-bar-${uid})`}
          />
        );
      })}
      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
        <text key={i} x={plotX + i * (barW + barGap) + barW / 2} y={plotBottom + 56} fill="#FFFFFF" fillOpacity="0.5" fontSize="32" fontFamily="Inter, sans-serif" textAnchor="middle">
          {d}
        </text>
      ))}

      {/* Watermark */}
      <text x={VW / 2} y={VH - 90} fill="#FFFFFF" fillOpacity="0.7" fontSize="42" fontWeight="600" letterSpacing="2" fontFamily="Newsreader, Georgia, serif" textAnchor="middle">
        sloe.co
      </text>
    </svg>
  );
}

/**
 * Rasterise a rendered recap `<svg>` to a PNG blob — no dependency. Serialises
 * the live SVG, paints it onto a 2× canvas, returns the blob for Save/Share.
 */
export async function recapSvgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const vb = svg.viewBox.baseVal;
  const w = (vb && vb.width) || svg.clientWidth || 1080;
  const h = (vb && vb.height) || svg.clientHeight || 1350;
  const xml = new XMLSerializer().serializeToString(svg);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("recap SVG render failed"));
    img.src = svgUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("recap PNG encode failed"))), "image/png"),
  );
}

export default WeeklyRecapCard;
