// @vitest-environment jsdom
/**
 * TodayRecentsRow (ENG-1247) — the Today "Quick add" recents one-tap re-log row
 * (v3 prototype `.quickrow`). Replaces the dead method-launcher strip. Guards:
 * chips render the recent foods (name + kcal) and re-log on tap; the "All" link
 * + the empty state both open the full LogSheet; the row caps at 6 chips.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { TodayRecentsRow } from "../../components/today/TodayRecentsRow";
import type { FoodHistoryItem } from "@suppr/nutrition-core/foodHistory";

void React;

function item(recipeTitle: string, calories: number, source?: string): FoodHistoryItem {
  return { recipeTitle, calories, protein: 10, carbs: 20, fat: 5, count: 3, source };
}

const RECENTS: FoodHistoryItem[] = [
  item("Flat white", 120, "recent"),
  item("Chicken & rice bowl", 641),
  item("Greek yogurt, oats & berries", 501),
];

describe("TodayRecentsRow", () => {
  it("renders the Quick add head, the All link, and a chip per recent", () => {
    const { getByText, getByLabelText } = render(
      <TodayRecentsRow recents={RECENTS} onReLog={() => {}} onOpenAll={() => {}} />,
    );
    expect(getByText("Quick add")).toBeTruthy();
    expect(getByLabelText("All logging options")).toBeTruthy();
    expect(getByText("Flat white")).toBeTruthy();
    expect(getByText("641")).toBeTruthy(); // kcal
    // long names truncate to 15 chars + ellipsis
    expect(getByText("Chicken & rice …")).toBeTruthy();
  });

  it("re-logs the tapped recent", () => {
    const onReLog = vi.fn();
    const { getByTestId } = render(
      <TodayRecentsRow recents={RECENTS} onReLog={onReLog} onOpenAll={() => {}} />,
    );
    fireEvent.press(getByTestId("today-recent-chip-1"));
    expect(onReLog).toHaveBeenCalledTimes(1);
    expect(onReLog.mock.calls[0][0].recipeTitle).toBe("Chicken & rice bowl");
  });

  it("the All link opens the LogSheet", () => {
    const onOpenAll = vi.fn();
    const { getByLabelText } = render(
      <TodayRecentsRow recents={RECENTS} onReLog={() => {}} onOpenAll={onOpenAll} />,
    );
    fireEvent.press(getByLabelText("All logging options"));
    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });

  it("caps at 6 chips", () => {
    const many = Array.from({ length: 10 }, (_, i) => item(`Food ${i}`, 100 + i));
    const { queryByTestId } = render(
      <TodayRecentsRow recents={many} onReLog={() => {}} onOpenAll={() => {}} />,
    );
    expect(queryByTestId("today-recent-chip-5")).toBeTruthy();
    expect(queryByTestId("today-recent-chip-6")).toBeNull();
  });

  it("empty recents → a 'Log your first meal' prompt that opens the LogSheet", () => {
    const onOpenAll = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <TodayRecentsRow recents={[]} onReLog={() => {}} onOpenAll={onOpenAll} />,
    );
    expect(queryByTestId("today-recent-chip-0")).toBeNull();
    fireEvent.press(getByTestId("today-recents-empty"));
    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });
});
