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
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";

export interface ProgressStoryGateProps {
  /** Days with ≥1 logged meal in the CURRENT WEEK (the card's window). */
  daysLogged: number;
  /**
   * Whether the account has any logged history at all (journal store,
   * not range-scoped). Switches the copy from cold-start ("your first
   * insight") to new-week framing — mirror of mobile (fresh-eyes
   * 2026-06-10 P0-2 resolution).
   */
  hasHistory?: boolean;
  className?: string;
}

export function ProgressStoryGate({
  daysLogged,
  hasHistory,
  className,
}: ProgressStoryGateProps) {
  const placeholder = buildProgressStoryPlaceholder(daysLogged, { hasHistory });

  // Day-count indicator — STORY_DATA_FLOOR_DAYS discrete ring segments
  // (filled per logged day). Mirror of mobile: the previous continuous
  // arc with a 6% minimum fill (ENG-1006) read as a stuck loading
  // spinner at 0/3 — superseded by segments, structurally visible at 0.
  const RING_SIZE = 24;
  const STROKE = 3;
  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const SEGMENT_GAP = 4; // px of arc between segments
  const segmentCount = STORY_DATA_FLOOR_DAYS;
  const segmentLen = Math.max(2, circumference / segmentCount - SEGMENT_GAP);
  const gapDeg = (SEGMENT_GAP / circumference) * 360;
  // ENG-1081 — white slab by default (cohesion); lilac wash behind the flag-off
  // path. Twin of ProgressHeadline so the slot doesn't change tone on unlock.
  const cohesionWhite = isFeatureEnabled("card_cohesion_white_v1");

  return (
    <SupprCard
      data-slot="progress-story-gate"
      data-testid="progress-story-gate"
      padding="xl"
      /* ENG-1006 — radius="lg" (var(--radius-card-lg) = 24px) matches the
         cream sibling cards (AVERAGE ADHERENCE / weight / daily-calories)
         so the lilac THIS WEEK card shares one corner radius with the
         stack below it. Was radius="xl" (16px), a detectable 8px mismatch. */
      radius="lg"
      className={className}
      style={cohesionWhite ? undefined : PROGRESS_INSIGHT_LILAC_STYLE}
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
          {Array.from({ length: segmentCount }, (_, i) => (
            <circle
              key={i}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke="currentColor"
              className={i < placeholder.segmentsFilled ? "text-primary" : "text-border"}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${segmentLen} ${circumference - segmentLen}`}
              transform={`rotate(${-90 + (i * 360) / segmentCount + gapDeg / 2} ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          ))}
        </svg>
      </div>
      {/* ENG-1006 — 13px label-secondary floor (was 11px, below the spec's
          13–14px body floor and small under the serif headline). Mirror of
          mobile ProgressStoryGate body bump. */}
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
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
