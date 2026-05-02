/**
 * WhyThisNumberDialog (web) — pin the "why is my target X kcal?"
 * dialog rendering + Adjust target CTA.
 *
 * Mirrors `apps/mobile/tests/unit/whyThisNumberSheet.test.tsx`. The two
 * surfaces share the same `buildWhyThisNumber` helper so any copy /
 * math drift fails the helper's own test (`whyThisNumber.test.ts`)
 * before reaching either component test.
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { WhyThisNumberDialog } from "../../src/app/components/suppr/why-this-number-dialog";

const BASE_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  targetCalories: 1800,
  maintenanceTdee: 2150,
  confidence: "medium" as const,
  loggingDays: 21,
  goal: "lose" as const,
  paceKgPerWeek: -0.5,
};

describe("WhyThisNumberDialog (web)", () => {
  it("renders the target headline", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.getByTestId("why-this-number-target-headline").textContent).toBe(
      "Today's target: 1,800 kcal",
    );
  });

  it("renders three breakdown rows in canonical order", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.getByTestId("why-this-number-line-tdee")).toBeTruthy();
    expect(screen.getByTestId("why-this-number-line-goal")).toBeTruthy();
    expect(screen.getByTestId("why-this-number-line-result")).toBeTruthy();
  });

  it("renders the canonical row content", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.getByTestId("why-this-number-line-tdee").textContent).toContain(
      "2,150 kcal (adaptive, last 7 days)",
    );
    expect(screen.getByTestId("why-this-number-line-goal").textContent).toContain(
      "Lose 0.5 kg/wk",
    );
    expect(screen.getByTestId("why-this-number-line-result").textContent).toContain(
      "−350 kcal/day deficit",
    );
  });

  it("renders 'Adjust target' CTA when onAdjustTarget is provided", () => {
    const onAdjustTarget = vi.fn();
    render(<WhyThisNumberDialog {...BASE_PROPS} onAdjustTarget={onAdjustTarget} />);
    expect(screen.getByTestId("why-this-number-adjust-target")).toBeTruthy();
  });

  it("hides 'Adjust target' CTA when onAdjustTarget is omitted", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} />);
    expect(screen.queryByTestId("why-this-number-adjust-target")).toBeNull();
  });

  it("Adjust target click closes dialog AND fires handler", () => {
    const onOpenChange = vi.fn();
    const onAdjustTarget = vi.fn();
    render(
      <WhyThisNumberDialog
        {...BASE_PROPS}
        onOpenChange={onOpenChange}
        onAdjustTarget={onAdjustTarget}
      />,
    );
    fireEvent.click(screen.getByTestId("why-this-number-adjust-target"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onAdjustTarget).toHaveBeenCalledTimes(1);
  });

  it("does not render dialog body when open=false", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} open={false} />);
    expect(screen.queryByTestId("why-this-number-target-headline")).toBeNull();
  });

  it("renders early-estimate qualifier when loggingDays < 14", () => {
    render(<WhyThisNumberDialog {...BASE_PROPS} loggingDays={5} />);
    expect(screen.getByText(/Early estimate/)).toBeTruthy();
  });

  it("renders calibrating copy when no maintenance estimate exists", () => {
    render(
      <WhyThisNumberDialog
        {...BASE_PROPS}
        maintenanceTdee={null}
        confidence={null}
        loggingDays={3}
      />,
    );
    expect(screen.getByText("calibrating — keep logging")).toBeTruthy();
  });
});
