"use client";

/**
 * CoachScreen — full Coach destination (web).
 *
 * ENG-1240: Today's read + ranked what-to-eat-next + Ask-the-coach chips.
 * Mirror: `apps/mobile/components/coach/CoachScreenView.tsx`.
 */

import Link from "next/link";
import { Info, Sparkles } from "lucide-react";
import { coachEmptyStateCopy, type CoachCandidate } from "@/lib/nutrition/mealCoach";
import {
  COACH_ASK_CHIPS,
  type CoachAskChipId,
} from "@/lib/nutrition/coachAsk";
import { SupprCard } from "../ui/suppr-card";
import { RecipeHeroFallback } from "./RecipeHeroFallback";
import { cn } from "../ui/utils";

export interface CoachScreenProps {
  narrative: string;
  narrativeLoading?: boolean;
  candidates: readonly CoachCandidate[];
  candidatesRefining?: boolean;
  onCandidatePress?: (recipeId: string) => void;
  /** Saved-recipe library size — distinguishes the over-budget empty state
   *  from the genuinely-no-recipes one (ENG-1294). */
  librarySize: number;
  /** Remaining calories for the day (≤ 0 when at/over target). */
  remainingCalories: number;
  selectedChipId: CoachAskChipId | null;
  askAnswer: string | null;
  askLoading: boolean;
  onAskChip: (chipId: CoachAskChipId) => void;
  backHref?: string;
}

function CoachCandidateRow({
  candidate,
  isBest,
  onPress,
}: {
  candidate: CoachCandidate;
  isBest: boolean;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl">
        {candidate.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <RecipeHeroFallback title={candidate.title} id={candidate.recipeId} className="h-full w-full rounded-xl" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-foreground line-clamp-2">{candidate.title}</p>
          {isBest ? (
            // Sanctioned soft-tint badge pair (`bg-primary-soft` +
            // `text-primary-solid`) — same as the selected filter chips in
            // DiscoverFeed / MealPlanner / FastingTimer; AA in dark (the old
            // `bg-accent-frost-mist` token never existed). ENG-1294.
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-solid">
              Best fit
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          Est. {candidate.predictedCalories.toLocaleString()} kcal · {candidate.predictedProtein}g protein
        </p>
        {candidate.whyLine ? (
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{candidate.whyLine}</p>
        ) : null}
      </div>
    </>
  );

  // Row chrome routed through <SupprCard elevation="card"> (ENG-1294) — the
  // same soft-lift page-ground treatment mobile's rows use, replacing the
  // hand-rolled `rounded-2xl border shadow-sm` div. Clickable-card pattern
  // per Library.tsx / DiscoverFeed.tsx; pressed state per the
  // discover-collections `active:scale-[0.99]` convention.
  if (onPress) {
    return (
      <SupprCard
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onPress();
        }}
        elevation="card"
        padding="lg"
        className="flex w-full gap-3 text-left cursor-pointer transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {inner}
      </SupprCard>
    );
  }

  return (
    <SupprCard elevation="card" padding="lg" className="flex w-full gap-3">
      {inner}
    </SupprCard>
  );
}

export function CoachScreen({
  narrative,
  narrativeLoading,
  candidates,
  candidatesRefining,
  onCandidatePress,
  librarySize,
  remainingCalories,
  selectedChipId,
  askAnswer,
  askLoading,
  onAskChip,
  backHref = "/today",
}: CoachScreenProps) {
  return (
    <div className="min-h-screen bg-background" data-testid="coach-screen">
      <header className="flex h-16 w-full items-center justify-between border-b border-border bg-background px-4">
        <Link
          href={backHref}
          className="-ml-1 p-1 text-foreground-brand hover:opacity-80"
          aria-label="Back to Today"
        >
          ←
        </Link>
        <h1 className="font-[family-name:var(--font-headline)] text-xl text-foreground-brand">
          Your coach
        </h1>
        <span className="w-8" aria-hidden />
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 pb-12">
        {/* Digest card — explicit soft-lift page-ground treatment
            (`elevation="card"`, 20px padding), matching the Today/Progress
            content-card siblings (digest-story-card,
            progress-activity-section) and mobile's `lift="soft"
            padding="lg"`. ENG-1294. */}
        <SupprCard elevation="card" padding="xl" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Today&apos;s read
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-solid">
              <Sparkles className="h-3 w-3" aria-hidden />
              Coach
            </span>
          </div>
          {narrativeLoading ? (
            <p className="text-sm text-muted-foreground">Reading your day…</p>
          ) : (
            <p className="font-[family-name:var(--font-headline)] text-base leading-relaxed text-foreground">
              {narrative}
            </p>
          )}
        </SupprCard>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-[family-name:var(--font-headline)] text-lg text-foreground">
              What to eat next
            </h2>
            <span className="text-xs text-muted-foreground">from your cookbook</span>
          </div>
          <div className="space-y-2">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {coachEmptyStateCopy({ librarySize, remainingCalories })}
              </p>
            ) : (
              candidates.map((c, i) => (
                <CoachCandidateRow
                  key={c.recipeId}
                  candidate={c}
                  isBest={i === 0}
                  onPress={
                    onCandidatePress ? () => onCandidatePress(c.recipeId) : undefined
                  }
                />
              ))
            )}
          </div>
          {candidatesRefining ? (
            <p className="text-xs text-muted-foreground">Refining order…</p>
          ) : null}
          <p className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Ranked from your saved recipes against what&apos;s left today. Numbers are always your
            own.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-lg text-foreground">
            Ask the coach
          </h2>
          <div className="flex flex-col items-start gap-2">
            {COACH_ASK_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                disabled={askLoading && selectedChipId === chip.id}
                onClick={() => onAskChip(chip.id)}
                className={cn(
                  // 16px/8px chip step + body-size (14px) label — snapped to
                  // the same scale mobile's ask chips use (Spacing.md /
                  // Spacing.sm / Type.body). Selected fill is the sanctioned
                  // `bg-primary-soft` pair (selected-chip siblings in
                  // DiscoverFeed / MealPlanner / FastingTimer). ENG-1294.
                  "rounded-full border border-border bg-card px-4 py-2 text-left text-sm font-medium text-foreground transition-colors",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedChipId === chip.id && "border-primary-solid bg-primary-soft",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {askLoading ? (
            <p className="text-sm text-muted-foreground">Coach is thinking…</p>
          ) : askAnswer ? (
            <SupprCard elevation="card" padding="xl">
              <p className="text-sm leading-relaxed text-foreground">{askAnswer}</p>
            </SupprCard>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Sloe is a tracking tool, not a medical or dietary advisor.
          </p>
        </section>
      </div>
    </div>
  );
}
