// @vitest-environment jsdom
/**
 * PlanV3Surface — empty-week grammar (ENG-1372 slice 1, mobile).
 *
 * Behind `empty_state_grammar_v1` (default-OFF): a week with ZERO real meals
 * in ANY slot (isPlanWeekEmpty) swaps the verdict row + day-detail zero-triad
 * for one warm PlanEmptyWeekCard ("Nothing planned yet" + filled "Generate
 * this week" + ghost "or add meals as you go"). A week with even one real
 * meal keeps the normal verdict + day-detail band untouched. Web parity:
 * `tests/unit/planEmptyWeekGrammarWeb.test.tsx`.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

const isFeatureEnabledMock = vi.fn((_flag: string) => false);
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => isFeatureEnabledMock(flag),
}));
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

const m = (calories: number, placeholder = true): DayPlanMeal => ({
  name: "Meal",
  recipeTitle: placeholder ? "" : "Meal",
  calories,
  protein: 30,
  carbs: 40,
  fat: 15,
  isPlaceholder: placeholder,
});

const emptyDay = (): DayPlan => ({
  day: 0,
  meals: [m(0, true), m(0, true), m(0, true)],
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});
const fullDay = (): DayPlan => ({
  day: 0,
  meals: [m(500, false), m(600, false), m(700, false)],
  totals: { calories: 1800, protein: 120, carbs: 150, fat: 55 },
});

const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 15 + i));
const today = new Date(2026, 5, 18);

const baseProps = {
  targetKcal: 1830,
  weekDates,
  weekLabel: "15–21 June",
  verdict: {
    daysHit: 0,
    total: 7,
    headline: "On track — 0 of 7 days on target",
    subline: "7 days need a meal or swap",
    tone: "warning" as const,
  },
  household: null,
  onGenerate: () => {},
  onAdjust: () => {},
  onTemplates: () => {},
  onOpenHousehold: () => {},
  onOpenMeal: () => {},
  onAddToSlot: () => {},
  shoppingItemCount: 0,
  servingCount: 1,
  onOpenShopping: () => {},
  onOpenBatchCook: () => {},
  batchCookSubtitle: "Cook once · scale shopping",
  today,
};

describe("PlanV3Surface (mobile) — empty-week grammar gating", () => {
  it("flag OFF (default): fully-empty week still shows the legacy verdict + zero-triad", () => {
    isFeatureEnabledMock.mockReturnValue(false);
    const plan = Array.from({ length: 7 }, emptyDay);
    const { queryByTestId, getByText } = render(<PlanV3Surface {...baseProps} plan={plan} />);
    expect(queryByTestId("plan-empty-week-card")).toBeNull();
    expect(getByText("On track — 0 of 7 days on target")).toBeTruthy();
    expect(getByText("Nothing planned yet")).toBeTruthy(); // day-detail zero-triad subline
  });

  it("flag ON + fully-empty week: renders the warm invitation card, hides the verdict row", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    const plan = Array.from({ length: 7 }, emptyDay);
    const { getByTestId, queryByText, queryByTestId } = render(
      <PlanV3Surface {...baseProps} plan={plan} />,
    );
    expect(getByTestId("plan-empty-week-card")).toBeTruthy();
    expect(queryByText("On track — 0 of 7 days on target")).toBeNull();
    expect(queryByTestId("plan-day-detail-band")).toBeNull();
  });

  it("flag ON but the week has ANY real meal: keeps the normal verdict + day-detail band", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    const plan = [fullDay(), emptyDay(), emptyDay(), emptyDay(), emptyDay(), emptyDay(), emptyDay()];
    const { queryByTestId, getByText } = render(<PlanV3Surface {...baseProps} plan={plan} />);
    expect(queryByTestId("plan-empty-week-card")).toBeNull();
    expect(getByText("On track — 0 of 7 days on target")).toBeTruthy();
  });

  it("'or add meals as you go' dismisses the card for this session, revealing the day-detail band", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    const plan = Array.from({ length: 7 }, emptyDay);
    const { getByText, queryByTestId, getByTestId } = render(
      <PlanV3Surface {...baseProps} plan={plan} />,
    );
    expect(getByTestId("plan-empty-week-card")).toBeTruthy();
    fireEvent.press(getByText("or add meals as you go"));
    expect(queryByTestId("plan-empty-week-card")).toBeNull();
    expect(getByTestId("plan-day-detail-band")).toBeTruthy();
  });
});
