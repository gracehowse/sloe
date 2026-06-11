/**
 * History-first food search (ENG-1031, MFP grammar) — web component pin.
 *
 * Behaviour: when the user types a query, matching items from their OWN
 * logging history surface FIRST as a visually-distinct "Past logged" group
 * ABOVE the database results, each one-tap loggable. A history item that also
 * appears in DB results shows once (history wins). The group is absent when no
 * history matches.
 *
 * Cross-platform parity pair:
 *   apps/mobile/tests/unit/foodSearchPastLogged.test.tsx
 * The shared matcher/ranker is unit-pinned separately in
 *   tests/unit/foodHistorySearch.test.ts
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, act, waitFor } from "@testing-library/react";

void React;

vi.mock("../../src/lib/nutrition/customFoodsClient", () => ({
  listCustomFoods: vi.fn(async () => []),
  searchCustomFoods: vi.fn(async () => []),
  createCustomFood: vi.fn(),
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}));

import {
  FoodSearchPanel,
  type FoodSearchPanelProps,
  type FoodSearchSelection,
} from "../../src/app/components/food-search/FoodSearchPanel";

const USDA_HIT_SOURDOUGH = {
  fdcId: 200002,
  description: "sourdough bread, slice",
  dataType: "Foundation",
  calories: 250,
  protein: 9,
  carbs: 48,
  fat: 2,
};

function makeFetchStub(routes: Record<string, () => Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [needle, handler] of Object.entries(routes)) {
      if (url.includes(needle)) return handler();
    }
    return new Response(JSON.stringify({ ok: true, hits: [], products: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

class MockIntersectionObserver {
  constructor(_cb: IntersectionObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  root: Element | Document | null = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
}

const HISTORY = [
  { recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1, count: 12 },
  { recipeTitle: "Smartfood popcorn", calories: 160, protein: 2, carbs: 14, fat: 10, count: 3 },
  { recipeTitle: "Greek yogurt", calories: 120, protein: 17, carbs: 7, fat: 2, count: 5 },
];

function renderPanel(props: Partial<FoodSearchPanelProps> = {}) {
  const onSelect = vi.fn<(s: FoodSearchSelection) => void>();
  const ui = render(
    <FoodSearchPanel query="" onSelect={onSelect} recentFoods={HISTORY} {...props} />,
  );
  return { onSelect, ...ui };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    MockIntersectionObserver;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("FoodSearchPanel — history-first 'Past logged' group", () => {
  it("does not render the group when the query is empty", () => {
    vi.stubGlobal("fetch", makeFetchStub({}));
    renderPanel({ query: "", mode: "compact" });
    expect(screen.queryByTestId("food-search-past-logged")).toBeNull();
  });

  it("surfaces matching history under a 'Past logged' eyebrow when a query is typed", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );
    renderPanel({ query: "sour" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    const group = await screen.findByTestId("food-search-past-logged");
    expect(group).toBeInTheDocument();
    expect(screen.getByText("Past logged")).toBeInTheDocument();
    expect(screen.getByTestId("food-search-past-logged-0")).toHaveTextContent(
      "Sourdough",
    );
  });

  it("does NOT render the group when no history matches the query", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );
    renderPanel({ query: "quinoa" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(screen.queryByTestId("food-search-past-logged")).toBeNull();
  });

  it("renders the 'Past logged' group ABOVE the database results", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [USDA_HIT_SOURDOUGH] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );
    const { container } = renderPanel({ query: "sourdough" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    const pastLogged = await screen.findByTestId("food-search-past-logged");
    // The history item title ("Sourdough") and a DB hit ("Sourdough Bread,
    // Slice") both render; assert the group comes first in document order.
    const dbRow = await screen.findByText(/Sourdough Bread/i);
    const position = pastLogged.compareDocumentPosition(dbRow);
    // DOCUMENT_POSITION_FOLLOWING (4) = dbRow comes AFTER pastLogged.
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    void container;
  });

  it("one-tap logs a history row with the 'history' source discriminator + per-serving macros", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );
    const { onSelect } = renderPanel({ query: "sour" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    const row = await screen.findByTestId("food-search-past-logged-0");
    fireEvent.click(row);
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    const sel = onSelect.mock.calls[0]![0];
    expect(sel.name).toBe("Sourdough");
    expect(sel.source).toBe("history");
    expect(sel.macrosPer100g).toBeNull();
    expect(sel.macrosPerServing).toEqual({
      calories: 180,
      protein: 6,
      carbs: 34,
      fat: 1,
    });
    expect(sel.quantity).toBe(1);
  });
});
