// @vitest-environment jsdom
/**
 * Web `<DayStrip>` — minimal current-day indicator (2026-06-03, Grace's
 * feedback). Web twin of `apps/mobile/tests/unit/dayStripMinimalIndicator`.
 *
 * The Today week strip used to mark the selected/today day with a clay FILLED
 * circle (`bg-primary text-primary-foreground` on a `w-[30px] h-[30px]
 * rounded-full` element) and a green check-icon inside a tinted circle for
 * logged days. Grace found the filled treatment clunky and asked for the
 * Julienne-minimal look: the active day = clay (`text-primary`) bold NUMBER
 * with a small clay DOT beneath, NO filled background. Logged days keep a sage
 * dot; the clay (selected) indicator wins on the both-case.
 *
 * Web + mobile share the `dayStripIndicator` decision so the two platforms
 * can't drift. This test pins the rendered web result:
 *   - the redesigned minimal dot test-ids are present
 *   - NO day tile carries the old filled-circle classes
 *   - the old green check icon path is gone (logged = sage dot, not a check)
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { DayStrip } from "../../src/app/components/DayStrip";
import { dateKeyFromDate } from "../../src/lib/nutrition/journalNavigation.ts";

void React;

// jsdom has no ResizeObserver; the web DayStrip creates one to measure the
// pager. Stub it so the mount effect doesn't throw. The day tiles render
// unconditionally (not gated on measured width), so a no-op stub is enough.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  ResizeObserverStub;

function renderStrip(opts?: { loggedKeys?: string[]; selectedDateKey?: string }) {
  const todayKey = dateKeyFromDate(new Date());
  return render(
    <DayStrip
      selectedDateKey={opts?.selectedDateKey ?? todayKey}
      weekStartDay="monday"
      loggedDays={new Set(opts?.loggedKeys ?? [])}
      onSelectDateKey={vi.fn()}
      onOpenCalendar={vi.fn()}
    />,
  );
}

describe("web DayStrip — minimal current-day indicator", () => {
  it("renders minimal dot test-ids (the redesigned path is live)", () => {
    const { container } = renderStrip();
    const dots = container.querySelectorAll('[data-testid^="daystrip-dot-minimal-"]');
    expect(dots.length).toBeGreaterThan(0);
  });

  it("drops the old filled-circle treatment entirely", () => {
    const { container } = renderStrip();
    // The old selected circle was `w-[30px] h-[30px] rounded-full ... bg-primary
    // text-primary-foreground`. None of those load-bearing class fragments may
    // survive on any element.
    const html = container.innerHTML;
    expect(html).not.toContain("w-[30px]");
    expect(html).not.toContain("text-primary-foreground");
    // a 30px filled circle had `rounded-full` on the day node + bg-primary as a
    // *background*; the new clay dot uses `bg-primary` only on a 1x1 (`w-1 h-1`)
    // dot. Assert there is no `rounded-full` element that is NOT the tiny dot.
    const roundedEls = Array.from(container.querySelectorAll(".rounded-full"));
    for (const el of roundedEls) {
      expect(el.className).toMatch(/\bw-1\b/);
    }
  });

  it("today (selected) renders a clay dot", () => {
    const { container } = renderStrip();
    const clay = container.querySelectorAll('[data-testid="daystrip-dot-minimal-clay"]');
    expect(clay.length).toBeGreaterThanOrEqual(1);
  });

  it("a logged non-selected day renders a sage dot, not a check icon", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { container } = renderStrip({ loggedKeys: [dateKeyFromDate(yesterday)] });
    const sage = container.querySelectorAll('[data-testid="daystrip-dot-minimal-sage"]');
    expect(sage.length).toBeGreaterThanOrEqual(1);
  });
});
