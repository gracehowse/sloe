"use client";

import * as React from "react";
import {
  DEFAULT_ONBOARDING_STATE,
  STEP_IDS,
  STEP_LABELS,
  TOTAL_STEPS,
  canAdvance as canAdvanceStep,
  displayPosition,
  resolveNextStep,
  type OnboardingState,
  type StepId,
} from "@/lib/onboarding/state";
import {
  computeV2Targets,
  paceWarning,
  type PaceWarning,
  type V2Targets,
} from "@/lib/onboarding/targets";
import { isFeatureEnabled } from "@/lib/analytics/track";

/** ENG-990 — feature flag gating the "Coming from another app?"
 *  (`app-choice`) step. When OFF the step is auto-skipped in `go()` and
 *  dropped from `displayTotal`, so the live flow is unchanged until the
 *  flag ramps in PostHog. Same flag name on web + mobile. */
export const APP_CHOICE_FLAG = "onboarding-app-choice";

/** ENG-963 — feature flag gating the "What's bringing you here?" step. */
export const WHY_NOW_FLAG = "onboarding-why-now";

/** ENG-1233/1241 — conversion funnel (upgrade + first-log after data-bridges). */
export const CONVERSION_FUNNEL_FLAG = "onboarding_conversion_funnel_v1";

/**
 * OnboardingProvider — single source of state for the v2 onboarding
 * flow on web. Exposes the same hook-shaped API the mobile flow will
 * use (see Stage D), so the underlying step components can be lifted
 * into a cross-platform layer later without touching their call sites.
 *
 * The provider intentionally does not own analytics or persistence
 * (Stage E + the wiring into Supabase) — those bind to the same hook
 * but live alongside the route component, so this file stays platform-
 * agnostic and easy to unit-test.
 */

interface OnboardingContext {
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
  /**
   * ENG-1241 — run the terminal completion path (persist profile + seed
   * recipes + fire `onboarding_completed` + navigate to Today) from a
   * step component. The flow shell registers its `handleComplete` via
   * `registerComplete`; the terminal `upgrade` step calls `complete()`
   * from its "Continue on Free" CTA so skip lands straight on Today with
   * no detour (Decision 2). A no-op before the shell registers. */
  complete: () => void;
  registerComplete: (fn: () => void) => void;
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

const Ctx = React.createContext<OnboardingContext | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  /** Optional initial overrides — useful for tests + the dev preview
   *  page so the flow can deep-link to a step or persona. */
  initial?: Partial<OnboardingState>;
}

/**
 * WEB-01 fix (audit 2026-04-28) — persist v2 state to localStorage so
 * a refresh, accidental tab close, or email-confirmation redirect
 * doesn't drop the user back at Welcome with all answers gone.
 *
 * The signup step's `emailRedirectTo` lands the user back at
 * `/onboarding`, which 307s to `/onboarding/v2` and remounts a fresh
 * provider. Without persistence, the user re-enters fresh and 11
 * steps of body-stat answers vanish.
 *
 * `password` is intentionally NOT persisted (the auth call resolves
 * synchronously inside the signup step before any redirect, so the
 * password never needs to survive).
 */
const STORAGE_KEY = "suppr.onboarding-v2.state";

function readPersistedState(): Partial<OnboardingState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<OnboardingState>;
  } catch {
    return null;
  }
}

function writePersistedState(state: OnboardingState): void {
  if (typeof window === "undefined") return;
  try {
    // Strip transient / sensitive fields. `password` is an in-memory-
    // only shape on the state; if a future schema adds it, exclude
    // here.
    const { ...persistable } = state;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {
    // Quota / disabled storage — silent failure is acceptable; the
    // worst case is a refresh dropping state, which is the existing
    // behaviour we're trying to improve.
  }
}

export function OnboardingProvider({ children, initial }: ProviderProps) {
  // When `initial` is provided (tests + dev preview pages), skip the
  // localStorage hydration. The `initial` arg is the explicit fresh-
  // start signal; mixing in persisted state from a previous render
  // (or test run) breaks deterministic test scenarios. In production
  // the route mounts the provider with no `initial` arg, so the
  // user's persisted state hydrates correctly.
  const hasInitial = initial !== undefined;
  const [state, setState] = React.useState<OnboardingState>(() => {
    if (hasInitial) {
      return {
        ...DEFAULT_ONBOARDING_STATE,
        ...(initial ?? {}),
      };
    }
    const persisted = readPersistedState();
    return {
      ...DEFAULT_ONBOARDING_STATE,
      ...(persisted ?? {}),
    };
  });

  // Save on every state change (debounced via React's batched updates).
  // The state is small (<5KB) and writes are cheap; no debounce timer
  // needed. Skip writes when `initial` was provided (test mode) so
  // persistence stays exclusively a production-user concern.
  React.useEffect(() => {
    if (hasInitial) return;
    writePersistedState(state);
  }, [state, hasInitial]);

  // ENG-990 — resolve the app-choice flag once per render. `isFeatureEnabled`
  // returns `false` when PostHog is cold / missing, which is exactly the
  // safe default here (skip the new step), so the live flow is untouched
  // until the flag ramps. Read in a ref so `go()` (a stable callback)
  // always sees the latest value without being re-created on every flag
  // re-resolution.
  const appChoiceEnabled = isFeatureEnabled(APP_CHOICE_FLAG);
  const appChoiceEnabledRef = React.useRef(appChoiceEnabled);
  appChoiceEnabledRef.current = appChoiceEnabled;
  const whyNowEnabled = isFeatureEnabled(WHY_NOW_FLAG);
  const whyNowEnabledRef = React.useRef(whyNowEnabled);
  whyNowEnabledRef.current = whyNowEnabled;
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
        whyNowEnabled: whyNowEnabledRef.current,
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

  // 1-indexed for human display, counting only steps that are visible
  // for this flow. Welcome is "Step 1 of N" (its overline + top bar are
  // hidden). ENG-990 — when the app-choice step is gated OFF it never
  // renders, so it's dropped from both the index and the total via the
  // shared `displayPosition` helper; otherwise a flag flip would desync
  // the bar from the flow.
  const { index: displayIndex, total: displayTotal } = displayPosition(
    state.step,
    { appChoiceEnabled, whyNowEnabled, conversionFunnelEnabled },
  );

  const value = React.useMemo<OnboardingContext>(
    () => ({
      state,
      set,
      go,
      goTo,
      reset,
      complete,
      registerComplete,
      targets,
      warning,
      currentStepId,
      displayIndex,
      displayTotal,
      canAdvance,
      stepLabels: STEP_LABELS,
    }),
    [state, set, go, goTo, reset, complete, registerComplete, targets, warning, currentStepId, canAdvance, displayIndex, displayTotal],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook the step components use to read + write the flow state. */
export function useOnboarding(): OnboardingContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useOnboarding must be used inside <OnboardingProvider>",
    );
  }
  return ctx;
}

/** Re-export so callers don't need a second import for type sigs. */
export type { OnboardingContext };
