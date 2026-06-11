/**
 * Favourites-in-search (teardown #1, ENG-1041) — web component pin.
 *
 * Behaviour: when the user types a query, foods they've STARRED that match it
 * surface in a "Favourites" group ABOVE "Past logged"; the empty-query Recent
 * strip is favourites-first (covered by the host parity test); every history-
 * style row carries a star toggle that calls the host's `onToggleFavorite`.
 *
 * Cross-platform parity pair:
 *   apps/mobile/tests/unit/foodSearchFavourites.test.tsx
 * The shared matcher/orderer is unit-pinned in
 *   tests/unit/favoriteFoodsSearch.test.ts
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
  { recipeTitle: "Greek yogurt", calories: 120, protein: 17, carbs: 7, fat: 2, count: 5 },
];

const FAVOURITES = [
  { id: "fav-1", recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1 },
];

function renderPanel(props: Partial<FoodSearchPanelProps> = {}) {
  const onSelect = vi.fn<(s: FoodSearchSelection) => void>();
  const onToggleFavorite = vi.fn();
  const ui = render(
    <FoodSearchPanel
      query=""
      onSelect={onSelect}
      recentFoods={HISTORY}
      favoriteFoods={FAVOURITES}
      onToggleFavorite={onToggleFavorite}
      {...props}
    />,
  );
  return { onSelect, onToggleFavorite, ...ui };
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

describe("FoodSearchPanel — favourites-in-search", () => {
  it("does not render the Favourites group when the query is empty", () => {
    vi.stubGlobal("fetch", makeFetchStub({}));
    renderPanel({ query: "", mode: "compact" });
    expect(screen.queryByTestId("food-search-favourites")).toBeNull();
  });

  it("surfaces a matching favourite under a 'Favourites' eyebrow when a query is typed", async () => {
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
    const group = await screen.findByTestId("food-search-favourites");
    expect(group).toBeInTheDocument();
    expect(screen.getByText("Favourites")).toBeInTheDocument();
    expect(screen.getByTestId("food-search-favourites-0")).toHaveTextContent("Sourdough");
  });

  it("renders the Favourites group ABOVE 'Past logged'", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );
    // "greek" matches the Greek-yogurt history row (not a favourite) AND
    // "sour" would match the favourite — query both groups by using a query
    // that hits history only, plus the favourite via its own term. Use a
    // query that matches the favourite + a different history row.
    renderPanel({ query: "o" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    const favourites = await screen.findByTestId("food-search-favourites");
    const pastLogged = await screen.findByTestId("food-search-past-logged");
    const position = favourites.compareDocumentPosition(pastLogged);
    // DOCUMENT_POSITION_FOLLOWING (4) = pastLogged comes AFTER favourites.
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("de-dupes a favourite out of 'Past logged' (favourites win)", async () => {
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
    await screen.findByTestId("food-search-favourites");
    // "Sourdough" is both a favourite and history → it appears in Favourites,
    // and the "Past logged" group must NOT also list it (so it renders nowhere
    // a second time, hence no Past-logged group at all here).
    expect(screen.queryByTestId("food-search-past-logged")).toBeNull();
  });

  it("the star on a Past-logged (non-favourite) row calls onToggleFavorite to ADD (no favoriteId)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );
    const { onToggleFavorite, onSelect } = renderPanel({ query: "greek" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    const star = await screen.findByTestId("food-search-past-logged-0-star");
    fireEvent.click(star);
    await waitFor(() => expect(onToggleFavorite).toHaveBeenCalledTimes(1));
    const arg = onToggleFavorite.mock.calls[0]![0];
    expect(arg.recipeTitle).toBe("Greek yogurt");
    expect(arg.favoriteId).toBeUndefined();
    // The star tap must NOT also log the row.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("the star on a Favourites row calls onToggleFavorite to REMOVE (carries the favoriteId)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );
    const { onToggleFavorite } = renderPanel({ query: "sour" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    const star = await screen.findByTestId("food-search-favourites-0-star");
    fireEvent.click(star);
    await waitFor(() => expect(onToggleFavorite).toHaveBeenCalledTimes(1));
    const arg = onToggleFavorite.mock.calls[0]![0];
    expect(arg.recipeTitle).toBe("Sourdough");
    expect(arg.favoriteId).toBe("fav-1");
  });
});
