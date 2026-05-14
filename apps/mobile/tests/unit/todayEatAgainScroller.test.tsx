/**
 * TodayEatAgainScroller — mobile component pin.
 *
 * Authority: premium-bar audit DC3 polish (2026-05-14) — MacroFactor-
 * style stacked 2–3 Eat-Again candidates as horizontal scroller.
 *
 * Pins:
 *   - With 2 candidates, both `TodayEatAgainBanner` rows render.
 *   - With 3 candidates, all 3 banners render (the scroller doesn't
 *     silently drop a card).
 *   - With 0 candidates, the scroller renders nothing.
 *   - `onLog` fires with the tapped card's item (not always the first).
 *   - `onDismiss` propagates through to the banner row.
 */

import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodayEatAgainScroller } from "../../components/today/TodayEatAgainScroller";
import type { FoodHistoryItem } from "../../../../src/lib/nutrition/foodHistory";

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => undefined),
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
}));

function makeItem(title: string, calories: number): FoodHistoryItem {
  return {
    recipeTitle: title,
    calories,
    protein: 10,
    carbs: 20,
    fat: 5,
    count: 1,
  };
}

describe("TodayEatAgainScroller (mobile)", () => {
  it("renders nothing when given an empty candidate list", () => {
    const { queryByText } = render(
      <TodayEatAgainScroller
        candidates={[]}
        slot="Lunch"
        textColor="#000"
        textSecondaryColor="#666"
        secondaryColor="#666"
        onLog={() => {}}
        onDismiss={() => {}}
      />,
    );
    // "EAT AGAIN" is the eyebrow on every banner row — none should render.
    expect(queryByText("EAT AGAIN")).toBeNull();
  });

  it("renders all 2 candidates side by side", () => {
    const { getAllByText, getByText } = render(
      <TodayEatAgainScroller
        candidates={[makeItem("Salad", 400), makeItem("Pad Thai", 700)]}
        slot="Lunch"
        textColor="#000"
        textSecondaryColor="#666"
        secondaryColor="#666"
        onLog={() => {}}
        onDismiss={() => {}}
      />,
    );
    // Both titles are visible at first mount (they live in the
    // horizontal scroller's content row — neither is removed).
    expect(getByText("Salad")).toBeTruthy();
    expect(getByText("Pad Thai")).toBeTruthy();
    // EAT AGAIN eyebrow renders once per banner.
    expect(getAllByText("EAT AGAIN")).toHaveLength(2);
  });

  it("renders all 3 candidates when the host supplies the max set", () => {
    const { getAllByText } = render(
      <TodayEatAgainScroller
        candidates={[
          makeItem("Salad", 400),
          makeItem("Pad Thai", 700),
          makeItem("Chicken Bowl", 600),
        ]}
        slot="Lunch"
        textColor="#000"
        textSecondaryColor="#666"
        secondaryColor="#666"
        onLog={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(getAllByText("EAT AGAIN")).toHaveLength(3);
  });

  it("fires `onLog` with the tapped item, not always the first card", () => {
    const onLog = vi.fn();
    const items = [makeItem("Salad", 400), makeItem("Pad Thai", 700)];
    const { getAllByLabelText } = render(
      <TodayEatAgainScroller
        candidates={items}
        slot="Lunch"
        textColor="#000"
        textSecondaryColor="#666"
        secondaryColor="#666"
        onLog={onLog}
        onDismiss={() => {}}
      />,
    );
    // The banner exposes `Log {title} to {slot}` as the button label.
    const padThaiBtn = getAllByLabelText(/Log Pad Thai to Lunch/i)[0];
    fireEvent.press(padThaiBtn);
    expect(onLog).toHaveBeenCalledTimes(1);
    expect(onLog.mock.calls[0][0]).toMatchObject({ recipeTitle: "Pad Thai" });
  });

  it("dismissing any card routes to the shared `onDismiss` callback", () => {
    const onDismiss = vi.fn();
    const { getAllByLabelText } = render(
      <TodayEatAgainScroller
        candidates={[makeItem("Salad", 400), makeItem("Pad Thai", 700)]}
        slot="Lunch"
        textColor="#000"
        textSecondaryColor="#666"
        secondaryColor="#666"
        onLog={() => {}}
        onDismiss={onDismiss}
      />,
    );
    const dismissBtns = getAllByLabelText("Dismiss Eat again suggestion");
    expect(dismissBtns.length).toBeGreaterThan(0);
    fireEvent.press(dismissBtns[0]!);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
