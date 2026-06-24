// @vitest-environment jsdom
/**
 * Web `<DayStrip>` — v3 prototype selected-cell indicator (ENG-1247,
 * 2026-06-24). Web twin of `apps/mobile/tests/unit/dayStripMinimalIndicator`.
 *
 * The v3 prototype `.day-cell.is-sel` fills the whole selected cell with plum
 * (`bg-primary`) and inverts its day-letter / date / dot to white
 * (`text-primary-foreground`). This supersedes the 2026-06-10 soft-tint pill.
 * Web + mobile share the `dayStripIndicator` decision so the two platforms
 * can't drift. This test pins the rendered web result:
 *   - the minimal dot test-ids are present
 *   - the SELECTED day tile carries the solid plum fill + white number
 *   - a logged non-selected day renders a sage dot
 *   - the week chevrons (prototype `.day-nav`) are present
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

describe("web DayStrip — v3 selected-cell indicator", () => {
  it("renders minimal dot test-ids (the redesigned path is live)", () => {
    const { container } = renderStrip();
    const dots = container.querySelectorAll('[data-testid^="daystrip-dot-minimal-"]');
    expect(dots.length).toBeGreaterThan(0);
  });

  it("fills the SELECTED day cell with plum + a white number (v3 `.is-sel`)", () => {
    const { container } = renderStrip();
    // The selected (today) day tile is the one cell carrying the solid plum
    // fill (`bg-primary` without the `-soft` suffix) + the white on-accent
    // number (`text-primary-foreground`).
    const filled = Array.from(container.querySelectorAll("button")).filter(
      (b) =>
        /\bbg-primary\b/.test(b.className) &&
        !b.className.includes("bg-primary-soft"),
    );
    expect(filled.length).toBe(1);
    expect(filled[0]!.innerHTML).toContain("text-primary-foreground");
    // the retired soft-tint pill must not return
    expect(container.innerHTML).not.toContain("bg-primary-soft");
  });

  it("today (selected) renders no status dot — the fill carries selection", () => {
    const { container } = renderStrip();
    const none = container.querySelectorAll('[data-testid="daystrip-dot-minimal-none"]');
    expect(none.length).toBeGreaterThanOrEqual(1);
  });

  it("a logged non-selected day renders a sage dot, not a check icon", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { container } = renderStrip({ loggedKeys: [dateKeyFromDate(yesterday)] });
    const sage = container.querySelectorAll('[data-testid="daystrip-dot-minimal-sage"]');
    expect(sage.length).toBeGreaterThanOrEqual(1);
  });

  it("exposes the week chevrons (prototype `.day-nav`)", () => {
    const { container } = renderStrip();
    expect(container.querySelector('button[aria-label="Previous week"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Next week"]')).not.toBeNull();
  });
});
