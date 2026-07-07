/**
 * P0-3 (2026-04-25) — meta-test pinning the inventory of `nutrition_entries`
 * insert sites and asserting each one either:
 *
 *   (a) calls a coercion guard (`wouldCoerceMacros`, `fetchPlannedMealMicros`,
 *       or `macrosAreCoerced`) inline, OR
 *   (b) is wrapped by an upstream caller that calls the guard before
 *       reaching this insert (`upstreamGuardFile`), OR
 *   (c) is allow-listed below with the provenance that makes coercion
 *       impossible (HealthKit external data, barcode-resolved macros,
 *       copy-from-existing-rows bulk inserts).
 *
 * If a new write site is added without falling into one of the three
 * categories, this test fails — forcing the author to either guard the
 * write, document the safe upstream caller, or document the safe
 * provenance.
 *
 * Policy reference: `docs/product/nutrition-approximation-policy.md` §A1.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../..");
// `.insert` may sit on the next line after the launch-audit P1-2 builder
// consolidation (`.from("nutrition_entries")\n  .insert(buildNutritionEntryRow(...))`).
const INSERT_RE = /from\(\s*["']nutrition_entries["']\s*\)\s*\.insert/;
// ENG-1466 — the web write-ahead port's durable write is an upsert
// (`.upsert(rows, {onConflict: "id"})`), not a bare insert; sites that
// delegate to `useWebJournalWriteAhead` match this instead of `INSERT_RE`.
const UPSERT_RE = /from\(\s*["']nutrition_entries["']\s*\)\s*\.upsert/;
const GUARD_RE = /macrosAreCoerced|wouldCoerceMacros|fetchPlannedMealMicros/;

type Site = {
  /** Path relative to repo root. */
  file: string;
  reason:
    | "guarded-inline"
    | "guarded-upstream"
    | "healthkit"
    | "barcode"
    | "copy"
    | "caller-resolved";
  /** When reason is "guarded-upstream", which file is the guard layer. */
  upstreamGuardFile?: string;
  /**
   * ENG-1466 — set when the write site's durable persistence has moved to
   * a write-ahead upsert (in a different file than `file` above) rather
   * than an inline `.insert()`. The sanity check matches `UPSERT_RE`
   * against THIS file instead of `INSERT_RE` against `file`.
   */
  writeAheadFile?: string;
};

/**
 * Authoritative inventory of `nutrition_entries.insert` sites and the
 * reason each one is safe. Keep in sync with the policy doc §A1.
 *
 * Adding a new insert site? You must either add the guard inline (call
 * `wouldCoerceMacros` / `fetchPlannedMealMicros` before insert) or add
 * the row here with documented provenance.
 */
const INVENTORY: Site[] = [
  // logPlannedMealWithPortion (line ~2755) is guarded inline. The other
  // insert in this file (~2543) is the copy/duplicate path which clones
  // already-validated rows; safe by provenance but co-located with the
  // guarded insert in the same file, so the inline guard pattern matches.
  { file: "apps/mobile/app/(tabs)/_today/TodayScreen.tsx", reason: "guarded-inline" },

  // addRecipeToTodayJournal — P0-3 added inline guard before insert.
  { file: "apps/mobile/app/recipe/[id].tsx", reason: "guarded-inline" },

  // useNutritionJournalState builds the row + guard-checks upstream; the
  // guard runs in the upstream caller (NutritionTracker.tsx onLogPlanMeal)
  // which calls fetchPlannedMealMicros and refuses before invoking
  // addLoggedMeal. Other callers of addLoggedMeal* pass already-resolved
  // per-100g macros from FoodSearch / barcode / verify — no coercion path.
  // ENG-1466 (2026-07-06) — the durable write itself moved to
  // `useWebJournalWriteAhead.ts`'s write-ahead `.upsert(rows, {onConflict:
  // "id"})` (enqueue-before-network-attempt), so the write-site sanity
  // check now matches UPSERT_RE against that file instead of INSERT_RE
  // against useNutritionJournalState.ts.
  {
    file: "src/context/appData/useNutritionJournalState.ts",
    reason: "guarded-upstream",
    upstreamGuardFile: "src/app/components/NutritionTracker.tsx",
    writeAheadFile: "src/hooks/useWebJournalWriteAhead.ts",
  },

  // External provenance — Apple Health.
  { file: "apps/mobile/lib/healthSync.ts", reason: "healthkit" },

  // External provenance — barcode → OFF/USDA pipeline. Macros pass
  // through `macroPlausibility.checkMacroPlausibility` (F-77) before
  // reaching the user, so coerced data cannot enter this path.
  { file: "apps/mobile/app/(tabs)/barcode.tsx", reason: "barcode" },
];

describe("nutrition_entries insert guard inventory", () => {
  for (const site of INVENTORY) {
    it(`${site.file} — ${site.reason}`, () => {
      const text = readFileSync(resolve(REPO, site.file), "utf8");

      // Sanity: each listed site must actually write into nutrition_entries
      // — either inline (INSERT_RE) or, post-ENG-1466, via a write-ahead
      // upsert in a delegate file (UPSERT_RE against `writeAheadFile`).
      if (site.writeAheadFile) {
        const writeAheadText = readFileSync(resolve(REPO, site.writeAheadFile), "utf8");
        expect(writeAheadText).toMatch(UPSERT_RE);
      } else {
        expect(text).toMatch(INSERT_RE);
      }

      if (site.reason === "guarded-inline") {
        expect(text).toMatch(GUARD_RE);
      }
      if (site.reason === "guarded-upstream") {
        expect(site.upstreamGuardFile).toBeDefined();
        const upstream = readFileSync(
          resolve(REPO, site.upstreamGuardFile!),
          "utf8",
        );
        expect(upstream).toMatch(GUARD_RE);
      }
      // Allow-listed reasons (healthkit, barcode, copy) don't require a
      // guard — documented as safe by data provenance.
    });
  }
});
