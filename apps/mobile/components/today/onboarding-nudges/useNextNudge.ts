import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  type NudgeEligibilityState,
  type OnboardingNudge,
  type OnboardingNudgeId,
  nudgeLastDismissedKey,
  nudgeRemovedKey,
} from "./types";
import { ONBOARDING_NUDGES } from "./nudges";

/**
 * Outcome of a nudge dismissal.
 *
 *   - `"primary"` — user tapped the primary CTA. The host has already
 *     fired the action handler (permission request / route push); we
 *     write the cooldown timestamp here so the same nudge doesn't
 *     re-render this session, and additionally write the permanent-
 *     removal flag for nudges flagged `removeOnAction`.
 *   - `"later"` — user tapped "Maybe later". Cooldown timestamp only;
 *     never permanent.
 */
export type NudgeDismissAction = "primary" | "later";

export type UseNextNudgeResult = {
  /** The highest-priority nudge that passes all gates, or null. */
  nudge: OnboardingNudge | null;
  /**
   * Persist the user's response. The host calls this AFTER the primary
   * action returns (so a permission grant that errored is still treated
   * as a dismissal, not a permanent removal). Returns once storage
   * writes resolve so callers can chain UI updates.
   */
  markDismissed: (id: OnboardingNudgeId, action: NudgeDismissAction) => Promise<void>;
};

type DismissalState = {
  lastDismissedAt: number | null; // epoch ms or null
  removed: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Read the dismissal state for one nudge from AsyncStorage. Treats any
 * unparseable timestamp as "never dismissed" — a corrupt write must not
 * silently lock the user out of seeing the prompt forever.
 */
async function readDismissalState(id: OnboardingNudgeId): Promise<DismissalState> {
  const [tsRaw, removedRaw] = await Promise.all([
    AsyncStorage.getItem(nudgeLastDismissedKey(id)),
    AsyncStorage.getItem(nudgeRemovedKey(id)),
  ]);
  let lastDismissedAt: number | null = null;
  if (tsRaw) {
    const parsed = Date.parse(tsRaw);
    if (Number.isFinite(parsed)) {
      lastDismissedAt = parsed;
    }
  }
  return { lastDismissedAt, removed: removedRaw === "true" };
}

/**
 * Filter the static catalogue down to the first nudge that passes:
 *   1. The runtime `eligibility` predicate (if present).
 *   2. Not permanently removed.
 *   3. Either never dismissed OR cooldown has elapsed.
 *
 * Order in `ONBOARDING_NUDGES` IS priority order — see `nudges.ts`.
 */
function selectNextNudge(
  catalogue: OnboardingNudge[],
  dismissalsById: Record<OnboardingNudgeId, DismissalState>,
  state: NudgeEligibilityState,
  now: number,
): OnboardingNudge | null {
  for (const nudge of catalogue) {
    if (nudge.eligibility && !nudge.eligibility(state)) continue;
    const ds = dismissalsById[nudge.id];
    if (ds.removed) continue;
    if (ds.lastDismissedAt != null) {
      const cooldownMs = nudge.cooldownDays * DAY_MS;
      if (now - ds.lastDismissedAt < cooldownMs) continue;
    }
    return nudge;
  }
  return null;
}

/**
 * Hook returning the next eligible nudge plus a dismissal writer.
 *
 * On mount it reads dismissal state for every catalogue entry in
 * parallel, picks the highest-priority eligible one, and re-runs the
 * selector after every `markDismissed` call so the UI advances to the
 * next nudge (or null) without remounting.
 *
 * The host passes a `state` object describing the user's current
 * library / log volume / permission posture; each nudge's
 * `eligibility` predicate decides if it's the right moment to surface
 * (e.g. don't ask for HealthKit until the user has logged a few
 * times). See `nudges.ts` and `types.ts → NudgeEligibilityState`.
 *
 * Hydration window: while reading from storage, `nudge` is `null`. This
 * prevents a flash where a stale "permissions" prompt renders for a
 * frame before the storage read tells us it's already been dismissed.
 *
 * Errors from AsyncStorage are swallowed (logged via `console.warn`):
 * a storage hiccup must not crash Today. The user simply sees the
 * banner re-appear on next launch — never twice in the same launch.
 */
export function useNextNudge(state: NudgeEligibilityState): UseNextNudgeResult {
  const [dismissalsById, setDismissalsById] = useState<
    Record<OnboardingNudgeId, DismissalState> | null
  >(null);

  // Hydrate dismissal state for every catalogue entry in parallel.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const entries = await Promise.all(
          ONBOARDING_NUDGES.map(async (n) => {
            const ds = await readDismissalState(n.id);
            return [n.id, ds] as const;
          }),
        );
        if (cancelled) return;
        const map = {} as Record<OnboardingNudgeId, DismissalState>;
        for (const [id, ds] of entries) {
          map[id] = ds;
        }
        setDismissalsById(map);
      } catch (err) {
        if (cancelled) return;
        console.warn("[onboarding-nudges] failed to hydrate dismissal state", err);
        // Open every nudge — a failed read should not silently hide the
        // prompts. The cooldown floor is "never dismissed".
        const map = {} as Record<OnboardingNudgeId, DismissalState>;
        for (const n of ONBOARDING_NUDGES) {
          map[n.id] = { lastDismissedAt: null, removed: false };
        }
        setDismissalsById(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markDismissed = useCallback(
    async (id: OnboardingNudgeId, action: NudgeDismissAction): Promise<void> => {
      const def = ONBOARDING_NUDGES.find((n) => n.id === id);
      if (!def) return;

      const nowIso = new Date().toISOString();
      const writes: Promise<void>[] = [
        AsyncStorage.setItem(nudgeLastDismissedKey(id), nowIso),
      ];
      const willRemove = action === "primary" && def.removeOnAction;
      if (willRemove) {
        writes.push(AsyncStorage.setItem(nudgeRemovedKey(id), "true"));
      }

      try {
        await Promise.all(writes);
      } catch (err) {
        console.warn("[onboarding-nudges] failed to persist dismissal", err);
        // Fall through to in-memory update — the user sees the banner
        // disappear regardless. Worst case: it returns next launch.
      }

      // Optimistic in-memory update so the next render advances.
      setDismissalsById((prev) => {
        const base = prev ?? ({} as Record<OnboardingNudgeId, DismissalState>);
        return {
          ...base,
          [id]: {
            lastDismissedAt: Date.parse(nowIso),
            removed: willRemove || base[id]?.removed === true,
          },
        };
      });
    },
    [],
  );

  // Until hydration completes, render no nudge — avoids the flash
  // described above. Once hydrated, re-run the selector against `now`
  // and the live eligibility state from the host.
  const nudge = dismissalsById
    ? selectNextNudge(ONBOARDING_NUDGES, dismissalsById, state, Date.now())
    : null;

  return { nudge, markDismissed };
}
