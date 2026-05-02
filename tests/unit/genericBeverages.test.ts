/**
 * F-73 (2026-04-27) — pin the generic-beverages match shim that
 * preempts USDA Branded "Cortado" (Spanish cheese) for known coffee
 * drink queries.
 *
 * Build-40 (2026-05-01) — extended to cover the family-expansion
 * behaviour: a "cortado" / "latte" / "flat white" / "americano" query
 * should now surface the full size + dairy ladder, not a single row.
 */
import { describe, it, expect } from "vitest";
import {
  GENERIC_BEVERAGES,
  matchGenericBeverage,
  matchGenericBeverages,
} from "../../src/lib/nutrition/genericBeverages";

describe("matchGenericBeverage — F-73 cortado fix (single-row, back-compat)", () => {
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
  it("contains all canonical entries plus the Build-40 family expansion", () => {
    // Build-40 (2026-05-01) — expanded from 30 (single-row per drink)
    // to 60 (size + dairy variants per common drink). The list is
    // asserted explicitly so any accidental drop / rename is loud.
    const ids = GENERIC_BEVERAGES.map((b) => b.id).sort();
    expect(ids).toEqual([
      // Espresso family
      "espresso-double",
      "espresso-single",
      "espresso-triple",
      "ristretto",
      // Americano family
      "americano",
      "americano-large",
      "americano-small",
      "iced-americano",
      // Cortado family
      "cortado",
      "cortado-almond",
      "cortado-oat",
      "cortado-skim",
      "cortado-soy",
      // Flat white family
      "flat-white",
      "flat-white-almond",
      "flat-white-large",
      "flat-white-oat",
      "flat-white-small",
      "flat-white-soy",
      // Cappuccino family
      "cappuccino",
      "cappuccino-almond",
      "cappuccino-large",
      "cappuccino-oat",
      "cappuccino-soy",
      // Latte family
      "iced-latte",
      "latte",
      "latte-almond",
      "latte-large",
      "latte-medium",
      "latte-oat",
      "latte-skim",
      "latte-soy",
      // Macchiato family
      "caramel-macchiato",
      "macchiato",
      // Mocha family
      "iced-mocha",
      "mocha",
      "mocha-large",
      "mocha-oat",
      // Drip / pour-over / cold brew
      "cold-brew",
      "drip-coffee",
      "drip-coffee-large",
      "pour-over",
      // Tea (5 + 3 family expansions for black-tea + matcha-latte + chai-latte)
      "black-tea",
      "black-tea-mug",
      "black-tea-with-milk",
      "chai-latte",
      "chai-latte-oat",
      "dirty-chai",
      "earl-grey",
      "green-tea",
      "herbal-tea",
      "matcha-latte",
      "matcha-latte-almond",
      "matcha-latte-oat",
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

  it("Build-40 — at least 5 cortado-family rows exist", () => {
    const cortadoFamily = GENERIC_BEVERAGES.filter((b) => b.family === "cortado");
    expect(cortadoFamily.length).toBeGreaterThanOrEqual(5);
    // Specifically: a base + skim + oat + almond + soy.
    const ids = cortadoFamily.map((b) => b.id);
    expect(ids).toContain("cortado");
    expect(ids).toContain("cortado-oat");
    expect(ids).toContain("cortado-almond");
    expect(ids).toContain("cortado-soy");
  });

  it("Build-40 — at least 4 size variants for the latte family (counting whole + medium + large + iced)", () => {
    const latteFamily = GENERIC_BEVERAGES.filter((b) => b.family === "latte");
    // Sizes: latte (240ml), latte-medium (360ml), latte-large (475ml), iced-latte (350ml).
    const sizes = new Set(latteFamily.map((b) => b.servingMl));
    expect(sizes.size).toBeGreaterThanOrEqual(4);
    // Family also has dairy variants (oat / almond / soy / skim) — ladder is rich.
    expect(latteFamily.length).toBeGreaterThanOrEqual(7);
  });

  it("Build-40 — oat-milk dairy variants exist for at least 5 popular drinks", () => {
    const oatVariants = GENERIC_BEVERAGES.filter((b) => /-oat$/.test(b.id));
    expect(oatVariants.length).toBeGreaterThanOrEqual(5);
    const families = new Set(oatVariants.map((b) => b.family));
    // Cortado, flat white, latte, cappuccino, mocha, matcha latte, chai latte all have oat-milk variants.
    for (const f of ["cortado", "flat-white", "latte", "cappuccino", "mocha", "matcha-latte", "chai-latte"]) {
      expect(families).toContain(f);
    }
  });

  it("Build-40 — every family of size > 1 has a canonical row whose family slug matches an existing canonical id", () => {
    // Sanity: family slugs aren't typos; e.g. "flat-white" family
    // contains a row with id "flat-white".
    const familySlugs = new Set(
      GENERIC_BEVERAGES.map((b) => b.family).filter((f): f is string => Boolean(f)),
    );
    const ids = new Set(GENERIC_BEVERAGES.map((b) => b.id));
    for (const slug of familySlugs) {
      const familyRows = GENERIC_BEVERAGES.filter((b) => b.family === slug);
      expect(familyRows.length).toBeGreaterThan(0);
      // For the named families the canonical id should exist.
      if (["cortado", "latte", "flat-white", "americano", "cappuccino", "mocha", "macchiato", "drip-coffee", "black-tea", "matcha-latte", "chai-latte", "espresso"].includes(slug)) {
        if (slug === "espresso") {
          // Espresso family canonical id is `espresso-single`, not `espresso`.
          expect(ids.has("espresso-single")).toBe(true);
        } else {
          expect(ids.has(slug)).toBe(true);
        }
      }
    }
  });
});

describe("matchGenericBeverages — Build-40 multi-result expansion", () => {
  it("expands 'cortado' into the full cortado family (5+ rows)", () => {
    const rows = matchGenericBeverages("cortado");
    expect(rows.length).toBeGreaterThanOrEqual(5);
    // The matched (canonical) row leads.
    expect(rows[0].id).toBe("cortado");
    // Family siblings follow.
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("cortado-skim");
    expect(ids).toContain("cortado-oat");
    expect(ids).toContain("cortado-almond");
    expect(ids).toContain("cortado-soy");
  });

  it("expands 'latte' to the full latte family (3+ rows including a dairy-alt)", () => {
    const rows = matchGenericBeverages("latte");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].id).toBe("latte");
    const ids = rows.map((r) => r.id);
    // At least one dairy-alt variant.
    const dairyAlt = ids.some((id) => /-oat$|-almond$|-soy$/.test(id));
    expect(dairyAlt).toBe(true);
    // Multiple sizes.
    const sizes = new Set(rows.map((r) => r.servingMl));
    expect(sizes.size).toBeGreaterThanOrEqual(3);
  });

  it("expands 'flat white' to the full flat-white family (3+ rows)", () => {
    const rows = matchGenericBeverages("flat white");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].id).toBe("flat-white");
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("flat-white-oat");
  });

  it("expands 'americano' to the full americano family (3+ rows)", () => {
    const rows = matchGenericBeverages("americano");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].id).toBe("americano");
    const sizes = new Set(rows.map((r) => r.servingMl));
    expect(sizes.size).toBeGreaterThanOrEqual(3);
  });

  it("expands 'espresso' to the espresso family (single + double + triple)", () => {
    const rows = matchGenericBeverages("espresso");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].id).toBe("espresso-single");
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("espresso-double");
    expect(ids).toContain("espresso-triple");
  });

  it("matched-row-first ordering: 'oat latte' surfaces latte-oat at index 0, then the rest of the family", () => {
    const rows = matchGenericBeverages("oat latte");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].id).toBe("latte-oat");
    const restIds = rows.slice(1).map((r) => r.id);
    expect(restIds).toContain("latte");
  });

  it("returns a single-row family for family-less rows (herbal tea, milks, juice, alcohol)", () => {
    expect(matchGenericBeverages("herbal tea").map((r) => r.id)).toEqual(["herbal-tea"]);
    expect(matchGenericBeverages("oat milk").map((r) => r.id)).toEqual(["oat-milk"]);
    expect(matchGenericBeverages("orange juice").map((r) => r.id)).toEqual(["orange-juice"]);
    expect(matchGenericBeverages("red wine").map((r) => r.id)).toEqual(["red-wine"]);
  });

  it("returns an empty array when the query has no match", () => {
    expect(matchGenericBeverages("ribeye steak")).toEqual([]);
    expect(matchGenericBeverages("")).toEqual([]);
    expect(matchGenericBeverages("spanish cheese")).toEqual([]);
  });

  it("never returns the same id twice (de-duplicated within a family)", () => {
    for (const seed of ["cortado", "latte", "americano", "espresso", "flat white", "cappuccino", "mocha", "matcha"]) {
      const rows = matchGenericBeverages(seed);
      const ids = rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
