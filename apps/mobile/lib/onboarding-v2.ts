/**
 * Mobile re-export shim for onboarding v2 shared logic.
 *
 * The single source of truth lives at `src/lib/onboarding/v2/*` so the
 * web flow (`app/onboarding/v2/`) and the mobile v2 flow share the
 * same Mifflin-St Jeor pipeline, pace conversion, safety-floor
 * detection, and validation rules. Mirrors the existing pattern at
 * `apps/mobile/lib/tdee.ts`.
 *
 * Always import from this module on mobile — never reach into
 * `../../../src/lib/onboarding/v2/*` directly. The shim isolates the
 * relative path so a future refactor (moving the shared module under
 * `packages/`) only touches one file.
 */

export * from "../../../src/lib/onboarding/v2/state";
export * from "../../../src/lib/onboarding/v2/targets";
