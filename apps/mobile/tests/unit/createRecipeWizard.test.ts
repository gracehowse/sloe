/**
 * Tests for the create-recipe wizard step machine.
 *
 * The component itself (`apps/mobile/components/recipe/CreateRecipeWizard.tsx`)
 * orchestrates the same Supabase + image-upload + analytics path as
 * `apps/mobile/app/create-recipe.tsx` (covered separately by
 * `createRecipeNormalisationParity.test.ts`). This file focuses on the
 * pure step-machine in `src/lib/recipes/createRecipeWizard.ts` —
 * step transitions, validations, totals math, and override handling
 * — because those are the rules that must not silently drift if the
 * UI is restyled.
 *
 * Counterpart UI test: a structural pin for the wizard component +
 * route at the bottom of the file. Same trick as
 * `createRecipeNormalisationParity.test.ts` — RNTL can't render the
 * Expo Router screen here, so we read the file as text and grep for
 * the load-bearing wiring (route export, FoodSearchModal mount, save
 * insert, normaliseInstructions call, etc.).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CREATE_RECIPE_STEP_IDS,
  CREATE_RECIPE_TOTAL_STEPS,
  SERVINGS_DEFAULT,
  SERVINGS_MAX,
  SERVINGS_MIN,
  TITLE_MAX_LENGTH,
  canAdvance,
  clampServings,
  computePerServing,
  computeRecipeTotals,
  hasMacroOverrides,
  initialWizardState,
  isIngredientsStepValid,
  isMacrosStepValid,
  isStepsStepValid,
  isTitleStepValid,
  nextStep,
  prevStep,
  stepCounterAnnouncement,
  stepIndex,
  type WizardIngredient,
  type WizardState,
} from "../../../../src/lib/recipes/createRecipeWizard";

function ing(partial: Partial<WizardIngredient> = {}): WizardIngredient {
  return {
    id: partial.id ?? "i1",
    name: partial.name ?? "Tomatoes",
    amount: partial.amount ?? "1",
    unit: partial.unit ?? "cup",
    calories: partial.calories ?? 30,
    protein: partial.protein ?? 1.5,
    carbs: partial.carbs ?? 7,
    fat: partial.fat ?? 0.3,
    fiberG: partial.fiberG ?? 2,
    source: partial.source ?? "USDA",
  };
}

describe("createRecipeWizard — step machine + structure", () => {
  it("exposes 5 ordered step ids matching the wizard brief", () => {
    expect(CREATE_RECIPE_STEP_IDS).toEqual([
      "title-photo",
      "ingredients",
      "steps",
      "macros",
      "save",
    ]);
    expect(CREATE_RECIPE_TOTAL_STEPS).toBe(5);
  });

  it("initialWizardState starts on the first step with empty fields", () => {
    const s = initialWizardState();
    expect(s.step).toBe("title-photo");
    expect(s.title).toBe("");
    expect(s.ingredients).toHaveLength(0);
    expect(s.steps).toHaveLength(0);
    expect(s.servings).toBe(SERVINGS_DEFAULT);
    expect(s.macroOverrides).toEqual({});
    expect(s.publish).toBe(false);
  });

  it("stepIndex returns the 0-based position; nextStep / prevStep walk it", () => {
    expect(stepIndex("title-photo")).toBe(0);
    expect(stepIndex("save")).toBe(4);
    expect(nextStep("title-photo")).toBe("ingredients");
    expect(nextStep("save")).toBeNull();
    expect(prevStep("title-photo")).toBeNull();
    expect(prevStep("ingredients")).toBe("title-photo");
  });

  it("stepCounterAnnouncement renders human-readable VoiceOver strings", () => {
    expect(stepCounterAnnouncement("title-photo")).toBe(
      "Step 1 of 5: Title and photo",
    );
    expect(stepCounterAnnouncement("ingredients")).toBe(
      "Step 2 of 5: Ingredients",
    );
    expect(stepCounterAnnouncement("save")).toBe("Step 5 of 5: Save");
  });
});

describe("createRecipeWizard — title-step validation", () => {
  it("rejects empty title", () => {
    expect(isTitleStepValid({ title: "" })).toBe(false);
    expect(isTitleStepValid({ title: "   " })).toBe(false);
  });

  it("accepts a normal title", () => {
    expect(isTitleStepValid({ title: "Tomato pasta" })).toBe(true);
  });

  it("rejects titles over the cap", () => {
    const long = "x".repeat(TITLE_MAX_LENGTH + 1);
    expect(isTitleStepValid({ title: long })).toBe(false);
  });

  it("canAdvance gates the title step on title presence", () => {
    const empty: WizardState = { ...initialWizardState() };
    expect(canAdvance(empty)).toBe(false);
    const filled: WizardState = { ...empty, title: "Soup", dirty: true };
    expect(canAdvance(filled)).toBe(true);
  });
});

describe("createRecipeWizard — ingredients-step validation", () => {
  it("rejects empty ingredient list", () => {
    expect(isIngredientsStepValid({ ingredients: [] })).toBe(false);
  });

  it("rejects rows with whitespace-only names (a tap-then-cancel artifact)", () => {
    expect(
      isIngredientsStepValid({ ingredients: [ing({ name: "   " })] }),
    ).toBe(false);
  });

  it("accepts a single named ingredient", () => {
    expect(isIngredientsStepValid({ ingredients: [ing()] })).toBe(true);
  });

  it("canAdvance on the ingredients step requires at least one ingredient", () => {
    const base: WizardState = {
      ...initialWizardState(),
      step: "ingredients",
      title: "Soup",
    };
    expect(canAdvance(base)).toBe(false);
    expect(canAdvance({ ...base, ingredients: [ing()] })).toBe(true);
  });
});

describe("createRecipeWizard — steps-step + macros-step validation", () => {
  it("steps step is always valid (combine-and-serve recipes are real)", () => {
    expect(isStepsStepValid({ steps: [] })).toBe(true);
    expect(
      isStepsStepValid({ steps: [{ id: "s1", text: "Combine and serve" }] }),
    ).toBe(true);
  });

  it("macros step is always valid (overrides are optional)", () => {
    expect(isMacrosStepValid(initialWizardState())).toBe(true);
  });

  it("save step does not advance — it has its own primary actions", () => {
    const s: WizardState = {
      ...initialWizardState(),
      step: "save",
      title: "Soup",
      ingredients: [ing()],
    };
    expect(canAdvance(s)).toBe(false);
  });
});

describe("createRecipeWizard — servings clamp (CR-05)", () => {
  it("clamps below the minimum to 1", () => {
    expect(clampServings(0)).toBe(SERVINGS_MIN);
    expect(clampServings(-5)).toBe(SERVINGS_MIN);
  });

  it("clamps above the maximum to 50", () => {
    expect(clampServings(SERVINGS_MAX + 1)).toBe(SERVINGS_MAX);
    expect(clampServings(9999)).toBe(SERVINGS_MAX);
  });

  it("rounds non-integers", () => {
    expect(clampServings(3.4)).toBe(3);
    expect(clampServings(3.6)).toBe(4);
  });

  it("falls back to the default on NaN / Infinity (typed garbage)", () => {
    expect(clampServings(Number.NaN)).toBe(SERVINGS_DEFAULT);
    expect(clampServings(Number.POSITIVE_INFINITY)).toBe(SERVINGS_DEFAULT);
  });
});

describe("createRecipeWizard — totals + per-serving math", () => {
  it("sums ingredient macros faithfully", () => {
    const totals = computeRecipeTotals([
      ing({ id: "a", calories: 100, protein: 10, carbs: 5, fat: 2, fiberG: 3 }),
      ing({ id: "b", calories: 200, protein: 8, carbs: 30, fat: 4, fiberG: 1 }),
    ]);
    expect(totals).toEqual({
      calories: 300,
      protein: 18,
      carbs: 35,
      fat: 6,
      fiberG: 4,
    });
  });

  it("ignores NaN macros without crashing the totals", () => {
    const totals = computeRecipeTotals([
      ing({ id: "a", calories: 100 }),
      ing({ id: "b", calories: Number.NaN }),
    ]);
    expect(totals.calories).toBe(100);
  });

  it("computes per-serving = totals / servings, rounded for display", () => {
    const ps = computePerServing({
      ingredients: [
        ing({ id: "a", calories: 200, protein: 20, carbs: 10, fat: 4, fiberG: 4 }),
        ing({ id: "b", calories: 200, protein: 10, carbs: 10, fat: 2, fiberG: 0 }),
      ],
      servings: 4,
      macroOverrides: {},
    });
    expect(ps.calories).toBe(100);
    expect(ps.protein).toBeCloseTo(7.5, 1);
    expect(ps.fat).toBeCloseTo(1.5, 1);
  });

  it("clamps invalid servings before per-serving compute", () => {
    const ps = computePerServing({
      ingredients: [ing({ calories: 100 })],
      servings: 0,
      macroOverrides: {},
    });
    expect(ps.calories).toBe(100);
  });
});

describe("createRecipeWizard — macro overrides (CR-04)", () => {
  it("hasMacroOverrides reports true only when a finite number override is set", () => {
    expect(hasMacroOverrides({ macroOverrides: {} })).toBe(false);
    expect(hasMacroOverrides({ macroOverrides: { protein: 12 } })).toBe(true);
  });

  it("computePerServing uses the override when set, falls back to auto-compute otherwise", () => {
    const ps = computePerServing({
      ingredients: [ing({ calories: 200, protein: 20 })],
      servings: 2,
      macroOverrides: { protein: 5 },
    });
    expect(ps.calories).toBe(100);
    expect(ps.protein).toBe(5);
  });

  it("an override of exactly 0 still applies (a real value, not 'no override')", () => {
    const ps = computePerServing({
      ingredients: [ing({ calories: 100, protein: 20 })],
      servings: 2,
      macroOverrides: { protein: 0 },
    });
    expect(ps.protein).toBe(0);
  });
});

// ----- Structural pins (vitest can't render the wizard component) -----
describe("createRecipeWizard — structural pins for the wizard component", () => {
  const ROUTE_PATH = resolve(__dirname, "../../app/recipe/create.tsx");
  const COMPONENT_PATH = resolve(
    __dirname,
    "../../components/recipe/CreateRecipeWizard.tsx",
  );
  const ROUTE_SRC = readFileSync(ROUTE_PATH, "utf8");
  const COMPONENT_SRC = readFileSync(COMPONENT_PATH, "utf8");

  it("the route file at apps/mobile/app/recipe/create.tsx renders the wizard component", () => {
    expect(ROUTE_SRC).toMatch(/import\s+CreateRecipeWizard\s+from/);
    expect(ROUTE_SRC).toMatch(/<CreateRecipeWizard\s*\/>/);
  });

  it("the wizard reuses normaliseInstructions on the save path (mirrors create-recipe.tsx)", () => {
    expect(COMPONENT_SRC).toMatch(
      /import\s*\{\s*normaliseInstructions\s*\}\s*from/,
    );
    expect(COMPONENT_SRC).toMatch(/normaliseInstructions\(/);
  });

  it("the wizard normalizes the title before insert (CR title polish parity)", () => {
    expect(COMPONENT_SRC).toMatch(
      /import\s*\{\s*normalizeRecipeTitle\s*\}\s*from/,
    );
    expect(COMPONENT_SRC).toMatch(/normalizeRecipeTitle\(/);
  });

  it("the wizard requires a publish-attestation Alert before flipping `published: true` (CR-03)", () => {
    // Same Alert pattern the single-screen form ships — Cancel /
    // Publish, with the "I created this recipe" attestation copy.
    expect(COMPONENT_SRC).toMatch(/Publish to community\?/);
    expect(COMPONENT_SRC).toMatch(
      /I created this recipe and I have the right to share it publicly/,
    );
  });

  it("the wizard wires FoodSearchModal as the autocomplete (no parallel implementation)", () => {
    // Import may wrap across lines — `[\s\S]` matches newlines.
    expect(COMPONENT_SRC).toMatch(
      /import\s+FoodSearchModal,\s*\{[\s\S]*?type\s+SelectedFood[\s\S]*?\}\s*from\s*"@\/components\/FoodSearchModal"/,
    );
    expect(COMPONENT_SRC).toMatch(/<FoodSearchModal/);
  });

  it("the wizard inserts into recipes + recipe_ingredients + saves (same shape as create-recipe.tsx)", () => {
    expect(COMPONENT_SRC).toMatch(/from\("recipes"\)\s*\.insert/);
    expect(COMPONENT_SRC).toMatch(
      /from\("recipe_ingredients"\)\s*\.insert/,
    );
    expect(COMPONENT_SRC).toMatch(/from\("saves"\)\s*\.insert/);
  });

  it("the wizard navigates to the recipe detail after save", () => {
    expect(COMPONENT_SRC).toMatch(
      /router\.replace\(`\/recipe\/\$\{recipeId\}`\)/,
    );
  });

  it("the wizard fires the canonical analytics events", () => {
    expect(COMPONENT_SRC).toMatch(
      /AnalyticsEvents\.recipe_create_wizard_step/,
    );
    expect(COMPONENT_SRC).toMatch(
      /AnalyticsEvents\.recipe_create_wizard_saved/,
    );
  });
});

describe("createRecipeWizard — Library entry-point pin", () => {
  const LIBRARY_PATH = resolve(__dirname, "../../app/(tabs)/library.tsx");
  const LIBRARY_SRC = readFileSync(LIBRARY_PATH, "utf8");

  it("Library exposes a + Create button that routes to /recipe/create", () => {
    // Header pill — primary affordance from the Library tab.
    expect(LIBRARY_SRC).toMatch(/router\.push\("\/recipe\/create"\)/);
    expect(LIBRARY_SRC).toMatch(/createBtn/);
  });

  it("the empty state surfaces 'Create a recipe' as the primary CTA", () => {
    expect(LIBRARY_SRC).toMatch(/Create a recipe/);
  });
});

describe("createRecipeWizard — _layout registration pin", () => {
  const LAYOUT_PATH = resolve(__dirname, "../../app/_layout.tsx");
  const LAYOUT_SRC = readFileSync(LAYOUT_PATH, "utf8");

  it("the wizard route is registered as STACK_HEADER_HIDDEN (own top bar)", () => {
    expect(LAYOUT_SRC).toMatch(/"recipe\/create"/);
  });

  it("the wizard has a readable stack title for default a11y label fallback", () => {
    expect(LAYOUT_SRC).toMatch(/"recipe\/create":\s*"New recipe"/);
  });
});
