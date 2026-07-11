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

  it("ENG-1372 slice 2 — renders a standalone '<n>/3' numeral WITH the ring (not just buried in the sentence below)", () => {
    const { getByTestId, queryByTestId } = render(<ProgressStoryGate daysLogged={0} />);
    expect(queryByTestId("progress-story-gate-ring-numeral")).toBeNull(); // fit-and-finish 2026-07-11: numeral removed (redundant with caption)
  });

  it("ENG-1372 slice 2 — the numeral tracks segmentsFilled at day 1", () => {
    const { getByTestId, queryByTestId } = render(<ProgressStoryGate daysLogged={1} />);
    expect(queryByTestId("progress-story-gate-ring-numeral")).toBeNull(); // fit-and-finish 2026-07-11: numeral removed (redundant with caption)
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

  it("renders hero digest row + supporting stats when days are logged", () => {
    const { getByText, getByTestId } = render(<DigestStoryCard {...base} />);
    expect(getByText("WEEK DIGEST")).toBeTruthy();
    expect(getByText("Apr 6 – Apr 12")).toBeTruthy();
    expect(getByTestId("digest-hero-row")).toBeTruthy();
    expect(getByTestId("digest-support-line")).toBeTruthy();
    expect(getByText(/days logged/i)).toBeTruthy();
    expect(getByText(/Avg 1,980 kcal/i)).toBeTruthy();
    expect(getByText(/Protein 4\/5 days/i)).toBeTruthy();
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
