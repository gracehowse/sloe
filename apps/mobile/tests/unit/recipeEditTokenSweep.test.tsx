// @vitest-environment jsdom
/**
 * ENG-821 (Redesign — Design Direction 2026) — recipe edit sheet + ingredient
 * editor token sweep (mobile lane).
 *
 * The design-director review read the edit sheet + ingredient editor as
 * "imported from a different design system": a hardcoded `#00000066` backdrop,
 * a border-as-depth sheet panel, and an off-token dashed add-button outline
 * (`Accent.primary + "50"`). This sweep aligns them to the one design language,
 * behind `design_system_elevation` (old flat/hairline path kept in the `else`
 * via `useCardElevation`'s default branch):
 *   - the sheet panel takes the real `Elevation.sheet` shadow + drops the
 *     border-as-depth when the flag is on (tonal lift on dark);
 *   - the backdrop uses the `colors.overlay` scrim token, not a raw hex;
 *   - the add-ingredient affordance uses the shared chip language
 *     (`Accent.primarySoft` fill + `Accent.primary` edge);
 *   - the commit CTA stays blue (`Accent.primary` / `Accent.primaryForeground`).
 *
 * It also covers `IngredientInfoSheet` — the branded read-only sheet that
 * replaces the off-brand raw iOS `Alert.alert` ingredient-info popup on recipe
 * detail (ready-to-wire; the detail screen itself is the ENG-818/819 lane).
 *
 * Mix of source-assertions (the established `recipeEditMobileParity` style, so
 * regressions in the token sweep surface) + a render test of the new sheet.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

void React;

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

// ── source-level token-sweep assertions ─────────────────────────────────────

describe("ENG-821 — recipe edit sheet token sweep (mobile)", () => {
  const sheet = () => read("../../components/recipe/RecipeEditSheet.tsx");
  const row = () => read("../../components/recipe/IngredientEditRow.tsx");

  it("RecipeEditSheet has no hardcoded hex colours", () => {
    // No `#rrggbb` / `#rrggbbaa` literals.
    expect(sheet()).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // No `Accent.<token> + "<alpha-hex>"` string-concat alpha hacks (the old
    // `Accent.primary + "50"` dashed-outline tint). Strip `//` comments first
    // so the explanatory comment referencing the old pattern doesn't trip it.
    const codeOnly = sheet()
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/Accent\.\w+\s*\+\s*"[0-9a-fA-F]{2}"/);
  });

  it("RecipeEditSheet backdrop uses the overlay scrim token, not a raw hex", () => {
    expect(sheet()).toMatch(/backgroundColor:\s*colors\.overlay/);
    expect(sheet()).not.toMatch(/#00000066/);
  });

  it("RecipeEditSheet panel takes the real sheet shadow under the elevation flag", () => {
    const src = sheet();
    expect(src).toMatch(/useCardElevation/);
    expect(src).toMatch(/Elevation\.sheet/);
    // border-as-depth is flag-gated, not static.
    expect(src).toMatch(/card\.useBorder\s*\?\s*1\s*:\s*0/);
  });

  it("RecipeEditSheet add-ingredient affordance uses the shared chip language", () => {
    const src = sheet();
    expect(src).toMatch(/backgroundColor:\s*Accent\.primarySoft/);
    expect(src).toMatch(/borderColor:\s*Accent\.primary\b/);
    // the off-token dashed concat outline is gone.
    expect(src).not.toMatch(/borderStyle:\s*"dashed"/);
  });

  it("RecipeEditSheet commit CTA stays blue (Accent.primary)", () => {
    const src = sheet();
    expect(src).toMatch(/saveBtn:\s*\{\s*backgroundColor:\s*Accent\.primary\s*\}/);
    expect(src).toMatch(/color:\s*colors\.primaryForeground/);
  });

  it("IngredientEditRow stays fully tokenised (no hardcoded hex)", () => {
    const src = row();
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).toMatch(/colors\.border/);
    expect(src).toMatch(/Accent\.destructive/);
    expect(src).toMatch(/colors\.inputBg/);
  });
});

// ── render test: the branded IngredientInfoSheet ────────────────────────────

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#94a3b8",
    background: "#fbfaf6",
    border: "#e4e4ec",
    inputBg: "#f0ece4",
    overlay: "#00000088",
  }),
}));

import { IngredientInfoSheet, type IngredientInfo } from "../../components/recipe/IngredientInfoSheet";

const INFO: IngredientInfo = {
  name: "Chicken breast",
  tierLabel: "Verified",
  tierColor: "#56A775",
  confidencePct: null,
  sourceLabel: "USDA",
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 4,
  explanation: "This ingredient was matched to a verified food database entry.",
};

describe("ENG-821 — IngredientInfoSheet (branded info sheet replacing the Alert)", () => {
  it("renders the ingredient name, status, source, macros and explanation", () => {
    const { getByText, getByTestId } = render(
      <IngredientInfoSheet info={INFO} onClose={() => {}} />,
    );
    expect(getByTestId("ingredient-info-sheet")).toBeTruthy();
    expect(getByText("Chicken breast")).toBeTruthy();
    expect(getByText("Verified")).toBeTruthy();
    expect(getByText("Source: USDA")).toBeTruthy();
    expect(getByText("165")).toBeTruthy(); // kcal read-out
    expect(getByText(INFO.explanation)).toBeTruthy();
  });

  it("shows the confidence percent only when the row is unverified", () => {
    const { getByText } = render(
      <IngredientInfoSheet
        info={{ ...INFO, tierLabel: "Estimated", confidencePct: 62 }}
        onClose={() => {}}
      />,
    );
    expect(getByText("Estimated · 62%")).toBeTruthy();
  });

  it("renders nothing visible when info is null (closed)", () => {
    const { queryByTestId } = render(<IngredientInfoSheet info={null} onClose={() => {}} />);
    // Modal is not visible → its content is not mounted.
    expect(queryByTestId("ingredient-info-sheet")).toBeNull();
  });
});
