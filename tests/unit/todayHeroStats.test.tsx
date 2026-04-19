/**
 * todayHeroStats — the Today hero block renders the 4-tile meta
 * (Logged / Target / Burned / Net) beside the calorie ring on desktop.
 *
 * These tests verify the *strings* the block produces for a given
 * calorie state, not the ring geometry (the ring is covered by its
 * own visual pass). Ring tiles are `hidden md:grid` so they render
 * in the DOM and jsdom can assert on them directly.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { TodayHeroStats } from "../../src/app/components/suppr/today-hero-stats";
import { TODAY_STAT_LABELS } from "../../src/lib/copy/today";

function renderStats(overrides: {
  loggedKcal: number;
  targetKcal: number;
  burnedKcal?: number;
}) {
  return render(
    <TodayHeroStats
      loggedKcal={overrides.loggedKcal}
      targetKcal={overrides.targetKcal}
      burnedKcal={overrides.burnedKcal ?? 0}
      consumed={overrides.loggedKcal}
      target={overrides.targetKcal}
      proteinPct={0.3}
      carbsPct={0.4}
      fatPct={0.5}
      expanded={false}
      onToggleExpanded={() => {}}
      displayMode="remaining"
      onDisplayModeChange={() => {}}
    />,
  );
}

describe("TodayHeroStats", () => {
  it("renders all 4 canonical stat labels", () => {
    const { container } = renderStats({ loggedKcal: 1420, targetKcal: 1800, burnedKcal: 2180 });
    const text = container.textContent ?? "";
    expect(text).toContain(TODAY_STAT_LABELS.logged);
    expect(text).toContain(TODAY_STAT_LABELS.target);
    expect(text).toContain(TODAY_STAT_LABELS.burned);
    expect(text).toContain(TODAY_STAT_LABELS.net);
  });

  it("formats Logged and Target with thousands separators", () => {
    const { container } = renderStats({ loggedKcal: 1420, targetKcal: 1800 });
    const text = container.textContent ?? "";
    expect(text).toContain("1,420");
    expect(text).toContain("1,800");
  });

  it("shows Net with a Unicode-minus prefix when logged < target", () => {
    const { container } = renderStats({ loggedKcal: 1040, targetKcal: 1800 });
    const text = container.textContent ?? "";
    // net = -760 → U+2212 prefix (no separate "deficit" sub-label —
    // sub-labels were removed 2026-04-18 as redundant noise; the
    // sign + colour communicate direction at a glance).
    expect(text).toMatch(/\u2212760/);
  });

  it("shows Net with a plus prefix when logged > target", () => {
    const { container } = renderStats({ loggedKcal: 2100, targetKcal: 1800 });
    const text = container.textContent ?? "";
    expect(text).toContain("+300");
  });

  it("shows '0' for Net when logged === target", () => {
    const { container } = renderStats({ loggedKcal: 1800, targetKcal: 1800 });
    const text = container.textContent ?? "";
    // Net value is exactly "0" — no sign prefix, no maintenance text.
    expect(text).toContain(TODAY_STAT_LABELS.net);
    expect(text).toMatch(/Net.*0/);
  });

  it("shows an em-dash for Burned when no Health data is synced", () => {
    const { container } = renderStats({ loggedKcal: 1000, targetKcal: 1800, burnedKcal: 0 });
    const text = container.textContent ?? "";
    // dash shown beside the "Burned" label
    expect(text).toContain(TODAY_STAT_LABELS.burned);
    expect(text).toContain("—");
  });
});
