/**
 * @vitest-environment node
 *
 * Eval-style test set for the structured recipe extraction contract
 * (`src/lib/recipe-import/structuredRecipeSchema.ts`) — the import-parser
 * "wedge". 8 fixture inputs cover the messy real-world shapes the importer
 * must survive: a clean caption, a hashtag/emoji-laden caption, a screenshot-
 * text dump with an unreadable line, a fragmented blog extract, a cookbook
 * page with furniture, a "no recipe" caption, a model that returned flat
 * strings instead of objects, and unparseable garbage.
 *
 * Each fixture asserts:
 *   - the prompt contract is correct for the source kind (schema + no-guessing
 *     rule present), and
 *   - the PARSER produces the expected structured output: schema validation,
 *     quantity/unit/name/prep split, and — critically — that low-confidence
 *     and unreadable lines are FLAGGED (never silently guessed or dropped).
 *
 * No live API is ever called. The "model reply" is a fixture string we feed
 * straight to `parseStructuredRecipe`, so this pins the contract + flagging
 * logic deterministically. (The route-level tests mock the provider; this
 * level tests the pure contract those routes share.)
 */
import { describe, it, expect } from "vitest";
import {
  LOW_CONFIDENCE_THRESHOLD,
  buildStructuredRecipePrompt,
  flaggedIngredientCount,
  ingredientToLine,
  parseStructuredRecipe,
  toIngredientLines,
  type RecipeSourceKind,
} from "@/lib/recipe-import/structuredRecipeSchema";

