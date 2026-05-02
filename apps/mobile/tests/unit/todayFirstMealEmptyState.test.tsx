// @vitest-environment jsdom
/**
 * TodayFirstMealEmptyState — journey-architect P1 (2026-05-01) close.
 *
 * The Today empty state was previously silent: when a brand-new user
 * landed with zero meals logged, nothing told them what to do next.
 * This component renders a friendly card with a single primary CTA
 * "Log a meal" and (for accounts < 24h old) a dismissable IG/TT tip.
 *
 * Behaviour pinned here:
 *   - 0 logs + brand-new account → card AND tip line render.
 *   - 0 logs + returning account (>= 24h) → card renders, tip hidden.
 *   - Tip dismissal hides the line (regardless of brand-new flag).
 *   - The primary CTA "Log a meal" calls `onLogMeal` exactly once.
 *   - The tip dismiss X calls `onDismissTip` exactly once.
 *
 * The host-side gate (`mealsToday.length === 0 && loggedDays.size === 0`)
 * is exercised at the integration level in
 * `tests/unit/todayFirstMealEmptyStateIntegration.test.ts`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { TodayFirstMealEmptyState } from "../../components/today/TodayFirstMealEmptyState";

void React;

const baseProps = {
  textColor: "#000",
  textSecondaryColor: "#555",
  cardColor: "#fff",
  cardBorderColor: "#e5e5e5",
};

describe("TodayFirstMealEmptyState (mobile)", () => {
  it("renders the canonical headline + primary CTA", () => {
    const { getByText, getByLabelText } = render(
      <TodayFirstMealEmptyState
        {...baseProps}
        isBrandNew={false}
        tipDismissed={false}
        onDismissTip={vi.fn()}
        onLogMeal={vi.fn()}
      />,
    );
    expect(getByText("Ready to log your first meal?")).toBeTruthy();
    expect(getByLabelText("Log a meal")).toBeTruthy();
  });

  it("brand-new + tip not dismissed → tip line renders", () => {
    const { getByText } = render(
      <TodayFirstMealEmptyState
        {...baseProps}
        isBrandNew
        tipDismissed={false}
        onDismissTip={vi.fn()}
        onLogMeal={vi.fn()}
      />,
    );
    expect(
      getByText(
        "Tip: paste an Instagram or TikTok recipe URL — we'll break it down for you.",
      ),
    ).toBeTruthy();
  });

  it("returning account (not brand-new) → tip line hidden", () => {
    const { queryByText } = render(
      <TodayFirstMealEmptyState
        {...baseProps}
        isBrandNew={false}
        tipDismissed={false}
        onDismissTip={vi.fn()}
        onLogMeal={vi.fn()}
      />,
    );
    expect(
      queryByText(
        "Tip: paste an Instagram or TikTok recipe URL — we'll break it down for you.",
      ),
    ).toBeNull();
  });

  it("tip dismissed (even if brand-new) → tip line hidden", () => {
    const { queryByText } = render(
      <TodayFirstMealEmptyState
        {...baseProps}
        isBrandNew
        tipDismissed
        onDismissTip={vi.fn()}
        onLogMeal={vi.fn()}
      />,
    );
    expect(
      queryByText(
        "Tip: paste an Instagram or TikTok recipe URL — we'll break it down for you.",
      ),
    ).toBeNull();
  });

  it("primary CTA calls onLogMeal exactly once", () => {
    const onLogMeal = vi.fn();
    const { getByLabelText } = render(
      <TodayFirstMealEmptyState
        {...baseProps}
        isBrandNew={false}
        tipDismissed={false}
        onDismissTip={vi.fn()}
        onLogMeal={onLogMeal}
      />,
    );
    fireEvent.press(getByLabelText("Log a meal"));
    expect(onLogMeal).toHaveBeenCalledTimes(1);
  });

  it("tip dismiss X calls onDismissTip exactly once", () => {
    const onDismissTip = vi.fn();
    const { getByLabelText } = render(
      <TodayFirstMealEmptyState
        {...baseProps}
        isBrandNew
        tipDismissed={false}
        onDismissTip={onDismissTip}
        onLogMeal={vi.fn()}
      />,
    );
    fireEvent.press(getByLabelText("Dismiss tip"));
    expect(onDismissTip).toHaveBeenCalledTimes(1);
  });
});
