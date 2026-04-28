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

/**
 * MV-03 fix (audit 2026-04-28) — persist v2 state to AsyncStorage so
 * an app background, force-quit, or cold-start mid-flow doesn't drop
 * the user back at Welcome with all answers gone.
 *
 * Mirrors the web `OnboardingV2Provider` localStorage approach. Reads
 * eagerly on mount; writes on every state change. Cleared on
 * successful completion by the mobile shell (parity with
 * `web-flow.tsx#handleComplete`).
 */
const STORAGE_KEY = "suppr.onboarding-v2.state";

export function OnboardingV2Provider({ children, initial }: ProviderProps) {
  // When `initial` is provided (tests + dev preview), skip the
  // AsyncStorage hydration. Same pattern as the web provider — the
  // explicit `initial` arg signals a fresh start, never mix in
  // persisted state.
  const hasInitial = initial !== undefined;
  const [state, setState] = React.useState<OnboardingState>(() => ({
    ...DEFAULT_ONBOARDING_STATE,
    ...(initial ?? {}),
  }));

  // Hydrate from AsyncStorage on mount. Async — initial render uses
  // defaults, then a setState fires once the persisted state is read.
  React.useEffect(() => {
    if (hasInitial) return;
    let cancelled = false;
    void (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setState((prev) => ({ ...prev, ...(parsed as Partial<OnboardingState>) }));
        }
      } catch {
        // Storage unavailable / malformed JSON — fall back to defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasInitial]);

  // Persist on every state change. Skipped when `initial` was provided
  // so test runs don't pollute the device's persisted onboarding.
  React.useEffect(() => {
    if (hasInitial) return;
    void (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Quota / disabled storage — silent fail.
      }
    })();
  }, [state, hasInitial]);

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
      // 1-indexed display — mirror of web context. Welcome is "Step 1
      // of 13" but its overline + top bar are both hidden.
      displayIndex: state.step + 1,
      displayTotal: TOTAL_STEPS,
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
