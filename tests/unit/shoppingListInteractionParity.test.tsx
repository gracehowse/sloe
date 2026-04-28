/**
 * F3 hybrid (audit 2026-04-28) — pin the lifecycle interactions
 * the web shopping list ported from mobile.
 *
 * Companion to `shoppingListPrototypePort.test.tsx`, which keeps
 * the structural prototype-strip assertions (no breadcrumb, no
 * export menu, etc.). This file covers the F3 behaviours:
 *
 *   - Per-row X to remove a single item
 *   - "Remove N checked" link, only when ≥1 row is checked
 *   - Slim progress bar with `role="progressbar"` + `aria-valuenow`
 *
 * Decision context: `docs/decisions/2026-04-28-shopping-list-web-parity-hybrid.md`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

void React;

type ShoppingItem = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  from: string;
};

type MockAppData = {
  shoppingItems: ShoppingItem[];
  toggleShoppingChecked: (id: string) => void;
  removeShoppingItem: (id: string) => void;
  setShoppingItems: (next: unknown) => void;
};

const appDataState: { current: MockAppData } = {
  current: {
    shoppingItems: [],
    toggleShoppingChecked: vi.fn(),
    removeShoppingItem: vi.fn(),
    setShoppingItems: vi.fn(),
  },
};

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => appDataState.current,
}));

import { ShoppingList } from "../../src/app/components/ShoppingList";

const items: ShoppingItem[] = [
  { id: "p1", name: "Broccoli", amount: "2", unit: "heads", category: "Produce", checked: false, from: "Plan" },
  { id: "p2", name: "Red pepper", amount: "3", unit: "", category: "Produce", checked: true, from: "Plan" },
  { id: "r1", name: "Chicken thighs", amount: "800", unit: "g", category: "Protein", checked: true, from: "Plan" },
  { id: "r2", name: "Greek yogurt", amount: "1", unit: "kg", category: "Protein", checked: false, from: "Plan" },
  { id: "pa1", name: "Jasmine rice", amount: "500", unit: "g", category: "Pantry", checked: false, from: "Plan" },
];

function seed(overrides: Partial<MockAppData> = {}) {
  appDataState.current = {
    shoppingItems: items,
    toggleShoppingChecked: vi.fn(),
    removeShoppingItem: vi.fn(),
    setShoppingItems: vi.fn(),
    ...overrides,
  };
}

describe("ShoppingList — F3 interaction parity (2026-04-28)", () => {
  it("renders the slim progress bar with role=progressbar and correct aria values", () => {
    seed();
    render(<ShoppingList userTier="free" />);
    const bar = screen.getByTestId("shopping-progress-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("role", "progressbar");
    // 2 of 5 unique groups checked (Red pepper, Chicken thighs).
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
  });

  it("renders the 'Remove N checked' link only when ≥1 row is checked", () => {
    seed();
    render(<ShoppingList userTier="free" />);
    const link = screen.getByTestId("shopping-clear-checked");
    expect(link).toHaveTextContent(/Remove 2 checked/i);
  });

  it("hides the 'Remove N checked' link when no row is checked", () => {
    seed({ shoppingItems: items.map((it) => ({ ...it, checked: false })) });
    render(<ShoppingList userTier="free" />);
    expect(screen.queryByTestId("shopping-clear-checked")).toBeNull();
  });

  it("'Remove N checked' link calls setShoppingItems with the unchecked filter", () => {
    const setShoppingItems = vi.fn();
    seed({ setShoppingItems });
    render(<ShoppingList userTier="free" />);
    fireEvent.click(screen.getByTestId("shopping-clear-checked"));
    expect(setShoppingItems).toHaveBeenCalledTimes(1);
    // Apply the functional updater to verify it filters checked rows.
    const updater = setShoppingItems.mock.calls[0][0] as (
      prev: ShoppingItem[],
    ) => ShoppingItem[];
    const next = updater(items);
    expect(next).toHaveLength(3);
    expect(next.every((it) => !it.checked)).toBe(true);
  });

  it("per-row remove button calls removeShoppingItem for every item in the group", () => {
    const removeShoppingItem = vi.fn();
    seed({ removeShoppingItem });
    render(<ShoppingList userTier="free" />);
    // Find the row remove for Broccoli (single-item group, key starts with the ingredient name).
    const removeBtn = screen.getByLabelText(/Remove Broccoli/i);
    fireEvent.click(removeBtn);
    expect(removeShoppingItem).toHaveBeenCalledWith("p1");
  });

  it("hides the progress bar entirely when the list is empty", () => {
    seed({ shoppingItems: [] });
    render(<ShoppingList userTier="free" />);
    expect(screen.queryByTestId("shopping-progress-bar")).toBeNull();
    expect(screen.queryByTestId("shopping-clear-checked")).toBeNull();
  });

  it("does NOT render share / clear-all / export affordances (deferred per F3 verdict)", () => {
    seed();
    render(<ShoppingList userTier="free" />);
    expect(screen.queryByRole("button", { name: /Share/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Clear all/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Export/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Print/i })).toBeNull();
  });
});
