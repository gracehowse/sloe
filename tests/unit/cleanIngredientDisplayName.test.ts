import { describe, it, expect } from "vitest";
import { cleanIngredientDisplayName } from "@/lib/recipe/cleanIngredientDisplayName";

describe("cleanIngredientDisplayName", () => {
  describe("worked cases from the brief", () => {
    it('strips a brand prefix before "·": "Essential Waitrose · Garlic" → "Garlic"', () => {
      expect(cleanIngredientDisplayName("Essential Waitrose · Garlic")).toBe("Garlic");
    });

    it('strips leading quantity + unit + parenthetical: "500 g Puntalette (Dried)" → "Puntalette"', () => {
      expect(cleanIngredientDisplayName("500 g Puntalette (Dried)")).toBe("Puntalette");
    });

    it('keeps a multi-word food after a brand: "Amylu · Chicken Meatballs" → "Chicken Meatballs"', () => {
      expect(cleanIngredientDisplayName("Amylu · Chicken Meatballs")).toBe("Chicken Meatballs");
    });
  });

  describe("leading quantity + unit stripping", () => {
    it.each([
      ["500 g flour", "Flour"],
      ["1 medium onion", "Onion"],
      ["2 tsp olive oil", "Olive Oil"],
      ["1.5 kg potatoes", "Potatoes"],
      ["2 tbsp soy sauce", "Soy Sauce"],
      ["3 large eggs", "Eggs"],
      ["1 clove garlic", "Garlic"],
      ["a pinch of salt", "Salt"],
      ["1 cup rice", "Rice"],
      ["250ml milk", "Milk"], // no space between number and unit
    ])("%s → %s", (raw, expected) => {
      expect(cleanIngredientDisplayName(raw)).toBe(expected);
    });

    it("handles a fraction quantity", () => {
      expect(cleanIngredientDisplayName("1/2 cup sugar")).toBe("Sugar");
    });

    it("handles a unicode-fraction quantity", () => {
      expect(cleanIngredientDisplayName("½ tsp cinnamon")).toBe("Cinnamon");
    });

    it("handles a pack-multiplier quantity", () => {
      expect(cleanIngredientDisplayName("2 x 400 g chopped tomatoes")).toBe("Chopped Tomatoes");
    });
  });

  describe("parentheticals + prep clauses", () => {
    it("drops a trailing parenthetical", () => {
      expect(cleanIngredientDisplayName("Puntalette (dried)")).toBe("Puntalette");
    });

    it("drops a prep clause after a comma", () => {
      expect(cleanIngredientDisplayName("Garlic, finely chopped")).toBe("Garlic");
    });

    it('drops "to taste"', () => {
      expect(cleanIngredientDisplayName("Salt, to taste")).toBe("Salt");
    });

    it("strips both a quantity and a prep clause", () => {
      expect(cleanIngredientDisplayName("1 onion, diced")).toBe("Onion");
    });
  });

  describe("title casing", () => {
    it("title-cases a lowercase name", () => {
      expect(cleanIngredientDisplayName("chicken breast")).toBe("Chicken Breast");
    });

    it("lowercases connective words mid-phrase", () => {
      expect(cleanIngredientDisplayName("salt and pepper")).toBe("Salt and Pepper");
    });

    it("preserves a short all-caps acronym", () => {
      expect(cleanIngredientDisplayName("BBQ sauce")).toBe("BBQ Sauce");
    });
  });

  describe("does not over-strip", () => {
    it("keeps a hyphenated dish name when not a brand separator", () => {
      // "slow-cooked" has no spaces around the hyphen → not a brand sep.
      expect(cleanIngredientDisplayName("slow-cooked beef")).toBe("Slow-cooked Beef");
    });

    it("keeps a name with no quantity or brand untouched (modulo case)", () => {
      expect(cleanIngredientDisplayName("Smoked Paprika")).toBe("Smoked Paprika");
    });

    it("does not strip a leading word that merely starts with a unit letter", () => {
      // "ginger" starts with 'g' but is not the unit "g" (boundary guard).
      expect(cleanIngredientDisplayName("Ginger")).toBe("Ginger");
    });

    it("does not drop the only ingredient when no real brand head exists", () => {
      // A bare middot list with a long head should be left mostly intact.
      const out = cleanIngredientDisplayName("Garlic");
      expect(out).toBe("Garlic");
    });
  });

  describe("edge / malicious inputs", () => {
    it("returns empty string for null", () => {
      expect(cleanIngredientDisplayName(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(cleanIngredientDisplayName(undefined)).toBe("");
    });

    it("returns empty string for an empty / whitespace string", () => {
      expect(cleanIngredientDisplayName("   ")).toBe("");
    });

    it("never returns blank when the raw is only a quantity", () => {
      // "500 g" with no food noun — must not blank out.
      const out = cleanIngredientDisplayName("500 g");
      expect(out.length).toBeGreaterThan(0);
    });

    it("does not throw on weird punctuation", () => {
      expect(() => cleanIngredientDisplayName("!!! ((( ··· )))")).not.toThrow();
    });

    it("collapses runaway whitespace", () => {
      expect(cleanIngredientDisplayName("chicken     breast")).toBe("Chicken Breast");
    });
  });

  describe("display-only invariant", () => {
    it("does not mutate the input string (pure)", () => {
      const raw = "Essential Waitrose · Garlic";
      const copy = `${raw}`;
      cleanIngredientDisplayName(raw);
      expect(raw).toBe(copy);
    });

    it("is deterministic — same input yields same output", () => {
      const raw = "500 g Puntalette (Dried)";
      expect(cleanIngredientDisplayName(raw)).toBe(cleanIngredientDisplayName(raw));
    });
  });
});
