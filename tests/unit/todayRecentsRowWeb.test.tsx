// @vitest-environment jsdom
/**
 * TodayRecentsRow (web) — parity twin of the mobile recents row (ENG-1247, v3
 * `.quickrow`). Replaces the dead method-launcher strip. Guards: chips render +
 * re-log on tap; "All" + the empty state open the LogSheet; the row caps at 6.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TodayRecentsRow } from "../../src/app/components/suppr/today-recents-row";
import type { FoodHistoryItem } from "../../src/lib/nutrition/foodHistory";

void React;

function item(recipeTitle: string, calories: number, source?: string): FoodHistoryItem {
  return { recipeTitle, calories, protein: 10, carbs: 20, fat: 5, count: 3, source };
}

const RECENTS: FoodHistoryItem[] = [
  item("Flat white", 120, "recent"),
  item("Chicken & rice bowl", 641),
  item("Greek yogurt, oats & berries", 501),
];

describe("TodayRecentsRow (web)", () => {
  it("renders the Quick add head, the All link, and a chip per recent", () => {
    render(<TodayRecentsRow recents={RECENTS} onReLog={() => {}} onOpenAll={() => {}} />);
    expect(screen.getByText("Quick add")).toBeTruthy();
    expect(screen.getByLabelText("All logging options")).toBeTruthy();
    expect(screen.getByText("Flat white")).toBeTruthy();
    expect(screen.getByText("641")).toBeTruthy();
    expect(screen.getByText("Chicken & rice …")).toBeTruthy(); // truncated 15 + …
  });

  it("re-logs the tapped recent", () => {
    const onReLog = vi.fn();
    render(<TodayRecentsRow recents={RECENTS} onReLog={onReLog} onOpenAll={() => {}} />);
    fireEvent.click(screen.getByTestId("today-recent-chip-1"));
    expect(onReLog).toHaveBeenCalledTimes(1);
    expect(onReLog.mock.calls[0][0].recipeTitle).toBe("Chicken & rice bowl");
  });

  it("the All link opens the LogSheet", () => {
    const onOpenAll = vi.fn();
    render(<TodayRecentsRow recents={RECENTS} onReLog={() => {}} onOpenAll={onOpenAll} />);
    fireEvent.click(screen.getByLabelText("All logging options"));
    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });

  it("caps at 6 chips", () => {
    const many = Array.from({ length: 10 }, (_, i) => item(`Food ${i}`, 100 + i));
    render(<TodayRecentsRow recents={many} onReLog={() => {}} onOpenAll={() => {}} />);
    expect(screen.queryByTestId("today-recent-chip-5")).toBeTruthy();
    expect(screen.queryByTestId("today-recent-chip-6")).toBeNull();
  });

  it("empty recents → a 'Log your first meal' prompt that opens the LogSheet", () => {
    const onOpenAll = vi.fn();
    render(<TodayRecentsRow recents={[]} onReLog={() => {}} onOpenAll={onOpenAll} />);
    expect(screen.queryByTestId("today-recent-chip-0")).toBeNull();
    fireEvent.click(screen.getByTestId("today-recents-empty"));
    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });
});
