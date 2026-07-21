/**
 * Centralised AsyncStorage clearer for sign-out (audit Y02, 2026-05-05).
 *
 * Background: signing out clears the Supabase session but historically
 * left dozens of AsyncStorage keys untouched. If a different user signed
 * in on the same device (TestFlight handoff, sim re-use, family iPad),
 * they inherited the previous user's `cachedUserTier` (showing Pro UI
 * without payment), HealthKit-written-meal IDs (suppressing legitimate
 * writes), eat-again list, push-prompt-dismissed state, etc.
 *
 * This module owns the canonical list of user-scoped (non-profile,
 * non-server) AsyncStorage keys that must be cleared when the session
 * ends. Auth provider's `onAuthStateChange` calls
 * `clearUserScopedAsyncStorage()` when the event is `SIGNED_OUT`.
 *
 * Keys NOT cleared:
 * - Theme preference (UI affordance, no leak risk)
 * - Anything keyed by userId (already userId-scoped — picks up the
 *   correct value on next sign-in)
 * - Per-recipe / per-barcode / per-household memos (non-leaky data
 *   the user benefits from carrying across accounts)
 *
 * Add a key here if it (a) caches user-state that User B should not
 * inherit from User A, or (b) gates a one-time prompt that should
 * re-appear for a fresh user.
 */

import { resetHealthKitMealWriterCache } from "./healthKitMealWriter";

/**
 * AsyncStorage keys to clear on sign-out. Strings are repeated verbatim
 * from their definition sites (cross-referenced in inline comments) so
 * a single rename anywhere doesn't break the wipe.
 */
const KEYS_TO_CLEAR_ON_SIGNOUT: ReadonlyArray<string> = [
  // apps/mobile/lib/cachedUserTier.ts
  "suppr.cached_user_tier",
  // apps/mobile/lib/healthKitMealWriter.ts — userId-scoped per-user
  // suffixed key handled separately below; this constant covers the
  // toggle flag.
  "health_export_nutrition",
  // apps/mobile/lib/healthSync.ts
  "health_import_nutrition",
  "health_import_generic_labels",
  "health_export_nutrition",
  "health_body_lookback_days",
  "health_sync_apple_connected",
  // apps/mobile/lib/expoPushToken.ts
  "notifications_prompt_dismissed_v1",
  "expo_push_token_last_synced_v1",
  // apps/mobile/hooks/use-meal-plan-slots.ts
  "suppr-meal-plan-slots-v1",
  "suppr-active-meal-plan-slot-v1",
  // apps/mobile/components/FirstRunChecklist.tsx
  "suppr-checklist-dismissed",
  // apps/mobile/lib/cookHandsfree.ts
  "suppr.cook.handsfree.enabled",
  // apps/mobile/components/onboarding/context.tsx — onboarding draft
  // state; a freshly-signed-in user should start onboarding from
  // scratch, not inherit the previous user's draft answers.
  "suppr.onboarding-v2.state",
  // src/lib/nutrition/trackingExtras.ts
  "suppr.tracking-extras.v1",
  // src/lib/analytics/firstLog.ts — fires the "first log" event once
  // per user; new sign-in must be eligible for it.
  "suppr:analytics:first_log_at_set",
  // apps/mobile/lib/widgetSnapshot.ts — SUPPR_WIDGET_SNAPSHOT_KEY
  "suppr.widget.snapshot.v1",
];

/**
 * Clear non-profile AsyncStorage keys that would otherwise leak from
 * one user's session into the next sign-in on the same device.
 *
 * Idempotent. Best-effort: any individual key that fails to remove
 * (RN bridge edge cases) is logged and skipped; the function still
 * resolves so it never blocks the sign-out flow.
 *
 * Also clears the in-memory HealthKit-written-meal-IDs cache so the
 * next user's writes start clean. The AsyncStorage backing for that
 * set is now userId-scoped (`health_export_written_ids:<uid>`) so the
 * outgoing user's set on disk is left intact for if they ever sign
 * back in — only the in-memory state is wiped here.
 */
export async function clearUserScopedAsyncStorage(): Promise<void> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    // multiRemove succeeds-or-fails as a batch — for partial-success
    // semantics we fall back to per-key removal on any error.
    try {
      await AsyncStorage.multiRemove(KEYS_TO_CLEAR_ON_SIGNOUT as string[]);
    } catch {
      for (const key of KEYS_TO_CLEAR_ON_SIGNOUT) {
        try {
          await AsyncStorage.removeItem(key);
        } catch {
          // swallow — best-effort; sign-out must complete regardless.
        }
      }
    }
  } catch {
    // If AsyncStorage itself fails to load, sign-out still proceeds.
  }
  // Reset in-memory caches that mirror cleared keys.
  try {
    resetHealthKitMealWriterCache();
  } catch {
    // swallow
  }
}
