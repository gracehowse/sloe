"use client";

/**
 * NorthStarBlock — "What to eat next" permanent block on Today (web).
 *
 * Production design spec — 2026-04-27 Surface A §A-northstar.
 * Authority: D-2026-04-27-04. "Promote the gated 'Dinner could hit'
 * suggestion from a card to a permanent block on Today, second thing the
 * eye lands on after the calorie ring. One suggested recipe at a time,
 * swipeable to skip, one tap to log/cook."
 *
 * State branches: `default` (gradient SupprCard), `library-empty`,
 * `over-budget`, `under-eating` (ENG-1454), `no-fit`, `new-user` — the five
 * non-default branches live in `north-star-block-non-default.tsx`.
 *
 * Presentation-only — the caller decides which branch to render via `kind`.
 * Mobile mirror: `apps/mobile/components/today/NorthStarBlock.tsx`.
 */

import * as React from "react";
import { Sparkles, X } from "lucide-react";

import type { OverBudgetStage } from "../../../lib/nutrition/coachOverBudgetStage.ts";
import { NorthStarFigmaHeroBlock } from "./north-star-figma-hero";
import { NorthStarBlockNonDefault } from "./north-star-block-non-default";
import { QuickLogButton } from "./quick-log-button";
import { SupprButton } from "./suppr-button";
import { SupprCard } from "../ui/suppr-card";
import { RecipeHeroFallback } from "./RecipeHeroFallback";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { cn } from "../ui/utils";

export type NorthStarKind =
  | "default"
  | "library-empty"
  | "over-budget"
  // ENG-1454 — single-day under-eating nudge (coaching_stages_v1). Mirrors mobile.
  | "under-eating"
  | "no-fit"
  // ENG-94 (2026-05-13): on a user's very first day — no nutrition
  // history yet — the `default` suggestion card felt presumptuous
  // (algorithm pattern-matching on targets alone, not real intake).
  // Render a calmer "Log your first meal" card instead until ≥ 1
  // meal has been logged anywhere in the user's history. Mirror of
  // the mobile `NorthStarBlock` kind shipped same day.
  | "new-user";

export interface NorthStarBlockSuggestion {
  recipeId: string;
  title: string;
  thumbnail?: string | null;
  /** Predicted calories at the picked portion multiplier. */
  predictedCalories: number;
  predictedProtein: number;
  predictedCarbs: number;
  predictedFat: number;
  /** "Hits within 3%" / "Close fit" / "Roughly fits". */
  bandLabel: string;
  /** Whether the band is "tight" (success-tinted chip) or other. */
  bandTight: boolean;
  /**
   * Activation hook (audit 2026-04-30 — leak fix #5): one-line
   * subtitle explaining WHICH macro the suggestion fits. Without this
   * the user sees "Close fit" but doesn't know what's being fitted —
   * the algorithm reads as a black box. Mirror of the mobile
   * `NorthStarBlock`. Computed by `whyLineForSuggestion` in
   * `northStarSuggestion.ts` and passed in by the host.
   */
  whyLine?: string;
  /**
   * Figma `654:2` hero meta row — optional cook time in minutes. When
   * present a "· {n} min" chip with a Clock glyph renders after the
   * kcal span. Sourced from the recipe (`cookTimeMin`) by the host;
   * absent for recipes with no recorded time — the chip degrades away.
   */
  cookTimeMin?: number;
}

