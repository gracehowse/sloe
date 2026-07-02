/**
 * Recipe-detail viewing-servings stepper — source-pin parity for both
 * platforms (PR1, Paprika parity, 2026-05-02 customer-lens audit).
 *
 * Both `apps/mobile/app/recipe/[id].tsx` (~2.7k LOC, wired to expo-
 * router + Supabase + AppData + a stack of sub-dialogs) and
 * `src/app/components/RecipeDetail.tsx` (~2.1k LOC, same shape on the
 * web side) are too heavily integrated to mount in isolation for an
 * RTL render — the existing repo idiom (see
 * `recipeDetailV3SourcePins.test.ts` and `recipeDetailLayoutWeb.test.tsx`)
 * is to source-pin the structural contract, then exercise the pure
 * helper module separately. We do both:
 *
 *   1. Source-string regex pins on each platform's stepper UI,
 *      ingredient-amount scaling, secondary kcal-total line, and a11y
 *      attrs, so a regression in any of those four shows up as a test
 *      failure on the canonical files.
 *   2. A real RTL render of a minimal harness component that uses the
 *      shared helper — confirms the +/- buttons drive the value, the
 *      bounds disable the buttons, and the displayed value matches
 *      the stepper state (the platform-agnostic part of the contract).
 *
 * If this file breaks, the recipe-detail stepper has regressed.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";

import {
  RECIPE_VIEW_SERVINGS_MAX,
  RECIPE_VIEW_SERVINGS_MIN,
  initialViewServings,
  stepViewServings,
  viewMultiplier,
} from "../../src/lib/nutrition/recipeViewScale.ts";

const REPO = resolve(__dirname, "..", "..");
const MOBILE_RECIPE = readFileSync(
  resolve(REPO, "apps/mobile/app/recipe/[id].tsx"),
  "utf8",
);
const WEB_RECIPE = readFileSync(
  resolve(REPO, "src/app/components/RecipeDetail.tsx"),
  "utf8",
);
const HELPER = readFileSync(
  resolve(REPO, "src/lib/nutrition/recipeViewScale.ts"),
  "utf8",
);
// ENG-920 / Figma 332:2: the stepper UI was extracted to a dedicated footer
// component and the ingredient scaling to the ingredient grid component.
// Source pins that previously targeted [id].tsx now target the correct files.
const SERVINGS_FOOTER = readFileSync(
  resolve(REPO, "apps/mobile/components/recipe/RecipeServingsFooter.tsx"),
  "utf8",
);
const INGREDIENT_GRID = readFileSync(
  resolve(REPO, "apps/mobile/components/recipe/RecipeIngredientGrid.tsx"),
  "utf8",
);

describe("mobile recipe-detail — viewing-servings stepper source pins", () => {
  it("imports the shared helpers from `recipeViewScale.ts`", () => {
    expect(MOBILE_RECIPE).toMatch(
      /import\s*\{[\s\S]*?initialViewServings[\s\S]*?stepViewServings[\s\S]*?viewMultiplier[\s\S]*?\}\s*from\s*["'][^"']*recipeViewScale["']/,
    );
  });

  it("renders the stepper with the canonical yield label and testIDs (ENG-920 extraction)", () => {
    // ENG-920 / Figma 332:2: the stepper was extracted to `RecipeServingsFooter`.
    // The outer footer carries `recipe-detail-sticky-footer`; the individual
    // controls carry `recipe-view-servings-minus` / `value` / `plus`.
    // The visible label above the stepper is "Yield" (Figma §8 copy), NOT the
    // earlier inline "Servings to view" — the component owns the copy.
    expect(SERVINGS_FOOTER).toMatch(/testID="recipe-view-servings-minus"/);
    expect(SERVINGS_FOOTER).toMatch(/testID="recipe-view-servings-value"/);
    expect(SERVINGS_FOOTER).toMatch(/testID="recipe-view-servings-plus"/);
    expect(SERVINGS_FOOTER).toMatch(/Yield/);
    // The screen wires `canDecrease` and `canIncrease` from `RECIPE_VIEW_SERVINGS_MIN/MAX`.
    expect(MOBILE_RECIPE).toMatch(/canDecrease=\{viewServings\s*>\s*RECIPE_VIEW_SERVINGS_MIN\}/);
    expect(MOBILE_RECIPE).toMatch(/canIncrease=\{viewServings\s*<\s*RECIPE_VIEW_SERVINGS_MAX\}/);
  });

  it("provides minus/plus pressables with disabled-at-bounds states (ENG-920 extraction)", () => {
    // ENG-920 / Figma 332:2: stepper controls live in RecipeServingsFooter.
    // The footer receives boolean `canDecrease`/`canIncrease` props derived
    // from the RECIPE_VIEW_SERVINGS_MIN/MAX bounds at the call site in [id].tsx.
    // hitSlop is not present — PressableScale provides adequate touch targets.
    expect(SERVINGS_FOOTER).toMatch(/testID="recipe-view-servings-minus"/);
    expect(SERVINGS_FOOTER).toMatch(/testID="recipe-view-servings-plus"/);
    expect(SERVINGS_FOOTER).toMatch(/disabled=\{!canDecrease\}/);
    expect(SERVINGS_FOOTER).toMatch(/disabled=\{!canIncrease\}/);
    // Bounds computation is at the call site in the screen:
    expect(MOBILE_RECIPE).toMatch(/canDecrease=\{viewServings\s*>\s*RECIPE_VIEW_SERVINGS_MIN\}/);
    expect(MOBILE_RECIPE).toMatch(/canIncrease=\{viewServings\s*<\s*RECIPE_VIEW_SERVINGS_MAX\}/);
  });

  it("provides a11y labels on minus/plus and an aria-live readout for the value (ENG-920 extraction)", () => {
    // ENG-920 / Figma 332:2: a11y attributes are on RecipeServingsFooter.
    // The canonical copy omits "to view" — it is "Decrease servings" /
    // "Increase servings" (simpler, matches the "Yield" label context).
    // accessibilityState is NOT used — disabled prop on PressableScale
    // covers the disabled semantic; `accessibilityLiveRegion="polite"` is
    // on the value display Text so screen-readers announce changes.
    expect(SERVINGS_FOOTER).toMatch(/accessibilityLabel="Decrease servings"/);
    expect(SERVINGS_FOOTER).toMatch(/accessibilityLabel="Increase servings"/);
    expect(SERVINGS_FOOTER).toMatch(/accessibilityLiveRegion="polite"/);
  });

  it("debounces stepper presses through the shared 200ms cadence", () => {
    expect(MOBILE_RECIPE).toMatch(
      /setTimeout\([\s\S]*?,\s*RECIPE_VIEW_STEPPER_DEBOUNCE_MS\s*\)/,
    );
    expect(MOBILE_RECIPE).toMatch(/stepperPendingTimer/);
    expect(MOBILE_RECIPE).toMatch(/stepperPendingDelta/);
  });

  it("scales ingredient amounts by `viewMultiplier`, NOT by the deep-link param (ENG-920 extraction)", () => {
    // ENG-920 / Figma 332:2: scaling moved to RecipeIngredientGrid, which
    // receives `viewMultiplier` as a prop and applies `ing.amount * viewMultiplier`
    // per row. The screen no longer inline-scales; it passes the computed
    // multiplier into the grid component.
    expect(INGREDIENT_GRID).toMatch(/ing\.amount\s*\*\s*viewMultiplier/);
    // The screen still derives `viewMultiplier` from the helper and passes it down.
    expect(MOBILE_RECIPE).toMatch(/viewMultiplier=\{viewMultiplier\}/);
    // The old `portionMultiplier` const is gone from the screen.
    expect(MOBILE_RECIPE).not.toMatch(/const portionMultiplier\s*=/);
  });

  it("removes the legacy 'Planned portion: Nx' banner (stepper is canonical)", () => {
    expect(MOBILE_RECIPE).not.toMatch(/Planned portion:/);
  });

  it("surfaces a secondary 'X kcal total for N portions' line when scaled away from base yield", () => {
    expect(MOBILE_RECIPE).toMatch(/testID="recipe-kcal-total-line"/);
    expect(MOBILE_RECIPE).toMatch(/kcal total for \{viewServings\} portions/);
    expect(MOBILE_RECIPE).toMatch(/hasScaledAway/);
  });

  it("seeds `viewServings` from the deep-link `?portion=N` param via `initialViewServings`", () => {
    expect(MOBILE_RECIPE).toMatch(
      /initialViewServings\(\s*\{\s*baseServings:\s*recipe\.servings/,
    );
    // Resets the seed when navigating A → B so the stepper doesn't
    // carry A's value into B.
    expect(MOBILE_RECIPE).toMatch(/lastSeededRecipeId/);
  });

  it("propagates the stepper multiplier into `logPortion` (so 'Add to today' records the chosen portion)", () => {
    expect(MOBILE_RECIPE).toMatch(/setLogPortion\(viewMultiplier\)/);
  });

  it("does NOT regress PR #72's cook-mode contract: portion threads from logPortion into /cook (ENG-945)", () => {
    expect(MOBILE_RECIPE).toMatch(/buildCookModeHref\(/);
    expect(MOBILE_RECIPE).toMatch(/logPortion/);
    expect(MOBILE_RECIPE).toMatch(/portion:\s*scaleSource\s*!==\s*1\s*\?\s*scaleSource\s*:\s*undefined/);
  });
});

describe("web recipe-detail — viewing-servings stepper source pins", () => {
  it("imports the shared helpers from `recipeViewScale.ts`", () => {
    expect(WEB_RECIPE).toMatch(
      /import\s*\{[\s\S]*?initialViewServings[\s\S]*?stepViewServings[\s\S]*?\}\s*from\s*["'][^"']*recipeViewScale\.ts["']/,
    );
  });

  it("renders the stepper with the canonical 'Servings to view' label and testID", () => {
    expect(WEB_RECIPE).toMatch(/data-testid="recipe-view-servings-stepper"/);
    expect(WEB_RECIPE).toMatch(/Servings to view/);
    // The old "Portions to view" label is gone — the cross-platform
    // copy is unified.
    expect(WEB_RECIPE).not.toMatch(/Portions to view/);
  });

  it("provides minus/plus buttons with disabled-at-bounds states", () => {
    expect(WEB_RECIPE).toMatch(/data-testid="recipe-view-servings-decrement"/);
    expect(WEB_RECIPE).toMatch(/data-testid="recipe-view-servings-increment"/);
    expect(WEB_RECIPE).toMatch(/disabled=\{servings\s*<=\s*RECIPE_VIEW_SERVINGS_MIN\}/);
    expect(WEB_RECIPE).toMatch(/disabled=\{servings\s*>=\s*RECIPE_VIEW_SERVINGS_MAX\}/);
    // disabled:opacity-40 + disabled:cursor-not-allowed style the
    // disabled state visibly so a click-locked stepper is obvious.
    expect(WEB_RECIPE).toMatch(/disabled:opacity-40/);
    expect(WEB_RECIPE).toMatch(/disabled:cursor-not-allowed/);
  });

  it("provides aria-labels on minus/plus and an aria-live readout for the value", () => {
    expect(WEB_RECIPE).toMatch(/aria-label="Decrease servings to view"/);
    expect(WEB_RECIPE).toMatch(/aria-label="Increase servings to view"/);
    expect(WEB_RECIPE).toMatch(/aria-live="polite"/);
    expect(WEB_RECIPE).toMatch(/role="status"/);
  });

  it("debounces stepper presses through the shared 200ms cadence", () => {
    expect(WEB_RECIPE).toMatch(
      /setTimeout\([\s\S]*?,\s*RECIPE_VIEW_STEPPER_DEBOUNCE_MS\s*\)/,
    );
    expect(WEB_RECIPE).toMatch(/stepperPendingTimer/);
    expect(WEB_RECIPE).toMatch(/stepperPendingDelta/);
  });

  it("seeds servings from `initialViewServings` (deep-link aware, bounded)", () => {
    expect(WEB_RECIPE).toMatch(
      /initialViewServings\(\s*\{\s*baseServings:\s*recipe\.servings/,
    );
    // The pre-PR1 inline `Math.round(recipe.servings * initialServings * 10) / 10`
    // form is gone — the helper handles bounds + non-finite + 0.
    expect(WEB_RECIPE).not.toMatch(
      /recipe\.servings\s*\*\s*initialServings\s*\*\s*10\s*\)\s*\/\s*10/,
    );
  });

  it("kcal hero binds to per-portion (invariant under the stepper)", () => {
    // The pre-PR1 binding was `Math.round(scaledMacros.calories)` —
    // which scales with `viewScale = servings/baseServings`, breaking
    // the "per-portion is per-portion" promise. PR1 binds the kcal
    // line to `perServingBase.calories` directly so the headline value
    // doesn't drift when the user dials the stepper.
    expect(WEB_RECIPE).toMatch(
      /const\s+kcalForLine\s*=\s*Math\.round\(\s*perServingBase\.calories\s*\)/,
    );
  });

  it("surfaces a secondary `X kcal total for N portions` line when scaled away", () => {
    expect(WEB_RECIPE).toMatch(/data-testid="recipe-kcal-total-line"/);
    expect(WEB_RECIPE).toMatch(/kcal total for \{servings\} portions/);
    expect(WEB_RECIPE).toMatch(/hasScaledAway/);
  });

  it("does NOT regress PR #72's CookMode handoff (servings + baseServings)", () => {
    // Pin: `<CookMode servings={servings} baseServings={baseServings} />`
    // — the 2026-05-01 fix that made cook-mode honour the user's
    // scaled view. We must NOT silently drop one of those props.
    // Match the JSX-opening form only (a leading `<CookMode\n` so we
    // don't catch `<CookMode>` in a comment elsewhere in the file).
    const callSite = WEB_RECIPE.match(/<CookMode\s+recipe=[\s\S]*?\/>/);
    expect(callSite).not.toBeNull();
    const block = callSite![0];
    expect(block).toMatch(/servings=\{servings\}/);
    expect(block).toMatch(/baseServings=\{baseServings\}/);
    expect(block).not.toMatch(/servings=\{baseServings\}/);
  });
});

describe("shared helper module — exposed surface", () => {
  it("exports the bounds + debounce constants both platforms reference", () => {
    expect(HELPER).toMatch(/export const RECIPE_VIEW_SERVINGS_MIN\s*=\s*1/);
    expect(HELPER).toMatch(/export const RECIPE_VIEW_SERVINGS_MAX\s*=\s*99/);
    expect(HELPER).toMatch(/export const RECIPE_VIEW_STEPPER_DEBOUNCE_MS\s*=\s*200/);
  });

  it("exports the four pure helpers both screens import", () => {
    expect(HELPER).toMatch(/export function clampViewServings/);
    expect(HELPER).toMatch(/export function stepViewServings/);
    expect(HELPER).toMatch(/export function viewMultiplier/);
    expect(HELPER).toMatch(/export function initialViewServings/);
  });
});

/**
 * Platform-agnostic harness — exercises the +/- → state → display
 * loop using the same helper both screens consume. Confirms that:
 *
 *   - The visible value tracks state.
 *   - +/- never escapes the [1, 99] bounds.
 *   - Disabled state on +/- matches the bounds.
 *   - Ingredient grams scale by `viewMultiplier(viewServings,
 *     baseServings)` (the contract every row consumes).
 *
 * This is intentionally NOT a render of `<RecipeDetail>` — that
 * component is integration-level and out of scope for a unit test.
 */
