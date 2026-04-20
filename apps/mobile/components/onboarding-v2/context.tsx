import * as React from "react";
import {
  DEFAULT_ONBOARDING_STATE,
  STEP_IDS,
  STEP_LABELS,
  TOTAL_STEPS,
  canAdvance as canAdvanceStep,
  computeV2Targets,
  paceWarning,
  resolveNextStep,
  type OnboardingState,
  type PaceWarning,
  type StepId,
  type V2Targets,
} from "@/lib/onboarding-v2";

/**
 * Mobile OnboardingV2Provider — same shape as the web provider at
 * `src/app/components/onboarding-v2/context.tsx`. The shared logic
 * (state.ts + targets.ts) lives in `src/lib/onboarding/v2/` and is
 * re-exported through `@/lib/onboarding-v2` (the mobile shim). Each
 * platform owns its own provider so JSX/type imports stay clean.
 *
 * Keep the public API in lockstep with the web context — step
 * components on either platform should be able to drop into the
 * other if a future cross-platform layer ever materialises.
 */

interface OnboardingV2Context {
  state: OnboardingState;
  set: (
    patch:
      | Partial<OnboardingState>
      | ((prev: OnboardingState) => Partial<OnboardingState>),
  ) => void;
  go: (delta: 1 | -1) => void;
  goTo: (index: number) => void;
  reset: () => void;
  targets: V2Targets | null;
  warning: PaceWarning | null;
  currentStepId: StepId;
  displayIndex: number;
  displayTotal: number;
  canAdvance: boolean;
  stepLabels: typeof STEP_LABELS;
}

const Ctx = React.createContext<OnboardingV2Context | null>(null);

interface ProviderProps {
  children: React.ReactNode;
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
    () => canAdvanceStep(currentStepId, state),
    [currentStepId, state],
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
      displayIndex: state.step,
      displayTotal: TOTAL_STEPS - 1,
      canAdvance,
      stepLabels: STEP_LABELS,
    }),
    [state, set, go, goTo, reset, targets, warning, currentStepId, canAdvance],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboardingV2(): OnboardingV2Context {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useOnboardingV2 must be used inside <OnboardingV2Provider>",
    );
  }
  return ctx;
}

export type { OnboardingV2Context };
