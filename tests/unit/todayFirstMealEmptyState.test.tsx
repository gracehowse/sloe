import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TodayFirstMealEmptyState } from "../../src/app/components/suppr/today-first-meal-empty-state";

void React;

/**
 * TodayFirstMealEmptyState (web) — journey-architect P1 (2026-05-01) close.
 *
 * Mobile parity: `apps/mobile/components/today/TodayFirstMealEmptyState.tsx`
 * (smoke-rendered in `apps/mobile/tests/unit/todayFirstMealEmptyState.test.tsx`).
 *
 * Behaviour pinned here:
 *   - 0 logs + brand-new account → card AND tip line render.
 *   - 0 logs + returning account → card renders, tip hidden.
 *   - Tip dismissed → tip line hidden even on brand-new.
 *   - CTA + tip dismiss invocations route to host callbacks.
 */

describe("TodayFirstMealEmptyState (web)", () => {
  it("renders the canonical headline + Log a meal CTA", () => {
    render(
      <TodayFirstMealEmptyState
        isBrandNew={false}
        tipDismissed={false}
        onDismissTip={vi.fn()}
        onLogMeal={vi.fn()}
      />,
    );
    expect(screen.getByText("Ready to log your first meal?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log a meal" })).toBeInTheDocument();
  });

  it("brand-new + tip not dismissed → tip line renders", () => {
    render(
      <TodayFirstMealEmptyState
        isBrandNew
        tipDismissed={false}
        onDismissTip={vi.fn()}
        onLogMeal={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/paste an Instagram or TikTok recipe URL/i),
    ).toBeInTheDocument();
  });

  it("returning account (not brand-new) → tip line hidden", () => {
    render(
      <TodayFirstMealEmptyState
        isBrandNew={false}
        tipDismissed={false}
        onDismissTip={vi.fn()}
        onLogMeal={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/paste an Instagram or TikTok recipe URL/i),
    ).toBeNull();
  });

  it("tip dismissed (even if brand-new) → tip line hidden", () => {
    render(
      <TodayFirstMealEmptyState
        isBrandNew
        tipDismissed
        onDismissTip={vi.fn()}
        onLogMeal={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/paste an Instagram or TikTok recipe URL/i),
    ).toBeNull();
  });

  it("CTA click invokes onLogMeal exactly once", () => {
    const onLogMeal = vi.fn();
    render(
      <TodayFirstMealEmptyState
        isBrandNew={false}
        tipDismissed={false}
        onDismissTip={vi.fn()}
        onLogMeal={onLogMeal}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Log a meal" }));
    expect(onLogMeal).toHaveBeenCalledTimes(1);
  });

  it("tip dismiss X invokes onDismissTip exactly once", () => {
    const onDismissTip = vi.fn();
    render(
      <TodayFirstMealEmptyState
        isBrandNew
        tipDismissed={false}
        onDismissTip={onDismissTip}
        onLogMeal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss tip" }));
    expect(onDismissTip).toHaveBeenCalledTimes(1);
  });
});
