import { describe, expect, it } from "vitest";
import {
  cookStepIngredientChips,
  ingredientsForStep,
  stepIngredientChipLabel,
  type StepMatchableIngredient,
} from "../../src/lib/recipe-ingredients/stepIngredients";

/** Convenience — assert the matched ingredient NAMES (in order). */
function matchedNames(
  step: string,
  ingredients: StepMatchableIngredient[],
): string[] {
  return ingredientsForStep(step, ingredients).map((m) => m.ingredient.name);
}

describe("ingredientsForStep — positive matches", () => {
  const ingredients: StepMatchableIngredient[] = [
    { name: "butter", amount: "2", unit: "tbsp" },
    { name: "garlic", amount: "2", unit: "cloves" },
    { name: "olive oil", amount: "1", unit: "tbsp" },
    { name: "chicken breast", amount: "2", unit: "" },
    { name: "salt", amount: null, unit: null },
  ];

  it("matches a single-word ingredient referenced in the step", () => {
    expect(matchedNames("Melt the butter in a pan over medium heat.", ingredients)).toEqual([
      "butter",
    ]);
  });

  it("is case-insensitive", () => {
    expect(matchedNames("MELT THE BUTTER, then add GARLIC.", ingredients)).toEqual([
      "butter",
      "garlic",
    ]);
  });

  it("matches a multi-word name only when every content word is present", () => {
    expect(matchedNames("Pour in the olive oil and swirl.", ingredients)).toEqual([
      "olive oil",
    ]);
  });

  it("returns matches in original ingredient order, not step order", () => {
    // Step mentions garlic before butter, but butter (index 0) sorts first.
    expect(matchedNames("Add the garlic, then stir in the butter.", ingredients)).toEqual([
      "butter",
      "garlic",
    ]);
  });

  it("matches multiple ingredients in one step", () => {
    expect(
      matchedNames("Season the chicken breast with salt and sear in olive oil.", ingredients),
    ).toEqual(["olive oil", "chicken breast", "salt"]);
  });
});

describe("ingredientsForStep — plural / singular folding", () => {
  it("matches plural step word against singular ingredient name", () => {
    expect(
      matchedNames("Dice the tomatoes and set aside.", [{ name: "tomato" }]),
    ).toEqual(["tomato"]);
  });

  it("matches singular step word against plural ingredient name", () => {
    expect(
      matchedNames("Add one tomato to the pan.", [{ name: "tomatoes" }]),
    ).toEqual(["tomatoes"]);
  });

  it("folds -ies plurals (berries → berry)", () => {
    expect(
      matchedNames("Fold the berries through the batter.", [{ name: "berry" }]),
    ).toEqual(["berry"]);
  });

  it("folds -ves plurals (leaves → leaf)", () => {
    expect(
      matchedNames("Tear the basil leaves over the top.", [{ name: "basil leaf" }]),
    ).toEqual(["basil leaf"]);
  });

  it("matches onions ↔ onion", () => {
    expect(matchedNames("Soften the onions.", [{ name: "onion" }])).toEqual(["onion"]);
  });
});

describe("ingredientsForStep — no false positives", () => {
  it("does NOT match 'butter' inside 'buttermilk'", () => {
    expect(matchedNames("Whisk the buttermilk into the flour.", [{ name: "butter" }])).toEqual([]);
  });

  it("does NOT match 'butter' inside 'butterfly the chicken'", () => {
    expect(matchedNames("Butterfly the chicken breast.", [{ name: "butter" }])).toEqual([]);
  });

  it("does NOT match a multi-word name when only one word is present", () => {
    // Step says "oil" but never "olive" → no match for "olive oil".
    expect(matchedNames("Heat the oil in a wok.", [{ name: "olive oil" }])).toEqual([]);
  });

  it("does NOT match an ingredient absent from the step", () => {
    expect(
      matchedNames("Preheat the oven to 200C.", [{ name: "butter" }, { name: "garlic" }]),
    ).toEqual([]);
  });

  it("guards -ss / -us words from over-singularising (hummus stays hummus)", () => {
    // "hummus" must not fold to "humm" and accidentally collide.
    expect(matchedNames("Spread the hummus on the bread.", [{ name: "hummus" }])).toEqual([
      "hummus",
    ]);
    expect(matchedNames("Pour the glass of wine.", [{ name: "glass" }])).toEqual(["glass"]);
  });
});

describe("ingredientsForStep — descriptor / stopword handling", () => {
  it("matches when the ingredient name carries prep descriptors the step omits", () => {
    expect(
      matchedNames("Stir the garlic into the oil.", [
        { name: "freshly chopped garlic" },
        { name: "olive oil" },
      ]),
    ).toEqual(["freshly chopped garlic"]); // "olive oil" needs both words
  });

  it("matches via the content word when the name carries trailing stopwords (\"salt to taste\")", () => {
    // "salt to taste" reduces to the content token ["salt"]; the step
    // actually says "salt", so it matches.
    expect(matchedNames("Add salt to the pan.", [{ name: "salt to taste" }])).toEqual([
      "salt to taste",
    ]);
    // …but a step that only says "to taste" (no content word) must NOT match.
    expect(matchedNames("Season everything to taste.", [{ name: "salt to taste" }])).toEqual([]);
  });

  it("never matches a degenerate name that is ONLY a descriptor", () => {
    // "fresh" alone reduces to [] → never matches.
    expect(matchedNames("Add a fresh handful.", [{ name: "fresh" }])).toEqual([]);
  });
});

