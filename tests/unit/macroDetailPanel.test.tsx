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

  it("ENG-732 — falls back to micros.fiberG when there's no top-level fibre", () => {
    // Health / dense-log entries store fibre only in the micros map. Without
    // the fallback the breakdown under-reports vs the day total + mobile.
    const meal = {
      name: "Beans",
      recipeTitle: "Black beans",
      micros: { fiberG: 7 },
    } as unknown as MacroMeal;
    expect(getMacroValue(meal, "fiber")).toBe(7);
  });

  it("ENG-732 — prefers a positive top-level fibre over micros.fiberG", () => {
    const meal = {
      name: "x",
      recipeTitle: "y",
      fiberG: 4,
      micros: { fiberG: 7 },
    } as unknown as MacroMeal;
    expect(getMacroValue(meal, "fiber")).toBe(4);
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

  // ENG-1213 — web↔mobile water-breakdown parity. Water lives on
  // `nutrition_entries.water_ml` → `waterMl` on the in-memory LoggedMeal.
  it("extracts water from the waterMl key (mobile-style mapping)", () => {
    const meal = { name: "Water", recipeTitle: "Glass", waterMl: 250 } as unknown as MacroMeal;
    expect(getMacroValue(meal, "water")).toBe(250);
  });

  it("falls back to the snake water_ml key", () => {
    const meal = { name: "Water", recipeTitle: "Glass", water_ml: 330 } as unknown as MacroMeal;
    expect(getMacroValue(meal, "water")).toBe(330);
  });

  it("falls back to a bare water key", () => {
    const meal = { name: "Water", recipeTitle: "Glass", water: 500 } as unknown as MacroMeal;
    expect(getMacroValue(meal, "water")).toBe(500);
  });

  it("returns 0 when no water value is present", () => {
    const meal: MacroMeal = { name: "Snack", recipeTitle: "Apple" };
    expect(getMacroValue(meal, "water")).toBe(0);
  });

  it("clamps negative water to 0 and rejects non-finite water (defensive read)", () => {
    const neg = { name: "x", recipeTitle: "y", waterMl: -100 } as unknown as MacroMeal;
    expect(getMacroValue(neg, "water")).toBe(0);
    const bad = { name: "x", recipeTitle: "y", waterMl: "nope" } as unknown as MacroMeal;
    expect(getMacroValue(bad, "water")).toBe(0);
  });
});

describe("MacroDetailPanel — water breakdown (ENG-1213 web↔mobile parity)", () => {
  const waterMeals = [
    { name: "Breakfast", recipeTitle: "Coffee", waterMl: 200 },
    { name: "Lunch", recipeTitle: "Water bottle", waterMl: 500 },
    { name: "Dinner", recipeTitle: "Soup", waterMl: 300 },
  ] as unknown as MacroMeal[];

  beforeEach(() => {
    flagFn.mockReset();
    flagFn.mockReturnValue(false);
  });
  afterEach(() => cleanup());

  it("renders the By-meal list and NO By meal / By ingredient toggle for water", () => {
    render(
      <MacroDetailPanel macro="water" meals={waterMeals} open onClose={() => undefined} />,
    );
    // By-meal list is present...
    expect(screen.getByTestId("macro-detail-meal-list")).toBeInTheDocument();
    // ...the ingredient list is NOT...
    expect(screen.queryByTestId("macro-detail-ingredient-list")).toBeNull();
    // ...and the segmented toggle (tablist) is hidden — water has no
    // per-ingredient decomposition (mirrors mobile BREAKDOWN_MACROS exclusion).
    expect(screen.queryByRole("tablist", { name: "Breakdown mode" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "By ingredient" })).toBeNull();
  });

  it("totals water in ml via getMacroValue (sums every meal's waterMl)", () => {
    render(
      <MacroDetailPanel macro="water" meals={waterMeals} open onClose={() => undefined} />,
    );
    // 200 + 500 + 300 = 1000 ml — rendered with the ml unit in the Total row.
    expect(screen.getByText("1000ml")).toBeInTheDocument();
    // Header reflects the Water config label.
    expect(screen.getByText("Water Breakdown")).toBeInTheDocument();
  });

  it("still shows the By meal / By ingredient toggle for an ingredient-capable macro (protein)", () => {
    // Guard against the water carve-out accidentally hiding the toggle globally.
    render(
      <MacroDetailPanel macro="protein" meals={waterMeals} open onClose={() => undefined} />,
    );
    expect(screen.getByRole("tablist", { name: "Breakdown mode" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "By ingredient" })).toBeInTheDocument();
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
    // Card container (div) — not the legacy <p>; modern rounded-xl corner.
    // Flat-card surfaces (2026-06-12): the ambient lift is retired — this is a
    // flat slab now, separation from the cream ground is the fill alone.
    expect(empty.tagName.toLowerCase()).toBe("div");
    expect(empty.className).toContain("rounded-xl");
    expect(empty.className).not.toContain("shadow-[");
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
