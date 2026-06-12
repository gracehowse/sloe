/**
 * Pins debounced journal sync to canonicalize nutrition_entries.source
 * (follow-up to ENG-674 — legacy in-memory labels must not re-hit CHECK).
 *
 * ENG (2026-06-12, launch-audit P1-2) — the backstop's inline row map was
 * replaced by the single shared `buildNutritionEntryRow`. The ENG-674
 * guarantee (canonical source + recipe_id on every backstop row) is now
 * provided by the builder, so we pin the hook→builder wiring here and the
 * canonicalization/recipe_id in the builder file. This also means the backstop
 * now writes `eaten_at` + an eaten-derived `date_key`, which it previously
 * omitted (the P1-2 corruption risk) — pinned in the builder too.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../hooks/useNutritionEntriesSync.ts"),
  "utf8",
);
const ROW_BUILDER_SRC = readFileSync(
  resolve(__dirname, "../../lib/nutritionEntryRow.ts"),
  "utf8",
);

describe("useNutritionEntriesSync — ENG-674 client writes", () => {
  it("builds backstop upsert rows via the shared row-builder (not an inline map)", () => {
    expect(SRC).toMatch(/buildNutritionEntryRow/);
    expect(SRC).toMatch(/todayMeals\.map\(\(m\)\s*=>\s*buildNutritionEntryRow\(m,\s*dk,\s*userId\)\)/);
    // The backstop must NOT carry a divergent inline column literal anymore.
    expect(SRC).not.toMatch(/source:\s*canonicalNutritionEntrySource\(m\.source\)/);
  });

  it("the shared row-builder canonicalizes source, sends recipe_id and writes eaten_at", () => {
    expect(ROW_BUILDER_SRC).toMatch(/canonicalNutritionEntrySource/);
    expect(ROW_BUILDER_SRC).toMatch(/source:\s*canonicalNutritionEntrySource\(meal\.source\)/);
    expect(ROW_BUILDER_SRC).toMatch(/recipe_id:\s*meal\.recipeId/);
    // P1-2 fix: the backstop column set now includes eaten_at + eaten-derived date_key.
    expect(ROW_BUILDER_SRC).toMatch(/eaten_at:\s*eatenAt/);
    expect(ROW_BUILDER_SRC).toMatch(/nutritionEntryDateKeyAndEatenAt/);
  });
});
