"use client";

/**
 * RecipePickerGrid — onboarding final step grid (web).
 *
 * Production design spec — 2026-04-27 Surface F.
 * Authority: D-2026-04-27-14 (onboarding produces first plan) + the
 * candidate-source decision (hand-picked seeds, no DB table).
 *
 * Geometry:
 *   - 3-col desktop (560px column), 2-col mobile-web below 640px.
 *   - Each tile: 36×36 hero emoji thumb + Type.caption 11pt 600 1.2.
 *   - Selected: bg `rgba(76,108,224,0.08)` + border `--primary` +
 *     12pt Check overlay (Lucide).
 *   - Counter "X of N picked" in caption tone.
 *
 * The component is presentation-only. Selection state machine lives
 * in `src/lib/onboarding/finalStep.ts` (togglePick / derivePickerState
 * / pickCounterLabel). Mobile mirror:
 * `apps/mobile/components/onboarding/RecipePickerGrid.tsx`.
 */

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/app/components/ui/utils";
import {
  ONBOARDING_SEEDS,
  filterOnboardingSeeds,
  type OnboardingSeed,
} from "@/lib/onboarding/onboardingSeeds";
import {
  derivePickerState,
  pickCounterLabel,
  togglePick,
} from "@/lib/onboarding/finalStep";

export interface RecipePickerGridProps {
  /** Active diet tags from `OnboardingState.diet`. Empty array = no filter. */
  diet?: readonly string[];
  /** Active allergies from `OnboardingState.allergies`. */
  allergies?: readonly string[];
  /** Controlled-mode picked set. */
  picked: ReadonlySet<string>;
  /** Pick toggle handler — caller updates state with the returned Set. */
  onPickedChange: (next: ReadonlySet<string>) => void;
  /** Optional override of the seed list (tests). */
  seeds?: readonly OnboardingSeed[];
  /** Render-mode for tests / storybook — default "live" reads filtered. */
  className?: string;
}

export function RecipePickerGrid({
  diet,
  allergies,
  picked,
  onPickedChange,
  seeds,
  className,
}: RecipePickerGridProps) {
  const visibleSeeds = React.useMemo(() => {
    const source = seeds ?? ONBOARDING_SEEDS;
    return filterOnboardingSeeds(source, {
      diet: diet ?? [],
      allergies: allergies ?? [],
    });
  }, [seeds, diet, allergies]);

  const state = derivePickerState(picked);

  return (
    <div
      data-testid="recipe-picker-grid"
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {visibleSeeds.map((seed) => {
          const isPicked = picked.has(seed.slug);
          return (
            <button
              key={seed.slug}
              type="button"
              data-testid={`recipe-picker-tile-${seed.slug}`}
              data-picked={isPicked ? "true" : "false"}
              onClick={() => onPickedChange(togglePick(picked, seed.slug))}
              className={cn(
                "relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left",
                "transition-pm focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-primary focus-visible:ring-offset-2",
                isPicked
                  ? "border-primary bg-[rgba(76,108,224,0.08)]"
                  : "border-border bg-card hover:border-foreground/20",
              )}
              aria-pressed={isPicked}
              aria-label={`${seed.title}, ${seed.kcal} kcal, ${seed.protein_g}g protein, ${seed.prepMins} min`}
            >
              <div className="flex h-9 w-9 items-center justify-center text-2xl leading-none">
                <span aria-hidden>{seed.heroEmoji}</span>
              </div>
              <span className="text-[11px] font-semibold leading-[1.2] line-clamp-2 text-foreground">
                {seed.title}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                {seed.kcal} kcal · {seed.protein_g}g · {seed.prepMins} min
              </span>
              {isPicked ? (
                <span
                  data-testid={`recipe-picker-tile-check-${seed.slug}`}
                  className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
                  aria-hidden
                >
                  <Check width={12} height={12} strokeWidth={2.5} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        data-testid="recipe-picker-counter"
        className="text-center text-[11px] font-medium text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {pickCounterLabel(picked)}
        {state.canSubmit ? null : (
          <span className="ml-2">·</span>
        )}
        {state.canSubmit ? null : (
          <span className="ml-2">{state.ctaLabel}</span>
        )}
      </div>
    </div>
  );
}

export default RecipePickerGrid;
