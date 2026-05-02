/**
 * Food search "no result" loop — PR2 (audit move-blocker #2,
 * 2026-04-30 competitor audit). Covers the empty-state contract
 * for FoodSearchPanel:
 *
 *  - Fires `food_search_no_result` (deduped per query) when every
 *    enabled source returns 0 hits.
 *  - Renders BOTH CTAs in the empty state: "Add as custom food"
 *    (opens the existing CreateCustomFoodDialog flow) and
 *    "Tell us we're missing this".
 *  - Tapping the dictionary-add CTA fires
 *    `food_search_request_dictionary_add` and surfaces a
 *    confirmation message; subsequent taps for the same query
 *    are deduped.
 *
 * Source pipeline is mocked at the network boundary (fetch) and the
 * Supabase-backed custom-foods client. No Supabase, no USDA, no OFF.
 *
 * Note: `track()` is invoked from `src/lib/analytics/track.ts`. We
 * spy on the module so the assertions look at the actual emit, not
 * a re-export shape.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

// PR2: spy on the analytics emit. We cannot assert on PostHog's
// transport; the contract is "track() was called with the right
// event name + payload", and `track` is the single boundary.
//
// `vi.mock` factories are hoisted, so the spy must be created via
// `vi.hoisted` to live in the same hoisted scope.
const { trackSpy } = vi.hoisted(() => ({ trackSpy: vi.fn() }));
vi.mock("../../src/lib/analytics/track", () => ({
  track: trackSpy,
}));

// Custom-foods client mocked to empty so the merged result really is
// 0 hits — and so opening the create dialog doesn't try to write to
// Supabase.
vi.mock("../../src/lib/nutrition/customFoodsClient", () => ({
  listCustomFoods: vi.fn(async () => []),
  searchCustomFoods: vi.fn(async () => []),
  createCustomFood: vi.fn(),
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}));

import FoodSearchPanel from "../../src/app/components/food-search/FoodSearchPanel";

// Minimal supabase shim — the panel only invokes it through the
// custom-foods mocks above; the bare reference exists so
// `customEnabled` flips true and the empty-state shows the
// "Add as custom food" CTA.
const SUPABASE_STUB = { from: () => ({}) } as any;

beforeEach(() => {
  trackSpy.mockReset();
  // USDA, OFF, Edamam, and any other JSON endpoints all return empty
  // arrays so the merged search yields zero rows.
  const emptyResp = { ok: true, hits: [], products: [] };
  (globalThis as any).fetch = vi.fn(async () =>
    new Response(JSON.stringify(emptyResp), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Mounts FoodSearchPanel with a fixed query so the debounced search
 * fires once on mount. `xyzzqzzfood` is intentionally nonsense so
 * `buildGenericMatchRow` (the in-memory generic-beverage / generic-
 * food matcher) doesn't fabricate a synthetic hit.
 */
function Harness({ query = "xyzzqzzfood" }: { query?: string }) {
  return (
    <FoodSearchPanel
      query={query}
      onSelect={() => {}}
      supabase={SUPABASE_STUB}
      userId="u1"
      mode="full"
    />
  );
}

describe("FoodSearchPanel no-result loop (web)", () => {
  it("fires `food_search_no_result` once when every source returns 0", async () => {
    render(<Harness />);
    // Empty state surfaces after the 400ms debounce + the awaited
    // mocked fetches resolve. testid pins the empty-state container.
    await screen.findByTestId("food-search-no-result-empty-state");

    // Exactly one no-result emit for the query.
    await waitFor(() => {
      const calls = trackSpy.mock.calls.filter(
        ([name]) => name === "food_search_no_result",
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]![1]).toMatchObject({
        query: "xyzzqzzfood",
        len: "xyzzqzzfood".length,
        source: "web",
      });
    });
  });

  it("renders both empty-state CTAs when customs are enabled", async () => {
    render(<Harness />);
    await screen.findByTestId("food-search-no-result-empty-state");
    expect(
      screen.getByTestId("food-search-no-result-add-custom"),
    ).toBeDefined();
    expect(
      screen.getByTestId("food-search-no-result-request-add"),
    ).toBeDefined();
  });

  it("fires `food_search_request_dictionary_add` when the user taps 'Tell us we're missing this'", async () => {
    render(<Harness />);
    const cta = await screen.findByTestId("food-search-no-result-request-add");
    fireEvent.click(cta);

    await waitFor(() => {
      const calls = trackSpy.mock.calls.filter(
        ([name]) => name === "food_search_request_dictionary_add",
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]![1]).toMatchObject({
        query: "xyzzqzzfood",
        len: "xyzzqzzfood".length,
        source: "web",
      });
    });

    // Inline confirmation surfaces after the tap.
    await screen.findByTestId("food-search-no-result-request-confirmation");
  });

  it("dedupes the dictionary-add event when the user double-taps the same query", async () => {
    render(<Harness />);
    const cta = await screen.findByTestId("food-search-no-result-request-add");
    fireEvent.click(cta);
    fireEvent.click(cta);
    fireEvent.click(cta);

    await waitFor(() => {
      const calls = trackSpy.mock.calls.filter(
        ([name]) => name === "food_search_request_dictionary_add",
      );
      // Only one emit even with three taps for the same query.
      expect(calls).toHaveLength(1);
    });
  });
});
