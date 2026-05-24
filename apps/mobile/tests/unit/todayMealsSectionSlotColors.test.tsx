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
 * where `col = SLOT_COLOR[slot]`. Post 2026-05-22 8-slot palette,
 * snack tint is Purple (`#9679D9`); Fat macro is Magenta (`#DF5EBC`).
 * We assert the snack wrapper's bg uses the Purple prefix and is
 * explicitly NOT the magenta hex prefix.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";
import { View } from "react-native";

import { TodayMealsSection } from "../../components/today/TodayMealsSection";
import { MacroColors, SlotColors } from "../../constants/theme";

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

  it("includes the Purple Snacks tint (SlotColors.snack), NOT the Magenta MacroColors.fat tint", () => {
    const tree = render(<TodayMealsSection {...BASE_PROPS} />);
    const tints = collectIconWrapperBackgrounds(tree);
    // The Purple snack tint MUST be present (8-slot palette).
    expect(tints).toContain(`${SlotColors.snack.toLowerCase()}18`);
    // The Magenta fat-macro tint MUST NOT be present anywhere in the
    // rendered Today meal section. This is the regression-pin: if
    // someone re-points Snacks back at `MacroColors.fat`, the magenta
    // bg appears here and the test fails.
    expect(tints).not.toContain(`${MacroColors.fat.toLowerCase()}18`);
    // Defence-in-depth — neither the new nor the legacy magenta hex
    // must bleed in via any other code path.
    for (const t of tints) {
      expect(t).not.toContain("df5ebc"); // new magenta (fat)
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

