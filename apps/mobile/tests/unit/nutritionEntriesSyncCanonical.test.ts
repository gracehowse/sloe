/**
 * Pins debounced journal sync to canonicalize nutrition_entries.source
 * (follow-up to ENG-674 — legacy in-memory labels must not re-hit CHECK).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../hooks/useNutritionEntriesSync.ts"),
  "utf8",
);

describe("useNutritionEntriesSync — ENG-674 client writes", () => {
  it("canonicalizes source and sends recipe_id on upsert rows", () => {
    expect(SRC).toMatch(/canonicalNutritionEntrySource/);
    expect(SRC).toMatch(/source:\s*canonicalNutritionEntrySource\(m\.source\)/);
    expect(SRC).toMatch(/recipe_id:\s*m\.recipeId/);
  });
});
