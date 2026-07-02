// @vitest-environment jsdom
/**
 * Web `<DayStrip>` — pager stride at narrow (mobile-web) widths (ENG-1291).
 *
 * The pager write (`scrollToWeekIndex`) and read-back (`handleScrollEnd`)
 * previously both assumed one week panel == the measured scroller viewport
 * width (`pagerW`). When the real panel width disagrees by even a few px,
 * the error compounds across ~160 week panels and the strip lands whole
 * weeks away from the selected day. The fix derives the TRUE stride from
 * `scrollWidth / panelCount` in BOTH paths.
 *
 * This test mocks a narrow viewport where panel width (342) != measured
 * viewport width (349) and pins:
 *   - the align scroll targets `weekIdx * 342` (true stride), not
 *     `weekIdx * 349` (viewport assumption);
 *   - a user scroll settling at `(weekIdx - 1) * 342` reads back as the
 *     PREVIOUS week and moves the selection exactly 7 days back.
 */
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

import { DayStrip } from "../../src/app/components/DayStrip";
import {
  addDaysLocal,
  dateKeyFromDate,
  dayIndexInWeek,
  enumerateWeekStartsInJournalRange,
} from "../../src/lib/nutrition/journalNavigation.ts";

void React;

const PANEL_W = 342; // true laid-out panel width
const VIEWPORT_W = 349; // measured scroller viewport width (disagrees)

// ResizeObserver stub that captures callbacks so the test can fire the
// pager-width measurement after mocking `clientWidth` on the observed row.
const roObservers: Array<{ cb: ResizeObserverCallback; el: Element }> = [];
class ResizeObserverStub {
  private readonly cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(el: Element) {
    roObservers.push({ cb: this.cb, el });
  }
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  ResizeObserverStub;

/** The component's own weekIdx derivation, replicated for expectations. */
function expectedWeekIdx(selected: Date): number {
  const weekStarts = enumerateWeekStartsInJournalRange("monday");
  const selectedKey = dateKeyFromDate(selected);
  for (let i = 0; i < weekStarts.length; i++) {
    const startK = dateKeyFromDate(weekStarts[i]!);
    const endK = dateKeyFromDate(addDaysLocal(weekStarts[i]!, 6));
    if (selectedKey >= startK && selectedKey <= endK) return i;
  }
  return 0;
}

function setupNarrowPager(onSelectDateKey = vi.fn()) {
  const today = new Date();
  const { container } = render(
    <DayStrip
      selectedDateKey={dateKeyFromDate(today)}
      weekStartDay="monday"
      loggedDays={new Set<string>()}
      onSelectDateKey={onSelectDateKey}
      onOpenCalendar={vi.fn()}
    />,
  );
  const scroller = container.querySelector<HTMLDivElement>(
    'div[class*="overflow-x-auto"]',
  );
  expect(scroller).not.toBeNull();
  const row = scroller!.parentElement as HTMLDivElement;
  const panelCount = scroller!.children.length;
  expect(panelCount).toBeGreaterThan(100); // ~3y back + 30d forward of weeks

  // Narrow viewport: measured width 349, but the panels really lay out
  // at 342 each (scrollWidth = panels * 342).
  Object.defineProperty(row, "clientWidth", {
    value: VIEWPORT_W,
    configurable: true,
  });
  Object.defineProperty(scroller!, "scrollWidth", {
    value: PANEL_W * panelCount,
    configurable: true,
  });
  const scrollTo = vi.fn();
  (scroller as unknown as { scrollTo: unknown }).scrollTo = scrollTo;

  // Fire the ResizeObserver measurement -> setPagerW(349) -> align effect.
  act(() => {
    for (const { cb, el } of roObservers) {
      cb([] as unknown as ResizeObserverEntry[], undefined as never);
      void el;
    }
  });

  return { container, scroller: scroller!, scrollTo, today, onSelectDateKey };
}

describe("web DayStrip — pager stride at narrow widths (ENG-1291)", () => {
  beforeEach(() => {
    roObservers.length = 0;
  });

  it("align scroll uses the true panel stride, not the viewport width", () => {
    const { scrollTo, today } = setupNarrowPager();
    const weekIdx = expectedWeekIdx(today);

    expect(scrollTo).toHaveBeenCalled();
    const lastCall = scrollTo.mock.calls.at(-1)![0] as { left: number };
    expect(lastCall.left).toBe(weekIdx * PANEL_W);
    // Regression pin: the old viewport-stride write would land whole
    // weeks away (>= one panel off) at this panel count.
    expect(Math.abs(weekIdx * VIEWPORT_W - lastCall.left)).toBeGreaterThan(
      PANEL_W,
    );
  });

  it("user-scroll read-back maps the settle position with the same stride", () => {
    const onSelectDateKey = vi.fn();
    const { scroller, today } = setupNarrowPager(onSelectDateKey);
    const weekIdx = expectedWeekIdx(today);

    // The user swipes one week back: the scroller settles exactly on the
    // previous panel boundary in TRUE stride terms.
    scroller.scrollLeft = (weekIdx - 1) * PANEL_W;
    act(() => {
      scroller.dispatchEvent(new Event("pointerdown"));
      scroller.dispatchEvent(new Event("scrollend"));
    });

    const col = dayIndexInWeek(today, "monday");
    void col; // same column, previous week == exactly 7 days back
    expect(onSelectDateKey).toHaveBeenCalledTimes(1);
    expect(onSelectDateKey).toHaveBeenCalledWith(
      dateKeyFromDate(addDaysLocal(today, -7)),
    );
  });

  it("read-back keeps the selection when the pager settles on the same week", () => {
    const onSelectDateKey = vi.fn();
    const { scroller, today } = setupNarrowPager(onSelectDateKey);
    const weekIdx = expectedWeekIdx(today);

    scroller.scrollLeft = weekIdx * PANEL_W;
    act(() => {
      scroller.dispatchEvent(new Event("pointerdown"));
      scroller.dispatchEvent(new Event("scrollend"));
    });

    // Same week -> same date -> no selection write.
    expect(onSelectDateKey).not.toHaveBeenCalled();
  });
});
