/**
 * Food search "no result" loop — audit move-blocker #2 (2026-05-02
 * competitor audit; replaces stale PR #36). Covers the empty-state
 * contract for the web FoodSearchPanel:
 *
 *  - Fires `food_search_no_result` (deduped per query) when every
 *    enabled source returns 0 hits.
 *  - Renders BOTH CTAs in the empty state: "Add as custom food"
 *    (opens the existing CreateCustomFoodDialog flow with the query
 *    pre-filled) and "Tell us we're missing this".
 *  - Tapping the dictionary-add CTA fires
 *    `food_search_request_dictionary_add` and surfaces an inline
 *    confirmation message; subsequent taps for the same query are
 *    deduped.
 *
 * Source pipeline is mocked at the network boundary (fetch) and the
 * Supabase-backed custom-foods client. No Supabase, no USDA, no OFF.
 *
 * Note: `track()` is invoked from `src/lib/analytics/track.ts`. We
 * spy on the module so the assertions look at the actual emit, not
 * a re-export shape.
 */
import * as React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

void React;

// Spy on the analytics emit. We cannot assert on PostHog's transport;
// the contract is "track() was called with the right event name +
// payload", and `track` is the single boundary.
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

// CreateCustomFoodDialog is rendered as a controlled component with
// the panel's query as `initialName`. We replace it with a tiny stub
// that surfaces both `open` + `initialName` so the "opens with query
// pre-filled" assertion can read the prop directly.
vi.mock("../../src/app/components/suppr/create-custom-food-dialog", () => ({
  CreateCustomFoodDialog: ({
    open,
    initialName,
  }: {
    open: boolean;
    initialName?: string;
  }) =>
    open ? (
      <div
        data-testid="create-custom-food-dialog-stub"
        data-initial-name={initialName ?? ""}
      >
        stub dialog
      </div>
    ) : null,
}));

import { FoodSearchPanel } from "../../src/app/components/food-search/FoodSearchPanel";

// Minimal supabase shim — the panel only invokes it through the
// custom-foods mocks above; the bare reference exists so
// `customEnabled` flips true and the empty-state shows the
// "Add as custom food" CTA.
const SUPABASE_STUB = { from: () => ({}) } as Parameters<typeof FoodSearchPanel>[0]["supabase"];

// IntersectionObserver polyfill — jsdom doesn't ship one. The panel
// constructs an IO instance to watch the load-more sentinel; without
// a polyfill the constructor throws on mount.
class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [] as IntersectionObserverEntry[];
  }
  root = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  trackSpy.mockReset();
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    NoopIntersectionObserver;
  // USDA, OFF, Edamam, FatSecret — every JSON endpoint returns empty
  // arrays so the merged search yields zero rows for the query.
  const emptyResp = { ok: true, hits: [], products: [] };
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(
    async () =>
      new Response(JSON.stringify(emptyResp), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const QUERY = "xyzzqzzfood";

/**
 * Mounts FoodSearchPanel with a fixed query so the debounced search
 * fires once on mount. `xyzzqzzfood` is intentionally nonsense so
 * `buildGenericMatchRow` (the in-memory generic-beverage / generic-
 * food matcher) doesn't fabricate a synthetic hit.
 */
function Harness({ query = QUERY }: { query?: string }) {
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

async function drainDebounce() {
  // Drain the 400ms search debounce + the awaited Promise.all over
  // the four backend stubs. A single advance of 500ms is sufficient
  // because the empty fetches resolve on the same microtask tick.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("FoodSearchPanel no-result loop (web)", () => {
  it("renders both CTAs in the empty state when every source returns 0", async () => {
    render(<Harness />);
    await drainDebounce();

    await waitFor(() => {
      expect(
        screen.getByTestId("food-search-no-result-empty-state"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("food-search-no-result-add-custom"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("food-search-no-result-request-add"),
    ).toBeInTheDocument();

    // The auto-emit runs once for the trimmed query, with the
    // documented payload shape.
    const noResultCalls = trackSpy.mock.calls.filter(
      ([name]) => name === "food_search_no_result",
    );
    expect(noResultCalls).toHaveLength(1);
    expect(noResultCalls[0]![1]).toMatchObject({
      query: QUERY,
      len: QUERY.length,
      source: "web",
    });
  });

  it("opens CreateCustomFoodDialog with the query pre-filled when the user taps 'Add as custom food'", async () => {
    render(<Harness />);
    await drainDebounce();

    const addCustom = await screen.findByTestId(
      "food-search-no-result-add-custom",
    );

    // Dialog stub is absent before the tap.
    expect(
      screen.queryByTestId("create-custom-food-dialog-stub"),
    ).toBeNull();

    fireEvent.click(addCustom);

    const dialog = await screen.findByTestId(
      "create-custom-food-dialog-stub",
    );
    expect(dialog.getAttribute("data-initial-name")).toBe(QUERY);
  });

  it("fires `food_search_request_dictionary_add` once + shows confirmation when the user taps 'Tell us we're missing this'", async () => {
    render(<Harness />);
    await drainDebounce();

    const cta = await screen.findByTestId(
      "food-search-no-result-request-add",
    );
    fireEvent.click(cta);

    await waitFor(() => {
      const calls = trackSpy.mock.calls.filter(
        ([name]) => name === "food_search_request_dictionary_add",
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]![1]).toMatchObject({
        query: QUERY,
        len: QUERY.length,
        source: "web",
      });
    });

    // Inline confirmation surfaces after the tap.
    await screen.findByTestId(
      "food-search-no-result-request-confirmation",
    );
  });

  it("dedupes the dictionary-add event when the user double-taps the same query", async () => {
    render(<Harness />);
    await drainDebounce();

    const cta = await screen.findByTestId(
      "food-search-no-result-request-add",
    );
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
