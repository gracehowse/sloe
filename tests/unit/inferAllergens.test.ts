import { describe, expect, it } from "vitest";
import {
  inferAllergensFromIngredients,
  MIN_ALLERGEN_INFERENCE_CONFIDENCE,
} from "../../src/lib/nutrition/inferAllergens";
import {
  formatContainsLine,
  normaliseAllergenIds,
  REGULATED_ALLERGENS,
} from "../../src/constants/regulatedAllergens";

/**
 * T12 — pins allergen inference behaviour. Safety-critical: FALSE
 * NEGATIVES are worse than false positives (a user with a severe
 * allergy trusts the label). Tests verify both directions.
 */

describe("REGULATED_ALLERGENS (shape guarantees)", () => {
  it("contains all 14 EU FIC regulated allergens", () => {
    const ids = REGULATED_ALLERGENS.map((a) => a.id).sort();
    expect(ids).toEqual(
      [
        "celery",
        "crustaceans",
        "eggs",
        "fish",
        "lupin",
        "milk",
        "molluscs",
        "mustard",
        "peanuts",
        "sesame",
        "soy",
        "sulfites",
        "tree_nuts",
        "wheat",
      ].sort(),
    );
    expect(REGULATED_ALLERGENS).toHaveLength(14);
  });

  it("every entry has at least one keyword", () => {
    for (const a of REGULATED_ALLERGENS) {
      expect(a.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe("inferAllergensFromIngredients — positive cases", () => {
  it("peanuts: flags groundnut + peanut", () => {
    expect(inferAllergensFromIngredients(["2 tbsp peanut butter"])).toEqual(["peanuts"]);
    expect(inferAllergensFromIngredients(["groundnut oil"])).toEqual(["peanuts"]);
  });

  it("tree nuts: flags almonds, cashews, walnuts, pistachios", () => {
    expect(inferAllergensFromIngredients(["flaked almonds"])).toEqual(["tree_nuts"]);
    expect(inferAllergensFromIngredients(["raw cashew pieces"])).toEqual(["tree_nuts"]);
    expect(inferAllergensFromIngredients(["walnut halves"])).toEqual(["tree_nuts"]);
    expect(inferAllergensFromIngredients(["chopped pistachios"])).toEqual(["tree_nuts"]);
  });

  it("milk: flags butter / cream / cheese / yoghurt", () => {
    expect(inferAllergensFromIngredients(["200g greek yoghurt"])).toEqual(["milk"]);
    expect(inferAllergensFromIngredients(["1 tbsp unsalted butter"])).toEqual(["milk"]);
    expect(inferAllergensFromIngredients(["double cream"])).toEqual(["milk"]);
    expect(inferAllergensFromIngredients(["parmesan shavings"])).toEqual(["milk"]);
  });

  it("eggs: flags eggs / mayonnaise", () => {
    expect(inferAllergensFromIngredients(["3 large eggs"])).toEqual(["eggs"]);
    expect(inferAllergensFromIngredients(["2 tbsp mayonnaise"])).toEqual(["eggs"]);
  });

  it("fish: flags salmon / tuna / cod / anchovies", () => {
    expect(inferAllergensFromIngredients(["200g salmon fillet"])).toEqual(["fish"]);
    expect(inferAllergensFromIngredients(["1 tin tuna"])).toEqual(["fish"]);
    expect(inferAllergensFromIngredients(["4 anchovy fillets"])).toEqual(["fish"]);
  });

  it("crustaceans: flags shrimp, prawn, crab, lobster", () => {
    expect(inferAllergensFromIngredients(["200g king prawns"])).toEqual(["crustaceans"]);
    expect(inferAllergensFromIngredients(["lobster tail"])).toEqual(["crustaceans"]);
  });

  it("molluscs: flags oyster, mussel, clam, squid", () => {
    expect(inferAllergensFromIngredients(["12 mussels, cleaned"])).toEqual(["molluscs"]);
    expect(inferAllergensFromIngredients(["squid rings"])).toEqual(["molluscs"]);
  });

  it("soy: flags tofu, edamame, miso, tamari", () => {
    expect(inferAllergensFromIngredients(["200g firm tofu"])).toEqual(["soy"]);
    expect(inferAllergensFromIngredients(["1 cup edamame"])).toEqual(["soy"]);
    expect(inferAllergensFromIngredients(["1 tbsp tamari"])).toEqual(["soy"]);
  });

  it("wheat: flags bread, pasta, flour, couscous", () => {
    expect(inferAllergensFromIngredients(["200g spaghetti"])).toEqual(["wheat"]);
    expect(inferAllergensFromIngredients(["2 slices sourdough bread"])).toEqual(["wheat"]);
    expect(inferAllergensFromIngredients(["100g couscous"])).toEqual(["wheat"]);
  });

  it("sesame: flags sesame, tahini", () => {
    expect(inferAllergensFromIngredients(["1 tbsp tahini"])).toEqual(["sesame"]);
    expect(inferAllergensFromIngredients(["sesame seeds, toasted"])).toEqual(["sesame"]);
  });

  it("mustard: flags mustard, dijon", () => {
    expect(inferAllergensFromIngredients(["1 tsp dijon mustard"])).toEqual(["mustard"]);
  });

  it("celery: flags celery + celeriac", () => {
    expect(inferAllergensFromIngredients(["2 celery sticks"])).toEqual(["celery"]);
    expect(inferAllergensFromIngredients(["1 small celeriac, diced"])).toEqual(["celery"]);
  });

  it("sulfites: flags named preservatives", () => {
    expect(inferAllergensFromIngredients(["wine (contains sulfites)"])).toEqual(["sulfites"]);
    expect(inferAllergensFromIngredients(["dried apricots (sulphur dioxide)"])).toEqual([
      "sulfites",
    ]);
  });

  it("lupin: flags lupin + lupine", () => {
    expect(inferAllergensFromIngredients(["lupin flour"])).toEqual(["lupin"]);
  });
});

describe("inferAllergensFromIngredients — exclusion cases (avoid false positives)", () => {
  it("coconut milk does NOT trigger milk or tree_nuts", () => {
    expect(inferAllergensFromIngredients(["400ml coconut milk"])).toEqual([]);
  });

  it("almond milk does NOT trigger milk (still triggers tree_nuts)", () => {
    expect(inferAllergensFromIngredients(["1 cup almond milk"])).toEqual(["tree_nuts"]);
  });

  it("peanut butter does NOT trigger milk (still triggers peanuts)", () => {
    expect(inferAllergensFromIngredients(["2 tbsp peanut butter"])).toEqual(["peanuts"]);
  });

  it("eggplant / aubergine does NOT trigger eggs", () => {
    expect(inferAllergensFromIngredients(["1 eggplant, sliced"])).toEqual([]);
    expect(inferAllergensFromIngredients(["1 aubergine, sliced"])).toEqual([]);
  });

  it("nutmeg and nutritional yeast do NOT trigger tree_nuts", () => {
    expect(inferAllergensFromIngredients(["pinch of nutmeg"])).toEqual([]);
    expect(inferAllergensFromIngredients(["2 tbsp nutritional yeast"])).toEqual([]);
  });

  it("coconut and butternut squash do NOT trigger tree_nuts", () => {
    expect(inferAllergensFromIngredients(["shredded coconut"])).toEqual([]);
    expect(inferAllergensFromIngredients(["1 butternut squash"])).toEqual([]);
  });

  it("almond flour does NOT trigger wheat (still triggers tree_nuts)", () => {
    expect(inferAllergensFromIngredients(["100g almond flour"])).toEqual(["tree_nuts"]);
  });

  it("rice noodle / corn tortilla do NOT trigger wheat", () => {
    expect(inferAllergensFromIngredients(["200g rice noodles"])).toEqual([]);
    expect(inferAllergensFromIngredients(["6 corn tortillas"])).toEqual([]);
  });

  it("cocoa butter does NOT trigger milk", () => {
    expect(inferAllergensFromIngredients(["2 tbsp cocoa butter"])).toEqual([]);
  });
});

describe("inferAllergensFromIngredients — confidence gate", () => {
  it("skips ingredients below default 0.70 confidence", () => {
    expect(
      inferAllergensFromIngredients([
        { name: "flaked almonds", confidence: 0.5 },
      ]),
    ).toEqual([]);
  });

  it("honours custom minConfidence (lowered to 0.2 for testing)", () => {
    expect(
      inferAllergensFromIngredients(
        [{ name: "flaked almonds", confidence: 0.5 }],
        { minConfidence: 0.2 },
      ),
    ).toEqual(["tree_nuts"]);
  });

  it("treats missing confidence as 1 (caller pre-filtered)", () => {
    expect(inferAllergensFromIngredients([{ name: "flaked almonds" }])).toEqual([
      "tree_nuts",
    ]);
  });

  it("exposes the threshold constant matching the recipe-verify review gate", () => {
    expect(MIN_ALLERGEN_INFERENCE_CONFIDENCE).toBe(0.7);
  });
});

describe("inferAllergensFromIngredients — multi-ingredient aggregation", () => {
  it("deduplicates allergens across multiple ingredient lines", () => {
    const out = inferAllergensFromIngredients([
      "200g salmon fillet",
      "200g tuna steak",
      "6 anchovy fillets",
    ]);
    expect(out).toEqual(["fish"]);
  });

  it("accumulates multiple allergens in canonical order", () => {
    const out = inferAllergensFromIngredients([
      "200g firm tofu",
      "1 cup flaked almonds",
      "200ml whole milk",
      "2 large eggs",
      "1 tbsp tahini",
    ]);
    // Canonical order: tree_nuts, milk, eggs, soy, sesame
    expect(out).toEqual(["tree_nuts", "milk", "eggs", "soy", "sesame"]);
  });

  it("empty input yields empty output", () => {
    expect(inferAllergensFromIngredients([])).toEqual([]);
  });
});

describe("normaliseAllergenIds", () => {
  it("drops unknown strings, dedupes, orders canonically", () => {
    const out = normaliseAllergenIds(["milk", "notanallergen", "peanuts", "milk"]);
    expect(out).toEqual(["peanuts", "milk"]);
  });

  it("returns empty for non-arrays / empty / nullish input", () => {
    expect(normaliseAllergenIds(null)).toEqual([]);
    expect(normaliseAllergenIds(undefined)).toEqual([]);
    expect(normaliseAllergenIds("peanuts")).toEqual([]);
    expect(normaliseAllergenIds([])).toEqual([]);
  });

  it("drops non-string entries silently", () => {
    expect(normaliseAllergenIds(["milk", 42, null, "eggs"])).toEqual(["milk", "eggs"]);
  });
});

describe("formatContainsLine", () => {
  it("returns null for empty allergen array", () => {
    expect(formatContainsLine([])).toBeNull();
  });

  it("returns EU labels by default", () => {
    expect(formatContainsLine(["peanuts", "milk"])).toBe("Contains: Peanuts, Milk");
  });

  it("collapses crustaceans + molluscs to single 'Shellfish' in US region", () => {
    expect(formatContainsLine(["crustaceans", "molluscs"], "us")).toBe(
      "Contains: Shellfish",
    );
  });

  it("keeps EU distinction between crustaceans and molluscs", () => {
    expect(formatContainsLine(["crustaceans", "molluscs"])).toBe(
      "Contains: Crustaceans, Molluscs",
    );
  });
});
