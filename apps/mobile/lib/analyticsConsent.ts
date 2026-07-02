import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/**
 * ENG-1286 — mobile analytics-consent state (launch blocker).
 *
 * Mirror of the web consent semantics in
 * `src/app/components/CookieConsent.tsx` + `AnalyticsProvider.tsx`:
 * the SAME three states ("accepted" | "declined" | null = never asked)
 * and the SAME fail-closed posture — nothing is captured until the
 * stored choice is "accepted". Web persists to localStorage under
 * `suppr_cookie_consent`; mobile persists to AsyncStorage under
 * `suppr_analytics_consent` (no cookies on iOS — the consent covers
 * PostHog usage analytics + masked session replay, which is what the
 * privacy policy's opt-out promise governs).
 *
 * Pure module by design (AsyncStorage + React only — no
 * `posthog-react-native` import), so consent UI components and unit
 * tests exercise the REAL logic without the SDK shim dance.
 * `apps/mobile/lib/analytics.ts` subscribes via
 * {@link onAnalyticsConsentChange} and applies the choice to the
 * PostHog client (create / optIn / optOut).
 *
 * In-memory state exists because `getPostHogClient()` is synchronous
 * and cannot await storage on every call — same tactic as the
 * forced-flag map (ENG-840). `primeAnalyticsConsent()` hydrates it at
 * bootstrap, BEFORE the AnalyticsProvider's first
 * `getPostHogClient()` call; until then the state is `null` and the
 * client gate stays closed (fail-closed, never fail-open).
 */

export const ANALYTICS_CONSENT_STORAGE_KEY = "suppr_analytics_consent";

/** Same value space as web `ConsentChoice` (CookieConsent.tsx). */
export type AnalyticsConsentChoice = "accepted" | "declined" | null;

/** Coerce a raw stored string to a valid choice; anything else = never asked. */
export function parseAnalyticsConsent(raw: string | null): AnalyticsConsentChoice {
  if (raw === "accepted" || raw === "declined") return raw;
  return null;
}

/** Read the persisted choice. Silent on failure (storage denied) → null,
 *  which keeps the capture gate closed — the safe direction. */
export async function readStoredAnalyticsConsent(): Promise<AnalyticsConsentChoice> {
  try {
    return parseAnalyticsConsent(
      await AsyncStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

let currentConsent: AnalyticsConsentChoice = null;

type ConsentListener = (choice: AnalyticsConsentChoice) => void;
const consentListeners = new Set<ConsentListener>();

function notifyConsentListeners(choice: AnalyticsConsentChoice): void {
  for (const cb of consentListeners) {
    try {
      cb(choice);
    } catch {
      /* listener shouldn't throw, but guard anyway */
    }
  }
}

/** Subscribe to consent changes (analytics client glue, Settings row,
 *  provider). Returns an unsubscribe function. */
export function onAnalyticsConsentChange(cb: ConsentListener): () => void {
  consentListeners.add(cb);
  return () => {
    consentListeners.delete(cb);
  };
}

/**
 * Hydrate the in-memory choice from AsyncStorage. Awaited by the
 * mobile `AnalyticsProvider` at bootstrap BEFORE the first
 * `getPostHogClient()` call — same one-shot prime pattern as
 * `primeSessionReplaySampleRate` / `primeForcedFlags`.
 */
export async function primeAnalyticsConsent(): Promise<void> {
  currentConsent = await readStoredAnalyticsConsent();
}

/** Synchronous read of the primed choice. `null` until primed —
 *  fail-closed by construction. */
export function getAnalyticsConsent(): AnalyticsConsentChoice {
  return currentConsent;
}

/**
 * Record the user's choice: update memory synchronously (so the next
 * `getPostHogClient()` gate read sees it), persist best-effort, then
 * notify listeners (the analytics module flips the PostHog client;
 * live UI re-renders). Mirrors web's accept()/decline() which write
 * localStorage then dispatch the `suppr-consent` event.
 */
export async function setAnalyticsConsent(
  choice: "accepted" | "declined",
): Promise<void> {
  currentConsent = choice;
  try {
    await AsyncStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice);
  } catch {
    /* persistence best-effort — in-memory choice governs this session;
       worst case the prompt re-asks next launch (never captures un-consented) */
  }
  notifyConsentListeners(choice);
}

/**
 * Live consent state for UI (Settings row, consent prompt). Hydrates
 * from storage on mount and stays in sync across instances via the
 * listener set — same cross-instance shape as `useTrendOnlyWeight`.
 */
export function useAnalyticsConsent(): readonly [
  AnalyticsConsentChoice,
  (choice: "accepted" | "declined") => Promise<void>,
] {
  const [choice, setChoice] = useState<AnalyticsConsentChoice>(currentConsent);

  useEffect(() => {
    let cancelled = false;
    // Belt-and-braces hydrate: the provider primes at bootstrap, but a
    // surface mounted before that resolves should still converge.
    void readStoredAnalyticsConsent()
      .then((stored) => {
        if (!cancelled && stored !== null) setChoice(stored);
      })
      .catch(() => {
        /* storage denied — stay on the in-memory value */
      });
    const unsub = onAnalyticsConsentChange(setChoice);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return [choice, setAnalyticsConsent] as const;
}

/** Test-only: reset the in-memory choice without a module reset. */
export function __resetAnalyticsConsentForTests(): void {
  currentConsent = null;
}