export interface NorthStarBlockProps {
  kind: NorthStarKind;
  /** Required when `kind="default"`. */
  suggestion?: NorthStarBlockSuggestion;
  /** ENG-1454 — staged over-budget copy for `kind="over-budget"`, behind
   *  `coaching_stages_v1`. No stage/flag-off → legacy caption (kill
   *  switch). See `coachOverBudgetStage.ts`. Mirrors mobile. */
  overBudgetStage?: OverBudgetStage;
  /** Consumed/goal calories for the staged line's `{n}`. */
  overBudgetCalories?: { consumed: number; goal: number };
  /** ENG-1454 — copy for `kind="under-eating"`; no copy → renders nothing. */
  underEatingLine?: string;
  /** Time-of-day-adaptive primary CTA label. */
  ctaLabel?: string;
  onPrimaryCta?: () => void;
  /** ENG-1301 (VERIFIED V13) — compact secondary "Log": one-tap logs the
   *  suggested recipe to the suggested slot. The primary CTA keeps routing
   *  to the recipe. Host reuses the existing quick-log insert helper and
   *  owns success feedback; the button owns the loading state. */
  onLogCta?: () => Promise<void> | void;
  /** Skip this suggestion; caller picks the next-best. Web has no
   *  swipe gesture — uses the small `X` button at top-right per
   *  reduce-motion fallback in spec §A-northstar. */
  onSkip?: () => void;
  /** Open Discover / Library — used on the empty / no-fit branches. */
  onBrowse?: () => void;
  /** Open Library — used on `library-empty`. */
  onOpenLibrary?: () => void;
  /** Figma `654:2` slot overline — "Dinner suggestion", etc. */
  slotEyebrow?: string;
  /** Test override for skipping rendering (used in tests). */
  testID?: string;
}

export function NorthStarBlock({
  kind,
  suggestion,
  overBudgetStage: stage,
  overBudgetCalories,
  underEatingLine,
  ctaLabel = "Log it",
  onPrimaryCta,
  onLogCta,
  onSkip,
  onBrowse,
  onOpenLibrary,
  slotEyebrow = "Meal suggestion",
  testID,
}: NorthStarBlockProps) {
  if (kind !== "default") {
    return (
      <NorthStarBlockNonDefault
        kind={kind}
        testID={testID}
        overBudgetStage={stage}
        overBudgetCalories={overBudgetCalories}
        underEatingLine={underEatingLine}
        onOpenLibrary={onOpenLibrary}
        onBrowse={onBrowse}
      />
    );
  }

  // kind === "default"
  if (!suggestion) {
    return null;
  }

  if (isFeatureEnabled("today_meals_figma_654")) {
    return (
      <NorthStarFigmaHeroBlock
        suggestion={suggestion}
        slotEyebrow={slotEyebrow}
        onPrimaryCta={onPrimaryCta}
        onLogCta={onLogCta}
        onSkip={onSkip}
        testID={testID}
      />
    );
  }

  return (
    <NorthStarDefaultBlock
      suggestion={suggestion}
      ctaLabel={ctaLabel}
      onPrimaryCta={onPrimaryCta}
      onLogCta={onLogCta}
      onSkip={onSkip}
      testID={testID}
    />
  );
}

// NorthStarFigmaHeroBlock extracted to `north-star-figma-hero.tsx` (ENG-1301)
// so this file stays under its screen-budget pin; behaviour unchanged there
// apart from the new compact secondary Log action.

