"use client";

/**
 * NorthStarBlock — "What to eat next" permanent block on Today (web).
 *
 * Production design spec — 2026-04-27 Surface A §A-northstar.
 * Authority: D-2026-04-27-04.
 *
 * "Promote the gated 'Dinner could hit' suggestion from a card to a
 *  permanent block on Today, second thing the eye lands on after the
 *  calorie ring. One suggested recipe at a time, swipeable to skip,
 *  one tap to log/cook."
 *
 * The block has four state branches:
 *   - `default`         — gradient SupprCard with thumb / body / CTA.
 *   - `library-empty`   — primary-tinted invitation when library < 5.
 *   - `over-budget`     — calm caption replaces block when ring is over.
 *   - `no-fit`          — caption "Library has nothing under your
 *                         remaining macros today" + Browse link.
 *
 * The component is presentation-only. The caller decides which branch
 * to render based on `kind`.
 *
 * Mobile mirror: `apps/mobile/components/today/NorthStarBlock.tsx`.
 */

import * as React from "react";
import { Check, ChevronRight, Clock, Flame, Sparkles, X } from "lucide-react";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { SupprButton } from "./suppr-button";
import { SupprCard } from "../ui/suppr-card";
import { RecipeHeroFallback } from "./RecipeHeroFallback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { cn } from "../ui/utils";

