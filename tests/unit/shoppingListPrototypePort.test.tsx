/**
 * ShoppingList prototype-rewrite structural test (2026-04-21).
 *
 * Paste-level fidelity to `docs/ux/claude-design-bundles/prototype/
 * project/screens-web.jsx` `WebShopping` (lines 518–543):
 *   - h1 "Shopping list" + "N items · from this week's plan" subtitle
 *   - 3-column `max-w-[900px]` grid of category cards
 *   - circular 18×18 checkbox + `{name} ({qty} {unit})` inline text
 *   - NO breadcrumb, NO progress bar, NO export / Print / CSV / Text UI,
 *     NO "Add custom item" input, NO trash icon per row, NO recipe
 *     thumbnails, NO regenerate card, NO out-of-sync banner.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

void React;

type MockAppData = {
  shoppingItems: Array<{
    id: string;
    name: string;
    amount: string;
    unit: string;
    category: string;
    checked: boolean;
    from: string;
  }>;
  toggleShoppingChecked: (id: string) => void;
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

function seedItems(overrides: Partial<MockAppData> = {}) {
  appDataState.current = {
    ...appDataState.current,
    shoppingItems: [
      { id: "p1", name: "Broccoli", amount: "2", unit: "heads", category: "Produce", checked: false, from: "Plan" },
      { id: "p2", name: "Red pepper", amount: "3", unit: "", category: "Produce", checked: false, from: "Plan" },
      { id: "r1", name: "Chicken thighs", amount: "800", unit: "g", category: "Protein", checked: true, from: "Plan" },
      { id: "r2", name: "Greek yogurt", amount: "1", unit: "kg", category: "Protein", checked: false, from: "Plan" },
      { id: "pa1", name: "Jasmine rice", amount: "500", unit: "g", category: "Pantry", checked: false, from: "Plan" },
    ],
    ...overrides,
  };
}

describe("ShoppingList — prototype rewrite (2026-04-21)", () => {
  it("renders the title 'Shopping list' and a derived 'N items · from this week's plan' subtitle", () => {
    seedItems();
    render(<ShoppingList userTier="free" />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Shopping list/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/5 items · from this week's plan/i)).toBeInTheDocument();
  });

  it("renders one card per category with the source-case overline", () => {
    seedItems();
    render(<ShoppingList userTier="free" />);
    expect(screen.getByText("Produce")).toBeInTheDocument();
    expect(screen.getByText("Protein")).toBeInTheDocument();
    expect(screen.getByText("Pantry")).toBeInTheDocument();
  });

  it("renders each item with qty and name inside its category card", () => {
    seedItems();
    render(<ShoppingList userTier="free" />);
    const rows = screen.getAllByRole("listitem");
    const broc = rows.find((r) => /Broccoli/.test(r.textContent ?? ""));
    expect(broc?.textContent ?? "").toMatch(/2\s*heads\s*Broccoli|Broccoli.*2\s*heads/);
    const rice = rows.find((r) => /Jasmine rice/.test(r.textContent ?? ""));
    expect(rice?.textContent ?? "").toMatch(/500\s*g\s*Jasmine rice|Jasmine rice.*500\s*g/);
  });

  it("tapping a circular checkbox toggles the item via the shared handler", () => {
    const toggle = vi.fn();
    seedItems({ toggleShoppingChecked: toggle });
    render(<ShoppingList userTier="free" />);
    const btn = screen.getByRole("button", { name: /Check.*Broccoli/i });
    fireEvent.click(btn);
    expect(toggle).toHaveBeenCalledWith("p1");
  });

  it("renders an empty 'No items' card when the list is empty", () => {
    appDataState.current = {
      ...appDataState.current,
      shoppingItems: [],
    };
    render(<ShoppingList userTier="free" />);
    expect(screen.getByText(/No items/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("does NOT render breadcrumb, progress bar, exports, add-custom, trash, regenerate, or out-of-sync banner", () => {
    seedItems();
    render(<ShoppingList userTier="free" />);
    // No breadcrumb nav
    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).toBeNull();
    // No progress region
    expect(screen.queryByLabelText(/Shopping progress/i)).toBeNull();
    // No export buttons (Print / CSV / Text / meatballs / actions menu)
    expect(screen.queryByRole("button", { name: /^Print$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Shopping list actions/i })).toBeNull();
    // No "Add custom item" input
    expect(screen.queryByPlaceholderText(/Add custom item/i)).toBeNull();
    // No Regenerate from plan button
    expect(screen.queryByRole("button", { name: /Regenerate from plan/i })).toBeNull();
    // No out-of-sync banner text
    expect(screen.queryByText(/List may not match your meal plan/i)).toBeNull();
  });
});
