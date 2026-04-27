/**
 * Profile targets "dirty" flag — AsyncStorage key written by the
 * mobile target editor (`apps/mobile/app/profile.tsx`) on a successful
 * save, and read+cleared by the Today tab's `useFocusEffect`.
 *
 * Mobile has no `AppDataContext` setter equivalent to web's
 * `setNutritionTargets`, so this flag is the sanctioned fallback for
 * propagating an explicit target edit to the Today ring without an app
 * restart. Today's `useFocusEffect` already calls `loadProfileTargets`
 * unconditionally on every focus, so this flag is forward-defensive
 * against future short-circuiting and gives a single source of truth
 * for "the user just edited targets".
 *
 * Documented in:
 *   - `docs/specs/2026-04-27-mobile-target-edits-parity.md` §5.5
 *
 * Web parity: `src/app/components/Profile.tsx` calls
 * `setNutritionTargets(normalizeMacroTargets(manualTargets))` directly
 * after a successful upsert. Mobile cannot do that; this flag is the
 * platform-appropriate equivalent.
 */
export const PROFILE_TARGETS_DIRTY_KEY = "suppr.profile.targets.dirty";
