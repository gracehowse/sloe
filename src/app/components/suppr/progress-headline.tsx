"use client";

/**
 * ProgressHeadline — story-led hero for the Progress surface.
 *
 * Production design spec — 2026-04-27 Surface E "Progress hero
 * (story-led)". Authority: D-2026-04-27-17 (Progress is a story not
 * a stat-card dashboard) + D-2026-04-27-12 (adaptive TDEE always-on,
 * confidence is metadata).
 *
 * Layout:
 *   - Eyebrow `Type.label` primary "THIS WEEK".
 *   - Headline `Type.headline` 17pt 700 — engine-generated commentary.
 *   - Body body-tier 12pt text-secondary — engine commentary explainer
 *     with bolded `tabular-nums` numerals inline.
 *   - <ConfidenceChip> inline at the end of the body.
 *
 * Voice + numbers come from `progressCommentary.ts`. This component
 * is presentation only — it accepts the fully-resolved
 * `ProgressCommentaryResult` and renders the story.
 *
 * Mirror: `apps/mobile/components/today/ProgressHeadline.tsx`.
 */

import * as React from "react";
import { ConfidenceChip } from "../ui/confidence-chip";
import {
  splitBodyIntoSegments,
  type ProgressCommentaryResult,
} from "../../../lib/nutrition/progressCommentary";
import { SupprCard } from "../ui/suppr-card";
import { Icons } from "../ui/icons";

export interface ProgressHeadlineProps {
  commentary: ProgressCommentaryResult;
  className?: string;
}

export function ProgressHeadline({
  commentary,
  className,
}: ProgressHeadlineProps) {
  const segments = splitBodyIntoSegments(commentary.body, commentary.numerals);

  return (
    // ENG-1081 (Grace 2026-06-13: "flat white for now"): the ~12% lilac wash
    // read as a lone grey card beside white siblings — SupprCard's white slab
    // shows unstyled; the ✦ + THIS WEEK eyebrow + serif headline carry the
    // insight role. Was flag-gated (card_cohesion_white_v1); collapsed ENG-1356.
    <SupprCard
      data-slot="progress-headline"
      data-regime={commentary.regime}
      padding="xl"
      radius="xl"
      className={className}
      aria-label="This week"
    >
      {/* Sloe Figma 492:2 — sparkle glyph by the clay THIS WEEK eyebrow. */}
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-primary-solid">
        <Icons.sparkles className="h-3.5 w-3.5" aria-hidden />
        THIS WEEK
      </p>
      <h2
        className="mt-1.5 text-[18px] font-bold leading-snug tracking-[-0.01em] text-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {commentary.headline}
      </h2>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {segments.map((seg, i) =>
          seg.highlight ? (
            <strong
              key={i}
              className="font-semibold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {seg.text}
            </strong>
          ) : (
            <React.Fragment key={i}>{seg.text}</React.Fragment>
          ),
        )}{" "}
        <ConfidenceChip
          level={commentary.confidence}
          className="ml-1 align-middle"
        />
      </p>
    </SupprCard>
  );
}

export default ProgressHeadline;
