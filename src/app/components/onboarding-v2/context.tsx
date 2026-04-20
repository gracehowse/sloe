"use client";

import * as React from "react";
import {
  DEFAULT_ONBOARDING_STATE,
  STEP_IDS,
  STEP_LABELS,
  TOTAL_STEPS,
  canAdvance as canAdvanceStep,
  resolveNextStep,
  type OnboardingState,
  type StepId,
} from "@/lib/onboarding/v2/state";
import {
  computeV2Targets,
  paceWarning,
  type PaceWarning,
  type V2Targets,
} from "@/lib/onboarding/v2/targets";

/**
 * OnboardingV2Provider — single source of state for the v2 onboarding
 * flow on web. Exposes the same hook-shaped API the mobile flow will
 * use (see Stage D), so the underlying step components can be lifted
 * into a cross-platform layer later without touching their call sites.
 *
 * The provider intentionally does not own analytics or persistence
 * (Stage E + the wiring into Supabase) — those bind to the same hook
 * but live alongside the route component, so this file stays platform-
 * agnostic and easy to unit-test.
 */

interface OnboardingV2Context {
  state: OnboardingState;
  /** Patch a subset of the state. Functional updater is supported for
   *  multi-key changes that depend on the current state. */
  set: (
    patch:
      | Partial<OnboardingState>
      | ((prev: OnboardingState) => Partial<OnboardingState>),
  ) => void;
  /** Move forward (`+1`) or backward (`-1`). Auto-skips `pace` when
   *  goal = maintain. Clamps to [0, TOTAL_STEPS - 1]. */
  go: (delta: 1 | -1) => void;
  /** Jump to a specific step. Clamps; does not invoke skip logic. */
  goTo: (index: number) => void;
  /** Reset to the welcome step with default values. */
  reset: () => void;
  /** Computed targets — `null` until body-stat steps have been answered. */
  targets: V2Targets | null;
  /** Pace warning derived from the current state. `null` when safe. */
  warning: PaceWarning | null;
  /** Step id at the current index. */
  currentStepId: StepId;
  /** Display index (1-based, excludes welcome) for "step X of Y" copy. */
  displayIndex: number;
  /** Display total (TOTAL_STEPS - 1, excludes welcome). */
  displayTotal: number;
  /** Validation for the current step. */
  canAdvance: boolean;
  /** Step labels — re-exported so consumers don't need a second import. */
  stepLabels: typeof STEP_LABELS;
}

const Ctx = React.createContext<OnboardingV2Context | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  /** Optional initial overrides — useful for tests + the dev preview
   *  page so the flow can deep-link to a step or persona. */
  initial?: Partial<OnboardingState>;
}

export function OnboardingV2Provider({ children, initial }: ProviderProps) {
  const [state, setState] = React.useState<OnboardingState>(() => ({
    ...DEFAULT_ONBOARDING_STATE,
    ...(initial ?? {}),
  }));

  const set = React.useCallback<OnboardingV2Context["set"]>((patch) => {
    setState((prev) => ({
      ...prev,
      ...(typeof patch === "function" ? patch(prev) : patch),
    }));
  }, []);

  const go = React.useCallback<OnboardingV2Context["go"]>((delta) => {
    setState((prev) => ({
      ...prev,
      step: resolveNextStep(prev.step, delta, prev),
    }));
  }, []);

  const goTo = React.useCallback<OnboardingV2Context["goTo"]>((index) => {
    setState((prev) => ({
      ...prev,
      step: Math.max(0, Math.min(TOTAL_STEPS - 1, index)),
    }));
  }, []);

  const reset = React.useCallback(() => {
    setState({ ...DEFAULT_ONBOARDING_STATE });
  }, []);

  const targets = React.useMemo(() => computeV2Targets(state), [state]);
  const currentStepId = STEP_IDS[state.step] as StepId;
  const warning = React.useMemo(
    () => paceWarning(state, targets?.target ?? null),
    [state, targets?.target],
  );
  const canAdvance = React.useMemo(
    () => canAdvanceStep(currentStepId, state, { paceWarning: warning }),
    [currentStepId, state, warning],
  );

  const value = React.useMemo<OnboardingV2Context>(
    () => ({
      state,
      set,
      go,
      goTo,
      reset,
      targets,
      warning,
      currentStepId,
      // 1-indexed for human display: Welcome is "Step 1 of 13"
      // (though Welcome itself hides the overline + the top bar).
      // Signup is "Step 02 of 13", import is "Step 13 of 13".
      // displayTotal is the full count, not count-minus-one — the
      // prototype labels were "Step XX of 13" and the prior
      // `TOTAL_STEPS - 1` value made "Step 13 of 12" inevitable on
      // the last step.
      displayIndex: state.step + 1,
      displayTotal: TOTAL_STEPS,
      canAdvance,
      stepLabels: STEP_LABELS,
    }),
    [state, set, go, goTo, reset, targets, warning, currentStepId, canAdvance],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook the step components use to read + write the flow state. */
export function useOnboardingV2(): OnboardingV2Context {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useOnboardingV2 must be used inside <OnboardingV2Provider>",
    );
  }
  return ctx;
}

/** Re-export so callers don't need a second import for type sigs. */
export type { OnboardingV2Context };