function StepperHarness({
  baseServings,
  initialPortion,
  ingredientAmount,
}: {
  baseServings: number;
  initialPortion?: number;
  ingredientAmount: number;
}) {
  const [view, setView] = useState<number>(() =>
    initialViewServings({ baseServings, portionParam: initialPortion ?? null }),
  );
  const mult = viewMultiplier(view, baseServings);
  const minDisabled = view <= RECIPE_VIEW_SERVINGS_MIN;
  const maxDisabled = view >= RECIPE_VIEW_SERVINGS_MAX;
  return (
    <div>
      <button
        type="button"
        data-testid="minus"
        disabled={minDisabled}
        onClick={() => setView((v) => stepViewServings(v, -1))}
      >
        −
      </button>
      <span data-testid="value">{view}</span>
      <button
        type="button"
        data-testid="plus"
        disabled={maxDisabled}
        onClick={() => setView((v) => stepViewServings(v, 1))}
      >
        +
      </button>
      <span data-testid="ingredient-grams">
        {Math.round(ingredientAmount * mult)}
      </span>
    </div>
  );
}

describe("stepper harness — platform-agnostic UI contract", () => {
  it("displays the seed value and base-yield ingredient amount on first render", () => {
    const { getByTestId } = render(
      <StepperHarness baseServings={4} ingredientAmount={400} />,
    );
    expect(getByTestId("value").textContent).toBe("4");
    expect(getByTestId("ingredient-grams").textContent).toBe("400");
  });

  it("scales chicken 400g → 600g after two `+` taps from 4-serving base (the spec example)", () => {
    const { getByTestId } = render(
      <StepperHarness baseServings={4} ingredientAmount={400} />,
    );
    fireEvent.click(getByTestId("plus"));
    fireEvent.click(getByTestId("plus"));
    expect(getByTestId("value").textContent).toBe("6");
    expect(getByTestId("ingredient-grams").textContent).toBe("600");
  });

  it("scales chicken 400g → 200g after two `−` taps from 4-serving base", () => {
    const { getByTestId } = render(
      <StepperHarness baseServings={4} ingredientAmount={400} />,
    );
    fireEvent.click(getByTestId("minus"));
    fireEvent.click(getByTestId("minus"));
    expect(getByTestId("value").textContent).toBe("2");
    expect(getByTestId("ingredient-grams").textContent).toBe("200");
  });

  it("disables the minus button at the lower bound (cannot go below 1)", () => {
    const { getByTestId } = render(
      <StepperHarness baseServings={4} ingredientAmount={400} />,
    );
    for (let i = 0; i < 5; i++) fireEvent.click(getByTestId("minus"));
    expect(getByTestId("value").textContent).toBe("1");
    expect((getByTestId("minus") as HTMLButtonElement).disabled).toBe(true);
    expect((getByTestId("plus") as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables the plus button at the upper bound (cannot exceed 99)", () => {
    const { getByTestId } = render(
      <StepperHarness baseServings={98} ingredientAmount={1} />,
    );
    fireEvent.click(getByTestId("plus")); // 98 → 99
    expect(getByTestId("value").textContent).toBe("99");
    expect((getByTestId("plus") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(getByTestId("plus")); // no-op
    expect(getByTestId("value").textContent).toBe("99");
  });

  it("seeds from a deep-link `?portion=1.5` on a 4-serving recipe → 6", () => {
    const { getByTestId } = render(
      <StepperHarness baseServings={4} initialPortion={1.5} ingredientAmount={400} />,
    );
    expect(getByTestId("value").textContent).toBe("6");
    expect(getByTestId("ingredient-grams").textContent).toBe("600");
  });
});
