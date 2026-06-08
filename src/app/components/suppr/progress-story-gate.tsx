"use client";

/**
 * `<ProgressStoryGate>` — placeholder card rendered in place of the
 * engine-led `<ProgressHeadline>` when the user has fewer than
 * `STORY_DATA_FLOOR_DAYS` (=3) days of logging.
 *
 * Authority: customer-lens audit 2026-04-30 (the live story renders
 * even when `adaptiveTdee == null` — narrative based on null is
 * broken UX) + D-2026-04-27-17.
 *
 * Geometry mirrors `<ProgressHeadline>` so the card slot doesn't
 * jump when the user crosses the threshold and the live story
 * unlocks on the next render.
 *
 * Mirror: `apps/mobile/components/today/ProgressStoryGate.tsx`.
 */

import * as React from "react";
import {
  buildProgressStoryPlaceholder,
  STORY_DATA_FLOOR_DAYS,
} from "../../../lib/nutrition/progressStoryGate";
import { SupprCard } from "../ui/suppr-card";
import { Icons } from "../ui/icons";
import { PROGRESS_INSIGHT_LILAC_STYLE } from "./progress-headline";

export interface ProgressStoryGateProps {
  /** Days with ≥1 logged meal in the rolling window. */
  daysLogged: number;
  className?: string;
}

export function ProgressStoryGate({
  daysLogged,
  className,
}: ProgressStoryGateProps) {
  const placeholder = buildProgressStoryPlaceholder(daysLogged);

  // Ring geometry — single-stroke arc that fills as logged days
  // approach the floor. Snaps closed at 1 once the user reaches the
  // threshold (the live `<ProgressHeadline>` takes over on the next
  // render).
  const RING_SIZE = 24;
  const STROKE = 3;
  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - placeholder.ringFraction);

  return (
    <SupprCard
      data-slot="progress-story-gate"
      data-testid="progress-story-gate"
      padding="xl"
      radius="xl"
      className={className}
      style={PROGRESS_INSIGHT_LILAC_STYLE}
      aria-label={`This week: ${placeholder.headline}. ${placeholder.body} ${placeholder.ringLabel} days logged.`}
    >
      {/* Sloe Figma 492:2 — sparkle glyph by the clay eyebrow, matching the
          live THIS WEEK headline so the slot reads identically pre/post-unlock. */}
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
        <Icons.sparkles className="h-3.5 w-3.5" aria-hidden />
        {placeholder.eyebrow}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <h2
          className="text-[18px] font-bold leading-snug tracking-[-0.01em] text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {placeholder.headline}
        </h2>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          aria-hidden="true"
          data-testid="progress-story-gate-ring"
          className="shrink-0"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke="currentColor"
            className="text-border"
            strokeWidth={STROKE}
            fill="none"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke="currentColor"
            className="text-primary"
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {placeholder.body}
      </p>
      <p
        data-testid="progress-story-gate-ring-label"
        className="mt-2 text-[11px] tabular-nums text-muted-foreground/80"
      >
        {/* V17 (2026-05-11 visual sweep) — see mobile ProgressStoryGate. */}
        {placeholder.ringLabel} days logged · {STORY_DATA_FLOOR_DAYS} needed to unlock
      </p>
    </SupprCard>
  );
}

export default ProgressStoryGate;
