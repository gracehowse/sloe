/**
 * ENG-1031 parity pins — web chart-swipe paging (Progress dashboard).
 *
 * Mirror of `apps/mobile/tests/unit/progressChartSwipe.test.tsx`. The web swipe
 * accelerator is the `usePeriodSwipe` hook (pure pointer-delta maths, no DOM),
 * consumed by `ProgressDashboard`. This file pins two things so the platforms
 * can't drift:
 *
 *   1. BEHAVIOUR of `usePeriodSwipe` driven directly: the 64px commit
 *      threshold, the right=prev / left=next direction, and the no-future clamp
 *      (a leftward drag is inert on the current period). jsdom PointerEvents
 *      don't carry a meaningful clientX, so direct handler invocation is the
 *      honest unit boundary (same approach as `progressPeriodControl.test.tsx`).
 *   2. WIRING in `ProgressDashboard`: it calls `usePeriodSwipe(period,
 *      setPeriod, 64)` and SPREADS the returned pointer handlers onto the chart
 *      container — i.e. the swipe lane is mounted on the right surface, not just
 *      defined. Regex-source-pin style mirrors the mobile `progress.tsx` pins in
 *      `weightChartSwipePaging.test.ts` (rendering the full dashboard needs the
 *      heavy mock harness; the wiring itself is a structural pin).
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { usePeriodSwipe } from "../../src/app/components/suppr/progress-period-control";
import {
  previousPeriod,
  nextPeriod,
} from "../../src/lib/nutrition/progressPeriod";
import type { ProgressPeriod } from "../../src/lib/nutrition/progressPeriod";

void React;

// The hook reads a ref across down→up, so `useRef` must run inside a render.
// A thin Harness captures the returned handlers (the same boundary the
// `usePeriodSwipe` block in `progressPeriodControl.test.tsx` uses), then we
// drive `onPointerDown`/`onPointerUp` directly — jsdom PointerEvents carry no
// meaningful clientX, so direct invocation is the honest unit boundary.
function makeSwipe(
  period: ProgressPeriod,
  onChange: (p: ProgressPeriod) => void,
  threshold?: number,
) {
  let captured: ReturnType<typeof usePeriodSwipe> | null = null;
  function Harness() {
    captured = usePeriodSwipe(period, onChange, threshold);
    return React.createElement("div", { "data-testid": "swipe-area" });
  }
  render(React.createElement(Harness));
  return captured!;
}
// clientY defaults to 0 so the existing pure-horizontal pins (down/up at the
// same Y) clear the |dx|>|dy| axis guard; diagonal cases pass an explicit Y.
const ptr = (clientX: number, clientY = 0) =>
  ({ clientX, clientY }) as unknown as React.PointerEvent;

describe("usePeriodSwipe (web) — 64px threshold + direction + no-future clamp", () => {
  it("a rightward drag past +64 pages BACK in time (prev)", () => {
    const onChange = vi.fn();
    const h = makeSwipe({ type: "W", offset: 0 }, onChange);
    h.onPointerDown(ptr(100));
    h.onPointerUp(ptr(200)); // dx +100 ≥ 64 → previous (older)
    expect(onChange).toHaveBeenCalledWith(previousPeriod({ type: "W", offset: 0 }));
  });

  it("a leftward drag past -64 on a past period pages FORWARD (next)", () => {
    const onChange = vi.fn();
    const h = makeSwipe({ type: "W", offset: -2 }, onChange);
    h.onPointerDown(ptr(200));
    h.onPointerUp(ptr(100)); // dx -100 ≤ -64, not current → next (newer)
    expect(onChange).toHaveBeenCalledWith(nextPeriod({ type: "W", offset: -2 }));
    expect(onChange).toHaveBeenCalledWith({ type: "W", offset: -1 });
  });

  it("respects the no-future clamp — a leftward drag is inert on the current period", () => {
    const onChange = vi.fn();
    const h = makeSwipe({ type: "W", offset: 0 }, onChange);
    h.onPointerDown(ptr(200));
    h.onPointerUp(ptr(100)); // dx -100, forward, but already current → clamped
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the clamp NEVER blocks paging backwards from the current period", () => {
    const onChange = vi.fn();
    const h = makeSwipe({ type: "W", offset: 0 }, onChange);
    h.onPointerDown(ptr(100));
    h.onPointerUp(ptr(180)); // dx +80 ≥ 64 → prev, allowed even at current
    expect(onChange).toHaveBeenCalledWith({ type: "W", offset: -1 });
  });

  it("a drag short of the 64px threshold does nothing (taps/short drags pass through)", () => {
    const onChange = vi.fn();
    const h = makeSwipe({ type: "W", offset: -1 }, onChange);
    h.onPointerDown(ptr(100));
    h.onPointerUp(ptr(163)); // dx +63 < 64
    expect(onChange).not.toHaveBeenCalled();
    // A near-still tap is also inert.
    h.onPointerDown(ptr(140));
    h.onPointerUp(ptr(140));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("defaults to a 64px threshold when no explicit threshold is passed", () => {
    const onChange = vi.fn();
    const h = makeSwipe({ type: "M", offset: -1 }, onChange); // no threshold arg
    h.onPointerDown(ptr(0));
    h.onPointerUp(ptr(64)); // exactly 64 → commits prev
    expect(onChange).toHaveBeenCalledWith(previousPeriod({ type: "M", offset: -1 }));
  });

  it("AXIS GUARD (mobile parity): a diagonal fling with |dx|<=|dy| does NOT page — vertical-ish scroll wins", () => {
    const onChange = vi.fn();
    const h = makeSwipe({ type: "W", offset: -1 }, onChange);
    h.onPointerDown(ptr(100, 100));
    h.onPointerUp(ptr(200, 300)); // dx +100 (≥64) BUT dy +200 → more vertical → inert
    expect(onChange).not.toHaveBeenCalled();
    // A predominantly-horizontal diagonal still pages.
    h.onPointerDown(ptr(100, 100));
    h.onPointerUp(ptr(280, 140)); // dx +180 > dy +40 → pages prev
    expect(onChange).toHaveBeenCalledWith(previousPeriod({ type: "W", offset: -1 }));
  });

  it("a cancelled/left gesture resets the start so a later pointerup can't misfire", () => {
    const onChange = vi.fn();
    const h = makeSwipe({ type: "W", offset: -1 }, onChange);
    h.onPointerDown(ptr(100));
    h.onPointerCancel(); // gesture aborted — no pointerup
    h.onPointerUp(ptr(300)); // stale start cleared → inert
    expect(onChange).not.toHaveBeenCalled();
    // onPointerLeave resets too.
    h.onPointerDown(ptr(100));
    h.onPointerLeave();
    h.onPointerUp(ptr(300));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ProgressDashboard — wires usePeriodSwipe onto the chart container", () => {
  const REPO_ROOT = resolve(__dirname, "../..");
  const dashboardSrc = readFileSync(
    resolve(REPO_ROOT, "src/app/components/ProgressDashboard.tsx"),
    "utf8",
  );

  it("imports usePeriodSwipe from the period-control module", () => {
    expect(dashboardSrc).toMatch(
      /import\s*\{[\s\S]*\busePeriodSwipe\b[\s\S]*\}\s*from\s*"\.\/suppr\/progress-period-control/,
    );
  });

  it("calls usePeriodSwipe(period, setPeriod, 64) — same period state the chevrons drive, 64px threshold", () => {
    expect(dashboardSrc).toMatch(
      /usePeriodSwipe\(\s*period\s*,\s*setPeriod\s*,\s*64\s*\)/,
    );
  });

  it("spreads the returned pointer handlers onto the daily-calories chart card", () => {
    // The {...periodSwipe} spread must sit on the chart container card, and that
    // card must allow vertical scroll (touch-pan-y) so a vertical drag still
    // scrolls the page — the web analogue of the mobile |dx|>|dy| guard.
    const cardBlock = dashboardSrc.match(
      /<SupprCard[\s\S]*?data-testid="progress-daily-calories-card"[\s\S]*?>/,
    );
    expect(cardBlock).not.toBeNull();
    expect(cardBlock![0]).toContain("{...periodSwipe}");
    expect(cardBlock![0]).toContain("touch-pan-y");
  });
});
