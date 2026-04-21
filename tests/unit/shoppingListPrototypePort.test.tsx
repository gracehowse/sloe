/**
 * ShoppingList prototype port (2026-04-20, Claude Design).
 *
 * Pins the web content-pane treatment that matches the prototype at
 * `docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
 * WebShopping — breadcrumb + subtitle + 3-column category-card grid
 * with circular checkboxes. Mobile-web (< md) continues to render a
 * single-column stacked layout, which we don't assert here because
 * jsdom reports desktop widths anyway.
 *
 * The existing `shoppingListEmptyState.test.tsx` already pins the
 * empty-state primitive; this file is dedicated to the prototype-
 * specific structural assertions that would regress silently if the
 * header/grid were re-templated.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

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

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
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

describe("ShoppingList — prototype port (2026-04-20)", () => {
  it("renders the breadcrumb `Recipes · Shopping list · <short date>` row on desktop", () => {
    seedItems();
    render(<ShoppingList userTier="free" />);
    const crumb = screen.getByRole("navigation", { name: /breadcrumb/i });
    const text = crumb.textContent ?? "";
    expect(text).toMatch(/Recipes/);
    expect(text).toMatch(/Shopping list/);
    // The trailing date crumb is today's short label (en-US format
    // renders "Mon, Apr 20"). We don't pin the wall-clock day
    // (flaky across CI calendar days), but the shape is stable.
    expect(text).toMatch(/[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}/);
  });

  it("renders the title 'Shopping list' and a derived 'N items · from this week's plan' subtitle", () => {
    seedItems();
    render(<ShoppingList userTier="free" />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Shopping list/i }),
    ).toBeInTheDocument();
    // 5 rows seeded → 5 grouped items.
    expect(screen.getByText(/5 items · from this week's plan/i)).toBeInTheDocument();
  });

  it("renders one card per category with an uppercase overline", () => {
    seedItems();
    render(<ShoppingList userTier="free" />);
    // Overlines come back uppercase via CSS, but the underlying DOM
    // still carries the sentence-case source string. Assert on the
    // source string so this doesn't regress if the overline class
    // changes.
    expect(screen.getByText("Produce")).toBeInTheDocument();
    expect(screen.getByText("Protein")).toBeInTheDocument();
    expect(screen.getByText("Pantry")).toBeInTheDocument();
  });

  it("renders each item as 'Name (qty unit)' inside its category card", () => {
    seedItems();
    render(<ShoppingList userTier="free" />);
    // "Broccoli (2 heads)" — dedupeShoppingLabel preserves the raw
    // qty + unit on a single-item group. The span is split across
    // nodes, so match with a flexible regexp on the row's textContent.
    const rows = screen.getAllByRole("listitem");
    const broc = rows.find((r) => /Broccoli/.test(r.textContent ?? ""));
    expect(broc).toBeDefined();
    expect(broc?.textContent ?? "").toMatch(/Broccoli\s*\(2\s*heads\)/);

    const rice = rows.find((r) => /Jasmine rice/.test(r.textContent ?? ""));
    expect(rice?.textContent ?? "").toMatch(/Jasmine rice\s*\(500\s*g\)/);
  });

  it("tapping a circular checkbox toggles the item via the shared handler", () => {
    const toggle = vi.fn();
    seedItems({ toggleShoppingChecked: toggle });
    render(<ShoppingList userTier="free" />);

    const btn = screen.getByRole("button", { name: /Check Broccoli/i });
    fireEvent.click(btn);
    expect(toggle).toHaveBeenCalledWith("p1");
  });

  it("an already-checked single-item group renders an Uncheck toggle", () => {
    seedItems();
    render(<ShoppingList userTier="free" />);
    // "Chicken thighs" was seeded as checked=true.
    const btn = screen.getByRole("button", { name: /Uncheck Chicken thighs/i });
    expect(btn).toBeInTheDocument();
  });

  it("preserves the empty state when shoppingItems is empty (no category grid rendered)", () => {
    appDataState.current = { ...appDataState.current, shoppingItems: [] };
    render(<ShoppingList userTier="free" />);
    expect(screen.getByText("Your shopping list is empty")).toBeInTheDocument();
    // No category cards: list of <li> rows should be 0.
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("keeps the out-of-sync banner + Regenerate button when the flag is on", () => {
    seedItems({ shoppingListOutOfSync: true });
    render(<ShoppingList userTier="free" />);
    expect(
      screen.getByText(/List may not match your meal plan/i),
    ).toBeInTheDocument();
    // Both the out-of-sync banner and the bottom Actions card carry a
    // "Regenerate from plan" button — we assert at least one is present.
    const btns = screen.getAllByRole("button", { name: /Regenerate from plan/i });
    expect(btns.length).toBeGreaterThan(0);
    // Silence unused `within` if the matcher changes shape later.
    void within;
  });
});
