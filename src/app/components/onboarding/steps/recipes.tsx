"use client";

/**
 * RecipePickerStep — onboarding step 15, "Pick 5 recipes you'd
 * actually cook" (web).
 *
 * Production design spec — 2026-04-27 Surface F.
 * Authority: D-2026-04-27-14 (onboarding produces first plan) +
 * docs/decisions/2026-04-27-onboarding-candidate-source.md.
 *
 * The step is the final-step picker. It composes:
 *   - The shared `<RecipePickerGrid>` (filtered by user's diet/allergens).
 *   - Selection state from `OnboardingState.pickedRecipeSlugs`.
 *   - The "Build my first week" CTA gated on `derivePickerState.canSubmit`.
 *
 * Persist is owned by the shell's `handleComplete` (web-flow.tsx) +
 * the seed-resolver/first-week helpers in `src/lib/onboarding/`. This
 * step is presentation-only.
 */

import * as React from "react";
import { Sparkles } from "lucide-react";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";
import { RecipePickerGrid } from "../recipe-picker-grid";
import {
  derivePickerState,
} from "@/lib/onboarding/finalStep";

export function RecipePickerStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();

  // Round-trip through string[] ↔ Set<string> so the state machine
  // stays JSON-friendly (the OnboardingState shape is persisted to
  // localStorage; Sets don't serialise naturally).
  const picked = React.useMemo(
    () => new Set<string>(state.pickedRecipeSlugs ?? []),
    [state.pickedRecipeSlugs],
  );

  const onPickedChange = React.useCallback(
    (next: ReadonlySet<string>) => {
      set({ pickedRecipeSlugs: Array.from(next) });
    },
    [set],
  );

  const pickerState = derivePickerState(picked);

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Pick 5 recipes you'd actually cook"
        subtitle="We'll seed your library and build your first weekly plan from these. You can change everything later."
      />

      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
        <Sparkles aria-hidden width={12} height={12} />
        Last step
      </div>

      <RecipePickerGrid
        diet={state.diet}
        allergies={state.allergies}
        picked={picked}
        onPickedChange={onPickedChange}
      />

      {/* The shell's terminal-step button reads "Build my first week"
          when canSubmit is true; "Pick {n} more" when not. The
          web-flow.tsx terminal-button consumes this state directly. */}
      <span data-testid="recipes-step-can-submit" data-value={pickerState.canSubmit ? "true" : "false"} hidden />
    </StepBody>
  );
}

export default RecipePickerStep;
