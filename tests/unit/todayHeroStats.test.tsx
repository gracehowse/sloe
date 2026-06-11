/**
 * todayHeroStats — Figma `654:2` Goal / Eaten / Bonus row under the ring.
 *
 * web ring parity 2026-06-10 (mobile ring wave): the right stat is ALWAYS
 * Bonus (never flips to "Over"), and the row renders on EMPTY days too with
 * honest zeros. Mirrors mobile `TodayHeroRing`.
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

  it("keeps Bonus (never flips to 'Over') in the stat row when consumed exceeds target", () => {
    const { container } = renderStats({ loggedKcal: 2100, targetKcal: 1800 });
    // Scope to the stat ROW — "Over budget" (chip) + "OVER" (ring centre) are
    // the correct over surfaces; only the third STAT cell must stay Bonus.
    const row = container.querySelector('[data-testid="today-hero-stat-row"]');
    expect(row).not.toBeNull();
    const rowText = row?.textContent ?? "";
    expect(rowText).toContain(TODAY_HERO_STAT_LABELS.bonus);
    expect(rowText).not.toContain(TODAY_HERO_STAT_LABELS.over);
    // No "over amount" (−300) in the stat row; no bonus headroom here → "0".
    expect(rowText).not.toMatch(/−300/);
  });

  it("renders the stat row with honest zeros on an EMPTY day (target set, nothing logged)", () => {
    const { container } = renderStats({ loggedKcal: 0, targetKcal: 2040, baseGoal: 2040 });
    const row = container.querySelector('[data-testid="today-hero-stat-row"]');
    expect(row).not.toBeNull();
    const text = row?.textContent ?? "";
    // GOAL 2,040 / EATEN 0 / BONUS 0 — the empty page mirrors a populated day.
    expect(text).toContain("2,040");
    expect(text).toContain(TODAY_HERO_STAT_LABELS.eaten);
    expect(text).toContain(TODAY_HERO_STAT_LABELS.bonus);
  });

  it("omits the stat row only when there is no profile target (target<=0)", () => {
    const { container } = renderStats({ loggedKcal: 0, targetKcal: 0 });
    expect(container.querySelector('[data-testid="today-hero-stat-row"]')).toBeNull();
  });
});
