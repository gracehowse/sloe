/**
 * ENG-1597 — short in-app help copy for the Import → Verify → Save loop.
 * Paraphrased from `docs/journeys/import-recipe.md` — not a wiki mirror.
 */

export const IN_APP_HELP_IMPORT_FLAG = "in_app_help_import_v1";

export type ContextualHelpTopic = {
  id: string;
  title: string;
  bullets: readonly string[];
};

export const IMPORT_VERIFY_HELP: ContextualHelpTopic = {
  id: "import-verify",
  title: "Why verify ingredients?",
  bullets: [
    "Import estimates nutrition from each ingredient match — some matches are low-confidence.",
    "Flagged rows are excluded from headline totals until you confirm or fix them.",
    "Tap Fix (or the row) to search a better food match; Save locks the recipe into your Library.",
    "You can always re-open verify later from the recipe — nothing is permanent until you trust it.",
  ],
};