export type NorthStarKind =
  | "default"
  | "library-empty"
  | "over-budget"
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
  thumbnail?: string;
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
  /** Time-of-day-adaptive primary CTA label. */
  ctaLabel?: string;
  onPrimaryCta?: () => void;
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
  ctaLabel = "Log it",
  onPrimaryCta,
  onSkip,
  onBrowse,
  onOpenLibrary,
  slotEyebrow = "Meal suggestion",
  testID,
}: NorthStarBlockProps) {
  if (kind === "over-budget") {
    return (
      <div data-slot="north-star-over-budget" data-testid={testID} className="px-1 py-2">
        <p className="text-[13px] text-muted-foreground">
          You've hit your calories for today — eat freely, or save for tomorrow.
        </p>
      </div>
    );
  }

  if (kind === "new-user") {
    return (
      <SupprCard
        elevation="card"
        data-slot="north-star-new-user"
        data-testid={testID}
        tone="primary"
        gradient
        padding="md"
        className="flex flex-row items-center gap-3"
      >
        <Sparkles aria-hidden width={18} height={18} className="text-primary shrink-0" />
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-[13px] font-semibold">
            Log your first meal — suggestions get smarter once we've seen you eat.
          </p>
        </div>
      </SupprCard>
    );
  }

  if (kind === "library-empty") {
    // ENG-1198: brought into parity with mobile's flattened inset-row grammar
    // (mobile shipped 2026-05-23). The whole row is the tap target; the sparkle
    // → primary-solid (accent "feature, tap me" signal), the chevron →
    // foreground-secondary (one step up from tertiary, not primary), and the row
    // sits in a quiet-fill affordance so it reads as a tappable pill rather than
    // greyed-out placeholder text. Replaces the older gradient-card + solid
    // "Open Library →" button, which was a structural + copy drift from mobile.
    return (
      <button
        type="button"
        data-slot="north-star-library-empty"
        data-testid={testID}
        onClick={onOpenLibrary}
        aria-label="Pick recipes for your library"
        className={cn(
          "flex w-full flex-row items-center gap-3 rounded-lg bg-fill-quiet px-3 py-3 text-left",
          "transition-opacity hover:opacity-80 active:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        )}
      >
        <Sparkles aria-hidden width={18} height={18} className="shrink-0 text-primary-solid" />
        <span className="flex-1 text-[14px] text-foreground-secondary">
          Pick a few recipes — we'll suggest from there.
        </span>
        <ChevronRight aria-hidden width={18} height={18} className="shrink-0 text-foreground-secondary" />
      </button>
    );
  }

  if (kind === "no-fit") {
    return (
      <SupprCard
        elevation="card"
        data-slot="north-star-no-fit"
        data-testid={testID}
        tone="neutral"
        padding="md"
        className="flex flex-row items-center gap-3"
      >
        <p className="flex-1 text-[13px] text-muted-foreground">
          Library has nothing under your remaining macros today.
        </p>
        <button
          type="button"
          onClick={onBrowse}
          className="shrink-0 text-[11px] font-semibold text-primary-solid hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          Browse →
        </button>
      </SupprCard>
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
      onSkip={onSkip}
      testID={testID}
    />
  );
}

function NorthStarFigmaHeroBlock({
  suggestion,
  slotEyebrow,
  onPrimaryCta,
  onSkip,
  testID,
}: {
  suggestion: NorthStarBlockSuggestion;
  slotEyebrow: string;
  onPrimaryCta?: () => void;
  onSkip?: () => void;
  testID?: string;
}) {
  const showFitsBadge = suggestion.bandTight || suggestion.bandLabel.toLowerCase().includes("close");
  const cookMin =
    typeof suggestion.cookTimeMin === "number" && suggestion.cookTimeMin > 0
      ? suggestion.cookTimeMin
      : null;

  return (
    <section className="mb-10" data-testid={testID ?? "north-star-figma-hero"}>
      <h3 className="font-[family-name:var(--font-headline)] text-2xl text-foreground-brand mb-4">
        What to eat next
      </h3>
      <button
        type="button"
        onClick={onPrimaryCta}
        className={cn(
          // Flat-card surfaces (2026-06-12): hero lift retired — mobile twin
          // NorthStarBlock.figmaHeroCard flattened in the same wave.
          "relative block w-full h-80 rounded-2xl overflow-hidden text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        )}
        aria-label={`${slotEyebrow}: ${suggestion.title}, ${suggestion.predictedCalories} kcal`}
      >
        <div className="absolute inset-0 z-0">
          {suggestion.thumbnail ? (
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
        {showFitsBadge ? (
          <span className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-success/90 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
            <Check width={14} height={14} aria-hidden />
            Fits your day
          </span>
        ) : null}
        {onSkip ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Skip this suggestion"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onSkip();
              }
            }}
            className="absolute right-3 top-3 z-20 grid h-7 w-7 place-items-center rounded-full bg-black/30 text-white/90 hover:bg-black/45"
          >
            <X width={14} height={14} aria-hidden />
          </span>
        ) : null}
        <div className="absolute bottom-0 left-0 z-20 w-full p-5 text-white">
          <p className="text-[10px] uppercase tracking-[1px] text-[rgba(201,194,214,0.9)] mb-1 font-medium">
            {slotEyebrow}
          </p>
          <h4 className="font-[family-name:var(--font-headline)] text-2xl mb-1 text-white line-clamp-2">
            {suggestion.title}
          </h4>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <span className="inline-flex items-center gap-1">
              <Flame width={14} height={14} aria-hidden />
              {suggestion.predictedCalories} kcal
            </span>
            {cookMin !== null ? (
              <>
                <span className="inline-block h-1 w-1 rounded-full bg-white/40" aria-hidden />
                <span className="inline-flex items-center gap-1">
                  <Clock width={14} height={14} aria-hidden />
                  {cookMin} min
                </span>
              </>
            ) : null}
          </div>
        </div>
      </button>
    </section>
  );
}

function NorthStarDefaultBlock({
  suggestion,
  ctaLabel,
  onPrimaryCta,
  onSkip,
  testID,
}: {
  suggestion: NorthStarBlockSuggestion;
  ctaLabel: string;
  onPrimaryCta?: () => void;
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
        <SupprButton
          variant="primary"
          onClick={onPrimaryCta}
          className="mt-1 h-9 self-start"
        >
          {ctaLabel}
        </SupprButton>
      </div>
    </SupprCard>
  );
}

export default NorthStarBlock;