// ─────────────────────────────────────────────────────────────────────────
// Prompt contract — every source kind carries the schema + the no-guessing
// rule. This is what each route hands the model; pinning it stops a future
// edit from loosening the contract silently.
// ─────────────────────────────────────────────────────────────────────────
describe("buildStructuredRecipePrompt", () => {
  const kinds: RecipeSourceKind[] = ["image", "caption", "text", "cookbook_page"];

  it.each(kinds)("includes the strict schema + no-guessing rule for %s", (kind) => {
    const p = buildStructuredRecipePrompt(kind);
    // Schema fields the parser depends on.
    expect(p).toContain('"quantity"');
    expect(p).toContain('"unit"');
    expect(p).toContain('"name"');
    expect(p).toContain('"prep"');
    expect(p).toContain('"confidence"');
    expect(p).toContain('"steps"');
    // The no-guessing rule (repo non-negotiable) must be explicit.
    expect(p).toMatch(/DO NOT GUESS/i);
    // Never fabricate attribution.
    expect(p).toMatch(/do NOT invent/i);
  });

  it("tailors the noise hint per source kind", () => {
    expect(buildStructuredRecipePrompt("caption")).toMatch(/hashtag/i);
    expect(buildStructuredRecipePrompt("cookbook_page")).toMatch(/page number|running head|column/i);
    expect(buildStructuredRecipePrompt("image")).toMatch(/PHOTO|SCREENSHOT/i);
    expect(buildStructuredRecipePrompt("text")).toMatch(/FREEFORM|blog/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Fixture eval set — each entry is a (description, model reply, assertions).
// ─────────────────────────────────────────────────────────────────────────

describe("parseStructuredRecipe — fixture eval set", () => {
  it("fixture 1: clean caption — all fields parse, nothing flagged", () => {
    const reply = JSON.stringify({
      title: "Garlic butter chicken",
      servings: 4,
      ingredients: [
        { quantity: 200, unit: "g", name: "chicken breast", prep: "diced", confidence: 0.96 },
        { quantity: 2, unit: "tbsp", name: "butter", prep: null, confidence: 0.95 },
        { quantity: 3, unit: "clove", name: "garlic", prep: "minced", confidence: 0.92 },
      ],
      steps: ["Sear the chicken.", "Add butter and garlic.", "Cook until done."],
      prepTimeMin: 10,
      cookTimeMin: 20,
      sourceName: "@chefkate",
      notes: null,
    });
    const r = parseStructuredRecipe(reply);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recipe.title).toBe("Garlic butter chicken");
    expect(r.recipe.servings).toBe(4);
    expect(r.recipe.ingredients).toHaveLength(3);
    expect(flaggedIngredientCount(r.recipe)).toBe(0);
    expect(r.recipe.ingredients[0]).toMatchObject({
      quantity: 200,
      unit: "g",
      name: "chicken breast",
      prep: "diced",
      flagged: false,
    });
    expect(toIngredientLines(r.recipe)[0]).toBe("200 g chicken breast, diced");
    expect(r.recipe.steps).toHaveLength(3);
    expect(r.recipe.sourceName).toBe("@chefkate");
  });

  it("fixture 2: hashtag/emoji caption — promo noise excluded, bare count handled", () => {
    // The model already stripped hashtags/emoji per the prompt; we assert the
    // parser handles a bare count ("2 eggs" → quantity 2, unit "").
    const reply = JSON.stringify({
      title: "Protein pancakes 🥞 #gains",
      servings: 2,
      ingredients: [
        { quantity: 2, unit: "", name: "eggs", prep: null, confidence: 0.94 },
        { quantity: 1, unit: "scoop", name: "vanilla protein", prep: null, confidence: 0.88 },
        { quantity: 1, unit: "banana", name: "banana", prep: "mashed", confidence: 0.9 },
      ],
      steps: ["Blend.", "Cook on a griddle."],
      prepTimeMin: 5,
      cookTimeMin: 10,
      sourceName: null,
      notes: null,
    });
    const r = parseStructuredRecipe(reply);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(flaggedIngredientCount(r.recipe)).toBe(0);
    // Bare count: unit "" collapses, line reads "2 eggs".
    expect(ingredientToLine(r.recipe.ingredients[0])).toBe("2 eggs");
    // Title noise is sanitised downstream (sanitiseImportedTitle), not here —
    // the parser keeps the raw model title.
    expect(r.recipe.title).toContain("Protein pancakes");
  });

  it("fixture 3: screenshot dump — one unreadable line is FLAGGED, never guessed", () => {
    const reply = JSON.stringify({
      title: "Beef stew",
      servings: 6,
      ingredients: [
        { quantity: 500, unit: "g", name: "beef chuck", prep: "cubed", confidence: 0.93 },
        // The screenshot was blurry on this line — model set quantity null and
        // dropped confidence below the threshold rather than inventing a number.
        { quantity: null, unit: null, name: "red wine", prep: null, confidence: 0.35 },
        { quantity: 2, unit: "", name: "carrots", prep: "chopped", confidence: 0.9 },
      ],
      steps: ["Brown the beef.", "Simmer with wine."],
      prepTimeMin: null,
      cookTimeMin: 120,
      sourceName: null,
      notes: null,
    });
    const r = parseStructuredRecipe(reply);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(flaggedIngredientCount(r.recipe)).toBe(1);
    const wine = r.recipe.ingredients.find((i) => i.name === "red wine");
    expect(wine).toBeDefined();
    expect(wine!.flagged).toBe(true);
    expect(wine!.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    // The uncertain line is preserved, NOT dropped — the review UI surfaces it.
    expect(r.recipe.ingredients).toHaveLength(3);
    // No quantity was invented for the flagged line.
    expect(wine!.quantity).toBeNull();
  });

  it("fixture 4: fragmented blog extract — partial parse, low-confidence flags", () => {
    const reply = JSON.stringify({
      title: null,
      servings: null,
      ingredients: [
        { quantity: 1, unit: "cup", name: "flour", prep: null, confidence: 0.85 },
        // Ambiguous amount the model wasn't sure about.
        { quantity: 0.5, unit: "cup", name: "sugar or honey", prep: null, confidence: 0.5 },
      ],
      steps: [],
      prepTimeMin: null,
      cookTimeMin: null,
      sourceName: null,
      notes: "Extracted from a fragmented page.",
    });
    const r = parseStructuredRecipe(reply);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recipe.title).toBeNull();
    expect(flaggedIngredientCount(r.recipe)).toBe(1);
    expect(r.recipe.ingredients[1].flagged).toBe(true);
    expect(r.recipe.notes).toContain("fragmented");
  });

  it("fixture 5: cookbook page — quantity/unit/prep split preserved", () => {
    const reply = JSON.stringify({
      title: "Ratatouille",
      servings: 4,
      ingredients: [
        { quantity: 1, unit: "", name: "aubergine", prep: "sliced", confidence: 0.9 },
        { quantity: 400, unit: "g", name: "tomatoes", prep: "chopped", confidence: 0.91 },
        { quantity: 3, unit: "tbsp", name: "olive oil", prep: null, confidence: 0.9 },
      ],
      steps: ["Layer the vegetables.", "Bake."],
      prepTimeMin: 20,
      cookTimeMin: 45,
      sourceName: "The Vegetable Book",
      notes: null,
    });
    const r = parseStructuredRecipe(reply);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(flaggedIngredientCount(r.recipe)).toBe(0);
    expect(toIngredientLines(r.recipe)).toEqual([
      "1 aubergine, sliced",
      "400 g tomatoes, chopped",
      "3 tbsp olive oil",
    ]);
    expect(r.recipe.sourceName).toBe("The Vegetable Book");
  });

  it("fixture 6: caption with NO recipe — empty arrays, nothing invented", () => {
    const reply = JSON.stringify({
      title: null,
      servings: null,
      ingredients: [],
      steps: [],
      prepTimeMin: null,
      cookTimeMin: null,
      sourceName: null,
      notes: null,
    });
    const r = parseStructuredRecipe(reply);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recipe.ingredients).toHaveLength(0);
    expect(r.recipe.steps).toHaveLength(0);
    expect(toIngredientLines(r.recipe)).toEqual([]);
  });

  it("fixture 7: model returned flat strings — accepted but flagged for review", () => {
    // Defensive: a weaker model ignored the object schema and returned plain
    // strings. We accept them (don't drop the recipe) but flag every line so
    // the user confirms the parse rather than trusting it blindly.
    const reply = JSON.stringify({
      title: "Quick salad",
      servings: 2,
      ingredients: ["2 cups spinach", "1 tbsp olive oil", "  "],
      steps: ["Toss together."],
      prepTimeMin: 5,
      cookTimeMin: null,
      sourceName: null,
      notes: null,
    });
    const r = parseStructuredRecipe(reply);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Blank string dropped; two real lines kept and both flagged.
    expect(r.recipe.ingredients).toHaveLength(2);
    expect(flaggedIngredientCount(r.recipe)).toBe(2);
    expect(r.recipe.ingredients[0].name).toBe("2 cups spinach");
    expect(r.recipe.ingredients[0].flagged).toBe(true);
  });

  it("fixture 8: unparseable garbage — returns ok:false (no throw, no guess)", () => {
    expect(parseStructuredRecipe("not json at all { ]").ok).toBe(false);
    expect(parseStructuredRecipe("").ok).toBe(false);
    expect(parseStructuredRecipe("null").ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Parser hardening — clamping + degradation rules that protect the
// nutrition pipeline downstream.
// ─────────────────────────────────────────────────────────────────────────
describe("parseStructuredRecipe — hardening", () => {
  it("clamps out-of-range confidence and empty-name lines to flagged", () => {
    const reply = JSON.stringify({
      ingredients: [
        // Model over-reported confidence > 1 → clamped to 1, not flagged.
        { quantity: 100, unit: "g", name: "oats", prep: null, confidence: 1.7 },
        // Empty name → confidence forced to 0, flagged, regardless of report.
        { quantity: 1, unit: "cup", name: "", prep: null, confidence: 0.99 },
      ],
      steps: [],
    });
    const r = parseStructuredRecipe(reply);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Empty-name line is dropped (name.length === 0 filter); only oats remains.
    expect(r.recipe.ingredients).toHaveLength(1);
    expect(r.recipe.ingredients[0].confidence).toBe(1);
    expect(r.recipe.ingredients[0].flagged).toBe(false);
  });

  it("rejects negative / non-finite quantities (no invented amounts)", () => {
    const reply = JSON.stringify({
      ingredients: [
        { quantity: -5, unit: "g", name: "salt", prep: null, confidence: 0.9 },
        { quantity: "NaN", unit: "g", name: "pepper", prep: null, confidence: 0.9 },
      ],
      steps: [],
    });
    const r = parseStructuredRecipe(reply);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Both quantities become null — we never fabricate a positive number.
    expect(r.recipe.ingredients[0].quantity).toBeNull();
    expect(r.recipe.ingredients[1].quantity).toBeNull();
  });
});
