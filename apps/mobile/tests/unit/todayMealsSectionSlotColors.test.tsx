// @vitest-environment jsdom
/**
 * `TodayMealsSection` slot-tint render test — ui-critic P2 #10
 * (2026-05-01).
 *
 * The source-grep parity test
 * (`slotColorTokensParity.test.ts`) pins what the file says. This
 * test pins what the user actually sees: the rendered icon-wrapper
 * `View` for the Snacks slot is tinted with the cyan slot token, NOT
 * the magenta `MacroColors.fat` value.
 *
 * The component renders the wrapper as
 *   `<View style={{ backgroundColor: col + "18", ... }}>`
 * where `col = SLOT_COLOR[slot]`. Sloe Phase 0 (dossier D-4): snack tint is
 * teal (`#4A7878`); Fat macro is amber (`#C9892C`). We assert the snack
 * wrapper's bg uses the teal prefix and is explicitly NOT the fat-macro hue —
 * that snack↔fat collision (the original 2026-05-01 bug) must never regress.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";
import { View } from "react-native";

import { TodayMealsSection } from "../../components/today/TodayMealsSection";
import { MacroColors, SlotColors } from "../../constants/theme";
import type { JournalMeal } from "../../lib/nutritionJournal";

// Per-slot icon TINTS, the micros-fibre chip, and the collapse/add affordances
// pinned here live in the LEGACY TD4 slot layout, which renders when
// `today_meals_figma_layout` is OFF. The Figma 654:2 layout (default-on) replaced
// them with neutral utensil tiles + a consolidated CTA. Force the legacy branch
// so these still-live (flag-gated fallback) invariants stay covered — same mock
// as `todayMealsSectionTd4.test.tsx`.
vi.mock("../../lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => flag !== "today_meals_figma_layout",
}));

void React;

const NOOP = () => undefined;

const BASE_PROPS = {
  slots: ["Breakfast", "Lunch", "Dinner", "Snacks"] as const,
  mealGroups: {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snacks: [],
  } as Record<string, never[]>,
  mealsTodayCount: 0,
  collapsedSlots: new Set<string>(),
  onToggleSlotCollapse: NOOP,
  onOpenFabForSlot: NOOP,
  onOpenSaveUsualMealForSlot: NOOP,
  onOpenDuplicateDay: NOOP,
  onPressMeal: NOOP,
  onLongPressEdit: NOOP,
  onRequestCopyMeal: NOOP,
  onDeleteMeal: NOOP,
  showMealTimestamps: false,
  formatMealMacroDetail: () => "",
  formatMealTimeDisplay: () => "",
  formatMealSourceLabelForRow: () => null,
  textColor: "#111118",
  textSecondaryColor: "#475569",
  textTertiaryColor: "#94a3b8",
  cardColor: "#ffffff",
  cardBorderColor: "#e4e4ec",
  savedMeals: [] as never[],
  onLogSavedMeal: NOOP,
  hintVisibleForSlot: () => false,
  onDismissUsualMealHint: NOOP,
  onAcceptUsualMealHint: NOOP,
  aiFirstLogTooltipMealId: null,
  onDismissAiFirstLogTooltip: NOOP,
} as const;

/**
 * Pull every distinct `<col>18` backgroundColor from rendered Views.
 *
 * The slot icon wrapper renders as
 *   `<View style={{ backgroundColor: col + "18", ... }}>`
 * (TodayMealsSection.tsx). A 9-char hex with trailing `18` is the
 * tint signature. Returns the lower-cased set so we can assert
 * exactly the four SlotColors values appear.
 */
function collectIconWrapperBackgrounds(
  rootNode: ReturnType<typeof render>,
): Set<string> {
  const out = new Set<string>();
  const all = rootNode.UNSAFE_getAllByType(View);
  for (const node of all) {
    const style = (node.props as { style?: unknown }).style;
    if (!style || typeof style !== "object") continue;
    const bg = (style as { backgroundColor?: string }).backgroundColor;
    if (typeof bg !== "string") continue;
    // 9-char hex with `18` alpha suffix is the wrapper tint signature.
    if (bg.length === 9 && bg.toLowerCase().endsWith("18")) {
      out.add(bg.toLowerCase());
    }
  }
  return out;
}

