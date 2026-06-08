/**
 * todayHeroStats — Figma `654:2` Goal / Eaten / Bonus row under the ring.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { TodayHeroStats } from "../../src/app/components/suppr/today-hero-stats";
import { TODAY_HERO_STAT_LABELS } from "../../src/lib/copy/today";

function renderStats(overrides: {
  loggedKcal: number;
  targetKcal: number;
  burnedKcal?: number;
  baseGoal?: number;
}) {
  return render(
    <TodayHeroStats
      loggedKcal={overrides.loggedKcal}
      targetKcal={overrides.targetKcal}
      burnedKcal={overrides.burnedKcal ?? 0}
      baseGoal={overrides.baseGoal ?? overrides.targetKcal}
      consumed={overrides.loggedKcal}
      target={overrides.targetKcal}
      proteinPct={0.3}
      carbsPct={0.4}
      fatPct={0.5}
      expanded={false}
      onToggleExpanded={() => {}}
      displayMode="remaining"
      onToggleDisplayMode={() => {}}
    />,
  );
}

describe("TodayHeroStats", () => {
  it("renders Figma Goal / Eaten / Bonus labels when food is logged", () => {
    const { container } = renderStats({ loggedKcal: 620, targetKcal: 2040, baseGoal: 1920 });
    const text = container.textContent ?? "";
    expect(text).toContain(TODAY_HERO_STAT_LABELS.goal);
    expect(text).toContain(TODAY_HERO_STAT_LABELS.eaten);
    expect(text).toContain(TODAY_HERO_STAT_LABELS.bonus);
  });

  it("formats Goal and Eaten with thousands separators", () => {
    const { container } = renderStats({ loggedKcal: 1420, targetKcal: 2040 });
    const text = container.textContent ?? "";
    expect(text).toContain("1,420");
    expect(text).toContain("2,040");
  });

  it("shows Bonus with plus prefix when activity headroom exists", () => {
    const { container } = renderStats({
      loggedKcal: 620,
      targetKcal: 2040,
      baseGoal: 1920,
    });
    const text = container.textContent ?? "";
    expect(text).toContain("+120");
  });

  it("shows Over instead of Bonus when consumed exceeds target", () => {
    const { container } = renderStats({ loggedKcal: 2100, targetKcal: 1800 });
    const text = container.textContent ?? "";
    expect(text).toContain(TODAY_HERO_STAT_LABELS.over);
    expect(text).toMatch(/−300/);
  });

  it("hides the desktop stat row until the user has logged food", () => {
    const { container } = renderStats({ loggedKcal: 0, targetKcal: 901 });
    expect(container.querySelector('[data-testid="today-hero-stat-row"]')).toBeNull();
  });
});
