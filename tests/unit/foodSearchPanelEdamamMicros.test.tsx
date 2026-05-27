/**
 * FoodSearchPanel (web) — Edamam full-micros select→commit pin (ENG-738).
 *
 * Before ENG-738 the Edamam SELECT branch only carried the search hit's
 * minimal panel (fiber/sugar/sodium) onto the preview, so a logged Edamam
 * food persisted only those three micros. The full 35-field panel lives
 * behind Edamam's `/nutrients` endpoint (proxied by `/api/edamam/food`).
 *
 * This pins:
 *   1. Tapping an Edamam row fires `/api/edamam/food?foodId=...`.
 *   2. The committed `FoodSearchSelection` carries the FULL fetched panel
 *      (vitamins + minerals + fat breakdown), merged over the search-hit
 *      micros, ready for the commit path to scale via `scaleMicrosForGrams`.
 *   3. A `/api/edamam/food` failure still commits the food (with the
 *      search-hit micros only) — the micros fetch never breaks the log.
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

// Edamam search hit envelope (shape of `/api/edamam/search` hits). Carries
// the minimal panel only — fiber/sugar/sodium under `microsPer100g`.
const EDAMAM_HIT_GRILLED_CHICKEN = {
  foodId: "food_grilled_chicken_1",
  label: "Grilled Chicken Breast",
  brand: null,
  category: "Generic foods",
  categoryLabel: "food",
  imageUrl: null,
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 74,
  microsPer100g: { sodiumMg: 74 },
  servingSizes: [],
};

// `/api/edamam/food` detail — the full per-100g panel from `/nutrients`,
// already remapped to canonical keys by the route.
const EDAMAM_FOOD_DETAIL = {
  ok: true,
  foodId: "food_grilled_chicken_1",
  microsPer100g: {
    sodiumMg: 74,
    potassiumMg: 256,
    calciumMg: 15,
    ironMg: 1,
    magnesiumMg: 29,
    phosphorusMg: 228,
    zincMg: 1,
    saturatedFatG: 1,
    monoFatG: 1.2,
    polyFatG: 0.8,
    cholesterolMg: 85,
    vitaminB6Mg: 0.6,
    niacinMg: 13.7,
    vitaminB12Mcg: 0.3,
  },
};

function makeFetchStub(routes: Record<string, () => Promise<Response> | Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [needle, handler] of Object.entries(routes)) {
      if (url.includes(needle)) return await handler();
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

// IntersectionObserver polyfill — same as the sibling FoodSearchPanel tests.
class MockIntersectionObserver {
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

function renderPanel(props: Partial<FoodSearchPanelProps> = {}) {
  const onSelect = vi.fn<(s: FoodSearchSelection) => void>();
  const ui = render(<FoodSearchPanel query="" onSelect={onSelect} {...props} />);
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

describe("FoodSearchPanel — Edamam full-micros select→commit (web)", () => {
  it("fetches /api/edamam/food on tap and commits the full panel", async () => {
    const fetchStub = makeFetchStub({
      "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
      "openfoodfacts.org": () => jsonResponse({ products: [] }),
      "/api/edamam/search": () =>
        jsonResponse({ ok: true, hits: [EDAMAM_HIT_GRILLED_CHICKEN], page: 1 }),
      "/api/fatsecret/search": () => jsonResponse({ ok: true, hits: [], page: 1 }),
      "/api/edamam/food": () => jsonResponse(EDAMAM_FOOD_DETAIL),
    });
    vi.stubGlobal("fetch", fetchStub);

    const { onSelect } = renderPanel({ query: "grilled chicken" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    const row = await screen.findByRole("button", { name: /Grilled Chicken Breast/i });
    fireEvent.click(row);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // The detail route was hit with the foodId.
    const detailCalls = fetchStub.mock.calls.filter(([u]) =>
      String(u).includes("/api/edamam/food"),
    );
    expect(detailCalls.length).toBe(1);
    expect(String(detailCalls[0]![0])).toContain("foodId=food_grilled_chicken_1");

    const useThis = await screen.findByRole("button", { name: /Use this/i });
    fireEvent.click(useThis);

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
    const arg = onSelect.mock.calls[0]![0];
    expect(arg.source).toBe("Edamam");
    // Full panel threaded through (would be sodium-only before ENG-738).
    expect(arg.microsPer100g).toMatchObject({
      sodiumMg: 74,
      potassiumMg: 256,
      calciumMg: 15,
      saturatedFatG: 1,
      cholesterolMg: 85,
      vitaminB12Mcg: 0.3,
    });
    expect(Object.keys(arg.microsPer100g!).length).toBeGreaterThan(3);
  });

  it("still commits the food when /api/edamam/food fails (micros fetch never breaks the log)", async () => {
    const fetchStub = makeFetchStub({
      "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
      "openfoodfacts.org": () => jsonResponse({ products: [] }),
      "/api/edamam/search": () =>
        jsonResponse({ ok: true, hits: [EDAMAM_HIT_GRILLED_CHICKEN], page: 1 }),
      "/api/fatsecret/search": () => jsonResponse({ ok: true, hits: [], page: 1 }),
      "/api/edamam/food": () => {
        throw new Error("nutrients endpoint down");
      },
    });
    vi.stubGlobal("fetch", fetchStub);

    const { onSelect } = renderPanel({ query: "grilled chicken" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    const row = await screen.findByRole("button", { name: /Grilled Chicken Breast/i });
    fireEvent.click(row);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const useThis = await screen.findByRole("button", { name: /Use this/i });
    fireEvent.click(useThis);

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
    const arg = onSelect.mock.calls[0]![0];
    expect(arg.source).toBe("Edamam");
    // Falls back to the search-hit micros (sodium only) — the food logs.
    expect(arg.microsPer100g).toEqual({ sodiumMg: 74 });
  });
});
