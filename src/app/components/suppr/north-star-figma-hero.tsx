"use client";

import * as React from "react";
import { Check, Clock, Flame, X } from "lucide-react";

import { QuickLogButton } from "./quick-log-button";
import { RecipeHeroFallback } from "./RecipeHeroFallback";
import { recipeUnderlayColor } from "../../../lib/recipe/recipeHeroFallback";
import { useFallbackScheme } from "../../../lib/theme/useFallbackScheme";
import { cn } from "../ui/utils";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { formatQualifiedKcal } from "../../../lib/nutrition/formatMacro";
import { totalRecipeDurationMin } from "../../../lib/recipes/totalDuration";
import type { NorthStarBlockSuggestion } from "./north-star-block";

/**
 * NorthStarFigmaHeroBlock — the Figma `654:2` full-bleed "What to eat next"
 * hero variant (flag `today_meals_figma_654`). Extracted from
 * `north-star-block.tsx` (ENG-1301) so the block file stays under its
 * screen-budget pin; behaviour unchanged apart from the new compact
 * secondary "Log" action (ENG-1301): the whole-card press still routes to
 * the recipe; the on-image pill commits the suggested recipe to the
 * suggested slot in one tap.
 *
 * Mobile mirror: `apps/mobile/components/today/NorthStarFigmaHero.tsx`.
 */
export function NorthStarFigmaHeroBlock({
  suggestion,
  slotEyebrow,
  onPrimaryCta,
  onSkip,
  onLogCta,
  testID,
}: {
  suggestion: NorthStarBlockSuggestion;
  slotEyebrow: string;
  onPrimaryCta?: () => void;
  onSkip?: () => void;
  /** ENG-1301 — one-tap quick-log of the suggested recipe to the suggested
   *  slot. Host reuses the existing quick-log insert helper. */
  onLogCta?: () => Promise<void> | void;
  testID?: string;
}) {
  const showFitsBadge = suggestion.bandTight || suggestion.bandLabel.toLowerCase().includes("close");
  // ENG-1617 — total (prep + cook), not cook alone.
  const totalMin = totalRecipeDurationMin(suggestion.prepTimeMin, suggestion.cookTimeMin);
  // ENG-1417 — flag-gated "~" qualifier when the suggestion's macros are an
  // unverified estimate rather than a verified nutrition lookup. Off →
  // exact pre-ENG-1417 kcal display (kill switch).
  const kcalDisplay = isFeatureEnabled("kcal_trust_qualifier_v1")
    ? formatQualifiedKcal(suggestion.predictedCalories, suggestion.isVerified)
    : String(suggestion.predictedCalories);
  const fallbackScheme = useFallbackScheme(); // ENG-1528 — dark ramp underlay on dark cards

  return (
    <section className="mb-10" data-testid={testID ?? "north-star-figma-hero"}>
      <h3 className="font-[family-name:var(--font-headline)] text-2xl text-foreground-brand mb-4">
        What to eat next
      </h3>
      {/* ENG-1266 a11y (axe nested-interactive): card is a plain <div>; the
          whole-card tap is a full-bleed <button> (z-15) under the Skip
          <button> (z-20); badge + footer are pointer-events-none overlays. */}
      <div
        className={cn(
          // Flat-card surfaces (2026-06-12): hero lift retired — mobile twin
          // NorthStarBlock.figmaHeroCard flattened in the same wave.
          "relative block w-full h-80 rounded-2xl overflow-hidden",
        )}
        // ENG-1374 PR 2 — opaque cuisine-tint underlay on the wrapper
        // (never page white, whatever the child does).
        style={{ backgroundColor: recipeUnderlayColor({ id: suggestion.recipeId, title: suggestion.title }, fallbackScheme) }}
      >
        <div className="absolute inset-0 z-0">
          {suggestion.thumbnail ? (
            /* ENG-1623 — decorative alt="" is deliberate: the full-bleed
               <button aria-label={`${slotEyebrow}: ${suggestion.title}...`}>
               below already carries the recipe name, plus the visible
               <h4>{suggestion.title}</h4> footer overlay. See the
               decorative-vs-informative rule in suppr/discover-recipe-image.tsx. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={suggestion.thumbnail}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <RecipeHeroFallback
              id={suggestion.recipeId}
              title={suggestion.title}
              iconSize={48}
              variant="hero"
              className="h-full w-full"
            />
          )}
        </div>
        {/* Two-layer scrim per Figma 654:165-166: a flat base overlay
            (z-5) under the bottom-up gradient (z-10) so the footer text
            keeps contrast even where the photo is light at the bottom. */}
        <div className="absolute inset-0 z-[5] bg-[rgba(34,27,38,0.2)]" aria-hidden />
        <div
          className="absolute inset-0 z-10 bg-gradient-to-t from-[#221B26]/90 via-[#221B26]/20 to-transparent"
          aria-hidden
        />
        {/* Whole-card primary action — full-bleed, sits under the Skip
            button in z-order so Skip stays tappable. */}
        <button
          type="button"
          onClick={onPrimaryCta}
          aria-label={`${slotEyebrow}: ${suggestion.title}, ${kcalDisplay} kcal`}
          className={cn(
            "absolute inset-0 z-[15] rounded-2xl",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
          )}
        />
        {showFitsBadge ? (
          <span className="pointer-events-none absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-success/90 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
            <Check width={14} height={14} aria-hidden />
            Fits your day
          </span>
        ) : null}
        {onSkip ? (
          <button
            type="button"
            aria-label="Skip this suggestion"
            onClick={onSkip}
            className="absolute right-3 top-3 z-20 grid h-7 w-7 place-items-center rounded-full bg-black/30 text-white/90 hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X width={14} height={14} aria-hidden />
          </button>
        ) : null}
        <div className="pointer-events-none absolute bottom-0 left-0 z-20 flex w-full items-end gap-3 p-5 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[1px] text-[rgba(201,194,214,0.9)] mb-1 font-medium">
              {slotEyebrow}
            </p>
            <h4 className="font-[family-name:var(--font-headline)] text-2xl mb-1 text-white line-clamp-2">
              {suggestion.title}
            </h4>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <span className="inline-flex items-center gap-1">
                <Flame width={14} height={14} aria-hidden />
                {kcalDisplay} kcal
              </span>
              {totalMin !== null ? (
                <>
                  <span className="inline-block h-1 w-1 rounded-full bg-white/40" aria-hidden />
                  <span className="inline-flex items-center gap-1">
                    <Clock width={14} height={14} aria-hidden />
                    {totalMin} min
                  </span>
                </>
              ) : null}
            </div>
          </div>
          {/* ENG-1301 — compact secondary Log, bottom-right in the footer row
              (the skip button's on-image grammar). `pointer-events-auto`
              re-enables interaction inside the pointer-events-none footer,
              sitting above the full-card z-15 button. */}
          {onLogCta ? (
            <QuickLogButton
              testID="north-star-log-cta"
              appearance="onImage"
              onLog={onLogCta}
              ariaLabel={`Log ${suggestion.title}`}
              className="pointer-events-auto shrink-0"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default NorthStarFigmaHeroBlock;