function NorthStarDefaultBlock({
  suggestion,
  ctaLabel,
  onPrimaryCta,
  onLogCta,
  onSkip,
  testID,
}: {
  suggestion: NorthStarBlockSuggestion;
  ctaLabel: string;
  onPrimaryCta?: () => void;
  onLogCta?: () => Promise<void> | void;
  onSkip?: () => void;
  testID?: string;
}) {
  const [whyOpen, setWhyOpen] = React.useState(false);

  return (
    // 2026-05-12 (premium-bar audit web parity, DC2 polish): 200ms
    // fade-up entrance using the shared `.v2-fade-up` keyframe so
    // the card lands as a deliberate moment, not a pop-in. Mirrors
    // mobile's 220ms reanimated fade-up. Honours
    // `prefers-reduced-motion: reduce` via the existing theme.css
    // reduce-motion override.
    <SupprCard
      elevation="card"
      data-slot="north-star-default"
      data-testid={testID}
      tone="primary"
      gradient
      padding="md"
      radius="lg"
      className="relative flex flex-row items-stretch gap-3 v2-fade-up"
    >
      {onSkip ? (
        <button
          type="button"
          aria-label="Skip this suggestion"
          onClick={onSkip}
          className={cn(
            "absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full",
            "text-muted-foreground/70 hover:text-muted-foreground hover:bg-background/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        >
          <X width={14} height={14} aria-hidden />
        </button>
      ) : null}

      {/* 2026-05-14 (premium-bar audit DC2 polish — Recime hero image,
          web parity): bumped 56→64 + radius lg→md (8) to match the
          mobile `<NorthStarBlock>` spec. The thumbnail is the trust
          signal that converts the suggestion into "yes I want that";
          56 read as an avatar, 64 reads as a proper thumbnail. */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg relative">
        {suggestion.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={suggestion.thumbnail} alt="" className="h-full w-full object-cover rounded-lg" />
        ) : (
          <RecipeHeroFallback id={suggestion.recipeId} title={suggestion.title} iconSize={28} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-primary-solid">
          <Sparkles aria-hidden width={10} height={10} />
          What to eat next
        </span>
        {/* 2026-05-13 (premium-bar audit DC2 polish — Recime
            multi-line + line-clamp(2)): web title now matches the
            mobile pattern (`numberOfLines={2}`) so long recipe
            titles wrap to a second line cleanly instead of
            mid-word truncating. */}
        <span className="text-[15px] font-bold leading-tight line-clamp-2">{suggestion.title}</span>
        {suggestion.whyLine ? (
          <>
            <button
              type="button"
              onClick={() => setWhyOpen(true)}
              className="text-left text-[11px] text-muted-foreground leading-tight underline decoration-dotted underline-offset-2 hover:text-foreground"
              aria-label={`${suggestion.whyLine}. Open why this recommendation.`}
            >
              {suggestion.whyLine}
            </button>
            <Dialog open={whyOpen} onOpenChange={setWhyOpen}>
              <DialogContent className="bg-card border-border max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Why this suggestion?</DialogTitle>
                  <DialogDescription asChild>
                    <div className="space-y-3 text-[13px] text-muted-foreground leading-relaxed">
                      <p>{suggestion.whyLine}</p>
                      <p>Macro fit: {suggestion.bandLabel.toLowerCase()}.</p>
                      <p>
                        Predicted: {suggestion.predictedCalories} kcal ·{" "}
                        {Math.round(suggestion.predictedProtein)}g P ·{" "}
                        {Math.round(suggestion.predictedCarbs)}g C ·{" "}
                        {Math.round(suggestion.predictedFat)}g F.
                      </p>
                      <p>
                        Sloe picks the saved recipe that best closes the gap to your remaining macros for
                        today. Skip (×) to see another candidate.
                      </p>
                    </div>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-band={suggestion.bandTight ? "tight" : "soft"}
            className={cn(
              "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold",
              suggestion.bandTight
                ? "bg-success/10 text-success-solid"
                : "bg-muted text-muted-foreground",
            )}
          >
            {suggestion.bandLabel}
          </span>
          {/* 2026-05-12 (premium-bar audit cross-cutting): macro
              format unified to `698 kcal · 22g P · 95g C · 27g F`
              across Today + Eat Again. Web mirrors mobile. */}
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {suggestion.predictedCalories} kcal · {Math.round(suggestion.predictedProtein)}g P · {Math.round(suggestion.predictedCarbs)}g C · {Math.round(suggestion.predictedFat)}g F
          </span>
        </div>

        {/* Button system (2026-06-12,
            `docs/decisions/2026-06-12-button-system-solid-primary.md`):
            the "what to eat next" CTA is this card's ONE primary action →
            `SupprButton` variant="primary" (solid aubergine fill, white
            label, pill, no shadow — the solid fill IS the affordance).
            Supersedes the old aubergine-OUTLINE treatment which read
            weak/floating on the flat cream ground. The FAB stays the
            screen-level loudest pixel (FAB-excepted from one-per-screen).
            Mirror of mobile `NorthStarBlock.tsx`. */}
        <div className="mt-1 flex items-center gap-2 self-start">
          <SupprButton
            variant="primary"
            onClick={onPrimaryCta}
            className="h-9"
          >
            {ctaLabel}
          </SupprButton>
          {/* ENG-1301 — compact secondary Log (ghost, per the 2026-06-12
              button system): one-tap logs the suggested recipe to the
              suggested slot; the primary keeps routing to the recipe. */}
          {onLogCta ? (
            <QuickLogButton
              testID="north-star-log-cta"
              onLog={onLogCta}
              ariaLabel={`Log ${suggestion.title}`}
            />
          ) : null}
        </div>
      </div>
    </SupprCard>
  );
}

export default NorthStarBlock;
