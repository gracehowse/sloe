/**
 * scaleStepText tests — pin the regex transform that powers the cook-mode
 * step-scaling banner ("Scaled for N servings").
 *
 * The helper is shared between web (`src/app/components/CookMode.tsx`) and
 * mobile (`apps/mobile/app/recipe/[id].tsx` inline cook overlay), so this
 * file is the only place both platforms can drift from. If a future change
 * loosens the unit allowlist or breaks fraction parsing, these tests fail.
 */
import { describe, it, expect } from "vitest";
import { scaleStepText } from "@/lib/nutrition/scaleStepText";

describe("scaleStepText — basic multiplier", () => {
  it("returns input unchanged when factor is 1", () => {
    expect(scaleStepText("Add 4 tbsp olive oil", 1)).toBe(
      "Add 4 tbsp olive oil",
    );
  });

  it("returns input unchanged when factor is invalid", () => {
    expect(scaleStepText("Add 4 tbsp olive oil", 0)).toBe(
      "Add 4 tbsp olive oil",
    );
    expect(scaleStepText("Add 4 tbsp olive oil", -1)).toBe(
      "Add 4 tbsp olive oil",
    );
    expect(scaleStepText("Add 4 tbsp olive oil", NaN)).toBe(
      "Add 4 tbsp olive oil",
    );
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error — runtime defence
    expect(scaleStepText(null, 2)).toBe("");
    // @ts-expect-error — runtime defence
    expect(scaleStepText(undefined, 2)).toBe("");
    // @ts-expect-error — runtime defence
    expect(scaleStepText(123, 2)).toBe("");
  });

  it("doubles '4 tbsp olive oil' → '8 tbsp olive oil'", () => {
    expect(scaleStepText("Add 4 tbsp olive oil", 2)).toBe(
      "Add 8 tbsp olive oil",
    );
  });

  it("doubles '4 tablespoons olive oil' → '8 tablespoons olive oil'", () => {
    expect(scaleStepText("Add 4 tablespoons olive oil", 2)).toBe(
      "Add 8 tablespoons olive oil",
    );
  });

  it("halves '8 tbsp' → '4 tbsp' (factor 0.5)", () => {
    expect(scaleStepText("Add 8 tbsp olive oil", 0.5)).toBe(
      "Add 4 tbsp olive oil",
    );
  });
});

describe("scaleStepText — fractions and decimals", () => {
  it("scales '1/2 cup' by 4 → '2 cup'", () => {
    expect(scaleStepText("Add 1/2 cup flour", 4)).toBe(
      "Add 2 cup flour",
    );
  });

  it("scales '1/4 tsp' by 2 → '0.5 tsp'", () => {
    expect(scaleStepText("Stir in 1/4 tsp salt", 2)).toBe(
      "Stir in 0.5 tsp salt",
    );
  });

  it("scales mixed number '1 1/2 cups' by 2 → '3 cups'", () => {
    expect(scaleStepText("Add 1 1/2 cups milk", 2)).toBe(
      "Add 3 cups milk",
    );
  });

  it("scales decimal '1.5 tbsp' by 2 → '3 tbsp'", () => {
    expect(scaleStepText("Drizzle 1.5 tbsp honey", 2)).toBe(
      "Drizzle 3 tbsp honey",
    );
  });

  it("strips trailing zeros after rounding ('0.50' → '0.5', '8.00' → '8')", () => {
    expect(scaleStepText("Add 0.25 tsp salt", 2)).toBe("Add 0.5 tsp salt");
    expect(scaleStepText("Add 4 tsp salt", 2)).toBe("Add 8 tsp salt");
  });
});

