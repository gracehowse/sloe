/**
 * DigestStoryCard — day-of-week pattern render pin (web).
 *
 * Audit 2026-04-30 (Lose It "Closer" parity, Fix 3). The narrative
 * card renders the optional `dayOfWeekPatternLine` from
 * `buildDigestStory` as its own `data-testid="digest-story-dow-pattern-line"`
 * sub-line. This test pins the render contract — the helper's logic
 * is covered by `digestStory.test.ts` + `dayOfWeekPattern.test.ts`.
 */

import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

import { DigestStoryCard } from "../../src/app/components/suppr/digest-story-card";

const baseProps = {
  weekLabel: "Apr 6 – Apr 12",
  daysLogged: 5,
  avgCalories: 1980,
  targetCalories: 2100,
  avgProtein: 140,
  targetProtein: 150,
  proteinOnTargetDays: 4,
  closestToTarget: { label: "Tuesday", calories: 2105, protein: 152 },
};

describe("DigestStoryCard — day-of-week pattern (web)", () => {
  it("renders the dow-pattern sub-line when the host supplies a pattern", () => {
    render(
      <DigestStoryCard
        {...baseProps}
        dayOfWeekPattern={{ highDay: "Saturday", lowDay: "Tuesday", deltaKcal: 250 }}
      />,
    );
    const line = screen.getByTestId("digest-story-dow-pattern-line");
    expect(line.textContent).toBe(
      "You averaged about 250 more kcal on Saturdays than Tuesdays.",
    );
  });

  it("suppresses the dow-pattern sub-line when no pattern is supplied", () => {
    render(<DigestStoryCard {...baseProps} />);
    expect(screen.queryByTestId("digest-story-dow-pattern-line")).toBeNull();
  });

  it("suppresses the dow-pattern sub-line when the host explicitly passes null", () => {
    render(<DigestStoryCard {...baseProps} dayOfWeekPattern={null} />);
    expect(screen.queryByTestId("digest-story-dow-pattern-line")).toBeNull();
  });
});
