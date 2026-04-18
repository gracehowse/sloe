/**
 * ShoppingList empty-state migration test (audit R1, 2026-04-18).
 *
 * Verifies that `src/app/components/ShoppingList.tsx` renders the shared
 * `<EmptyState />` primitive from `src/app/components/suppr/empty-state.tsx`
 * when no shopping items exist — not the deleted legacy
 * `src/app/components/EmptyState.tsx`.
 *
 * Behaviour under test:
 *  - Title + description strings appear (unchanged vs pre-migration).
 *  - The action slot renders as a button labelled "Go to Meal Planner".
 *  - Clicking the action fires `empty_state_cta_clicked` with the legacy
 *    payload shape `{ title, ctaLabel }` (analytics parity preserved).
 *  - Clicking the action calls `onNavigate("planner")`.
 *  - When shoppingItems is non-empty, the empty state is NOT rendered.
 *
 * The `useAppData` hook is mocked so this test doesn't need the full
 * AppDataContext provider (which pulls Supabase + NotificationContext +
 * many other dependencies).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// React import keeps the JSX runtime happy under vitest/jsdom (parity
// with tests/unit/emptyState.test.tsx).
void React;

type MockAppData = {
  shoppingItems: unknown[];
  toggleShoppingChecked: () => void;
  removeShoppingItem: () => void;
  addShoppingItem: () => void;
  generateShoppingListFromPlan: () => Promise<void>;
  shoppingListOutOfSync: boolean;
  savedRecipesForLibrary: unknown[];
};

const appDataState: { current: MockAppData } = {
  current: {
    shoppingItems: [],
    toggleShoppingChecked: vi.fn(),
    removeShoppingItem: vi.fn(),
    addShoppingItem: vi.fn(),
    generateShoppingListFromPlan: vi.fn(() => Promise.resolve()),
    shoppingListOutOfSync: false,
    savedRecipesForLibrary: [],
  },
};

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => appDataState.current,
}));

const trackCalls: Array<{ event: string; payload?: Record<string, unknown> }> = [];

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: (event: string, payload?: Record<string, unknown>) => {
    trackCalls.push({ event, payload });
  },
}));

vi.mock("sonner", () => ({
  toast: {
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { ShoppingList } from "../../src/app/components/ShoppingList";

describe("ShoppingList empty-state (audit R1)", () => {
  it("renders the shared EmptyState primitive with title + description + action when shoppingItems is empty", () => {
    appDataState.current = {
      ...appDataState.current,
      shoppingItems: [],
    };

    render(<ShoppingList userTier="free" />);

    expect(
      screen.getByText("Your shopping list is empty"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Generate a meal plan first/i),
    ).toBeInTheDocument();

    // The CTA now renders as a real <button> from the shared primitive's
    // action slot. The legacy implementation rendered a bespoke inline
    // button — this is the load-bearing migration we're pinning.
    expect(
      screen.getByRole("button", { name: /Go to Meal Planner/i }),
    ).toBeInTheDocument();
  });

  it("fires empty_state_cta_clicked + calls onNavigate('planner') when the action is clicked", () => {
    trackCalls.length = 0;
    const onNavigate = vi.fn();

    appDataState.current = {
      ...appDataState.current,
      shoppingItems: [],
    };

    render(<ShoppingList userTier="free" onNavigate={onNavigate} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Go to Meal Planner/i }),
    );

    const ctaFire = trackCalls.find(
      (c) => c.event === "empty_state_cta_clicked",
    );
    expect(ctaFire).toBeDefined();
    expect(ctaFire?.payload).toEqual({
      title: "Your shopping list is empty",
      ctaLabel: "Go to Meal Planner",
    });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("planner");
  });

  it("does NOT render the empty state when shoppingItems is non-empty", () => {
    appDataState.current = {
      ...appDataState.current,
      shoppingItems: [
        {
          id: "s1",
          name: "Eggs",
          amount: "6",
          unit: "each",
          category: "Protein",
          checked: false,
          from: "Custom",
        },
      ],
    };

    render(<ShoppingList userTier="free" />);

    expect(
      screen.queryByText("Your shopping list is empty"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Go to Meal Planner/i }),
    ).not.toBeInTheDocument();
  });
});
