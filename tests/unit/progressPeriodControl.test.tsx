/**
 * ProgressPeriodControl (web) — Apple Health range grammar (ENG-1030).
 *
 * Mirror of `apps/mobile/tests/unit/progressPeriodControl.test.tsx`. Both
 * surfaces share the `progressPeriod.ts` helper (pinned exhaustively in
 * `tests/unit/progressPeriod.test.ts`), so this file pins the web wiring +
 * the keyboard a11y the mobile surface gets for free from native controls.
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  ProgressPeriodControl,
  usePeriodSwipe,
} from "../../src/app/components/suppr/progress-period-control";
import { previousPeriod } from "../../src/lib/nutrition/progressPeriod";
import type { ProgressPeriod } from "../../src/lib/nutrition/progressPeriod";

// Wed 10 Jun 2026 — fixed clock so labels are deterministic.
const NOW = new Date(2026, 5, 10, 14, 30, 0);

function renderControl(period: ProgressPeriod, onChange = vi.fn()) {
  render(
    <ProgressPeriodControl
      period={period}
      weekStart="monday"
      onChange={onChange}
      now={NOW}
    />,
  );
  return { onChange };
}

describe("ProgressPeriodControl (web)", () => {
  it("renders all five segments and the period label", () => {
    renderControl({ type: "W", offset: 0 });
    for (const seg of ["D", "W", "M", "6M", "Y"]) {
      expect(screen.getByTestId(`progress-period-segment-${seg}`)).toBeTruthy();
    }
    expect(screen.getByTestId("progress-period-label").textContent).toBe("8–14 Jun");
  });

  it("clicking a segment switches type and resets to the current period", () => {
    const { onChange } = renderControl({ type: "W", offset: -3 });
    fireEvent.click(screen.getByTestId("progress-period-segment-M"));
    expect(onChange).toHaveBeenCalledWith({ type: "M", offset: 0 });
  });

  it("the active segment is aria-selected with a focusable tabIndex", () => {
    renderControl({ type: "M", offset: 0 });
    const active = screen.getByTestId("progress-period-segment-M");
    expect(active.getAttribute("aria-selected")).toBe("true");
    expect(active.getAttribute("tabindex")).toBe("0");
    const inactive = screen.getByTestId("progress-period-segment-W");
    expect(inactive.getAttribute("aria-selected")).toBe("false");
    expect(inactive.getAttribute("tabindex")).toBe("-1");
  });

  it("arrow keys move the segment selection (a11y parity with mobile)", () => {
    const { onChange } = renderControl({ type: "W", offset: -2 });
    fireEvent.keyDown(screen.getByTestId("progress-period-segments"), { key: "ArrowRight" });
    // W → M, reset to current.
    expect(onChange).toHaveBeenCalledWith({ type: "M", offset: 0 });
  });

  it("the prev chevron pages one period back", () => {
    const { onChange } = renderControl({ type: "W", offset: 0 });
    fireEvent.click(screen.getByTestId("progress-period-prev"));
    expect(onChange).toHaveBeenCalledWith({ type: "W", offset: -1 });
  });

  it("the next chevron pages forward when not at the present", () => {
    const { onChange } = renderControl({ type: "W", offset: -2 });
    fireEvent.click(screen.getByTestId("progress-period-next"));
    expect(onChange).toHaveBeenCalledWith({ type: "W", offset: -1 });
  });

  it("the next chevron is disabled on the current period (no future)", () => {
    const { onChange } = renderControl({ type: "W", offset: 0 });
    const next = screen.getByTestId("progress-period-next") as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(next);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the label updates for a past period", () => {
    renderControl({ type: "M", offset: -1 });
    expect(screen.getByTestId("progress-period-label").textContent).toBe("May 2026");
  });
});

describe("usePeriodSwipe (web optional accelerator)", () => {
  // The handler factory is pure (no DOM), so we drive its handlers directly
  // with the fields they read (`clientX` + `clientY`). jsdom's synthetic
  // PointerEvent doesn't carry meaningful coords, so DOM dispatch can't
  // exercise the delta maths — direct invocation is the honest unit boundary.
  // clientY defaults to 0 so these pure-horizontal drags clear the |dx|>|dy|
  // axis guard added in ENG-1031.
  let captured: ReturnType<typeof usePeriodSwipe> | null = null;
  function Harness({ period, onChange }: { period: ProgressPeriod; onChange: (p: ProgressPeriod) => void }) {
    captured = usePeriodSwipe(period, onChange);
    return <div data-testid="swipe-area" />;
  }
  const ptr = (clientX: number, clientY = 0) =>
    ({ clientX, clientY }) as unknown as React.PointerEvent;

  it("a rightward drag pages back in time", () => {
    const onChange = vi.fn();
    render(<Harness period={{ type: "W", offset: 0 }} onChange={onChange} />);
    captured!.onPointerDown(ptr(100));
    captured!.onPointerUp(ptr(200)); // dx +100 > threshold → back in time
    expect(onChange).toHaveBeenCalledWith(previousPeriod({ type: "W", offset: 0 }));
  });

  it("a leftward drag at the present is clamped (no future)", () => {
    const onChange = vi.fn();
    render(<Harness period={{ type: "W", offset: 0 }} onChange={onChange} />);
    captured!.onPointerDown(ptr(200));
    captured!.onPointerUp(ptr(100)); // dx -100, forward, but already current
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a leftward drag on a past period pages forward", () => {
    const onChange = vi.fn();
    render(<Harness period={{ type: "W", offset: -2 }} onChange={onChange} />);
    captured!.onPointerDown(ptr(200));
    captured!.onPointerUp(ptr(100)); // dx -100, forward → offset -1
    expect(onChange).toHaveBeenCalledWith({ type: "W", offset: -1 });
  });

  it("a drag under the threshold does nothing", () => {
    const onChange = vi.fn();
    render(<Harness period={{ type: "W", offset: -1 }} onChange={onChange} />);
    captured!.onPointerDown(ptr(100));
    captured!.onPointerUp(ptr(130)); // dx +30 < 64
    expect(onChange).not.toHaveBeenCalled();
  });
});
