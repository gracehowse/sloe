/**
 * RecipeVerifyModal (ENG-1333) — web recipe-detail ingredient-verification
 * modal. The dedicated "review & resolve" surface the import-review banner
 * opens on web, matching the v3 prototype `WebVerify`.
 *
 * These tests pin the user-visible contract so a regression fails CI:
 *  - flag-ON the modal renders one row per ingredient, each with a status dot,
 *    name, amount·status line, a "Fix" affordance on low-confidence rows and a
 *    "Matched" check on verified rows, plus the single "Calculate nutrition" CTA.
 *  - every row's status is derived from the SHARED
 *    `deriveIngredientVerificationTier` helper — the same computation the inline
 *    recipe-detail card grid uses (the SourceDot-drop regression class). Proven
 *    two ways: (a) render assertion — a verified row shows the check while a
 *    low-confidence row shows Fix, matching the helper's tiers; (b) a
 *    source-grep asserting BOTH the modal and RecipeDetail import + call the
 *    shared helper and never introduce a second/divergent status source.
 *  - the flag gate: the banner's onVerify opens the modal only when
 *    `recipe_detail_v3_conformance` is on; flag-OFF keeps the legacy
 *    `setActiveTab("ingredients")` tab-switch (source-grep on RecipeDetail).
 *
 * The mobile verify surface (`apps/mobile/app/recipe/verify.tsx`) is its own
 * dedicated screen and is not touched by this change.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { RecipeVerifyModal } from "../../src/app/components/suppr/recipe-verify-modal";
import { deriveIngredientVerificationTier } from "../../src/lib/recipe-ingredients/ingredientVerificationStatus";
import type { IngredientRow } from "../../src/types/recipe";

void React;

function makeRow(partial: Partial<IngredientRow>): IngredientRow {
  return {
    name: "Ingredient",
    amount: "1",
    unit: "g",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    isVerified: false,
    source: "AI",
    ...partial,
  };
}

// One row per verification tier the shared helper can produce.
const ROWS: IngredientRow[] = [
  // verified via is_verified flag
  makeRow({ name: "Chicken thighs", amount: "450", unit: "g", isVerified: true, source: "USDA", confidence: 1 }),
  // verified via trusted source (belt-and-braces, is_verified false)
  makeRow({ name: "Double cream", amount: "200", unit: "ml", isVerified: false, source: "FatSecret", confidence: null }),
  // partial (0.5 <= c < 0.75) → Fix
  makeRow({ name: "Sun-dried tomatoes", amount: "100", unit: "g", isVerified: false, source: "AI", confidence: 0.6 }),
  // estimated (0 < c < 0.5) → Fix
  makeRow({ name: "Parmesan", amount: "40", unit: "g", isVerified: false, source: "AI", confidence: 0.3 }),
  // unverified (confidence null, untrusted source) → Fix
  makeRow({ name: "sauce, to taste", amount: "", unit: "", isVerified: false, source: "AI", confidence: null }),
];

const IDS = ROWS.map((_, i) => `ing-${i}`);

function renderModal(overrides?: {
  onFixRow?: (i: number) => void;
  onCalculate?: () => void;
  onOpenChange?: (o: boolean) => void;
  ingredientIds?: string[];
}) {
  return render(
    <RecipeVerifyModal
      open
      onOpenChange={overrides?.onOpenChange ?? (() => {})}
      recipeName="Creamy Tuscan Chicken"
      ingredients={ROWS}
      ingredientIds={overrides?.ingredientIds ?? IDS}
      servings={4}
      baseServings={4}
      onFixRow={overrides?.onFixRow ?? (() => {})}
      onCalculate={overrides?.onCalculate ?? (() => {})}
    />,
  );
}

describe("RecipeVerifyModal (ENG-1333)", () => {
  it("renders the dialog title, subtitle, and one row per ingredient", () => {
    renderModal();
    expect(screen.getByText("Verify ingredients")).toBeInTheDocument();
    expect(
      screen.getByText(/Confirm each ingredient so Sloe can lock reliable macros for Creamy Tuscan Chicken\./i),
    ).toBeInTheDocument();
    const list = screen.getByTestId("recipe-verify-modal-list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(ROWS.length);
  });

  it("renders a status dot on every row", () => {
    renderModal();
    ROWS.forEach((_, i) => {
      expect(screen.getByTestId(`recipe-verify-row-dot-${i}`)).toBeInTheDocument();
    });
  });

  it("shows the Matched check on verified rows and a Fix button on low-confidence rows — matching the shared helper's tier", () => {
    renderModal();
    ROWS.forEach((row, i) => {
      const tier = deriveIngredientVerificationTier({
        isVerified: row.isVerified,
        confidence: row.confidence ?? null,
        source: row.source,
      });
      if (tier === "verified") {
        // Verified → check, no Fix.
        expect(screen.getByTestId(`recipe-verify-row-check-${i}`)).toBeInTheDocument();
        expect(screen.queryByTestId(`recipe-verify-row-fix-${i}`)).not.toBeInTheDocument();
      } else {
        // partial / estimated / unverified → Fix, no check.
        expect(screen.getByTestId(`recipe-verify-row-fix-${i}`)).toBeInTheDocument();
        expect(screen.queryByTestId(`recipe-verify-row-check-${i}`)).not.toBeInTheDocument();
      }
    });
    // Sanity: the fixture exercises BOTH branches of the helper.
    expect(screen.getAllByTestId(/recipe-verify-row-check-/)).not.toHaveLength(0);
    expect(screen.getAllByTestId(/recipe-verify-row-fix-/)).not.toHaveLength(0);
  });

  it("renders the amount·status line with the prototype status words", () => {
    renderModal();
    // Verified (row 0) → "Matched"; low-confidence untrusted (row 4) → "Needs input".
    expect(screen.getByText(/450 g · Matched/i)).toBeInTheDocument();
    expect(screen.getByText(/^Needs input$/i)).toBeInTheDocument();
  });

  it("fires onFixRow with the row index when a Fix button is tapped", async () => {
    const onFixRow = vi.fn();
    renderModal({ onFixRow });
    // Row 2 is the first low-confidence (partial) row.
    screen.getByTestId("recipe-verify-row-fix-2").click();
    expect(onFixRow).toHaveBeenCalledTimes(1);
    expect(onFixRow).toHaveBeenCalledWith(2);
  });

  it("disables Fix for rows without a persisted DB id (cannot verify an unsaved row)", () => {
    // Drop the id for row 2 (a low-confidence row that would otherwise show Fix).
    const ids = [...IDS];
    ids[2] = "";
    renderModal({ ingredientIds: ids });
    expect(screen.getByTestId("recipe-verify-row-fix-2")).toBeDisabled();
    // A persisted low-confidence row stays enabled.
    expect(screen.getByTestId("recipe-verify-row-fix-3")).not.toBeDisabled();
  });

  it("fires onCalculate when the single primary CTA is tapped", () => {
    const onCalculate = vi.fn();
    renderModal({ onCalculate });
    const cta = screen.getByTestId("recipe-verify-modal-calculate");
    expect(cta).toHaveTextContent("Calculate nutrition");
    cta.click();
    expect(onCalculate).toHaveBeenCalledTimes(1);
  });

  it("renders an empty-state row when there are no ingredients", () => {
    render(
      <RecipeVerifyModal
        open
        onOpenChange={() => {}}
        recipeName="Empty"
        ingredients={[]}
        ingredientIds={[]}
        servings={1}
        baseServings={1}
        onFixRow={() => {}}
        onCalculate={() => {}}
      />,
    );
    expect(screen.getByText(/No ingredients to verify yet\./i)).toBeInTheDocument();
    // The primary CTA is still present so the flow never dead-ends.
    expect(screen.getByTestId("recipe-verify-modal-calculate")).toBeInTheDocument();
  });

  it("does not mount dialog content while closed", () => {
    render(
      <RecipeVerifyModal
        open={false}
        onOpenChange={() => {}}
        recipeName="Closed"
        ingredients={ROWS}
        ingredientIds={IDS}
        servings={4}
        baseServings={4}
        onFixRow={() => {}}
        onCalculate={() => {}}
      />,
    );
    expect(screen.queryByText("Verify ingredients")).not.toBeInTheDocument();
  });
});

describe("RecipeVerifyModal — shared-status-source + flag-gate parity (source grep)", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
  const MODAL_SRC = read("src/app/components/suppr/recipe-verify-modal.tsx");
  const DETAIL_SRC = read("src/app/components/RecipeDetail.tsx");

  it("the modal derives row status ONLY from the shared deriveIngredientVerificationTier helper", () => {
    // Imports the shared helper…
    expect(MODAL_SRC).toMatch(
      /import\s*\{[^}]*deriveIngredientVerificationTier[^}]*\}\s*from\s*["'][^"']*ingredientVerificationStatus["']/,
    );
    // …and calls it.
    expect(MODAL_SRC).toContain("deriveIngredientVerificationTier({");
    // No second/divergent status computation: the modal must NOT re-derive a
    // tier from raw confidence thresholds itself.
    expect(MODAL_SRC).not.toMatch(/confidence\s*>=\s*0\.\d/);
  });

  it("the inline recipe-detail grid uses the SAME shared helper (no divergent per-row status)", () => {
    expect(DETAIL_SRC).toMatch(
      /import\s*\{[\s\S]*?deriveIngredientVerificationTier[\s\S]*?\}\s*from\s*["'][^"']*ingredientVerificationStatus/,
    );
    expect(DETAIL_SRC).toContain("deriveIngredientVerificationTier({");
  });

  it("the import banner's onVerify opens the modal only when the v3 flag is on, else keeps the tab-switch", () => {
    // recipeDetailV3 is the recipe_detail_v3_conformance flag read.
    expect(DETAIL_SRC).toContain('isFeatureEnabled("recipe_detail_v3_conformance")');
    // Flag-ON opens the modal; flag-OFF keeps setActiveTab("ingredients").
    expect(DETAIL_SRC).toMatch(
      /onVerify=\{\(\)\s*=>\s*\{\s*if\s*\(recipeDetailV3\)\s*setVerifyModalOpen\(true\);\s*else\s*setActiveTab\("ingredients"\);\s*\}\}/,
    );
    // The modal element is rendered, gated on the same flag.
    expect(DETAIL_SRC).toContain("<RecipeVerifyModal");
    expect(DETAIL_SRC).toMatch(/recipeDetailV3\s*\?\s*\(\s*<RecipeVerifyModal/);
  });
});
