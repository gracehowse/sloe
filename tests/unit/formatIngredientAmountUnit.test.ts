/**
 * Tests for `formatIngredientAmountUnit` — the defensive amount/unit
 * renderer that fixes the "1 1 breast" duplicated-token render seen
 * in user testing on 2026-05-02.
 *
 * Bug context: USDA / FatSecret persists count-prefixed portion labels
 * ("1 breast", "1 medium (182g)") into the `unit` column. When the
 * recipe-detail row template did `${amount} ${unit}` the result was
 * "1 1 breast". This formatter dedupes at render time without
 * requiring a destructive backfill of historical rows.
 */

import { describe, expect, it } from "vitest";
import { formatIngredientAmountUnit } from "@/lib/recipe-ingredients/formatIngredientAmount";

describe("formatIngredientAmountUnit", () => {
  it("returns 'amount unit' when both fields are clean and distinct", () => {
    expect(formatIngredientAmountUnit(1, "breast")).toBe("1 breast");
  });

  it("dedupes when unit already contains the amount as a prefix", () => {
    expect(formatIngredientAmountUnit(1, "1 breast")).toBe("1 breast");
  });

  it("dedupes USDA-style compound portion labels with parentheticals", () => {
    expect(formatIngredientAmountUnit(1, "1 medium (182g)")).toBe(
      "1 medium (182g)",
    );
  });

  it("dedupes when amount and count agree but unit case differs", () => {
    // FatSecret-style: amount="2", unit="2 BREAST" should still dedupe
    // to "2 BREAST" (preserve the persisted casing).
    expect(formatIngredientAmountUnit(2, "2 BREAST")).toBe("2 BREAST");
  });

  it("dedupes when amount string ends with the unit token", () => {
    // amount="1 breast", unit="breast" → "1 breast" (no dup).
    expect(formatIngredientAmountUnit("1 breast", "breast")).toBe("1 breast");
  });

  it("does NOT dedupe when amounts differ between fields", () => {
    // amount=2, unit="1 breast" — the user has scaled the recipe so
    // the count differs. Concatenate so the on-screen render still
    // exposes the mismatch rather than silently dropping a token.
    expect(formatIngredientAmountUnit(2, "1 breast")).toBe("2 1 breast");
  });

  it("returns just the amount when unit is empty", () => {
    expect(formatIngredientAmountUnit(1, "")).toBe("1");
    expect(formatIngredientAmountUnit(1, null)).toBe("1");
    expect(formatIngredientAmountUnit(1, undefined)).toBe("1");
  });

  it("returns just the unit when amount is empty", () => {
    expect(formatIngredientAmountUnit("", "cup")).toBe("cup");
    expect(formatIngredientAmountUnit(null, "cup")).toBe("cup");
    expect(formatIngredientAmountUnit(undefined, "cup")).toBe("cup");
  });

  it("returns empty string when both fields are empty", () => {
    expect(formatIngredientAmountUnit(null, null)).toBe("");
    expect(formatIngredientAmountUnit("", "")).toBe("");
    expect(formatIngredientAmountUnit(undefined, undefined)).toBe("");
  });

  it("rounds numeric amounts to two decimals", () => {
    expect(formatIngredientAmountUnit(0.6666666, "cup")).toBe("0.67 cup");
  });

  it("renders integer amounts without trailing zeros", () => {
    expect(formatIngredientAmountUnit(2, "tbsp")).toBe("2 tbsp");
  });

  it("ignores non-finite numeric amounts", () => {
    expect(formatIngredientAmountUnit(Number.NaN, "cup")).toBe("cup");
    expect(formatIngredientAmountUnit(Number.POSITIVE_INFINITY, "cup")).toBe("cup");
  });

  it("trims whitespace on inputs before deciding dedupe", () => {
    expect(formatIngredientAmountUnit(1, "  1 breast  ")).toBe("1 breast");
    expect(formatIngredientAmountUnit("  1  ", "breast")).toBe("1 breast");
  });

  it("pluralises bare count-noun units when the amount is greater than 1", () => {
    expect(formatIngredientAmountUnit(2, "rasher")).toBe("2 rashers");
    expect(formatIngredientAmountUnit(2, "clove")).toBe("2 cloves");
    expect(formatIngredientAmountUnit(3, "slice")).toBe("3 slices");
    expect(formatIngredientAmountUnit("2", "clove")).toBe("2 cloves");
  });

  it("keeps the singular unit at amount 1 or below", () => {
    expect(formatIngredientAmountUnit(1, "clove")).toBe("1 clove");
    expect(formatIngredientAmountUnit(0.5, "clove")).toBe("0.5 clove");
  });

  it("never pluralises measurement abbreviations or size words", () => {
    expect(formatIngredientAmountUnit(2, "g")).toBe("2 g");
    expect(formatIngredientAmountUnit(2, "tbsp")).toBe("2 tbsp");
    expect(formatIngredientAmountUnit(2, "medium")).toBe("2 medium");
  });

  it("leaves already-plural units untouched", () => {
    expect(formatIngredientAmountUnit(2, "cloves")).toBe("2 cloves");
    expect(formatIngredientAmountUnit(2, "cups")).toBe("2 cups");
  });

  it("uses irregular plurals for f-ending units", () => {
    expect(formatIngredientAmountUnit(2, "leaf")).toBe("2 leaves");
  });

  it("skips pluralisation for compound or non-alphabetic units", () => {
    expect(formatIngredientAmountUnit(2, "bay leaf")).toBe("2 bay leaf");
    expect(formatIngredientAmountUnit(2, "medium (182g)")).toBe("2 medium (182g)");
  });
});

describe("unpluralisable unit tokens (ENG-1533A review hardening)", () => {
  it.each([
    ["cm", "2 cm"],
    ["mm", "5 mm"],
    ["in", "2 in"],
    ["dozen", "2 dozen"],
  ])("never appends s to %s", (unit, expected) => {
    const amount = Number(expected.split(" ")[0]);
    expect(formatIngredientAmountUnit(amount, unit)).toBe(expected);
  });
});
