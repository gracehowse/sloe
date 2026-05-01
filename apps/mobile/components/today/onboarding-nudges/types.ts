/**
 * Post-launch onboarding nudge contract — mobile-only by design.
 *
 * Apple Health is iOS-native and the import / recipes nudges sit
 * alongside it on Today; web has no equivalent surface and the linear
 * onboarding shrink (`docs/decisions/2026-04-30-onboarding-shrink-15-to-12.md`)
 * deliberately moved these three off the linear flow into a queue that
 * only the mobile app exposes. If web ever grows a "Today" surface that
 * mirrors mobile, the import + recipes nudges could port at that time;
 * the permissions nudge cannot (no Apple Health on web).
 *
 * The queue itself lives entirely in this folder — see `nudges.ts`,
 * `useNextNudge.ts`, and `OnboardingNudgeBanner.tsx`. Mounted from
 * `apps/mobile/app/(tabs)/index.tsx` directly below the calorie ring.
 */

export type OnboardingNudgeId = "permissions" | "import" | "recipes";

export type OnboardingNudge = {
  id: OnboardingNudgeId;
  /** Header copy shown in the banner. */
  title: string;
  /** Body copy. */
  body: string;
  /** Primary CTA label. */
  primaryLabel: string;
  /** Secondary "Maybe later" cooldown in days. */
  cooldownDays: number;
  /** Whether the nudge should drop from the queue after the primary action. */
  removeOnAction: boolean;
};

/**
 * AsyncStorage key prefix for per-nudge dismissal state.
 *
 * For each nudge the queue writes two keys:
 *   - `${PREFIX}${id}.last-dismissed-at` — ISO timestamp; cooldown gate.
 *   - `${PREFIX}${id}.removed`           — `"true"` once permanently dropped
 *                                          (only ever set for "permissions"
 *                                          today; future nudges with
 *                                          `removeOnAction: true` would also
 *                                          write here).
 */
export const NUDGE_DISMISSED_KEY_PREFIX = "suppr.nudge.";

/** Build the cooldown timestamp key for a given nudge id. */
export function nudgeLastDismissedKey(id: OnboardingNudgeId): string {
  return `${NUDGE_DISMISSED_KEY_PREFIX}${id}.last-dismissed-at`;
}

/** Build the permanent-removal flag key for a given nudge id. */
export function nudgeRemovedKey(id: OnboardingNudgeId): string {
  return `${NUDGE_DISMISSED_KEY_PREFIX}${id}.removed`;
}
