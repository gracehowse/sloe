// @vitest-environment jsdom
/**
 * PlanV3Surface (ENG-1225 Block 2) — the assembled v3 Plan top section. Pins
 * that the header + week strip + day-detail render from a real week plan, the
 * selected day defaults to today, and tapping a day re-targets the detail band.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#6A6072",
    textTertiary: "#9B93A3",
    navPrimary: "#3B2A4D",
    backgroundSecondary: "#F5F4F7",
    borderStrong: "#C9C2D6",
    border: "#E8E2EC",
  }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));

import { PlanV3Surface } from "../../components/plan/PlanV3Surface";
import type { DayPlan, DayPlanMeal } from "../../lib/types";

const m = (calories: number, placeholder = false): DayPlanMeal => ({
  name: "Meal",
  recipeTitle: "Meal",
  calories,
  protein: 30,
  carbs: 40,
  fat: 15,
  isPlaceholder: placeholder,
});

const fullDay = (cals: number, p: number, c: number, f: number): DayPlan => ({
  day: 0,
  meals: [m(cals * 0.3), m(cals * 0.35), m(cals * 0.35)],
  totals: { calories: cals, protein: p, carbs: c, fat: f },
});
const emptyDay = (): DayPlan => ({
  day: 0,
  meals: [m(0, true), m(0, true), m(0, true)],
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});

// Week of Mon 15 Jun 2026 → Sun 21 Jun; today = Thu 18 (index 3).
const weekDates = Array.from(
  { length: 7 },
  (_, i) => new Date(2026, 5, 15 + i),
);
const today = new Date(2026, 5, 18);
const plan: DayPlan[] = [
  fullDay(1800, 120, 150, 55),
  fullDay(1820, 121, 151, 56),
  emptyDay(),
  fullDay(1490, 99, 121, 42), // Thu 18 — selected by default
  fullDay(1810, 120, 150, 55),
  emptyDay(),
  emptyDay(),
];

const baseProps = {
  plan,
  targetKcal: 1830,
  weekDates,
  weekLabel: "15–21 June",
  verdict: {
    daysHit: 4,
    total: 7,
    headline: "On track — 4 of 7 days land",
    subline: "3 days need a meal or swap",
    tone: "warning" as const,
  },
  household: null,
  onGenerate: () => {},
  onAdjust: () => {},
  onTemplates: () => {},
  onOpenHousehold: () => {},
  onOpenMeal: () => {},
  onAddToSlot: () => {},
  today,
};

describe("PlanV3Surface", () => {
  it("renders the header, verdict, and 7-day strip", () => {
    const { getByText, getByLabelText } = render(<PlanV3Surface {...baseProps} />);
    expect(getByText("Your plan")).toBeTruthy();
    expect(getByText("On track — 4 of 7 days land")).toBeTruthy();
    // Mon 15 … Sun 21
    expect(getByLabelText("M 15")).toBeTruthy();
    expect(getByLabelText("S 21")).toBeTruthy();
  });

  it("defaults the day-detail to today (Thu 18) with its real totals", () => {
    const { getByText } = render(<PlanV3Surface {...baseProps} />);
    expect(getByText("Thursday 18")).toBeTruthy();
    expect(getByText("1,490")).toBeTruthy();
    expect(getByText("≈340 kcal short — room for more")).toBeTruthy();
  });

  it("re-targets the detail band when another day is tapped", () => {
    const { getByText, getByLabelText } = render(<PlanV3Surface {...baseProps} />);
    fireEvent.press(getByLabelText("W 17")); // empty day, index 2
    expect(getByText("Wednesday 17")).toBeTruthy();
    expect(getByText("Nothing planned yet")).toBeTruthy();
  });

  it("lists the selected day's slots under the default 'All' filter", () => {
    const { getByLabelText, getByText } = render(<PlanV3Surface {...baseProps} />);
    // Thu 18 (fullDay) has 3 filled slots; the 4th (Snacks) is missing → empty.
    expect(getByLabelText("Breakfast: Meal")).toBeTruthy();
    expect(getByLabelText("Dinner: Meal")).toBeTruthy();
    expect(getByText("Add snacks")).toBeTruthy();
  });

  it("switches to the across-week view when a specific slot is filtered", () => {
    const { getByLabelText, getByText, getAllByText, queryByText } = render(
      <PlanV3Surface {...baseProps} />,
    );
    fireEvent.press(getByLabelText("Dinner")); // the filter chip
    // Across-week → every day's dinner under a day header.
    expect(getByText("Monday 15")).toBeTruthy();
    expect(getByText("Sunday 21")).toBeTruthy();
    // The 3 empty days (Wed 17, Sat 20, Sun 21) → "Add dinner" rows.
    expect(getAllByText("Add dinner")).toHaveLength(3);
    // "Add snacks" only exists in the All view → gone now.
    expect(queryByText("Add snacks")).toBeNull();
  });
});
