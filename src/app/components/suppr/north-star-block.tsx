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
import { Sparkles, X } from "lucide-react";

import { SupprCard } from "../ui/suppr-card";
import { cn } from "../ui/utils";

export type NorthStarKind =
  | "default"
  | "library-empty"
  | "over-budget"
  | "no-fit";

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

  if (kind === "library-empty") {
    return (
      <SupprCard
        data-slot="north-star-library-empty"
        data-testid={testID}
        tone="primary"
        gradient
        padding="md"
        className="flex flex-row items-center gap-3"
      >
        <Sparkles aria-hidden width={18} height={18} className="text-primary shrink-0" />
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-[14px] font-semibold">
            Pick a few recipes you'd actually cook — we'll suggest from there.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenLibrary}
          className={cn(
            "shrink-0 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          )}
        >
          Open Library →
        </button>
      </SupprCard>
    );
  }

  if (kind === "no-fit") {
    return (
      <SupprCard
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
          className="shrink-0 text-[12px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
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

  return (
    <SupprCard
      data-slot="north-star-default"
      data-testid={testID}
      tone="primary"
      gradient
      padding="md"
      radius="lg"
      className="relative flex flex-row items-stretch gap-3"
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

      {suggestion.thumbnail ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={suggestion.thumbnail}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-primary/20 to-pink-300/20"
        />
      )}

      <div className="flex flex-1 flex-col gap-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
          <Sparkles aria-hidden width={10} height={10} />
          What to eat next
        </span>
        <span className="text-[15px] font-bold leading-tight">{suggestion.title}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-band={suggestion.bandTight ? "tight" : "soft"}
            className={cn(
              "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold",
              suggestion.bandTight
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground",
            )}
          >
            {suggestion.bandLabel}
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {suggestion.predictedCalories} kcal · {Math.round(suggestion.predictedProtein)}P / {Math.round(suggestion.predictedCarbs)}C / {Math.round(suggestion.predictedFat)}F
          </span>
        </div>

        {/* Premium-feel papercut #3 (audit 2026-04-29): the CTA used
            solid `bg-primary`, matching the persistent Today FAB and
            creating two competing same-colour buttons within a thumb's
            reach. Demoted to a subtle-fill variant (8% primary +
            primary text) so the FAB stays the loudest pixel and this
            card reads as a suggestion, not a demand. Mirror of the
            same change in mobile `NorthStarBlock.tsx`. */}
        <button
          type="button"
          onClick={onPrimaryCta}
          className={cn(
            "mt-1 inline-flex h-9 items-center justify-center self-start rounded-md bg-primary/10 px-3 text-[13px] font-semibold text-primary",
            "hover:bg-primary/15",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          )}
        >
          {ctaLabel}
        </button>
      </div>
    </SupprCard>
  );
}

export default NorthStarBlock;
