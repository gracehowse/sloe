import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * ENG-1515 — userId-scoped cache of a CONFIRMED onboarding completion.
 *
 * The (tabs) gate historically initialised `onboardingCompleted = true`
 * ("assume complete — never block tab mount on a network fetch") and its
 * 8s timeout + catch kept that optimistic default. For a brand-new user
 * on a slow/failing profile fetch that silently skipped onboarding: they
 * landed on Today with no targets, no plan, and no way to know why.
 *
 * This cache lets `useOnboardingGate` distinguish "never confirmed" from
 * "confirmed complete": a user with a cached completion keeps the
 * instant tab mount even offline; a session with NO cache never assumes
 * complete on timeout/error.
 *
 * Written ("1") at the two confirmation moments:
 *  - onboarding completion (mobile-flow `handleComplete`, immediately
 *    after the `persistOnboarding` upsert that sets
 *    `profiles.onboarding_completed = true` succeeds), and
 *  - a gate fetch that returns a confirmed `onboarding_completed = true`
 *    (backfills existing users, cross-device completions, reinstalls).
 *
 * Cleared when a gate fetch returns confirmed NOT-complete (e.g. "Erase
 * everything" ran on another device — `nukeAllUserAppData` flips
 * `profiles.onboarding_completed` back to false).
 *
 * Deliberately userId-scoped, so it is intentionally NOT in
 * `clearUserScopedStorage.ts`'s sign-out wipe (that module's policy:
 * userId-keyed values pick up the correct value on next sign-in) — a
 * returning user keeps the fast path across sign-out/sign-in.
 */
export function onboardingCompletedCacheKey(userId: string): string {
  return `suppr.onboarding-completed:${userId}`;
}

/** True only when a prior session confirmed completion for this user.
 *  Best-effort: a storage failure reads as "no cache" — the safe
 *  default, since the gate then waits for the server instead of
 *  assuming completion. */
export async function readOnboardingCompletedCache(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(onboardingCompletedCacheKey(userId))) === "1";
  } catch {
    return false;
  }
}

/** Record a confirmed completion. Best-effort — a write failure only
 *  costs the fast path on the next launch, never correctness. */
export async function writeOnboardingCompletedCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(onboardingCompletedCacheKey(userId), "1");
  } catch {
    /* best-effort */
  }
}

/** Drop the cached completion (server confirmed not-complete). */
export async function clearOnboardingCompletedCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(onboardingCompletedCacheKey(userId));
  } catch {
    /* best-effort */
  }
}
