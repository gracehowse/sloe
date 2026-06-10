// @vitest-environment jsdom
/**
 * Today hero status pills (web) — ENG-753.
 *
 * Pins the flag-gated "On track" pill on the desktop hero
 * (`screens-web.jsx:173-177` port). Pairs with
 * `apps/mobile/__tests__/todayStatusPills.test.tsx` so the visibility
 * logic — flag-off, logged-vs-empty day — cannot drift between platforms.
 *
 * Sloe redesign (2026-06-08): the "Adaptive TDEE learning · N of 7 days"
 * line was removed from the Today hero to match Figma `654:2` (the frame
 * shows nothing between the Goal/Eaten/Bonus stats and the "Room for dinner"
 * coach line; the learning state lives on Progress). These tests now GUARD
 * that the TDEE line never re-appears on Today, while "On track" still works.
 * The `tdeeLearnDays` prop is retained for call-site stability.
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

  it("renders nothing when the flag is off, even with On track eligible", () => {
    flagFn.mockReturnValue(false);
    render(<TodayHeroStats {...baseProps({ isOnTrack: true, tdeeLearnDays: 6 })} />);
    expect(screen.queryByTestId("today-status-pills")).toBeNull();
  });

  it("renders the On track pill when flag on, day logged, and isOnTrack", () => {
    flagFn.mockReturnValue(true);
    render(<TodayHeroStats {...baseProps({ isOnTrack: true, tdeeLearnDays: 0 })} />);
    expect(screen.getByTestId("today-pill-on-track")).toBeTruthy();
  });

  it("NEVER renders the Adaptive TDEE learning line on Today (Figma 654:2)", () => {
    // Even with the flag on and tdeeLearnDays > 0, the TDEE line must not
    // appear — it was removed from Today. Re-adding it should break this test.
    flagFn.mockReturnValue(true);
    render(<TodayHeroStats {...baseProps({ isOnTrack: false, tdeeLearnDays: 4 })} />);
    expect(screen.queryByTestId("today-pill-tdee-learning")).toBeNull();
    expect(screen.queryByText(/Adaptive TDEE learning/)).toBeNull();
    // With only the (removed) TDEE pill eligible and On track false, the whole
    // pills row collapses to nothing.
    expect(screen.queryByTestId("today-status-pills")).toBeNull();
  });

  it("keeps the On track pill even when tdeeLearnDays is set (no TDEE line beside it)", () => {
    flagFn.mockReturnValue(true);
    render(<TodayHeroStats {...baseProps({ isOnTrack: true, tdeeLearnDays: 6 })} />);
    expect(screen.getByTestId("today-pill-on-track")).toBeTruthy();
    expect(screen.queryByTestId("today-pill-tdee-learning")).toBeNull();
  });

  it("hides the pills row when not on track", () => {
    flagFn.mockReturnValue(true);
    render(<TodayHeroStats {...baseProps({ isOnTrack: false, tdeeLearnDays: 0 })} />);
    expect(screen.queryByTestId("today-status-pills")).toBeNull();
  });

  it("hides all pills on an empty (un-logged) day even when flag on", () => {
    flagFn.mockReturnValue(true);
    render(
      <TodayHeroStats
        {...baseProps({ loggedKcal: 0, consumed: 0, isOnTrack: true, tdeeLearnDays: 6 })}
      />,
    );
    // An empty day means nothing consumed: `showStatRow = consumed > 0 && target
    // > 0` is false, so the pills block (which sits under the stat row) is gated
    // off. `consumed` must be 0 too — it's the canonical "did you eat" signal the
    // gate reads (loggedKcal alone no longer drives it).
    expect(screen.queryByTestId("today-status-pills")).toBeNull();
  });
});
