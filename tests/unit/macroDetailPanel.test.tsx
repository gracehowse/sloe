import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";

// Flag module mocked so we can flip `design_system_elevation` for the
// gated empty-state structure (web mirror of the mobile macro/meal lane,
// ENG-825) and `design_system_colours` for the blue commit-CTA recolour
// (P5 parity gap #9).
vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

// `next/navigation` — the empty-state "Log a meal" CTA closes the dialog and
// routes to the canonical web Today surface (mobile routes to "/(tabs)").
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { isFeatureEnabled } from "../../src/lib/analytics/track";
import {
  MacroDetailPanel,
  getMacroValue,
  type MacroMeal,
} from "../../src/app/components/MacroDetailPanel";

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

const sampleMeals: MacroMeal[] = [
  { name: "Breakfast", recipeTitle: "Oatmeal", protein: 12, carbs: 40, fat: 5, calories: 300, fiberG: 4 },
  { name: "Lunch", recipeTitle: "Chicken Salad", protein: 35, carbs: 15, fat: 10, calories: 400, fiberG: 3 },
  { name: "Dinner", recipeTitle: "Salmon Bowl", protein: 30, carbs: 50, fat: 18, calories: 520, fiberG: 6 },
];

describe("MacroDetailPanel — getMacroValue", () => {
  it("extracts protein from a meal", () => {
    expect(getMacroValue(sampleMeals[0], "protein")).toBe(12);
  });

  it("extracts carbs from a meal", () => {
    expect(getMacroValue(sampleMeals[1], "carbs")).toBe(15);
  });

  it("extracts fat from a meal", () => {
    expect(getMacroValue(sampleMeals[2], "fat")).toBe(18);
  });

  it("extracts calories from a meal", () => {
    expect(getMacroValue(sampleMeals[0], "calories")).toBe(300);
  });

  it("extracts fiber from fiberG key", () => {
    expect(getMacroValue(sampleMeals[0], "fiber")).toBe(4);
  });

  it("falls back to fiber key when fiberG is missing", () => {
    const meal: MacroMeal = { name: "Snack", recipeTitle: "Apple", fiber: 3 };
    expect(getMacroValue(meal, "fiber")).toBe(3);
  });

  it("returns 0 when macro key is missing", () => {
    const meal: MacroMeal = { name: "Snack", recipeTitle: "Water" };
    expect(getMacroValue(meal, "protein")).toBe(0);
    expect(getMacroValue(meal, "fiber")).toBe(0);
    expect(getMacroValue(meal, "calories")).toBe(0);
  });

  it("coerces string values to numbers", () => {
    const meal: MacroMeal = { name: "Lunch", recipeTitle: "Soup", protein: "22" as unknown as number };
    expect(getMacroValue(meal, "protein")).toBe(22);
  });

  it("returns 0 for non-numeric string values", () => {
    const meal: MacroMeal = { name: "Lunch", recipeTitle: "Soup", protein: "abc" };
    expect(getMacroValue(meal, "protein")).toBe(0);
  });

  it("handles negative values (does not clamp)", () => {
    // The component displays raw values; clamping is a concern of the caller.
    const meal: MacroMeal = { name: "Correction", recipeTitle: "Adjustment", calories: -50 };
    expect(getMacroValue(meal, "calories")).toBe(-50);
  });
});

describe("MacroDetailPanel — empty state (ENG-825 design_system_elevation)", () => {
  beforeEach(() => {
    flagFn.mockReset();
    flagFn.mockReturnValue(false);
    mockPush.mockReset();
  });
  afterEach(() => cleanup());

  it("flag OFF → legacy one-line empty state", () => {
    flagFn.mockReturnValue(false);
    render(
      <MacroDetailPanel macro="protein" meals={[]} open onClose={() => undefined} />,
    );
    const empty = screen.getByTestId("macro-detail-empty");
    expect(empty.tagName.toLowerCase()).toBe("p");
    expect(empty).toHaveTextContent("No meals logged for this day.");
  });

  it("flag ON → structured, iconified empty card with the modern radius", () => {
    flagFn.mockImplementation((f: string) => f === "design_system_elevation");
    render(
      <MacroDetailPanel macro="protein" meals={[]} open onClose={() => undefined} />,
    );
    const empty = screen.getByTestId("macro-detail-empty");
    // Card container (div) — not the legacy <p>; carries the modern
    // rounded-xl corner + ambient shadow.
    expect(empty.tagName.toLowerCase()).toBe("div");
    expect(empty.className).toContain("rounded-xl");
    expect(empty).toHaveTextContent("No meals logged yet");
    expect(empty).toHaveTextContent("Log a meal to see your protein broken down here.");
  });

  it("renders the 'Log a meal' commit CTA in the elevated empty card", () => {
    // P5 parity gap #9: the web empty state was a dead end (text only). It now
    // mirrors the mobile macro-detail empty state's commit CTA.
    flagFn.mockImplementation((f: string) => f === "design_system_elevation");
    render(
      <MacroDetailPanel macro="protein" meals={[]} open onClose={() => undefined} />,
    );
    const cta = screen.getByRole("button", { name: "Log a meal on Today" });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent("Log a meal");
  });

  it("CTA closes the dialog then routes to the Today log surface", () => {
    flagFn.mockImplementation((f: string) => f === "design_system_elevation");
    const onClose = vi.fn();
    render(
      <MacroDetailPanel macro="protein" meals={[]} open onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Log a meal on Today" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/today");
  });

  it("design_system_colours ON → CTA fills the blue commit colour (no macro-hue style)", () => {
    flagFn.mockImplementation(
      (f: string) =>
        f === "design_system_elevation" || f === "design_system_colours",
    );
    render(
      <MacroDetailPanel macro="carbs" meals={[]} open onClose={() => undefined} />,
    );
    const cta = screen.getByRole("button", { name: "Log a meal on Today" });
    // Blue commit fill via the shared `bg-primary` token; the legacy macro-hue
    // inline background is NOT applied.
    expect(cta.className).toContain("bg-primary");
    expect(cta.getAttribute("style") ?? "").not.toContain("--macro-carbs");
  });

  it("design_system_colours OFF → CTA keeps the legacy saturated macro hue", () => {
    // Mirrors mobile's `ctaColorLegacy={config.color}` flag-OFF fill.
    flagFn.mockImplementation((f: string) => f === "design_system_elevation");
    render(
      <MacroDetailPanel macro="carbs" meals={[]} open onClose={() => undefined} />,
    );
    const cta = screen.getByRole("button", { name: "Log a meal on Today" });
    expect(cta.className).not.toContain("bg-primary");
    expect(cta.getAttribute("style") ?? "").toContain("var(--macro-carbs)");
  });
});
