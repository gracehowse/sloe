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
      onToggleDisplayMode={() => {}}
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

  // N4 (2026-05-03) — NET tone is now three-state. Previously the
  // valueTone was `net < 0 ? "positive" : "neutral"` which painted
  // the value green any time consumed was below target — including
  // when nothing had been logged. The empty-state -1,132 in green
  // read as "good deficit" when the user had simply not started.
  describe("Net tile colour tone (N4)", () => {
    function netColorClass(loggedKcal: number, targetKcal: number): string {
      const { container } = renderStats({ loggedKcal, targetKcal, burnedKcal: 0 });
      const row = container.querySelector('[data-testid="today-hero-stat-row"]');
      if (!row) throw new Error("Stat row not rendered (desktop hides row until loggedKcal > 0)");
      const tiles = row.querySelectorAll(".text-\\[10px\\]");
      const tileMap: Record<string, Element | null> = {};
      tiles.forEach((label) => {
        const txt = (label.textContent ?? "").trim();
        tileMap[txt] = label.parentElement?.querySelector(".text-\\[18px\\]") ?? null;
      });
      const netValue = tileMap[TODAY_STAT_LABELS.net];
      if (!netValue) throw new Error("Net tile not found in render");
      return netValue.className;
    }

    it("hides the desktop stat row until the user has logged food", () => {
      const { container } = renderStats({ loggedKcal: 0, targetKcal: 1132, burnedKcal: 0 });
      expect(container.querySelector('[data-testid="today-hero-stat-row"]')).toBeNull();
    });

    it("renders Net in success when under target with food logged", () => {
      expect(netColorClass(1000, 1800)).toContain("text-success");
    });

    it("renders Net in over-budget amber when over target", () => {
      // 2026-05-21: switched from destructive red to over-budget amber
      // per brand-tokens.md + project memory ("over-budget is amber,
      // never red"). Red was alarming/clinical for a wellness app.
      expect(netColorClass(2000, 1800)).toContain("over-budget-fg");
    });

    it("renders Net in neutral when exactly at target", () => {
      expect(netColorClass(1800, 1800)).toContain("text-foreground");
    });
  });
});