describe("TodayMealsSection — slot icon tint (ui-critic P2 #10)", () => {
  it("renders the four slot rows", () => {
    const tree = render(<TodayMealsSection {...BASE_PROPS} />);
    expect(tree.getByText("Breakfast")).toBeTruthy();
    expect(tree.getByText("Lunch")).toBeTruthy();
    expect(tree.getByText("Dinner")).toBeTruthy();
    expect(tree.getByText("Snacks")).toBeTruthy();
  });

  it("includes the teal Snacks tint (SlotColors.snack), distinct from MacroColors.fat", () => {
    const tree = render(<TodayMealsSection {...BASE_PROPS} />);
    const tints = collectIconWrapperBackgrounds(tree);
    // The teal snack tint MUST be present (Sloe D-4).
    expect(tints).toContain(`${SlotColors.snack.toLowerCase()}18`);
    // The original 2026-05-01 bug was Snacks borrowing MacroColors.fat — so
    // the invariant is that the snack tint is NOT the fat hue. In Sloe snack
    // is teal and fat is amber, so they're distinct by construction.
    expect(SlotColors.snack.toLowerCase()).not.toBe(MacroColors.fat.toLowerCase());
    // Legacy magenta fat hexes must never bleed back in via any code path.
    for (const t of tints) {
      expect(t).not.toContain("df5ebc"); // legacy 8-slot magenta (fat)
      expect(t).not.toContain("e04888"); // legacy TF49 magenta
    }
  });

  it("renders the canonical SlotColors tints for Breakfast / Lunch / Dinner / Snacks", () => {
    const tree = render(<TodayMealsSection {...BASE_PROPS} />);
    const tints = collectIconWrapperBackgrounds(tree);
    expect(tints).toContain(`${SlotColors.breakfast.toLowerCase()}18`);
    expect(tints).toContain(`${SlotColors.lunch.toLowerCase()}18`);
    expect(tints).toContain(`${SlotColors.dinner.toLowerCase()}18`);
    expect(tints).toContain(`${SlotColors.snack.toLowerCase()}18`);
  });
});

/**
 * 2026-05-25 regression — the slot-header fibre chip must include
 * fibre that lives in `nutrition_micros` (Health / dense logs), not
 * just the top-level `fiberG` column. Breakfast was showing no fibre
 * chip while the Fibre detail screen + day tile counted it, because
 * the slot summed raw `m.fiberG` instead of `mealContributedFiberG`.
 */
describe("TodayMealsSection — slot fibre chip counts micros-derived fibre", () => {
  const microsFibreMeal: JournalMeal = {
    id: "bk-1",
    name: "Breakfast",
    recipeTitle: "Cavendish · Hash Brown Patty",
    time: "",
    calories: 205,
    protein: 20,
    carbs: 30,
    fat: 11,
    fiberG: undefined, // no top-level fibre column …
    micros: { fiberG: 7 }, // … fibre lives only in micros
    source: undefined,
  } as unknown as JournalMeal;

  it("surfaces a micros-only fibre value (7g) in the Breakfast slot header", () => {
    const tree = render(
      <TodayMealsSection
        {...BASE_PROPS}
        mealGroups={
          {
            Breakfast: [microsFibreMeal],
            Lunch: [],
            Dinner: [],
            Snacks: [],
          } as unknown as Record<string, never[]>
        }
        mealsTodayCount={1}
      />,
    );
    // The fibre chip renders `${round1(fiber)}g`. Pre-fix this was absent
    // (slotFiber === 0 because the column was undefined and micros ignored).
    expect(tree.queryAllByText("7g").length).toBeGreaterThan(0);
  });
});

