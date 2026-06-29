// @vitest-environment jsdom
/**
 * TodayHeroRing — SLOE hero chrome (redesign 2026-06-03, `01 · Today`).
 *
 * Protects the re-skinned hero composition that wraps the ring:
 *   - the status indicator (calm copy, three states), and
 *   - the Goal / Eaten / Bonus(or Over) stats row.
 *
 * ENG-1247 flipped `today_hero_decard_v3` default-ON (ENG-1264 red main): the
 * hero is now the BARE de-carded block with the status rendered as a centered
 * `RingStatusLine` BELOW the ring (sage/red dot + label, HIDDEN on empty days),
 * replacing the carded hero's tappable status CHIP above the ring (the
 * `today-ring-status-chip` testid + its "…, see how your calorie target was
 * set" accessibility label). The first block asserts that now-default v3
 * de-carded surface; the second block forces the flag OFF to keep guarding the
 * legacy carded chip (the PostHog kill-switch path).
 *
 * Chip / status copy matches Figma `01 · Today`: Fresh start / Under budget /
 * Over budget (`todayStatusChip` in `src/lib/copy/today.ts`) — shared, so it
 * can't drift between the chip and the line.
 *
 * Web parity pinned by `tests/unit/todayHeroRingChipsWeb.test.tsx`.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { isFeatureEnabled } from "@/lib/analytics";
import { TodayHeroRing } from "../../components/today/TodayHeroRing";

void React;

// Conformance + tier flags ship default-ON; mirror that here. Each block below
// overrides only the flag it's exercising (`today_hero_decard_v3`).
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: vi.fn(() => true),
}));

const flagFn = vi.mocked(isFeatureEnabled);

/** Default-ON for every flag EXCEPT the listed overrides. */
function setFlags(overrides: Record<string, boolean> = {}): void {
  flagFn.mockImplementation((flag: string) =>
    flag in overrides ? overrides[flag] : true,
  );
}

const baseProps = {
  baseGoal: undefined as number | undefined,
  textColor: "#221B26",
  secondaryColor: "#6A6072",
  trackColor: "#EDEAF1",
  cardBackgroundColor: "#F6F5F2",
  borderColor: "#E8E2EC",
  textTertiaryColor: "#9B93A3",
  proteinPct: 0.5,
  carbsPct: 0.5,
  fatPct: 0.5,
  expanded: true,
  onToggleExpanded: () => {},
  onToggleDisplayMode: () => {},
  displayMode: "consumed" as const,
};

// ── v3 default de-carded hero (today_hero_decard_v3 ON — the shipped default) ─
describe("TodayHeroRing — v3 de-carded status line (default)", () => {
  beforeEach(() => {
    setFlags();
  });

  it("empty day → status line is HIDDEN (and no carded chip)", () => {
    const { queryByText, queryByTestId } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={2000} />,
    );
    // RingStatusLine returns null on empty; the carded chip is gated out.
    expect(queryByText("Fresh start")).toBeNull();
    expect(queryByTestId("today-ring-status-chip")).toBeNull();
  });

  it("under target → 'Under budget' status line", () => {
    const { getByText, queryByTestId } = render(
      <TodayHeroRing {...baseProps} consumed={1200} goal={2000} />,
    );
    expect(getByText("Under budget")).toBeTruthy();
    // The de-carded hero renders the line, not the carded chip.
    expect(queryByTestId("today-ring-status-chip")).toBeNull();
  });

  it("over target → 'Over budget' status line", () => {
    const { getByText } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    expect(getByText("Over budget")).toBeTruthy();
  });
});

// ── Legacy carded hero (today_hero_decard_v3 forced OFF — kill-switch path) ──
// Forced OFF deliberately: guards the pre-v3 carded hero + its tappable status
// CHIP above the ring (the ENG-1184 "tap the chip to open the target
// explainer" affordance), which stays live behind the kill switch. The
// de-carded RingStatusLine is NOT pressable, so onPressStatusChip only exists
// on this carded path. Do not delete.
describe("TodayHeroRing — legacy carded status chip (flag forced OFF)", () => {
  beforeEach(() => {
    setFlags({ today_hero_decard_v3: false });
  });

  it("empty day → 'Fresh start' chip (no calorie data)", () => {
    const { getByText } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={2000} />,
    );
    expect(getByText("Fresh start")).toBeTruthy();
  });

  it("under target → 'Under budget' chip", () => {
    const { getByText } = render(
      <TodayHeroRing {...baseProps} consumed={1200} goal={2000} />,
    );
    expect(getByText("Under budget")).toBeTruthy();
  });

  it("over target → 'Over budget' chip", () => {
    const { getByText } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    expect(getByText("Over budget")).toBeTruthy();
  });

  it("ENG-1184 — fires onPressStatusChip when the status chip is pressed", () => {
    const onPressStatusChip = vi.fn();
    const { getByLabelText } = render(
      <TodayHeroRing
        {...baseProps}
        consumed={0}
        goal={2000}
        onPressStatusChip={onPressStatusChip}
      />,
    );
    fireEvent.press(
      getByLabelText("Fresh start, see how your calorie target was set"),
    );
    expect(onPressStatusChip).toHaveBeenCalledTimes(1);
  });
});

// ── Goal / Eaten / Bonus stats row — flag-independent (renders in both heroes)
describe("TodayHeroRing — SLOE Goal/Eaten/Bonus stats row", () => {
  beforeEach(() => {
    setFlags();
  });

  it("renders Goal + Eaten labels with thousands-separated values when logged", () => {
    const { getByText, getAllByText } = render(
      <TodayHeroRing {...baseProps} consumed={1420} goal={2040} />,
    );
    expect(getByText("Goal")).toBeTruthy();
    expect(getByText("Eaten")).toBeTruthy();
    expect(getByText("2,040")).toBeTruthy(); // goal (stats row only)
    // Eaten (=consumed) also appears as the ring's centre value in
    // consumed display mode, so it can occur more than once.
    expect(getAllByText("1,420").length).toBeGreaterThanOrEqual(1);
  });

  it("shows a positive Bonus when an exercise bonus lifts the goal", () => {
    const { getByText, getByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        consumed={1420}
        goal={2160}
        baseGoal={2040}
      />,
    );
    // goal - baseGoal = 120 earned headroom.
    expect(getByText("Bonus")).toBeTruthy();
    expect(getByTestId("today-ring-bonus")).toBeTruthy();
    expect(getByText("+120")).toBeTruthy();
  });

  it("keeps Bonus as the third stat even when over budget (Grace 2026-06-10)", () => {
    // The over amount already reads in the centre + the status indicator; the
    // old slot-flip hid the earned-burn number exactly when an over-budget
    // user most wants it.
    const { getByText, queryByText } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} baseGoal={1800} />,
    );
    expect(getByText("Bonus")).toBeTruthy();
    expect(getByText("+200")).toBeTruthy();
    expect(queryByText("Over")).toBeNull();
  });

  it("renders the stats row on the EMPTY hero too — zeros are honest (Grace 2026-06-10)", () => {
    // Supersedes the calm-empty divergence: the empty page mirrors
    // populated days; Eaten 0 / Bonus +0 are numbers, not noise.
    const { getByText, getAllByText } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={2000} />,
    );
    expect(getByText("Goal")).toBeTruthy();
    expect(getByText("Eaten")).toBeTruthy();
    expect(getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });
});
