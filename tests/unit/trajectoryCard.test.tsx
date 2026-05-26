/**
 * ENG-741 — TrajectoryCard render pins (web).
 *
 * Mirror of `apps/mobile/tests/unit/trajectoryCard.test.tsx`. The
 * projection MATHS is pinned by `computeTrajectory.test.ts`; these tests
 * pin the RENDER contract: projection state surfaces the hero + basis +
 * footnote, placeholder state surfaces the days-remaining title + bar,
 * and a missing current weight renders nothing (never a fabricated
 * forecast).
 */

import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

import { TrajectoryCard } from "../../src/app/components/suppr/trajectory-card";

type Meal = { calories?: number | null };
function buildDays(count: number, kcal: number): Record<string, Meal[]> {
  const out: Record<string, Meal[]> = {};
  for (let i = 0; i < count; i++) {
    out[`2026-05-${String(i + 1).padStart(2, "0")}`] = [{ calories: kcal }];
  }
  return out;
}

describe("TrajectoryCard — projection state (web)", () => {
  it("renders the eyebrow, hero kg + horizon, basis, and footnote", () => {
    render(
      <TrajectoryCard
        byDay={buildDays(7, 1500)}
        latestWeightKg={70}
        targetCalories={1500}
        maintenanceTdeeKcal={2200}
        goal="lose"
      />,
    );
    expect(screen.getByTestId("trajectory-card")).toBeTruthy();
    expect(screen.getByText("PROJECTED WEIGHT")).toBeTruthy();
    const hero = screen.getByTestId("trajectory-hero-kg");
    expect(hero.textContent).toMatch(/kg$/);
    expect(screen.getByTestId("trajectory-hero-when").textContent).toContain("weeks");
    expect(screen.getByTestId("trajectory-basis").textContent).toContain("1,500");
    expect(screen.getByTestId("trajectory-footnote").textContent).toContain("7,700");
    // Calm forecast: never the placeholder bar in this state.
    expect(screen.queryByTestId("trajectory-progress-track")).toBeNull();
  });
});

describe("TrajectoryCard — placeholder state (web)", () => {
  it("renders the exact days-remaining title and a progress bar under the floor", () => {
    render(
      <TrajectoryCard
        byDay={buildDays(3, 1500)}
        latestWeightKg={70}
        targetCalories={1500}
      />,
    );
    expect(screen.getByTestId("trajectory-placeholder-title").textContent).toContain(
      "Log 2 more days",
    );
    expect(screen.getByTestId("trajectory-progress-track")).toBeTruthy();
    expect(screen.getByTestId("trajectory-progress-fill")).toBeTruthy();
    // No hero number invented below the floor.
    expect(screen.queryByTestId("trajectory-hero-kg")).toBeNull();
  });

  it("singularises 'day' when one day remains", () => {
    render(
      <TrajectoryCard
        byDay={buildDays(4, 1500)}
        latestWeightKg={70}
        targetCalories={1500}
      />,
    );
    expect(screen.getByTestId("trajectory-placeholder-title").textContent).toContain(
      "Log 1 more day to",
    );
  });
});

describe("TrajectoryCard — hidden / no-data (web)", () => {
  it("renders nothing when there is no current weight", () => {
    const { container } = render(
      <TrajectoryCard
        byDay={buildDays(7, 1500)}
        latestWeightKg={null}
        targetCalories={1500}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
