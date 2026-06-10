// @vitest-environment jsdom
/**
 * Mobile `<SwapMealSheet>` render + interaction tests (ENG-1011,
 * 2026-06-10 fresh-eyes P0 class B).
 *
 * The sheet replaces the native `Alert.alert` recipe picker on the
 * planner's "Swap meal" row action. Coverage:
 *   1. Header carries slot · day · slot-share target context.
 *   2. Candidate rows render title + kcal + protein, fire `onPick`
 *      with the recipe id.
 *   3. ★ Library tag renders only for saved candidates (P1-22 intent).
 *   4. Δ-vs-target label: "on target" inside ±25 kcal, signed delta
 *      otherwise.
 *   5. Empty candidate list shows the save-more guidance, no rows.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { SwapMealSheet, type SwapCandidate } from "../../components/SwapMealSheet";

void React;

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
  }),
}));

const CANDIDATES: SwapCandidate[] = [
  { id: "r1", title: "Soothing Chicken Congee", calories: 380, proteinG: 24, image: null, isSaved: true },
  { id: "r2", title: "Tuna Nicoise Bowl", calories: 480, proteinG: 32, image: null, isSaved: false },
];

function renderSheet(over: Partial<React.ComponentProps<typeof SwapMealSheet>> = {}) {
  const onPick = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <SwapMealSheet
      visible
      onClose={onClose}
      slotName="Lunch"
      dayLabel="Wednesday"
      targetKcal={376}
      candidates={CANDIDATES}
      onPick={onPick}
      {...over}
    />,
  );
  return { ...utils, onPick, onClose };
}

describe("<SwapMealSheet /> (mobile) — ENG-1011", () => {
  it("renders the slot-share target context in the header", () => {
    const { getByText } = renderSheet();
    expect(getByText("Swap meal")).toBeTruthy();
    expect(getByText("Lunch · Wednesday · target ~376 kcal")).toBeTruthy();
  });

  it("renders candidate rows with kcal + protein and fires onPick with the id", () => {
    const { getByText, getByLabelText, onPick } = renderSheet();
    expect(getByText("380 kcal · 24g protein")).toBeTruthy();
    fireEvent.press(
      getByLabelText("Swap to Soothing Chicken Congee, 380 kcal, from your library"),
    );
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("r1");
  });

  it("tags only saved candidates with the Library chip", () => {
    const { getAllByText } = renderSheet();
    expect(getAllByText("Library")).toHaveLength(1);
  });

  it("labels candidates within ±25 kcal of target as on target, others with a signed delta", () => {
    const { getByText } = renderSheet();
    expect(getByText("on target")).toBeTruthy(); // 380 vs 376
    expect(getByText("+104")).toBeTruthy(); // 480 vs 376
  });

  it("shows the save-more guidance when there are no candidates", () => {
    const { getByText, queryByText } = renderSheet({ candidates: [] });
    expect(
      getByText("No alternatives for this slot yet — save more recipes from Discover."),
    ).toBeTruthy();
    expect(queryByText("Library")).toBeNull();
  });
});
