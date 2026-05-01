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

/**
 * Runtime state the host passes into `useNextNudge` so each nudge can
 * decide if it's eligible for display.
 *
 * Wave-2 (2026-04-30 audit-vs-competitors): Cal AI defers HK ask until
 * after the first food log because asking BEFORE the user has felt the
 * value lands in a "no, why" state. We mirror that by gating each nudge
 * on a value-felt signal rather than queuing them all the moment the
 * user lands on Today. See `nudges.ts` for the per-id thresholds.
 */
export type NudgeEligibilityState = {
  /** Number of meals logged today. (Banner is also mount-gated on >=1.) */
  mealsTodayCount: number;
  /**
   * Total recipes saved to the user's library. Used to gate the import
   * + recipes nudges so we don't ask a user with a stocked library to
   * import / browse — they're already past that step.
   */
  libraryCount: number;
  /**
   * Lifetime count of nutrition entries (any source). Used to gate the
   * permissions nudge so we don't ask for HealthKit until the user has
   * felt the value of logging a few times. `null` = unknown (treat as 0
   * for gating purposes — never show if we can't prove the threshold).
   */
  lifetimeMealCount: number | null;
  /**
   * OS-reported notifications permission status. When `granted` or
   * `denied`, the OS already has an authoritative answer — re-asking
   * via this nudge is noise. `undetermined` is the "we can still ask"
   * state; `null` = we haven't checked yet (treat as ineligible until
   * we know, so we never flash a stale prompt).
   */
  notificationsPermissionStatus: "granted" | "denied" | "undetermined" | null;
};

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
  /**
   * Predicate gating display on runtime state. Called during selector
   * evaluation alongside the cooldown / removed gates. Returning false
   * skips this nudge for now; if a higher-priority nudge is also
   * skipped, selection falls through to the next eligible one. When
   * absent, the nudge is always eligible (subject to cooldown +
   * removed flags). Pure — same input, same output.
   */
  eligibility?: (state: NudgeEligibilityState) => boolean;
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
