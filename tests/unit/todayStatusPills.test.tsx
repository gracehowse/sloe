// @vitest-environment jsdom
/**
 * Today hero status pills (web) — ENG-753.
 *
 * Pins the flag-gated "On track" + "Adaptive TDEE learning · N of 7
 * days" pills on the desktop hero (`screens-web.jsx:173-177` port).
 * Pairs with `apps/mobile/__tests__/todayStatusPills.test.tsx` so the
 * visibility logic — flag-off, logged-vs-empty day, and per-pill
 * conditions — cannot drift between platforms.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  TodayHeroStats,
  type TodayHeroStatsProps,
} from "../../src/app/components/suppr/today-hero-stats";
import { isFeatureEnabled } from "../../src/lib/analytics/track";

void React;

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

function baseProps(overrides: Partial<TodayHeroStatsProps> = {}): TodayHeroStatsProps {
  return {
    loggedKcal: 1500,
    targetKcal: 2000,
    burnedKcal: 0,
    consumed: 1500,
    target: 2000,
    proteinPct: 0.5,
    carbsPct: 0.5,
    fatPct: 0.5,
    expanded: false,
    onToggleExpanded: () => undefined,
    displayMode: "remaining",
    onToggleDisplayMode: () => undefined,
    ...overrides,
  };
}

describe("ENG-753 — Today hero status pills (web)", () => {
  beforeEach(() => {
    flagFn.mockReset();
  });

  it("renders nothing when the flag is off, even with both pills eligible", () => {
    flagFn.mockReturnValue(false);
    render(<TodayHeroStats {...baseProps({ isOnTrack: true, tdeeLearnDays: 6 })} />);
    expect(screen.queryByTestId("today-status-pills")).toBeNull();
  });

  it("renders the On track pill when flag on, day logged, and isOnTrack", () => {
    flagFn.mockReturnValue(true);
    render(<TodayHeroStats {...baseProps({ isOnTrack: true, tdeeLearnDays: 0 })} />);
    expect(screen.getByTestId("today-pill-on-track")).toBeTruthy();
    expect(screen.queryByTestId("today-pill-tdee-learning")).toBeNull();
  });

  it("renders the TDEE learning pill with the day count", () => {
    flagFn.mockReturnValue(true);
    render(<TodayHeroStats {...baseProps({ isOnTrack: false, tdeeLearnDays: 4 })} />);
    const pill = screen.getByTestId("today-pill-tdee-learning");
    expect(pill.textContent).toContain("Adaptive TDEE learning · 4 of 7 days");
    expect(screen.queryByTestId("today-pill-on-track")).toBeNull();
  });

  it("renders both pills together", () => {
    flagFn.mockReturnValue(true);
    render(<TodayHeroStats {...baseProps({ isOnTrack: true, tdeeLearnDays: 6 })} />);
    expect(screen.getByTestId("today-pill-on-track")).toBeTruthy();
    expect(screen.getByTestId("today-pill-tdee-learning")).toBeTruthy();
  });

  it("hides the TDEE pill when tdeeLearnDays is 0", () => {
    flagFn.mockReturnValue(true);
    render(<TodayHeroStats {...baseProps({ isOnTrack: false, tdeeLearnDays: 0 })} />);
    expect(screen.queryByTestId("today-status-pills")).toBeNull();
  });

  it("hides all pills on an empty (un-logged) day even when flag on", () => {
    flagFn.mockReturnValue(true);
    render(
      <TodayHeroStats
        {...baseProps({ loggedKcal: 0, isOnTrack: true, tdeeLearnDays: 6 })}
      />,
    );
    // showStatRow is false when loggedKcal === 0, so the pills block is gated off.
    expect(screen.queryByTestId("today-status-pills")).toBeNull();
  });
});
