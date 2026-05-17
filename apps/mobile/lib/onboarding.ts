/**
 * Mobile re-export shim for onboarding shared logic.
 *
 * The single source of truth lives at `src/lib/onboarding/*` so the
 * web flow (`app/onboarding/page.tsx`) and the mobile flow share the
 * same Mifflin-St Jeor pipeline, pace conversion, safety-floor
 * detection, and validation rules. Mirrors the existing pattern at
 * `apps/mobile/lib/tdee.ts`.
 *
 * Always import from this module on mobile — never reach into
 * `../../../src/lib/onboarding/*` directly. The shim isolates the
 * relative path so a future refactor (moving the shared module under
 * `packages/`) only touches one file.
 *
 * Renamed 2026-04-30 from `onboarding-v2.ts` (the v2 suffix was dropped
 * once legacy onboarding shipped removal). Live data — PostHog flag
 * `onboarding_v2`, analytics events, and the `suppr.onboarding-v2.state`
 * AsyncStorage key — keep their original names to avoid orphaning
 * persisted state and breaking dashboards.
 */

export * from "@suppr/shared/onboarding/state";
export * from "@suppr/shared/onboarding/targets";