describe("ingredientsForStep — empty / weird / malicious inputs", () => {
  const ingredients: StepMatchableIngredient[] = [{ name: "butter" }];

  it("returns [] for a step with no ingredient references", () => {
    expect(ingredientsForStep("Let the dough rest for 25 minutes.", ingredients)).toEqual([]);
  });

  it("returns [] for an empty step", () => {
    expect(ingredientsForStep("", ingredients)).toEqual([]);
  });

  it("returns [] for a whitespace-only step", () => {
    expect(ingredientsForStep("   \n  ", ingredients)).toEqual([]);
  });

  it("returns [] when there are no ingredients", () => {
    expect(ingredientsForStep("Melt the butter.", [])).toEqual([]);
  });

  it("tolerates non-string / null inputs without throwing", () => {
    // @ts-expect-error — deliberately wrong type
    expect(ingredientsForStep(null, ingredients)).toEqual([]);
    // @ts-expect-error — deliberately wrong type
    expect(ingredientsForStep("Melt the butter.", null)).toEqual([]);
  });

  it("skips ingredient rows with a missing / non-string name", () => {
    const weird = [
      { name: "butter" },
      // @ts-expect-error — deliberately malformed row
      { name: null },
      // @ts-expect-error — deliberately malformed row
      {},
    ] as StepMatchableIngredient[];
    expect(matchedNames("Melt the butter.", weird)).toEqual(["butter"]);
  });

  it("does not crash on punctuation-heavy / symbol step text", () => {
    expect(
      matchedNames("Add butter!!! ::: <<<garlic>>> @@@ 350°F", [
        { name: "butter" },
        { name: "garlic" },
      ]),
    ).toEqual(["butter", "garlic"]);
  });
});

describe("stepIngredientChipLabel", () => {
  it("composes amount + unit + name at 1x", () => {
    expect(stepIngredientChipLabel({ name: "butter", amount: 2, unit: "tbsp" })).toBe(
      "2 tbsp butter",
    );
  });

  it("renders just the name when there is no amount or unit", () => {
    expect(stepIngredientChipLabel({ name: "salt", amount: null, unit: null })).toBe("salt");
  });

  it("scales the amount when scaleFactor != 1", () => {
    expect(stepIngredientChipLabel({ name: "butter", amount: 2, unit: "tbsp" }, 2)).toBe(
      "4 tbsp butter",
    );
  });

  it("halves cleanly to a cookbook fraction at 0.5x", () => {
    expect(stepIngredientChipLabel({ name: "butter", amount: 1, unit: "tbsp" }, 0.5)).toBe(
      "1/2 tbsp butter",
    );
  });

  it("leaves the amount verbatim for an invalid scaleFactor", () => {
    expect(stepIngredientChipLabel({ name: "egg", amount: "1", unit: "" }, 0)).toBe("1 egg");
    expect(stepIngredientChipLabel({ name: "egg", amount: "1", unit: "" }, NaN)).toBe("1 egg");
  });

  it("dedupes amount-prefixed unit labels via formatIngredientAmountUnit", () => {
    expect(stepIngredientChipLabel({ name: "chicken", amount: 1, unit: "1 breast" })).toBe(
      "1 breast chicken",
    );
  });
});

describe("cookStepIngredientChips — flag gate", () => {
  const ingredients: StepMatchableIngredient[] = [
    { name: "butter", amount: 2, unit: "tbsp" },
    { name: "garlic", amount: 2, unit: "cloves" },
  ];
  const step = "Melt the butter and add the garlic.";

  it("returns [] when the flag is OFF (byte-identical to pre-feature)", () => {
    expect(cookStepIngredientChips(false, step, ingredients, 1)).toEqual([]);
  });

  it("returns matched, keyed, scale-aware chips when the flag is ON", () => {
    expect(cookStepIngredientChips(true, step, ingredients, 1)).toEqual([
      { key: 0, label: "2 tbsp butter" },
      { key: 1, label: "2 cloves garlic" },
    ]);
  });

  it("scales chip amounts when the flag is ON", () => {
    expect(cookStepIngredientChips(true, step, ingredients, 2)).toEqual([
      { key: 0, label: "4 tbsp butter" },
      { key: 1, label: "4 cloves garlic" },
    ]);
  });

  it("returns [] for a step with no ingredient match even when ON (no empty label)", () => {
    expect(
      cookStepIngredientChips(true, "Preheat the oven to 200C.", ingredients, 1),
    ).toEqual([]);
  });
});

describe("stepIngredientChipLabel — scale-before-format pluralisation (ENG-1533A)", () => {
  it("re-pluralises a stored-singular unit at down-scale: 2 clove @0.5x → 1 clove", () => {
    expect(
      stepIngredientChipLabel({ name: "garlic", amount: 2, unit: "clove" }, 0.5),
    ).toBe("1 clove garlic");
  });

  it("pluralises on up-scale: 1 clove @2x → 2 cloves", () => {
    expect(
      stepIngredientChipLabel({ name: "garlic", amount: 1, unit: "clove" }, 2),
    ).toBe("2 cloves garlic");
  });

  it("numeric-string amounts scale before formatting too", () => {
    expect(
      stepIngredientChipLabel({ name: "bacon", amount: "2", unit: "rasher" }, 0.5),
    ).toBe("1 rasher bacon");
  });

  it("non-numeric amounts keep the legacy text path (bare ranges pass through)", () => {
    // Range amounts can't be numerically scaled up front; they take the
    // legacy scaleAmountText path, which leaves a bare unitless range
    // untouched — pre-existing behaviour, unchanged by ENG-1533A.
    expect(
      stepIngredientChipLabel({ name: "eggs", amount: "1-2", unit: "" }, 2),
    ).toBe("1-2 eggs");
  });
});