describe("scaleStepText — units allowlist", () => {
  it("scales weights (g, kg, oz, lb)", () => {
    expect(scaleStepText("Use 200 g flour", 2)).toBe("Use 400 g flour");
    expect(scaleStepText("Use 1 kg potatoes", 2)).toBe("Use 2 kg potatoes");
    expect(scaleStepText("Use 4 oz butter", 2)).toBe("Use 8 oz butter");
    expect(scaleStepText("Use 1 lb chicken", 2)).toBe("Use 2 lb chicken");
  });

  it("scales volumes (ml, cup, tbsp, tsp, litre)", () => {
    expect(scaleStepText("Pour 250 ml water", 2)).toBe("Pour 500 ml water");
    expect(scaleStepText("Pour 1 litre stock", 2)).toBe("Pour 2 litre stock");
    expect(scaleStepText("Pour 1 liter stock", 2)).toBe("Pour 2 liter stock");
    // Single-letter "l" alone is intentionally NOT in the allowlist —
    // too easy to false-positive on identifiers / labels. Recipes that
    // use plain "l" are vanishingly rare; the writer typically uses "L"
    // or "litre"/"liter"/"ltr" already.
    expect(scaleStepText("Pour 1 l stock", 2)).toBe("Pour 1 l stock");
  });

  it("scales count nouns (slices, pieces, cloves)", () => {
    expect(scaleStepText("Add 2 cloves garlic", 3)).toBe(
      "Add 6 cloves garlic",
    );
    expect(scaleStepText("Use 2 slices bread", 2)).toBe("Use 4 slices bread");
    // We preserve the original unit form — singular→plural pluralisation
    // is intentionally NOT attempted ("1 piece" + 4× → "4 piece"). A
    // wrong plural is the cosmetic cost of a correct quantity, and we
    // accept it.
    expect(scaleStepText("Add 1 piece ginger", 4)).toBe(
      "Add 4 piece ginger",
    );
  });
});

describe("scaleStepText — non-ingredient numbers stay untouched", () => {
  it("does not multiply 'bake for 30 minutes' (time, not amount)", () => {
    // The regex's unit allowlist excludes minutes/hours/seconds; the
    // 30 stays put — multiplying time would be a worse bug than not
    // scaling it.
    expect(scaleStepText("Bake for 30 minutes at 350°F", 2)).toBe(
      "Bake for 30 minutes at 350°F",
    );
  });

  it("does not multiply temperatures", () => {
    expect(scaleStepText("Preheat oven to 350 F", 2)).toBe(
      "Preheat oven to 350 F",
    );
    expect(scaleStepText("Set to 180 C", 2)).toBe("Set to 180 C");
  });

  it("does not multiply step numbers ('Step 4: ...')", () => {
    expect(scaleStepText("Step 4: brown the meat", 2)).toBe(
      "Step 4: brown the meat",
    );
  });

  it("non-numeric strings pass through unchanged", () => {
    expect(scaleStepText("Stir until combined", 2)).toBe(
      "Stir until combined",
    );
    expect(scaleStepText("Season to taste", 2)).toBe("Season to taste");
  });

  it("empty string passes through unchanged", () => {
    expect(scaleStepText("", 2)).toBe("");
  });
});

describe("scaleStepText — multiple matches in one step", () => {
  it("scales every (number unit) pair in a sentence", () => {
    expect(
      scaleStepText("Whisk 4 tbsp oil with 1/2 cup vinegar and 200 g sugar.", 2),
    ).toBe("Whisk 8 tbsp oil with 1 cup vinegar and 400 g sugar.");
  });

  it("preserves surrounding punctuation and word boundaries", () => {
    expect(scaleStepText("(2 tbsp) butter", 2)).toBe("(4 tbsp) butter");
    expect(scaleStepText("[100 g] flour", 2)).toBe("[200 g] flour");
  });
});

describe("scaleStepText — pinning the canonical spec examples", () => {
  // These pin the exact examples in the task spec — if the regex ever
  // regresses on these, the journey-architect P0 is back.
  it("'4 tbsp olive oil' + scaleFactor 2 → '8 tbsp olive oil'", () => {
    expect(scaleStepText("4 tbsp olive oil", 2)).toBe("8 tbsp olive oil");
  });

  it("'1/2 cup' + scaleFactor 4 → '2 cup'", () => {
    expect(scaleStepText("1/2 cup", 4)).toBe("2 cup");
  });

  it("non-numeric strings unchanged at any factor", () => {
    expect(scaleStepText("Stir until combined", 2)).toBe(
      "Stir until combined",
    );
    expect(scaleStepText("Stir until combined", 8)).toBe(
      "Stir until combined",
    );
  });
});
