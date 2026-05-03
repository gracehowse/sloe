// @vitest-environment jsdom
/**
 * Food search "no result" loop — mobile mirror of
 * `tests/unit/foodSearchNoResultLoop.test.tsx`.
 * Audit move-blocker #2 (2026-05-02; replaces stale PR #36).
 *
 * Pins the empty-state contract for the MOBILE FoodSearchPanel:
 *
 *  - Renders both CTAs ("Add as custom food" + "Tell us we're
 *    missing this") + auto-emits `food_search_no_result` once with
 *    `source: "mobile"` when every source returns 0 hits.
 *  - Tapping the dictionary-add CTA fires
 *    `food_search_request_dictionary_add` with `source: "mobile"`
 *    and surfaces an inline confirmation row (NOT a native
 *    `Alert.alert` — softer pattern per Grace, 2026-05-02).
 *  - Subsequent taps for the same query are deduped.
 *
 * Module-level mocks neutralise the network boundary
 * (`@/lib/verifyRecipe.searchFoods`) and the Supabase-backed custom-
 * foods client. `@/lib/analytics` is shimmed via vitest config; the
 * shared shim's `track` is a `vi.fn` we can assert against directly.
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
} from "@testing-library/react-native";

void React;

// Hoisted spy for `@/lib/analytics.track`. The mobile vitest config
// already aliases `@/lib/analytics` → `tests/shims/analytics.ts`, but
// re-mocking it here gives us a fresh `vi.fn` per file that exposes
// the full mock-API (`mockReset`, `mock.calls`, etc.) — matching the
// pattern in `goalPaceRetuneSheet.test.tsx`.
const { trackSpy } = vi.hoisted(() => ({ trackSpy: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  track: trackSpy,
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
  bootstrapAnalytics: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

// Custom-foods client: empty library + empty query results so the
// merged search yields zero rows. Stub the writers so opening the
// create-sheet doesn't try to reach Supabase.
vi.mock("../../../../src/lib/nutrition/customFoodsClient", () => ({
  listCustomFoods: vi.fn(async () => []),
  searchCustomFoods: vi.fn(async () => []),
  createCustomFood: vi.fn(),
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}));

// Verify-recipe network boundary: `searchFoods` is the multi-source
// fan-out (USDA + OFF + Edamam + FatSecret). Force every call to
// resolve to an empty array so the merged result is guaranteed empty.
// `scaleMacros` + `getFoodMacros` + `getFatSecretFood` are kept
// passthrough-shaped so any reference paths still type-check, but
// they are never reached from the empty-state branch.
vi.mock("@/lib/verifyRecipe", () => ({
  searchFoods: vi.fn(async () => []),
  getFoodMacros: vi.fn(async () => null),
  getFatSecretFood: vi.fn(async () => null),
  scaleMacros: (m: unknown) => m,
}));

// FatSecret autocomplete (Premier-tier) — stub to empty so the
// typeahead row stays hidden.
vi.mock("../../../../src/lib/nutrition/fatsecretAutocompleteClient", () => ({
  fetchFatSecretAutocomplete: vi.fn(async () => ({
    tier: "basic",
    suggestions: [],
  })),
}));

// CreateCustomFoodSheet — replace with a stub that surfaces both
// `visible` + `initialName` so the "opens with query pre-filled"
// assertion can read the prop directly via testID + props.
vi.mock("../../components/CreateCustomFoodSheet", () => ({
  __esModule: true,
  default: ({
    visible,
    initialName,
  }: {
    visible: boolean;
    initialName?: string;
  }) =>
    visible
      ? React.createElement("View", {
          testID: "create-custom-food-sheet-stub",
          "data-initial-name": initialName ?? "",
        })
      : null,
}));

// `useThemeColors` returns the minimum surface the panel reads.
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#94a3b8",
    background: "#fafafa",
    card: "#ffffff",
    border: "#e4e4ec",
    cardBorder: "#e4e4ec",
    inputBg: "#f0f0f0",
  }),
}));

// Defer the import until after the vi.mock declarations above so the
// FoodSearchPanel module sees the mocked dependencies on first load.
// eslint-disable-next-line import/first
import FoodSearchPanel from "../../components/food-search/FoodSearchPanel";

const SUPABASE_STUB = {
  from: () => ({}),
} as unknown as Parameters<typeof FoodSearchPanel>[0]["supabase"];

const QUERY = "xyzzqzzfood";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  trackSpy.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

async function drainDebounce() {
  // Drain the 400ms search debounce + the awaited Promise.all over
  // the mocked sources. A single 500ms advance is sufficient because
  // every mocked source resolves on the same microtask tick.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("FoodSearchPanel no-result loop (mobile)", () => {
  it("renders both CTAs in the empty state when every source returns 0", async () => {
    const { findByTestId } = render(
      <FoodSearchPanel
        query={QUERY}
        onSelect={() => {}}
        supabase={SUPABASE_STUB}
        userId="u1"
        mode="full"
      />,
    );
    await drainDebounce();

    await findByTestId("food-search-no-result-empty-state");
    await findByTestId("food-search-no-result-add-custom");
    await findByTestId("food-search-no-result-request-add");

    // Auto-emit fires exactly once with the documented payload shape.
    const noResultCalls = trackSpy.mock.calls.filter(
      ([name]) => name === "food_search_no_result",
    );
    expect(noResultCalls).toHaveLength(1);
    expect(noResultCalls[0]![1]).toMatchObject({
      query: QUERY,
      len: QUERY.length,
      source: "mobile",
    });
  });

  it("opens CreateCustomFoodSheet with the query pre-filled when the user taps 'Add as custom food'", async () => {
    const { findByTestId, queryByTestId } = render(
      <FoodSearchPanel
        query={QUERY}
        onSelect={() => {}}
        supabase={SUPABASE_STUB}
        userId="u1"
        mode="full"
      />,
    );
    await drainDebounce();

    const addCustom = await findByTestId(
      "food-search-no-result-add-custom",
    );

    expect(queryByTestId("create-custom-food-sheet-stub")).toBeNull();

    await act(async () => {
      fireEvent.press(addCustom);
    });

    const sheet = await findByTestId("create-custom-food-sheet-stub");
    // Mobile RN host elements expose props on `props.[key]`. The
    // `data-initial-name` attribute we set on the stub element is
    // mirrored verbatim onto the underlying host node.
    expect(
      (sheet as unknown as { props: { "data-initial-name": string } }).props[
        "data-initial-name"
      ],
    ).toBe(QUERY);
  });

  it("fires `food_search_request_dictionary_add` once + shows confirmation when the user taps 'Tell us we're missing this'", async () => {
    const { findByTestId } = render(
      <FoodSearchPanel
        query={QUERY}
        onSelect={() => {}}
        supabase={SUPABASE_STUB}
        userId="u1"
        mode="full"
      />,
    );
    await drainDebounce();

    const cta = await findByTestId("food-search-no-result-request-add");
    await act(async () => {
      fireEvent.press(cta);
    });

    const requestCalls = trackSpy.mock.calls.filter(
      ([name]) => name === "food_search_request_dictionary_add",
    );
    expect(requestCalls).toHaveLength(1);
    expect(requestCalls[0]![1]).toMatchObject({
      query: QUERY,
      len: QUERY.length,
      source: "mobile",
    });

    // Inline confirmation row surfaces (replaces native Alert per
    // Grace's 2026-05-02 softer-pattern call).
    await findByTestId("food-search-no-result-request-confirmation");
  });

  it("dedupes the dictionary-add event when the user double-taps the same query", async () => {
    const { findByTestId } = render(
      <FoodSearchPanel
        query={QUERY}
        onSelect={() => {}}
        supabase={SUPABASE_STUB}
        userId="u1"
        mode="full"
      />,
    );
    await drainDebounce();

    const cta = await findByTestId("food-search-no-result-request-add");
    await act(async () => {
      fireEvent.press(cta);
      fireEvent.press(cta);
      fireEvent.press(cta);
    });

    const requestCalls = trackSpy.mock.calls.filter(
      ([name]) => name === "food_search_request_dictionary_add",
    );
    // Only one emit even with three taps for the same query.
    expect(requestCalls).toHaveLength(1);
  });
});
