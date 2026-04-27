/**
 * F-73 (2026-04-27) — pin the generic-beverages match shim that
 * preempts USDA Branded "Cortado" (Spanish cheese) for known coffee
 * drink queries.
 */
import { describe, it, expect } from "vitest";
import {
  GENERIC_BEVERAGES,
  matchGenericBeverage,
} from "../../src/lib/nutrition/genericBeverages";

describe("matchGenericBeverage — F-73 cortado fix", () => {
  it("matches 'cortado' (the canonical bug query)", () => {
    const m = matchGenericBeverage("cortado");
    expect(m).not.toBeNull();
    expect(m?.id).toBe("cortado");
    expect(m?.name).toBe("Cortado");
  });

  it("matches case-insensitively + with surrounding whitespace", () => {
    expect(matchGenericBeverage("CORTADO")?.id).toBe("cortado");
    expect(matchGenericBeverage("  Cortado  ")?.id).toBe("cortado");
  });

  it("matches common drinks via aliases", () => {
    expect(matchGenericBeverage("flat white")?.id).toBe("flat-white");
    expect(matchGenericBeverage("flat-white")?.id).toBe("flat-white");
    expect(matchGenericBeverage("cappuccino")?.id).toBe("cappuccino");
    expect(matchGenericBeverage("doppio")?.id).toBe("espresso-double");
    expect(matchGenericBeverage("long black")?.id).toBe("americano");
    expect(matchGenericBeverage("v60")?.id).toBe("pour-over");
    expect(matchGenericBeverage("cold brew")?.id).toBe("cold-brew");
  });

  it("tolerates curly apostrophes (cafe vs café)", () => {
    expect(matchGenericBeverage("café latte")?.id).toBe("latte");
    expect(matchGenericBeverage("caffe latte")?.id).toBe("latte");
  });

  it("matches typo aliases (cappucino, capuccino)", () => {
    expect(matchGenericBeverage("cappucino")?.id).toBe("cappuccino");
    expect(matchGenericBeverage("capuccino")?.id).toBe("cappuccino");
  });

  it("returns null for empty / whitespace input", () => {
    expect(matchGenericBeverage("")).toBeNull();
    expect(matchGenericBeverage("   ")).toBeNull();
  });

  it("returns null for unknown queries (does not over-match)", () => {
    expect(matchGenericBeverage("ribeye steak")).toBeNull();
    expect(matchGenericBeverage("apple")).toBeNull();
    // "spanish cheese" specifically does NOT route to cortado.
    expect(matchGenericBeverage("spanish cheese")).toBeNull();
  });

  it("requires exact alias match, not substring (multi-word queries don't false-positive)", () => {
    // "macchiato latte" is not a real drink, and shouldn't match "latte"
    // alone (substring) or "macchiato" alone.
    expect(matchGenericBeverage("macchiato latte")).toBeNull();
    // But "latte" alone does match.
    expect(matchGenericBeverage("latte")?.id).toBe("latte");
    // And "macchiato" alone does match.
    expect(matchGenericBeverage("macchiato")?.id).toBe("macchiato");
  });
});

describe("GENERIC_BEVERAGES table integrity (coffee + tea + milk + juice + alcohol)", () => {
  it("contains the canonical 12 coffee drinks plus the 2026-04-27 expansion (tea / milk / juice / alcohol)", () => {
    // Bumped from 12 (coffee-only) to 30 when the F-73 pattern was
    // extended to other beverage categories on 2026-04-27. The list
    // is asserted explicitly so any accidental drop / rename is loud.
    expect(GENERIC_BEVERAGES.length).toBe(30);
    const ids = GENERIC_BEVERAGES.map((b) => b.id).sort();
    expect(ids).toEqual([
      // Coffee (12 — original F-73 set)
      "americano",
      "cappuccino",
      "cold-brew",
      "cortado",
      "drip-coffee",
      "espresso-double",
      "espresso-single",
      "flat-white",
      "latte",
      "macchiato",
      "mocha",
      "pour-over",
      // Tea (6)
      "black-tea",
      "chai-latte",
      "earl-grey",
      "green-tea",
      "herbal-tea",
      "matcha-latte",
      // Milk (6)
      "almond-milk",
      "oat-milk",
      "semi-skimmed-milk",
      "skim-milk",
      "soy-milk",
      "whole-milk",
      // Juice (2)
      "apple-juice",
      "orange-juice",
      // Alcohol (4)
      "ipa",
      "lager",
      "red-wine",
      "white-wine",
    ].sort());
  });

  it("every beverage has at least one alias and a positive serving size", () => {
    for (const b of GENERIC_BEVERAGES) {
      expect(b.aliases.length).toBeGreaterThan(0);
      expect(b.servingMl).toBeGreaterThan(0);
      expect(b.caffeineMgPer100ml).toBeGreaterThanOrEqual(0);
      expect(b.per100ml.calories).toBeGreaterThanOrEqual(0);
    }
  });

  it("every alias is unique across the table (no two drinks share an alias)", () => {
    const seen = new Map<string, string>(); // alias → id
    for (const b of GENERIC_BEVERAGES) {
      for (const a of b.aliases) {
        const norm = a.toLowerCase().trim();
        const prev = seen.get(norm);
        if (prev && prev !== b.id) {
          throw new Error(
            `Alias "${a}" (normalised "${norm}") is shared by ${prev} and ${b.id}`,
          );
        }
        seen.set(norm, b.id);
      }
    }
  });

  it("canonical names are distinct from each other", () => {
    const names = new Set(GENERIC_BEVERAGES.map((b) => b.name.toLowerCase()));
    expect(names.size).toBe(GENERIC_BEVERAGES.length);
  });

  it("alcohol-bearing entries set alcoholGPer100ml; non-alcoholic entries leave it undefined", () => {
    const alcoholic = GENERIC_BEVERAGES.filter((b) => b.alcoholGPer100ml != null);
    const alcoholicIds = alcoholic.map((b) => b.id).sort();
    expect(alcoholicIds).toEqual(["ipa", "lager", "red-wine", "white-wine"]);
    for (const b of alcoholic) {
      expect(b.alcoholGPer100ml).toBeGreaterThan(0);
    }
    for (const b of GENERIC_BEVERAGES) {
      if (!alcoholicIds.includes(b.id)) {
        expect(b.alcoholGPer100ml).toBeUndefined();
      }
    }
  });

  it("milk + tea + juice queries route to the right rows", () => {
    expect(GENERIC_BEVERAGES.find((b) => b.id === "whole-milk")?.aliases).toContain("milk");
    expect(GENERIC_BEVERAGES.find((b) => b.id === "black-tea")?.aliases).toContain("tea");
    expect(GENERIC_BEVERAGES.find((b) => b.id === "orange-juice")?.aliases).toContain("orange juice");
    expect(GENERIC_BEVERAGES.find((b) => b.id === "red-wine")?.aliases).toContain("red wine");
    expect(GENERIC_BEVERAGES.find((b) => b.id === "lager")?.aliases).toContain("beer");
  });
});
