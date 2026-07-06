"use client";

import * as React from "react";

import type { OnboardingRevealProjection } from "@/lib/onboarding/revealProjection";

export interface OnboardingRevealProjectionChartProps {
  projection: OnboardingRevealProjection;
  /** When true, draws the trendline with a short stroke animation (reveal beat). */
  animate?: boolean;
}

/**
 * ENG-1233 — projected weight trend on the onboarding Reveal step (web).
 * Mirrors the Sloe v3 prototype `.ob-proj` card + mobile twin.
 *
 * ENG-1451: compacted — the full reveal stack (hero + ring + this card)
 * was clipping under the fixed Continue bar at 390×844. Dropped the
 * separate "X kg now / ~N weeks" footer row (the sparkline's own start/
 * end dots plus the one summary line already carry that) and tightened
 * the card padding + sparkline height, so this is sparkline + a single
 * "~{weight} by {date}" line with no dead space, per the design
 * contract. Chart geometry (`revealProjection.ts`) still authors a
 * 300×86 viewBox; `preserveAspectRatio="none"` lets the shorter
 * rendered height vertically compress it — legible at sparkline scale.
 */
export function OnboardingRevealProjectionChart({
  projection,
  animate = false,
}: OnboardingRevealProjectionChartProps) {
  const { startMarker, endMarker } = projection;
  const fmt = (kg: number) => `${kg.toFixed(1).replace(/\.0$/, "")} kg`;

  return (
    <div
      className="mt-4 rounded-2xl border border-border bg-card p-3 text-left shadow-[var(--shadow-card)]"
      data-testid="onboarding-reveal-projection-chart"
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Projected trend
        </span>
        <span className="text-xs text-muted-foreground">
          ~{fmt(projection.endKg)} by{" "}
          <span className="font-medium text-foreground">{projection.dateLabel}</span>
        </span>
      </div>
      <svg
        viewBox="0 0 300 86"
        preserveAspectRatio="none"
        className="h-[52px] w-full"
        aria-hidden
      >
        <polyline
          points={projection.polylinePoints}
          fill="none"
          stroke="var(--success-solid)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animate ? "onboarding-reveal-proj-animate" : undefined}
        />
        <circle
          cx={startMarker.x}
          cy={startMarker.y}
          r={3.5}
          fill="var(--foreground-tertiary)"
        />
        <circle
          cx={endMarker.x}
          cy={endMarker.y}
          r={4}
          fill="var(--success-solid)"
        />
      </svg>
    </div>
  );
}
