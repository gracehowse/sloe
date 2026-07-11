import { useEffect, useState } from "react";

import { isFeatureDisabled } from "@/lib/analytics";
import {
  clearOnboardingCompletedCache,
  readOnboardingCompletedCache,
  writeOnboardingCompletedCache,
} from "@/lib/onboardingCompletedCache";
import { supabase } from "@/lib/supabase";

/** What the profiles fetch has said so far. */
export type OnboardingGateFetchState =
  | "pending" // in flight (or no session yet)
  | "complete" // confirmed onboarding_completed === true
  | "incomplete" // confirmed: row says not complete, or no row exists
  | "unavailable"; // timed out / errored — the server never answered

export type OnboardingGateDecision = "pending" | "tabs" | "onboarding";

export const PROFILE_ONBOARDING_TIMEOUT_MS = 8000;

/** Kill switch (ENG-1515). Read via `isFeatureDisabled` so a cold
 *  PostHog defaults to the STRICT gate — the bug's primary victims are
 *  brand-new users on their very first launch, exactly when flags are
 *  cold, so a default-OFF `isFeatureEnabled` ramp could never protect
 *  them. Throwing the switch in PostHog restores the legacy optimistic
 *  gate for everyone. Same pattern as `onboarding_default_seeds`. */
export const ONBOARDING_GATE_STRICT_FLAG = "onboarding_gate_strict_v1";

/**
 * Pure gate decision — exported for tests.
 *
 * Decision table:
 *  - fetch confirmed complete            → tabs   (server truth)
 *  - fetch confirmed incomplete          → onboarding (server truth —
 *    overrides a stale cached completion, e.g. account nuked on web)
 *  - legacy mode (kill switch thrown)    → tabs   (pre-ENG-1515
 *    optimistic default: mount immediately, timeout/error keeps tabs)
 *  - strict, cache not hydrated yet      → pending (one local read, ~1 frame)
 *  - strict, cached completion           → tabs   (offline-safe fast path)
 *  - strict, no cache, fetch in flight   → pending (block on launch screen)
 *  - strict, no cache, timeout/error     → onboarding (never assume
 *    complete for a session that was never confirmed — the fix)
 */
export function resolveOnboardingGate(args: {
  strict: boolean;
  cached: boolean | null;
  fetched: OnboardingGateFetchState;
}): OnboardingGateDecision {
  const { strict, cached, fetched } = args;
  if (fetched === "complete") return "tabs";
  if (fetched === "incomplete") return "onboarding";
  if (!strict) return "tabs";
  if (cached === null) return "pending";
  if (cached) return "tabs";
  return fetched === "pending" ? "pending" : "onboarding";
}

/**
 * useOnboardingGate — the (tabs) onboarding gate, extracted from
 * `app/(tabs)/_layout.tsx` so the decision logic is unit-testable
 * (ENG-1515). See `resolveOnboardingGate` for the decision table and
 * `lib/onboardingCompletedCache.ts` for the cache contract.
 *
 * Render cost for the 99% (returning, cached) case: the launch screen
 * the auth check already shows stays up for the one extra frame the
 * local cache read takes, then tabs mount — the network fetch runs in
 * the background exactly as before. Only a session with NO cached
 * completion (brand-new user, or first launch after install/update)
 * waits on the profile fetch.
 */
export function useOnboardingGate(userId: string | null): OnboardingGateDecision {
  // Latched once per mount: a mid-session PostHog flag flip must not
  // unmount live tabs out from under the user.
  const [strict] = useState(() => !isFeatureDisabled(ONBOARDING_GATE_STRICT_FLAG));
  const [cached, setCached] = useState<boolean | null>(null);
  const [fetched, setFetched] = useState<OnboardingGateFetchState>("pending");

  // Hydrate the userId-scoped completion cache (local AsyncStorage, ~ms).
  useEffect(() => {
    setCached(null);
    if (!userId) return;
    let cancelled = false;
    void readOnboardingCompletedCache(userId).then((v) => {
      if (!cancelled) setCached(v);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Server fetch — the same query + 8s race the inline gate used. Also
  // backfills/heals the cache so existing users get the fast path from
  // their second launch onward, and a stale cache is cleared the moment
  // the server confirms not-complete.
  useEffect(() => {
    setFetched("pending");
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const timedOut = Symbol("profile_onboarding_timeout");
        const result = await Promise.race([
          supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", userId)
            .maybeSingle(),
          new Promise<typeof timedOut>((resolve) => {
            setTimeout(() => resolve(timedOut), PROFILE_ONBOARDING_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        if (result === timedOut) {
          setFetched("unavailable");
          return;
        }
        // A resolved supabase error (RLS hiccup, 5xx) is NOT a
        // confirmation the user is incomplete — treat it like a timeout.
        // (The old inline gate mapped this to "incomplete" and bounced
        // completed users to onboarding on transient errors.)
        if (result.error) {
          setFetched("unavailable");
          return;
        }
        const complete = result.data?.onboarding_completed === true;
        setFetched(complete ? "complete" : "incomplete");
        if (complete) {
          void writeOnboardingCompletedCache(userId);
        } else {
          void clearOnboardingCompletedCache(userId);
        }
      } catch {
        if (!cancelled) setFetched("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return resolveOnboardingGate({ strict, cached, fetched });
}
