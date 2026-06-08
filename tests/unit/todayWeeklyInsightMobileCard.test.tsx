// @vitest-environment jsdom
/**
 * TodayWeeklyInsightMobileCard (web) — below-meals weekly insight on
 * mobile-web; parity with `apps/mobile/components/today/WeeklyInsightCard.tsx`.
 *
 * 2026-06-08 flat-slab unification (Grace flagged the below-hero Today cards
 * as inconsistent across web + mobile): the Figma narrative branch used to be
 * a hand-rolled `<div class="rounded-xl border border-border bg-[…frost-mist…]">`
 * — a bordered card with a COOLER ad-hoc lilac that didn't match the
 * cross-screen insight wash. Both branches are now flat `SupprCard`
 * (`elevation="slab-flat"`, borderless) carrying the CANONICAL insight lilac
 * (`PROGRESS_INSIGHT_LILAC_STYLE` = `var(--slot-dinner-soft)`, the exact wash
 * the Progress THIS WEEK card uses) — mirroring mobile `tone="magenta"`.
 *
 * Pinned here (both flag branches):
 *   1. The card is a flat `SupprCard` slab — `.card-slab-flat` +
 *      `data-flat-slab` — never the old bordered `rounded-xl border` div.
 *   2. It carries the canonical insight-lilac background var (matches
 *      Progress), not the cooler `--frost-mist` ad-hoc fill.
 *   3. Every wired figure still renders (the re-chrome is presentation-only).
 *   4. The flag gate is preserved (nothing renders when both layout flags off).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { TodayWeeklyInsightMobileCard } from "../../src/app/components/suppr/today-weekly-insight-mobile-card";

void React;

// Default mock: both layout flags OFF. Individual describes override per branch.
const flagMock = vi.fn((_flag: string) => false);
vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => flagMock(flag),
}));

const base = {
  householdSize: 2,
  loggedDaysInWeek: 4,
  weekAvgKcal: 1840,
  weekDailyKcal: [1960, 2000, 2040, 1500, 0, 0, 0],
  dailyKcalTarget: 2000,
};

/** The flat `SupprCard` host node — both branches set `data-testid`. */
function insightCard(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(
    '[data-testid="today-weekly-insight-mobile"]',
  );
  if (!el) throw new Error("insight card not rendered");
  return el;
}

describe("TodayWeeklyInsightMobileCard (web) — flag gate", () => {
  it("renders nothing when both layout flags are off", () => {
    flagMock.mockImplementation(() => false);
    const { container } = render(<TodayWeeklyInsightMobileCard {...base} />);
    expect(
      container.querySelector('[data-testid="today-weekly-insight-mobile"]'),
    ).toBeNull();
  });
});

describe.each([
  {
    label: "Figma narrative branch (today_meals_figma_654 ON, default)",
    impl: (_flag: string) => true,
  },
  {
    label: "legacy stat-grid branch (rollout gate ON, figma OFF)",
    impl: (flag: string) => flag !== "today_meals_figma_654",
  },
])("TodayWeeklyInsightMobileCard (web) — $label", ({ impl }) => {
  it("renders a flat SupprCard slab, never the old bordered figma div", () => {
    flagMock.mockImplementation(impl);
    const { container } = render(<TodayWeeklyInsightMobileCard {...base} />);
    const card = insightCard(container);
    // Flat slab — the SupprCard `slab-flat` chrome (borderless).
    expect(card.className).toContain("card-slab-flat");
    expect(card).toHaveAttribute("data-flat-slab", "true");
    // The deleted hand-rolled bordered figma div must not come back.
    expect(card.className).not.toMatch(/\brounded-xl\b/);
    expect(card.className).not.toMatch(/\bborder-border\b/);
  });

  it("carries the canonical insight lilac (matches Progress), not frost-mist", () => {
    flagMock.mockImplementation(impl);
    const { container } = render(<TodayWeeklyInsightMobileCard {...base} />);
    const card = insightCard(container);
    // `PROGRESS_INSIGHT_LILAC_STYLE.background = var(--slot-dinner-soft)`.
    expect(card.style.background).toContain("--slot-dinner-soft");
    // The old cooler ad-hoc fill is gone from the card surface.
    expect(card.className).not.toContain("frost-mist");
  });

  it("renders the wired derived content", () => {
    flagMock.mockImplementation(impl);
    const { getByText } = render(<TodayWeeklyInsightMobileCard {...base} />);
    // 3 of 4 logged days on target → the coach line shows in both branches.
    expect(getByText("3 of 4 days landed on target — nice.")).toBeTruthy();
  });
});
