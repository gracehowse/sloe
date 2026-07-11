import * as React from "react";
import {
  DEFAULT_ONBOARDING_STATE,
  STEP_IDS,
  STEP_LABELS,
  TOTAL_STEPS,
  canAdvance as canAdvanceStep,
  computeV2Targets,
  displayPosition,
  paceWarning,
  resolveNextStep,
  type OnboardingState,
  type PaceWarning,
  type StepId,
  type V2Targets,
} from "@/lib/onboarding";
import { isFeatureEnabled } from "@/lib/analytics";

/** ENG-990 — feature flag gating the "Coming from another app?"
 *  (`app-choice`) step. Same flag name on web (see
 *  `src/app/components/onboarding/context.tsx#APP_CHOICE_FLAG`). When OFF
 *  the step is auto-skipped in `go()` and dropped from `displayTotal`. */
export const APP_CHOICE_FLAG = "onboarding-app-choice";

/** ENG-1233/1241 — conversion funnel (upgrade + first-log after data-bridges). */
export const CONVERSION_FUNNEL_FLAG = "onboarding_conversion_funnel_v1";

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
  /**
   * ENG-1241 — run the terminal completion path (persist profile + seed
   * recipes + fire `onboarding_completed` + navigate to Today) from a
   * step component. The flow shell registers its `handleComplete` via
   * `registerComplete`; the terminal `upgrade` step calls `complete()`
   * from its "Continue on Free" CTA so skip lands straight on Today with
   * no detour (Decision 2). A no-op before the shell registers. */
  complete: () => void;
  registerComplete: (fn: () => void) => void;
  /**
   * ENG-1507 — persist WITHOUT navigating. The terminal `upgrade` step's
   * "Start free trial" awaits `persist()` BEFORE pushing the paywall so
   * the paywall's personalised-plan card reads the row THIS run just
   * wrote, never the previous run's plan (the trial-path persist hole:
   * every `from=onboarding` paywall exit replaces to Today, so the
   * navigation-coupled `complete()` handler never ran on that path and
   * the freshly-selected plan was silently discarded). Resolves `true`
   * when the profile write + seeding landed; `false` when it failed and
   * the flow shell already surfaced the error (stay on-step). A
   * `false`-resolving no-op before the shell registers.
   */
  persist: () => Promise<boolean>;
  registerPersist: (fn: () => Promise<boolean>) => void;
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

  // ENG-990 — resolve the app-choice flag once per render. Cold-safe:
  // `isFeatureEnabled` returns false when PostHog isn't ready, which is
  // exactly the safe default (skip the new step) so the live flow is
  // untouched until the flag ramps. Held in a ref so `go()` (a stable
  // callback) always reads the latest value.
  const appChoiceEnabled = isFeatureEnabled(APP_CHOICE_FLAG);
  const appChoiceEnabledRef = React.useRef(appChoiceEnabled);
  appChoiceEnabledRef.current = appChoiceEnabled;
  const conversionFunnelEnabled = isFeatureEnabled(CONVERSION_FUNNEL_FLAG);
  const conversionFunnelEnabledRef = React.useRef(conversionFunnelEnabled);
  conversionFunnelEnabledRef.current = conversionFunnelEnabled;

  const set = React.useCallback<OnboardingContext["set"]>((patch) => {
    setState((prev) => ({
      ...prev,
      ...(typeof patch === "function" ? patch(prev) : patch),
    }));
  }, []);

  const go = React.useCallback<OnboardingContext["go"]>((delta) => {
    setState((prev) => ({
      ...prev,
      step: resolveNextStep(prev.step, delta, prev, {
        appChoiceEnabled: appChoiceEnabledRef.current,
        conversionFunnelEnabled: conversionFunnelEnabledRef.current,
      }),
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

  // ENG-1241 — the flow shell registers its terminal completion handler
  // here so the terminal `upgrade` step can trigger it directly (skip →
  // Today, no detour). Held in a ref so `complete` stays referentially
  // stable and always calls the latest registered handler.
  const completeRef = React.useRef<() => void>(() => undefined);
  const registerComplete = React.useCallback<OnboardingContext["registerComplete"]>(
    (fn) => {
      completeRef.current = fn;
    },
    [],
  );
  const complete = React.useCallback<OnboardingContext["complete"]>(() => {
    completeRef.current();
  }, []);

  // ENG-1507 — persist-without-navigation twin of `complete` (same ref
  // pattern) so the terminal `upgrade` step can land the profile write
  // BEFORE pushing the paywall. Defaults to `false` (nothing persisted)
  // until the flow shell registers.
  const persistRef = React.useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const registerPersist = React.useCallback<OnboardingContext["registerPersist"]>(
    (fn) => {
      persistRef.current = fn;
    },
    [],
  );
  const persist = React.useCallback<OnboardingContext["persist"]>(
    () => persistRef.current(),
    [],
  );

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

  // 1-indexed display, counting only the steps visible for this flow —
  // mirror of the web context. ENG-990: the shared `displayPosition`
  // helper drops the flag-hidden `app-choice` step from both the index
  // and the total. Welcome is "Step 1 of N" (its overline + top bar are
  // hidden). The refresh-plan adjustment below composes on top.
  const base = displayPosition(state.step, {
    appChoiceEnabled,
    conversionFunnelEnabled,
  });

  const value = React.useMemo<OnboardingContext>(
    () => ({
      state,
      set,
      go,
      goTo,
      reset,
      complete,
      registerComplete,
      persist,
      registerPersist,
      targets,
      warning,
      currentStepId,
      displayIndex: base.index,
      // 2026-05-12 (Grace TF) — drop the data-bridges step from the
      // displayed total on refresh-plan, because mobile-flow routes
      // reveal → handleComplete directly in that mode. Without this,
      // the user sees "Step N of N" on what is, for them, the last step
      // they'll ever see — confusing and inaccurate. Composes with the
      // app-choice discount already applied in `base.total`.
      displayTotal: isRefreshPlan ? base.total - 1 : base.total,
      canAdvance,
      stepLabels: STEP_LABELS,
      isRefreshPlan,
    }),
    [state, set, go, goTo, reset, complete, registerComplete, persist, registerPersist, targets, warning, currentStepId, canAdvance, isRefreshPlan, base.index, base.total],
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
