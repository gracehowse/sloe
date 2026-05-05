// @vitest-environment jsdom
/**
 * Milestone30DayModal — render + interaction pins (mobile).
 *
 * Gating + content build are unit-covered in
 * `tests/unit/milestone30Day.test.ts` (root tests dir). These RTL
 * tests pin the rendered output:
 *
 *   1. Headline + days-logged subline render verbatim from content.
 *   2. Avg kcal + longest streak tiles render with tabular nums.
 *   3. Top foods list renders with rank + count suffix.
 *   4. Top foods section is suppressed when the list is empty.
 *   5. Weight-delta row is suppressed when null (no fabricated zero).
 *   6. "Keep going" CTA fires onDismiss exactly once.
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { Milestone30DayModal } from "../../components/today/Milestone30DayModal";
import type { Milestone30DayContent } from "../../lib/milestone30Day";

void React;

const BASE_COLORS = {
  cardColor: "#fff",
  textColor: "#000",
  textSecondaryColor: "#555",
  borderColor: "#e0e0e0",
};

function makeContent(overrides: Partial<Milestone30DayContent> = {}): Milestone30DayContent {
  return {
    headline: "30 days of meal logging",
    daysLogged: 30,
    avgDailyKcal: 1850,
    topFoods: [
      { name: "Salad", count: 12 },
      { name: "Eggs", count: 8 },
      { name: "Toast", count: 6 },
    ],
    longestStreak: 11,
    totalWeightDeltaKg: -1.4,
    ...overrides,
  };
}

describe("Milestone30DayModal", () => {
  it("renders the headline + days-logged subline", () => {
    const { getByText } = render(
      <Milestone30DayModal
        visible
        content={makeContent()}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByText("30 days of meal logging")).toBeTruthy();
    expect(
      getByText(/30\+ distinct days with meals logged/i),
    ).toBeTruthy();
  });

  it("renders avg kcal + longest streak tiles", () => {
    const { getByText } = render(
      <Milestone30DayModal
        visible
        content={makeContent()}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByText("Avg daily kcal")).toBeTruthy();
    expect(getByText("1,850")).toBeTruthy();
    expect(getByText("Best run")).toBeTruthy();
    expect(getByText("11 days")).toBeTruthy();
  });

  it("uses singular 'day' label when streak is 1", () => {
    const { getByText, queryByText } = render(
      <Milestone30DayModal
        visible
        content={makeContent({ longestStreak: 1 })}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByText("1 day")).toBeTruthy();
    expect(queryByText("1 days")).toBeNull();
  });

  it("renders the top foods list with rank + count suffix", () => {
    const { getByText } = render(
      <Milestone30DayModal
        visible
        content={makeContent()}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByText("Most-logged foods")).toBeTruthy();
    expect(getByText("1. Salad")).toBeTruthy();
    expect(getByText("12×")).toBeTruthy();
    expect(getByText("2. Eggs")).toBeTruthy();
    expect(getByText("8×")).toBeTruthy();
    expect(getByText("3. Toast")).toBeTruthy();
    expect(getByText("6×")).toBeTruthy();
  });

  it("suppresses the top foods card when the list is empty", () => {
    const { queryByText } = render(
      <Milestone30DayModal
        visible
        content={makeContent({ topFoods: [] })}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(queryByText("Most-logged foods")).toBeNull();
  });

  it("renders the weight delta row with unicode minus", () => {
    const { getByText } = render(
      <Milestone30DayModal
        visible
        content={makeContent({ totalWeightDeltaKg: -1.4 })}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByText(/Weight \(first/)).toBeTruthy();
    expect(getByText("−1.4 kg")).toBeTruthy();
  });

  it("suppresses the weight delta row when totalWeightDeltaKg is null", () => {
    const { queryByText } = render(
      <Milestone30DayModal
        visible
        content={makeContent({ totalWeightDeltaKg: null })}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(queryByText(/Weight \(first/)).toBeNull();
  });

  it("calls onDismiss when 'Keep going' is pressed", () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(
      <Milestone30DayModal
        visible
        content={makeContent()}
        onDismiss={onDismiss}
        {...BASE_COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Keep going"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when content is null (defensive guard)", () => {
    const { toJSON } = render(
      <Milestone30DayModal
        visible
        content={null}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});
