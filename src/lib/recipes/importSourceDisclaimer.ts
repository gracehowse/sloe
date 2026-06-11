/**
 * Import source-card disclaimer — single source of truth (ENG-858 / ENG-1042).
 *
 * Imported (non-first-party) recipes carry an attribution + link-back AND a
 * short, body-neutral disclaimer on their SOURCE card. Required by the recipe-
 * import legal posture: we extract the FACTS from a creator's page (ingredients,
 * steps, times) and estimate the nutrition ourselves — so the user must be told
 * the numbers are our estimate and that we are not affiliated with or endorsed
 * by the original source. Without this, the recipe shows a Suppr-calculated
 * nutrition panel with no estimate/non-endorsement notice.
 *
 * The exact wording is the legal-reviewer-approved string from
 * `docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md` ("Exact
 * wording" §). It is deliberately factual and body-neutral (no health claims,
 * no value judgement). Any change to this string must be re-approved by the
 * legal lens — `recipeSourceCardParity.test.ts` pins it on both platforms.
 *
 * Shared (no `@/` alias) so mobile can import it via `@suppr/shared/recipes/...`
 * and web via `@/lib/recipes/...` — one constant, no platform drift.
 */

/**
 * Whether a recipe is an IMPORT (non-first-party) and therefore must show the
 * attribution + disclaimer card. The canonical signal is a persisted
 * `source_url`: every import path writes one, first-party authoring never does.
 * `source_name` alone (a caption-recovered handle with no URL) is still an
 * import — the extractor read it off someone else's post.
 */
export function isImportedRecipe(input: {
  sourceUrl?: string | null;
  sourceName?: string | null;
}): boolean {
  const url = (input.sourceUrl ?? "").trim();
  const name = (input.sourceName ?? "").trim();
  return url.length > 0 || name.length > 0;
}

/**
 * Build the disclaimer line for an imported recipe's source card. When the
 * source name is known it is named in the non-endorsement clause; when only a
 * URL is known (no recovered name) we fall back to a neutral "the original
 * source" so the sentence still reads cleanly and never invents an attribution.
 */
export function importSourceDisclaimer(sourceName?: string | null): string {
  const name = (sourceName ?? "").trim();
  const subject = name.length > 0 ? name : "the original source";
  return `Recipe imported for your personal cookbook. Ingredients and nutrition are estimated by Suppr and may differ from the original. Not affiliated with or endorsed by ${subject}.`;
}
