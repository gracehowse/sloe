/**
 * Render-shape tests for the mobile `<ProgressStoryGate>` placeholder
 * card and the `<DigestStoryCard>` lead card on Progress.
 *
 * Authority: customer-lens audit 2026-04-30 + D-2026-04-27-17.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { ProgressStoryGate } from "../../components/today/ProgressStoryGate";
import { DigestStoryCard } from "../../components/progress/DigestStoryCard";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#eee",
    inputBg: "#f4f4f4",
    confidenceNeutral: "#475569",
    tint: "#1c1916",
  }),
}));

describe("<ProgressStoryGate /> (mobile)", () => {
  it("renders eyebrow + headline + body + ring + 0/3 label when daysLogged = 0", () => {
    const { getByText, getByTestId } = render(
      <ProgressStoryGate daysLogged={0} />,
    );
    expect(getByText("THIS WEEK")).toBeTruthy();
    expect(getByText("Your story builds with your data")).toBeTruthy();
    expect(
      getByText("Log a meal to start the count. 3 days to your first insight."),
    ).toBeTruthy();
    expect(getByTestId("progress-story-gate-ring")).toBeTruthy();
    const label = getByTestId("progress-story-gate-ring-label");
    expect(label.props.children.join("")).toContain("0 / 3");
  });

  it("renders 'Almost there' headline on day 2", () => {
    const { getByText, getByTestId } = render(
      <ProgressStoryGate daysLogged={2} />,
    );
    expect(getByText("Almost there")).toBeTruthy();
    expect(
      getByText("One more logged day and your weekly story unlocks."),
    ).toBeTruthy();
    const label = getByTestId("progress-story-gate-ring-label");
    expect(label.props.children.join("")).toContain("2 / 3");
  });
});

describe("<DigestStoryCard /> (mobile)", () => {
  const base = {
    weekLabel: "Apr 6 – Apr 12",
    daysLogged: 5,
    avgCalories: 1980,
    targetCalories: 2100,
    avgProtein: 140,
    targetProtein: 150,
    proteinOnTargetDays: 4,
    closestToTarget: { label: "Tuesday", calories: 2105, protein: 152 },
  };

  it("renders eyebrow + week label + four narrative lines", () => {
    const { getByText, getByTestId } = render(<DigestStoryCard {...base} />);
    expect(getByText("WEEK DIGEST")).toBeTruthy();
    expect(getByText("Apr 6 – Apr 12")).toBeTruthy();
    expect(getByTestId("digest-story-days-line")).toBeTruthy();
    expect(getByTestId("digest-story-calories-line")).toBeTruthy();
    expect(getByTestId("digest-story-protein-line")).toBeTruthy();
    expect(getByTestId("digest-story-closest-line")).toBeTruthy();
    expect(
      getByText("You averaged 1,980 kcal vs 2,100 target — 120 under."),
    ).toBeTruthy();
    expect(
      getByText("Hit your protein target on 4 of 5 days logged."),
    ).toBeTruthy();
    expect(
      getByText("Tuesday was your closest day (2,105 kcal vs 2,100 target)."),
    ).toBeTruthy();
  });

  it("renders the calm empty state when daysLogged = 0 — no numeral lines", () => {
    const { getByTestId, queryByTestId } = render(
      <DigestStoryCard
        {...base}
        daysLogged={0}
        avgCalories={0}
        avgProtein={0}
        proteinOnTargetDays={0}
        closestToTarget={null}
      />,
    );
    expect(getByTestId("digest-story-card-empty")).toBeTruthy();
    expect(queryByTestId("digest-story-calories-line")).toBeNull();
    expect(queryByTestId("digest-story-protein-line")).toBeNull();
    expect(queryByTestId("digest-story-closest-line")).toBeNull();
  });
});
