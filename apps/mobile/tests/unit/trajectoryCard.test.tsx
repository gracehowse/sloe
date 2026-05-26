// @vitest-environment jsdom

/**
 * ENG-741 — TrajectoryCard render pins (mobile).
 *
 * Mirror of `tests/unit/trajectoryCard.test.tsx` (web). The projection
 * MATHS is pinned by web `computeTrajectory.test.ts` (shared helper);
 * these tests pin the RN RENDER contract: projection state surfaces the
 * hero + basis + footnote, placeholder state surfaces the days-remaining
 * title + bar, and a missing current weight renders nothing (never a
 * fabricated forecast).
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#666",
    textTertiary: "#999",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#ddd",
  }),
}));

import { TrajectoryCard } from "../../components/progress/TrajectoryCard";

type Meal = { calories?: number | null };
function buildDays(count: number, kcal: number): Record<string, Meal[]> {
  const out: Record<string, Meal[]> = {};
  for (let i = 0; i < count; i++) {
    out[`2026-05-${String(i + 1).padStart(2, "0")}`] = [{ calories: kcal }];
  }
  return out;
}

describe("TrajectoryCard — projection state (mobile)", () => {
  it("renders the hero kg + horizon, basis, and footnote", () => {
    const { getByTestId, queryByTestId } = render(
      <TrajectoryCard
        byDay={buildDays(7, 1500)}
        latestWeightKg={70}
        targetCalories={1500}
        maintenanceTdeeKcal={2200}
        goal="lose"
      />,
    );
    expect(getByTestId("trajectory-card")).toBeTruthy();
    const heroChildren = ([] as unknown[]).concat(
      getByTestId("trajectory-hero-kg").props.children,
    );
    expect(heroChildren).toContain(" kg");
    const when = ([] as unknown[])
      .concat(getByTestId("trajectory-hero-when").props.children)
      .join("");
    expect(when).toContain("weeks");
    expect(getByTestId("trajectory-basis")).toBeTruthy();
    expect(getByTestId("trajectory-footnote")).toBeTruthy();
    // Calm forecast — no placeholder bar in this state.
    expect(queryByTestId("trajectory-progress-track")).toBeNull();
  });
});

describe("TrajectoryCard — placeholder state (mobile)", () => {
  it("renders the exact days-remaining title and a progress bar under the floor", () => {
    const { getByTestId, queryByTestId } = render(
      <TrajectoryCard byDay={buildDays(3, 1500)} latestWeightKg={70} targetCalories={1500} />,
    );
    const title = ([] as unknown[])
      .concat(getByTestId("trajectory-placeholder-title").props.children)
      .join("");
    expect(title).toContain("Log 2 more days");
    expect(getByTestId("trajectory-progress-track")).toBeTruthy();
    expect(getByTestId("trajectory-progress-fill")).toBeTruthy();
    expect(queryByTestId("trajectory-hero-kg")).toBeNull();
  });

  it("singularises 'day' when one day remains", () => {
    const { getByTestId } = render(
      <TrajectoryCard byDay={buildDays(4, 1500)} latestWeightKg={70} targetCalories={1500} />,
    );
    const title = ([] as unknown[])
      .concat(getByTestId("trajectory-placeholder-title").props.children)
      .join("");
    expect(title).toContain("Log 1 more day to");
  });
});

describe("TrajectoryCard — hidden / no-data (mobile)", () => {
  it("renders nothing when there is no current weight", () => {
    const { queryByTestId } = render(
      <TrajectoryCard byDay={buildDays(7, 1500)} latestWeightKg={null} targetCalories={1500} />,
    );
    expect(queryByTestId("trajectory-card")).toBeNull();
  });
});
