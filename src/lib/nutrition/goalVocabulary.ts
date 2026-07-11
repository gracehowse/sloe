/**
 * goalVocabulary — ENG-1507 single goal-normalisation helper.
 *
 * Two goal vocabularies coexist: the v2 onboarding UI speaks
 * `lose | maintain | gain | recomp` (`src/lib/onboarding/state.ts`) and the
 * DB `profiles.goal` column speaks `cut | maintain | bulk` (written by
 * `mapV2GoalToLegacy` in `src/lib/onboarding/persist.ts`, plus legacy
 * synonyms from older builds: `lose`, `gain`, `strength`, `health`).
 *
 * Before this module, every reader hand-rolled its own normalisation and
 * THREE of them silently defaulted unknown goals to weight-loss
 * (`goalEditorPace.normalizeEditorGoal` → 'cut' — which then WROTE 'cut'
 * back on save; `maintenanceChain` → 'cut'; the four inline
 * WhyThisNumber maps → 'lose'). A user whose goal we don't know was
 * framed — and sometimes persisted — as a weight-loss user.
 *
 * Rules (ENG-1507 / docs/decisions/2026-07-11-canonical-energy-numbers.md):
 *   - Unknown / null NEVER silently becomes 'cut' or 'lose'. It is `null`,
 *     and callers surface an honest "not set" state (or a neutral
 *     derivation) instead.
 *   - `recomp` is NOT a DB value (persist collapses it to 'cut' before
 *     write). A literal 'recomp' reaching a reader is therefore unknown →
 *     null. Restoring recomp fidelity end-to-end (a recomp-aware DB value
 *     or label column) is deferred: see ENG-1538.
 *
 * Pure, dependency-free, RN-safe. Mobile imports via
 * `@suppr/nutrition-core/goalVocabulary`.
 */

/** The canonical DB goal vocabulary. */
export type CanonicalDbGoal = "cut" | "maintain" | "bulk";

/**
 * Normalise any stored/legacy goal string to the canonical DB vocabulary.
 * Unknown (incl. null, garbage, and the never-persisted 'recomp') → null.
 */
export function normalizeDbGoal(
  raw: string | null | undefined,
): CanonicalDbGoal | null {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "cut":
    case "lose":
      return "cut";
    case "maintain":
    case "health":
      return "maintain";
    case "bulk":
    case "gain":
    case "strength":
      return "bulk";
    default:
      return null;
  }
}

/**
 * Short noun-form label ("Lose weight"). Null goal → null so callers omit
 * the line entirely rather than mislabelling the user.
 */
export function formatGoalLabel(
  goal: string | null | undefined,
): string | null {
  switch (normalizeDbGoal(goal)) {
    case "cut":
      return "Lose weight";
    case "maintain":
      return "Eat healthier";
    case "bulk":
      return "Build muscle";
    default:
      return null;
  }
}

/**
 * Gerund clause for prose ("…built around your 2,140 kcal target for
 * losing weight"). Fixes the audit's broken "for lose weight" grammar,
 * which lower-cased the noun label into a sentence.
 */
export function goalClauseGerund(
  goal: string | null | undefined,
): string | null {
  switch (normalizeDbGoal(goal)) {
    case "cut":
      return "losing weight";
    case "maintain":
      return "eating healthier";
    case "bulk":
      return "building muscle";
    default:
      return null;
  }
}
