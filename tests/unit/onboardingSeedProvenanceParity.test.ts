import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ONBOARDING_SEEDS } from "../../src/lib/onboarding/onboardingSeeds";
import { SEED_RECIPE_SOURCE_NAME } from "../../src/lib/onboarding/onboardingSeedResolver";

/**
 * ENG-1388 regression guard — resolver ↔ migration provenance parity.
 *
 * `resolveSeedsToRecipeIds` finds seed recipes with
 * `.eq("source_name", SEED_RECIPE_SOURCE_NAME).or(title.ilike.<matchTitle>…)`.
 * The seed recipes are inserted by the 2026-05-14 "suppr kitchen" migration.
 *
 * When that migration renamed `source_name` from 'Suppr onboarding' →
 * 'Suppr Kitchen' (and deleted the old rows via
 * `delete from recipes where author_id is null`), the resolver's gate was
 * never updated — so it matched zero rows and EVERY onboarding seed silently
 * resolved to nothing in production for ~2 months. No test tied the resolver's
 * filter value or the seed matchTitles to the migration, so nothing failed.
 *
 * These tests close that gap: a future rename / dropped seed fails CI, not prod.
 */
const SEED_MIGRATION = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260514100000_replace_recipes_with_suppr_kitchen.sql",
  ),
  "utf8",
);

describe("ENG-1388 — onboarding seed provenance parity (resolver ↔ migration)", () => {
  it("the seed migration inserts recipes under the exact source_name the resolver filters on", () => {
    // The resolver's provenance gate must match a value the migration writes,
    // or resolution returns 0 (the ENG-1388 failure). Assert as a quoted SQL
    // literal so a partial/substring match can't give a false pass.
    expect(SEED_MIGRATION).toContain(`'${SEED_RECIPE_SOURCE_NAME}'`);
  });

  it("every onboarding seed matchTitle exists as an inserted recipe title", () => {
    // The resolver matches titles by case-insensitive equality (ilike, no
    // wildcards), so each matchTitle must appear verbatim as a quoted title in
    // the migration or that seed resolves as missing.
    const haystack = SEED_MIGRATION.toLowerCase();
    const missing = ONBOARDING_SEEDS.map((s) => s.matchTitle).filter(
      (title) => !haystack.includes(`'${title.toLowerCase()}'`),
    );
    expect(missing).toEqual([]);
  });

  it("marks seed recipes published (the resolver drops unpublished rows)", () => {
    // Resolver treats `published === false` as missing. The suppr-kitchen
    // recipes insert `… , published, is_verified) values ( …, true, true )`.
    // Smoke-check that no seed recipe is inserted with published = false.
    expect(SEED_MIGRATION).not.toMatch(/published[\s\S]{0,40}?false/i);
  });
});
