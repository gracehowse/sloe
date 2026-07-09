/**
 * Render-shape tests for the web `<ProgressStoryGate>` placeholder
 * card and the `<DigestStoryCard>` lead card on Progress.
 *
 * Authority: customer-lens audit 2026-04-30 + D-2026-04-27-17.
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProgressStoryGate } from "../../src/app/components/suppr/progress-story-gate";
import { DigestStoryCard } from "../../src/app/components/suppr/digest-story-card";

describe("<ProgressStoryGate />", () => {
  it("renders the eyebrow + 0/3 ring + aspirational copy when daysLogged = 0", () => {
    render(<ProgressStoryGate daysLogged={0} />);
    expect(screen.getByText("THIS WEEK")).toBeDefined();
    expect(screen.getByText("Your story builds with your data")).toBeDefined();
    expect(
      screen.getByText("Log a meal to start the count. 3 days to your first insight."),
    ).toBeDefined();
    expect(screen.getByTestId("progress-story-gate-ring")).toBeDefined();
    const label = screen.getByTestId("progress-story-gate-ring-label");
    expect(label.textContent).toContain("0 / 3");
  });

  it("renders 'Almost there' on day 2", () => {
    render(<ProgressStoryGate daysLogged={2} />);
    expect(screen.getByText("Almost there")).toBeDefined();
    expect(
      screen.getByText("One more logged day and your weekly story unlocks."),
    ).toBeDefined();
    const label = screen.getByTestId("progress-story-gate-ring-label");
    expect(label.textContent).toContain("2 / 3");
  });

  it("ENG-1372 slice 2 — renders a standalone '<n>/3' numeral WITH the ring (not just buried in the sentence below)", () => {
    render(<ProgressStoryGate daysLogged={0} />);
    expect(screen.getByTestId("progress-story-gate-ring-numeral").textContent).toBe("0/3");
  });

  it("ENG-1372 slice 2 — the numeral tracks segmentsFilled at day 1", () => {
    render(<ProgressStoryGate daysLogged={1} />);
    expect(screen.getByTestId("progress-story-gate-ring-numeral").textContent).toBe("1/3");
  });
});

describe("<DigestStoryCard />", () => {
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

  it("renders eyebrow 'WEEK DIGEST', the week label, and four narrative lines", () => {
    render(<DigestStoryCard {...base} />);
    expect(screen.getByText("WEEK DIGEST")).toBeDefined();
    expect(screen.getByText("Apr 6 – Apr 12")).toBeDefined();
    expect(screen.getByTestId("digest-story-days-line").textContent).toBe(
      "5 of 7 days logged.",
    );
    expect(screen.getByTestId("digest-story-calories-line").textContent).toBe(
      "You averaged 1,980 kcal vs 2,100 target — 120 under.",
    );
    expect(screen.getByTestId("digest-story-protein-line").textContent).toBe(
      "Hit your protein target on 4 of 5 days logged.",
    );
    expect(screen.getByTestId("digest-story-closest-line").textContent).toBe(
      "Tuesday was your closest day (2,105 kcal vs 2,100 target).",
    );
  });

  it("renders the calm empty state when daysLogged = 0 — no numerals, no exhortation", () => {
    render(
      <DigestStoryCard
        {...base}
        daysLogged={0}
        avgCalories={0}
        avgProtein={0}
        proteinOnTargetDays={0}
        closestToTarget={null}
      />,
    );
    expect(screen.getByTestId("digest-story-card-empty")).toBeDefined();
    expect(screen.queryByTestId("digest-story-calories-line")).toBeNull();
    expect(screen.queryByTestId("digest-story-protein-line")).toBeNull();
    expect(screen.queryByTestId("digest-story-closest-line")).toBeNull();
  });

  it("does not render calorie / protein sentences when targets are 0", () => {
    render(
      <DigestStoryCard
        {...base}
        targetCalories={0}
        targetProtein={0}
      />,
    );
    expect(screen.queryByTestId("digest-story-calories-line")).toBeNull();
    expect(screen.queryByTestId("digest-story-protein-line")).toBeNull();
    // Days line + closest line still render.
    expect(screen.getByTestId("digest-story-days-line")).toBeDefined();
    expect(screen.getByTestId("digest-story-closest-line")).toBeDefined();
  });
});
