"use client";

/**
 * CoachScreen — full Coach destination (web).
 *
 * ENG-1240: Today's read + ranked what-to-eat-next + Ask-the-coach chips.
 * Mirror: `apps/mobile/components/coach/CoachScreenView.tsx`.
 */

import Link from "next/link";
import { Info, Sparkles } from "lucide-react";
import type { CoachCandidate } from "@/lib/nutrition/mealCoach";
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
            <span className="shrink-0 rounded-full bg-accent-frost-mist px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-solid">
              Best fit
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {candidate.predictedCalories.toLocaleString()} kcal · {candidate.predictedProtein}g protein
        </p>
        {candidate.whyLine ? (
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{candidate.whyLine}</p>
        ) : null}
      </div>
    </>
  );

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className="flex w-full gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="flex w-full gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      {inner}
    </div>
  );
}

export function CoachScreen({
  narrative,
  narrativeLoading,
  candidates,
  candidatesRefining,
  onCandidatePress,
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
        <SupprCard className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Today&apos;s read
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-frost-mist px-2 py-0.5 text-xs font-medium text-primary-solid">
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
                Log a meal or save a few recipes — ranked suggestions appear once the coach has
                something to work with.
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
                  "rounded-full border border-border bg-card px-4 py-2 text-left text-sm font-medium text-foreground transition-colors",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedChipId === chip.id && "border-primary-solid bg-accent-frost-mist",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {askLoading ? (
            <p className="text-sm text-muted-foreground">Coach is thinking…</p>
          ) : askAnswer ? (
            <SupprCard className="p-4">
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
