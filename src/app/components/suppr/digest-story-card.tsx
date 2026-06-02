"use client";

/**
 * `<DigestStoryCard>` — always-visible weekly narrative card on
 * Progress (web). Replaces the 2x2 stat-card grid as the visual lead.
 *
 * Authority: D-2026-04-27-17 (Progress is a story, not a stat-card
 * dashboard) + customer-lens audit 2026-04-30.
 *
 * Distinct from:
 *   - `<ProgressHeadline>` — engine-led adaptive-TDEE recap line.
 *   - `<Digest>` — Sunday-evening recap card with share + dismiss.
 *
 * Renders any time `daysLogged > 0`; the empty state is rendered when
 * the count is 0 (calm, factual, no exhortation).
 *
 * Mirror: `apps/mobile/components/progress/DigestStoryCard.tsx`.
 */

import * as React from "react";
import {
  buildDigestStory,
  type DigestStoryInput,
} from "../../../lib/nutrition/digestStory";
import { SupprCard } from "../ui/suppr-card";

export interface DigestStoryCardProps extends DigestStoryInput {
  className?: string;
}

export function DigestStoryCard(props: DigestStoryCardProps) {
  const { className, ...input } = props;
  const story = buildDigestStory(input);
  const isEmpty = input.daysLogged <= 0;

  return (
    <SupprCard
      data-slot="digest-story-card"
      data-testid="digest-story-card"
      padding="xl"
      radius="xl"
      className={className}
      aria-label={
        isEmpty
          ? "Week digest. Quiet week — log a meal to start your story."
          : `Week digest. ${story.paragraph}`
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
          WEEK DIGEST
        </p>
        <p className="text-[11px] tabular-nums text-muted-foreground/80">
          {input.weekLabel}
        </p>
      </div>
      {isEmpty ? (
        <p
          data-testid="digest-story-card-empty"
          className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground"
        >
          Quiet week — log a meal to start your story.
        </p>
      ) : (
        <div className="mt-2.5 space-y-1.5">
          <p
            data-testid="digest-story-days-line"
            className="text-[13px] leading-relaxed font-semibold text-foreground"
          >
            {story.daysLine}
          </p>
          {story.caloriesLine ? (
            <p
              data-testid="digest-story-calories-line"
              className="text-[13px] leading-relaxed text-muted-foreground"
            >
              {story.caloriesLine}
            </p>
          ) : null}
          {story.proteinLine ? (
            <p
              data-testid="digest-story-protein-line"
              className="text-[13px] leading-relaxed text-muted-foreground"
            >
              {story.proteinLine}
            </p>
          ) : null}
          {story.closestLine ? (
            <p
              data-testid="digest-story-closest-line"
              className="text-[13px] leading-relaxed text-muted-foreground"
            >
              {story.closestLine}
            </p>
          ) : null}
          {story.dayOfWeekPatternLine ? (
            <p
              data-testid="digest-story-dow-pattern-line"
              className="text-[13px] leading-relaxed text-muted-foreground"
            >
              {story.dayOfWeekPatternLine}
            </p>
          ) : null}
        </div>
      )}
    </SupprCard>
  );
}

export default DigestStoryCard;
