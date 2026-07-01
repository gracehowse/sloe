/**
 * ENG-969 — PaywallTrajectoryChart render pins (web).
 *
 * Mirror of `apps/mobile/tests/unit/paywallTrajectoryChart.test.tsx`. The
 * projection MATHS is pinned by `computeTrajectory.test.ts`; these tests pin
 * the paywall RENDER contract:
 *   - default-OFF flag → renders nothing even with valid data;
 *   - flag ON + a REAL projection → draws the chart + hero + honest footnote;
 *   - flag ON but below-floor / no-weight / no-data → renders nothing (a
 *     conversion surface never nags and never fabricates a forecast).
 *
 * The flag is forced via `window.__SUPPR_FORCE_FLAGS__` (the same client force
 * hook Playwright seeds), since `/pricing` reads the flag client-side.
 */

import * as React from "react";
import { describe, expect, it, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

import {
  PaywallTrajectoryChart,
  PAYWALL_TRAJECTORY_CHART_FLAG,
} from "../../app/pricing/PaywallTrajectoryChart";

type Meal = { calories?: number | null };
function buildDays(count: number, kcal: number): Record<string, Meal[]> {
  const out: Record<string, Meal[]> = {};
  for (let i = 0; i < count; i++) {
    out[`2026-05-${String(i + 1).padStart(2, "0")}`] = [{ calories: kcal }];
  }
  return out;
}

function forceFlag(value: boolean) {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    [PAYWALL_TRAJECTORY_CHART_FLAG]: value,
  };
}

afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

describe("PaywallTrajectoryChart — flag gate (web)", () => {
  it("renders nothing when the flag is OFF, even with a valid projection", () => {
    // No force → default-OFF.
    render(
      <PaywallTrajectoryChart byDay={buildDays(7, 1500)} latestWeightKg={70} targetCalories={1500} />,
    );
    expect(screen.queryByTestId("paywall-trajectory-chart")).toBeNull();
  });
});

describe("PaywallTrajectoryChart — projection state (web, flag ON)", () => {
  it("renders the chart, hero kg + horizon, basis, and honest footnote", () => {
    forceFlag(true);
    render(
      <PaywallTrajectoryChart
        byDay={buildDays(7, 1500)}
        latestWeightKg={70}
        targetCalories={1500}
        maintenanceTdeeKcal={2200}
        goal="lose"
      />,
    );
    expect(screen.getByTestId("paywall-trajectory-chart")).toBeTruthy();
    expect(screen.getByTestId("paywall-trajectory-svg")).toBeTruthy();
    expect(screen.getByTestId("paywall-trajectory-hero-kg").textContent).toContain("kg");
    expect(screen.getByTestId("paywall-trajectory-when").textContent).toContain("weeks");
    expect(screen.getByTestId("paywall-trajectory-basis")).toBeTruthy();
    expect(screen.getByTestId("paywall-trajectory-footnote").textContent).toContain(
      "An estimate, not a promise",
    );
  });
});

describe("PaywallTrajectoryChart — never fabricates / nags (web, flag ON)", () => {
  it("renders nothing below the projection floor (no placeholder nag)", () => {
    forceFlag(true);
    render(
      <PaywallTrajectoryChart byDay={buildDays(3, 1500)} latestWeightKg={70} targetCalories={1500} />,
    );
    expect(screen.queryByTestId("paywall-trajectory-chart")).toBeNull();
  });

  it("renders nothing when there is no current weight", () => {
    forceFlag(true);
    render(
      <PaywallTrajectoryChart byDay={buildDays(7, 1500)} latestWeightKg={null} targetCalories={1500} />,
    );
    expect(screen.queryByTestId("paywall-trajectory-chart")).toBeNull();
  });

  it("renders nothing on the public route shape (no data props passed)", () => {
    forceFlag(true);
    render(<PaywallTrajectoryChart />);
    expect(screen.queryByTestId("paywall-trajectory-chart")).toBeNull();
  });
});
