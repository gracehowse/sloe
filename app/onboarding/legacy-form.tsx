/**
 * REMOVED 2026-04-27 — legacy onboarding form, superseded by /onboarding/v2.
 *
 * The 1-week validation window agreed in
 * docs/decisions/2026-04-27-delete-legacy-onboarding.md closed today
 * with no v2 regressions in TestFlight or web. The previous file
 * contents (the 4-step form + LegacyOnboardingForm export) are gone.
 *
 * The route /onboarding now redirects unconditionally to /onboarding/v2;
 * the ?legacy=1 escape hatch is no longer wired anywhere. This file
 * exists only as a tombstone — `git rm` it on the next branch and the
 * build will not break (no other surface imports it).
 */
export {};
