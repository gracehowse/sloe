/**
 * ShoppingList empty-state (prototype rewrite, 2026-04-21).
 *
 * Replaces the previous `<EmptyState />` CTA assertion. The
 * prototype-rewrite of `src/app/components/ShoppingList.tsx` drops
 * the illustrated empty state + "Go to Meal Planner" CTA in favour
 * of a single muted "No items" card (matches `WebShopping` in
 * `docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`).
 *
 * `useAppData` is mocked so this test doesn't need the full
 * AppDataContext provider.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

type MockAppData = {
  shoppingItems: unknown[];
  toggleShoppingChecked: () => void;
};

const appDataState: { current: MockAppData } = {
  current: {
    shoppingItems: [],
    toggleShoppingChecked: vi.fn(),
  },
};

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => appDataState.current,
}));

import { ShoppingList } from "../../src/app/components/ShoppingList";

describe("ShoppingList empty-state (prototype rewrite)", () => {
  it("renders the empty-state card when shoppingItems is empty", () => {
    appDataState.current = {
      ...appDataState.current,
      shoppingItems: [],
    };
    render(<ShoppingList userTier="free" />);
    expect(screen.getByText(/shopping list builds itself/i)).toBeInTheDocument();
  });

  it("does NOT render the legacy illustrated empty state or the 'Go to Meal Planner' CTA", () => {
    appDataState.current = {
      ...appDataState.current,
      shoppingItems: [],
    };
    render(<ShoppingList userTier="free" />);
    expect(
      screen.queryByText(/Your shopping list is empty/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Go to Meal Planner/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the 'No items' card when shoppingItems is non-empty", () => {
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
    expect(screen.queryByText(/shopping list builds itself/i)).not.toBeInTheDocument();
  });
});
