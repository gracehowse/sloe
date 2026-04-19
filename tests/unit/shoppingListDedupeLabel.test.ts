/**
 * Shopping-list label dedupe — G-2 (TestFlight
 * `ALU8hrB1I9Sn4ysqoR_ocEs`, 2026-04-19).
 *
 * The tester's screenshot showed "60 g 60g protein powder" and
 * "220 g Oats, whole grain, rolled, old fashioned" — the grams
 * prefix was rendered twice because importers occasionally store
 * the full ingredient string in `recipe_ingredients.name` while
 * ALSO populating `amount` and `unit` on the same row. The render
 * site then did `${amount} ${unit} ${name}` and doubled the prefix.
 *
 * `dedupeShoppingLabel` strips the leading `<amount> <unit>` from
 * `name` when it's present. Pure so the behaviour is identical on
 * web (`src/app/components/ShoppingList.tsx`) and mobile
 * (`apps/mobile/app/shopping.tsx`).
 */
import { describe, expect, it } from "vitest";
import { dedupeShoppingLabel } from "../../src/lib/planning/shoppingListLifecycle";

describe("dedupeShoppingLabel (G-2)", () => {
  it("given `60 g protein powder` as the ingredient name, the line renders once", () => {
    // Regression guard for the exact evidence string.
    const d = dedupeShoppingLabel({
      amount: "60",
      unit: "g",
      name: "60 g protein powder",
    });
    expect(d).toEqual({ amount: "60", unit: "g", name: "protein powder" });
    // Shape the render sites use: `${a} ${u} ${n}`.
    expect(`${d.amount} ${d.unit} ${d.name}`.replace(/\s+/g, " ").trim()).toBe(
      "60 g protein powder",
    );
  });

  it("handles the `60g` variant (no space between amount and unit)", () => {
    // The screenshot also showed "60 g 60g protein powder" — the
    // second occurrence used the stuck form.
    const d = dedupeShoppingLabel({
      amount: "60",
      unit: "g",
      name: "60g protein powder",
    });
    expect(d.name).toBe("protein powder");
  });

  it("handles the `220 g Oats, whole grain, rolled, old fashioned` case", () => {
    // The trailing commas in the real ingredient name must NOT be
    // eaten by the dedupe — only the leading "<amount> <unit>"
    // prefix is stripped.
    const d = dedupeShoppingLabel({
      amount: "220",
      unit: "g",
      name: "220 g Oats, whole grain, rolled, old fashioned",
    });
    expect(d.name).toBe("Oats, whole grain, rolled, old fashioned");
  });

  it("leaves a correctly-formatted name alone (no duplicate prefix)", () => {
    // The normal shape: `name` is just the ingredient. We must not
    // mutate it.
    const d = dedupeShoppingLabel({
      amount: "2",
      unit: "breast",
      name: "chicken breast",
    });
    expect(d.name).toBe("chicken breast");
  });

  it("does not over-match: `60gram jar` must not be interpreted as the `g` unit", () => {
    // Defensive: the unit match must be followed by a word-break
    // (space / comma / end of string) so we don't eat the "g" at
    // the start of "gram".
    const d = dedupeShoppingLabel({
      amount: "1",
      unit: "g",
      name: "1 gram jar of honey",
    });
    // The leading "1 " gets stripped but "gram" survives — the
    // unit "g" is followed by "ram", which fails the word-break.
    // We leave the row untouched in that case rather than risk a
    // wrong strip.
    expect(d.name).toBe("1 gram jar of honey");
  });

  it("returns the name unchanged when amount is missing", () => {
    const d = dedupeShoppingLabel({
      amount: "",
      unit: "g",
      name: "60 g protein powder",
    });
    expect(d.name).toBe("60 g protein powder");
  });

  it("returns the name unchanged when the prefix doesn't match", () => {
    const d = dedupeShoppingLabel({
      amount: "100",
      unit: "g",
      name: "60 g protein powder",
    });
    // Prefix is "60 g…", declared amount is "100" — no dedupe.
    expect(d.name).toBe("60 g protein powder");
  });

  it("is case-insensitive on the unit", () => {
    const d = dedupeShoppingLabel({
      amount: "50",
      unit: "ml",
      name: "50 ML olive oil",
    });
    expect(d.name).toBe("olive oil");
  });

  it("treats null / undefined inputs safely", () => {
    expect(dedupeShoppingLabel({ amount: null, unit: null, name: null })).toEqual({
      amount: "",
      unit: "",
      name: "",
    });
    expect(
      dedupeShoppingLabel({ amount: undefined, unit: undefined, name: undefined }),
    ).toEqual({ amount: "", unit: "", name: "" });
  });

  it("does not strip when doing so would leave an empty name", () => {
    // Unlikely in practice but defensive: better to render a
    // duplicate prefix than a blank line.
    const d = dedupeShoppingLabel({
      amount: "60",
      unit: "g",
      name: "60 g",
    });
    expect(d.name).toBe("60 g");
  });

  it("handles no-unit rows (amount only)", () => {
    // Count-based items without an explicit unit, e.g. "2 eggs".
    const d = dedupeShoppingLabel({
      amount: "2",
      unit: "",
      name: "2 eggs",
    });
    expect(d.name).toBe("eggs");
  });
});
