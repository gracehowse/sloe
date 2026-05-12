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
} from "@/lib/onboarding";

/**
 * Mobile OnboardingProvider — same shape as the web provider at
 * `src/app/components/onboarding/context.tsx`. The shared logic
 * (state.ts + targets.ts) lives in `src/lib/onboarding/v2/` and is
 * re-exported through `@/lib/onboarding-v2` (the mobile shim). Each
 * platform owns its own provider so JSX/type imports stay clean.
 *
 * Keep the public API in lockstep with the web context — step
 * components on either platform should be able to drop into the
 * other if a future cross-platform layer ever materialises.
 */

interface OnboardingContext {
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
  /** True when the user arrived via Settings → "Refresh my plan". When
   *  true, mobile-flow routes reveal → handleComplete directly and we
   *  drop data-bridges from `displayTotal` so the counter reads N/12
   *  instead of N/13. `null` while the AsyncStorage flag read is in
   *  flight on mount. */
  isRefreshPlan: boolean | null;
}

const Ctx = React.createContext<OnboardingContext | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  initial?: Partial<OnboardingState>;
}

/**
 * MV-03 fix (audit 2026-04-28) — persist v2 state to AsyncStorage so
 * an app background, force-quit, or cold-start mid-flow doesn't drop
 * the user back at Welcome with all answers gone.
 *
 * Mirrors the web `OnboardingProvider` localStorage approach. Reads
 * eagerly on mount; writes on every state change. Cleared on
 * successful completion by the mobile shell (parity with
 * `web-flow.tsx#handleComplete`).
 */
const STORAGE_KEY = "suppr.onboarding-v2.state";

export function OnboardingProvider({ children, initial }: ProviderProps) {
  // When `initial` is provided (tests + dev preview), skip the
  // AsyncStorage hydration. Same pattern as the web provider — the
  // explicit `initial` arg signals a fresh start, never mix in
  // persisted state.
  const hasInitial = initial !== undefined;
  const [state, setState] = React.useState<OnboardingState>(() => ({
    ...DEFAULT_ONBOARDING_STATE,
    ...(initial ?? {}),
  }));

  // 2026-05-12 (Grace TF) — refresh-plan detection. Mirror of the
  // identically-named read in `mobile-flow.tsx`, lifted here so the
  // counter overline (`Step N of 12`) and any other consumer can react
  // without duplicating the AsyncStorage read. `null` = unknown (read
  // in flight); true/false once resolved.
  const [isRefreshPlan, setIsRefreshPlan] = React.useState<boolean | null>(
    hasInitial ? false : null,
  );

  // Hydrate from AsyncStorage on mount. Async — initial render uses
  // defaults, then a setState fires once the persisted state is read.
  React.useEffect(() => {
    if (hasInitial) return;
    let cancelled = false;
    void (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const [raw, flag] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem("suppr.reset-plan-pending-prompt"),
        ]);
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              setState((prev) => ({ ...prev, ...(parsed as Partial<OnboardingState>) }));
            }
          } catch {
            /* malformed JSON — ignore */
          }
        }
        setIsRefreshPlan(flag === "1");
      } catch {
        // Storage unavailable / malformed JSON — fall back to defaults.
        if (!cancelled) setIsRefreshPlan(false);
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

  const set = React.useCallback<OnboardingContext["set"]>((patch) => {
    setState((prev) => ({
      ...prev,
      ...(typeof patch === "function" ? patch(prev) : patch),
    }));
  }, []);

  const go = React.useCallback<OnboardingContext["go"]>((delta) => {
    setState((prev) => ({
      ...prev,
      step: resolveNextStep(prev.step, delta, prev),
    }));
  }, []);

  const goTo = React.useCallback<OnboardingContext["goTo"]>((index) => {
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

  const value = React.useMemo<OnboardingContext>(
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
      // 2026-05-12 (Grace TF) — drop the data-bridges step from the
      // displayed total on refresh-plan, because mobile-flow routes
      // reveal → handleComplete directly in that mode. Without this,
      // the user sees "Step 12 of 13" on what is, for them, the last
      // step they'll ever see — confusing and inaccurate.
      displayTotal: isRefreshPlan ? TOTAL_STEPS - 1 : TOTAL_STEPS,
      canAdvance,
      stepLabels: STEP_LABELS,
      isRefreshPlan,
    }),
    [state, set, go, goTo, reset, targets, warning, currentStepId, canAdvance, isRefreshPlan],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboarding(): OnboardingContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useOnboarding must be used inside <OnboardingProvider>",
    );
  }
  return ctx;
}

export type { OnboardingContext };
