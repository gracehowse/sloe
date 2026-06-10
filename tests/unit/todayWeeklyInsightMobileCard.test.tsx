// @vitest-environment jsdom
/**
 * TodayWeeklyInsightMobileCard (web) — below-meals weekly insight on
 * mobile-web; parity with `apps/mobile/components/today/WeeklyInsightCard.tsx`.
 *
 * §3 de-card (web parity 2026-06-10, ENG-1022): the card was a soft
 * `SupprCard` slab carrying the cross-screen insight lilac
 * (`PROGRESS_INSIGHT_LILAC_STYLE`). On the inverted §1 material (cream ground /
 * white cards) the filled lilac slab read as the odd muddy box between the
 * white gallery cards — the same finding that drove the mobile de-card. Both
 * branches now render a card-less typographic callout sitting directly on the
 * page ground: an uppercase eyebrow row (TrendingUp + "WEEKLY INSIGHT" in
 * `text-primary-solid`) + a prose line in `text-muted-foreground`.
 *
 * Pinned here (both flag branches):
 *   1. No card chrome — the host is not a `.card-slab` / `data-soft-elevation`
 *      node, and it carries no `--slot-dinner-soft` lilac background.
 *   2. The eyebrow reads "Weekly insight" in the primary-solid accent.
 *   3. The wired derived prose still renders (the de-chrome is presentation-
 *      only — every figure stays derived from log data).
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

/** The de-carded callout host node — both branches set `data-testid`. */
function insightCallout(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(
    '[data-testid="today-weekly-insight-mobile"]',
  );
  if (!el) throw new Error("insight callout not rendered");
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
  it("renders a card-less typographic callout, never the old lilac slab", () => {
    flagMock.mockImplementation(impl);
    const { container } = render(<TodayWeeklyInsightMobileCard {...base} />);
    const callout = insightCallout(container);
    // §3 de-card: the callout sits on the page ground — no card elevation,
    // no lilac wash. The deleted carded treatment must not come back.
    expect(callout.className).not.toContain("card-slab");
    expect(callout).not.toHaveAttribute("data-soft-elevation");
    expect(callout.style.background).not.toContain("--slot-dinner-soft");
    // Mobile-web only — the desktop right rail owns the insight on `md+`.
    expect(callout.className).toContain("md:hidden");
  });

  it("renders the primary-solid 'Weekly insight' eyebrow", () => {
    flagMock.mockImplementation(impl);
    const { getByText } = render(<TodayWeeklyInsightMobileCard {...base} />);
    const eyebrow = getByText("Weekly insight");
    expect(eyebrow.className).toContain("text-primary-solid");
    expect(eyebrow.className).toContain("uppercase");
  });

  it("renders the wired derived prose", () => {
    flagMock.mockImplementation(impl);
    const { getByText } = render(<TodayWeeklyInsightMobileCard {...base} />);
    // 3 of 4 logged days on target → the coach line is the prose body.
    expect(getByText("3 of 4 days landed on target — nice.")).toBeTruthy();
  });
});
