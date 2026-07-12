/**
 * Streak-reset detector (L6 G8, 2026-04-18).
 *
 * Pure predicate: returns `true` iff the computed protected streak has
 * just transitioned from a positive value to zero. Used on both
 * platforms to fire the `streak_reset` analytics event exactly once
 * per transition — not on repeated zero-reads after the reset has
 * already been emitted, and not on initial mounts where the user
 * simply hasn't logged yet (prior=0, current=0).
 *
 * Callers:
 *  - `src/lib/nutrition/useStreakResetCopy.ts` — web hook (host:
 *    `NutritionTracker.tsx`); `computeProtectedStreak` result feeds a
 *    `useEffect` that diffs the prior ref against the current value.
 *  - `apps/mobile/app/(tabs)/index.tsx` — same pattern on mobile.
 *
 * Both call sites MUST seed the prior ref with `null` on first mount
 * so the initial render never fires a spurious reset even if the
 * streak currently reads zero. `null → 0` is not a transition; only
 * `>=1 → 0` is.
 */

/** Returns true iff the streak transitioned from >=1 to 0.
 *
 *  `prior` is `null` on the very first render (meaning we don't yet
 *  know the previous value), and a number on every render after. A
 *  `null` prior is NEVER treated as a transition — we need to see a
 *  real positive value cross to zero before firing the event. */
export function didStreakReset(prior: number | null, current: number): boolean {
  if (prior == null) return false;
  if (!Number.isFinite(prior) || !Number.isFinite(current)) return false;
  return prior >= 1 && current === 0;
}
