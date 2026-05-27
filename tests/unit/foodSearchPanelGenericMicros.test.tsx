/**
 * FoodSearchPanel (web) — generic-food micros threading pin (ENG-738).
 *
 * Root cause being pinned: when a user logged a generic-dictionary food
 * (carrot, spinach, …) the select→commit path never attached micros, so
 * `nutrition_micros` was written empty and the meal-detail "Vitamins,
 * minerals & more" card showed "did not publish…". The real-USDA and OFF
 * branches DID thread `microsPer100g`; the GenericFood branch did not.
 *
 * This test drives the full row → preview → onSelect chain for a
 * generic-food query and asserts the emitted FoodSearchSelection carries
 * the baked per-100g micronutrient panel. If the threading regresses
 * (row construction or select branch drops `microsPer100g`), the
 * `onSelect` argument loses its micros and this fails.
 *
 * The actual scaling-to-grams + persist into `nutrition_micros` lives in
 * the commit handler (NutritionTracker `scaleMicrosForGrams`), which is
 * unchanged here — covered by `scaleMicrosPerServing.test.ts` /
 * `plannedMealMicros.test.ts`. This file's job is the missing link:
 * proving micros now reach the selection at all.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

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
import { genericFoodMicrosPer100g } from "../../src/lib/nutrition/genericFoodMicros";

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

// Empty external sources so the only result is the locally-seeded
// generic-food row from `matchGenericFood`.
const EMPTY_SOURCES = {
  "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
  "openfoodfacts.org": () => jsonResponse({ products: [] }),
  "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
  "/api/fatsecret/search": () => jsonResponse({ ok: true, hits: [], page: 1 }),
};

type MockIOInstance = {
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
  disconnect: () => void;
};
const ioInstances: MockIOInstance[] = [];
class MockIntersectionObserver {
  constructor() {
    ioInstances.push({ observe: () => {}, unobserve: () => {}, disconnect: () => {} });
  }
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

async function pickGenericAndConfirm(
  query: string,
  rowName: RegExp,
): Promise<FoodSearchSelection> {
  vi.stubGlobal("fetch", makeFetchStub(EMPTY_SOURCES));
  const { onSelect } = renderPanel({ query });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(450);
  });

  const row = await screen.findByRole("button", { name: rowName });
  fireEvent.click(row);

  // Generic-food selection resolves synchronously (no detail fetch) —
  // drain a microtask so the preview renders.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  const useThis = await screen.findByRole("button", { name: /Use this/i });
  fireEvent.click(useThis);

  expect(onSelect).toHaveBeenCalledTimes(1);
  return onSelect.mock.calls[0]![0];
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  ioInstances.length = 0;
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    MockIntersectionObserver;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("FoodSearchPanel — generic-food micros reach the selection (web)", () => {
  it("threads carrot's baked micros (vitamin A + potassium) onto onSelect", async () => {
    const arg = await pickGenericAndConfirm("carrot", /Carrot/i);

    expect(arg).toMatchObject({ name: "Carrot", source: "USDA" });
    expect(arg.microsPer100g).toBeDefined();
    expect(Object.keys(arg.microsPer100g!).length).toBeGreaterThan(0);
    // Spot-check the flagship carrot nutrients survive the threading.
    expect(arg.microsPer100g!.vitaminAMcgRae).toBeCloseTo(835, 0);
    expect(arg.microsPer100g!.potassiumMg).toBeCloseTo(320, 0);
    // The panel must thread the exact baked table reference, not a
    // re-derived / truncated copy.
    expect(arg.microsPer100g).toEqual(genericFoodMicrosPer100g("carrot"));
  });

  it("threads spinach's baked micros (vitamin K + folate) onto onSelect", async () => {
    const arg = await pickGenericAndConfirm("spinach", /Spinach/i);

    expect(arg.microsPer100g).toBeDefined();
    expect(arg.microsPer100g!.vitaminKMcg).toBeCloseTo(483, 0);
    expect(arg.microsPer100g!.folateMcg).toBeCloseTo(194, 0);
    expect(arg.microsPer100g).toEqual(genericFoodMicrosPer100g("spinach"));
  });

  it("still emits a usable selection shape alongside the micros", async () => {
    const arg = await pickGenericAndConfirm("carrot", /Carrot/i);

    // Regression guard: threading micros must not disturb the existing
    // macro / portion contract the commit path depends on.
    expect(arg.macrosPer100g).not.toBeNull();
    expect(arg.macrosPer100g!.calories).toBe(41);
    expect(arg.chosenPortion).toBeDefined();
    expect(typeof arg.chosenPortion.gramWeight).toBe("number");
    expect(arg.quantity).toBeGreaterThan(0);
    expect(arg.portions.some((p) => p.label === "g")).toBe(true);
  });
});
