// @vitest-environment jsdom
/**
 * Food-search results redesign (mobile) — ENG-814.
 *
 * Pins the `redesign_search_results`-flagged results body for the MOBILE
 * FoodSearchPanel against the approved prototype
 * (docs/prototypes/2026-05-31-design-direction/surface-search-results.html):
 *
 *  - ONE unified segmented control — the prototype's friendlier labels
 *    ("Recent" / "My foods") render in place of the old pills ("Recents" /
 *    "Custom"), while the underlying `food-search-category-*` testIDs (the
 *    real filter values) stay stable.
 *  - Results group into "Best matches" / "More results" sections, split by
 *    the SHARED scorer so web + mobile section identically.
 *  - Each row renders a legible confidence chip — soft-blue "Verified" /
 *    amber "Estimated" — driven by the row's `confidenceTier` (ENG-807).
 *    A defensively-absent tier falls back to the CONSERVATIVE "Estimated"
 *    label — never "Verified" — so a missing signal can never over-claim
 *    trust (CLAUDE.md trust posture; matches the web sibling ENG-815).
 *  - Flag OFF: the old flat path renders — old pill labels, no section
 *    headers, no Verified/Estimated chip. The old path must stay alive.
 *
 * The network boundary (`searchFoods`) is mocked; `splitFoodSearchResults`
 * is mocked to delegate to the REAL shared `splitBestMatches` so the test
 * exercises the same sectioning logic production uses.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react-native";

void React;

const { isFeatureEnabledSpy } = vi.hoisted(() => ({
  isFeatureEnabledSpy: vi.fn((_flag: string) => false),
}));
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
  bootstrapAnalytics: vi.fn(),
  isFeatureEnabled: isFeatureEnabledSpy,
}));

vi.mock("../../../../src/lib/nutrition/customFoodsClient", () => ({
  listCustomFoods: vi.fn(async () => []),
  searchCustomFoods: vi.fn(async () => []),
  createCustomFood: vi.fn(),
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}));

vi.mock("../../../../src/lib/nutrition/fatsecretAutocompleteClient", () => ({
  fetchFatSecretAutocomplete: vi.fn(async () => ({ tier: "basic", suggestions: [] })),
}));

// Two rows: a strong USDA "verified" hit (high score → Best matches) and a
// weak OFF "estimated" hit (low score → More results). The mocked
// `splitFoodSearchResults` delegates to the real shared split so the
// section boundary is the production boundary, not a test fixture.
const ROWS = [
  {
    key: "usda-1",
    name: "Chicken breast",
    _source: "USDA" as const,
    verified: true,
    confidenceTier: "verified" as const,
    macrosPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiberG: 0, sugarG: 0, sodiumMg: 74 },
    calsPer100g: 165,
    _relevance: 0.95,
    _fdcId: 1,
  },
  {
    key: "off-1",
    name: "Chicken nuggets value pack",
    _source: "OFF" as const,
    verified: false,
    confidenceTier: "estimated" as const,
    macrosPer100g: { calories: 280, protein: 14, carbs: 18, fat: 17, fiberG: 1, sugarG: 1, sodiumMg: 500 },
    calsPer100g: 280,
    _relevance: 0.2,
    _offCode: "off1",
  },
];

vi.mock("@/lib/verifyRecipe", async () => {
  const ranking = await import("../../../../src/lib/nutrition/foodSearchRanking");
  return {
    searchFoods: vi.fn(async () => ROWS),
    getFoodMacros: vi.fn(async () => null),
    getFatSecretFood: vi.fn(async () => null),
    getEdamamFoodMicros: vi.fn(async () => ({})),
    scaleMacrosByGrams: (m: unknown) => m,
    splitFoodSearchResults: (_q: string, rows: typeof ROWS) =>
      ranking.splitBestMatches(rows, (r) => (r as { _relevance: number })._relevance),
  };
});

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#94a3b8",
    background: "#fafafa",
    card: "#ffffff",
    cardElevated: "#fbf8f0",
    border: "#e4e4ec",
    cardBorder: "#e4e4ec",
    inputBg: "#f0f0f0",
  }),
}));

// Light theme so useCardElevation's light branch (soft shadow, no border)
// is exercised when the elevation flag is on.
vi.mock("@/context/theme", () => ({
  useTheme: () => ({ resolved: "light", colors: {} }),
}));

vi.mock("../../components/CreateCustomFoodSheet", () => ({
  __esModule: true,
  default: () => null,
}));

// eslint-disable-next-line import/first
import FoodSearchPanel from "../../components/food-search/FoodSearchPanel";

const SUPABASE_STUB = { from: () => ({}) } as unknown as Parameters<
  typeof FoodSearchPanel
>[0]["supabase"];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  isFeatureEnabledSpy.mockReset();
  isFeatureEnabledSpy.mockImplementation(() => false);
});

afterEach(() => {
  vi.useRealTimers();
});

async function drainDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

function flagOn(...flags: string[]) {
  const set = new Set(flags);
  isFeatureEnabledSpy.mockImplementation((f: string) => set.has(f));
}

describe("FoodSearchPanel results redesign (mobile, ENG-814)", () => {
  it("flag ON: renders unified labels, Best/More section headers and confidence chips", async () => {
    flagOn("redesign_search_results", "design_system_elevation");
    const { findByText, findByTestId, queryByText } = render(
      <FoodSearchPanel
        query="chicken"
        onSelect={() => {}}
        supabase={SUPABASE_STUB}
        userId="u1"
        mode="full"
      />,
    );
    await drainDebounce();

    // Unified labels (prototype wording) — "Recent" not "Recents",
    // "My foods" not "Custom". The underlying filter testIDs are unchanged.
    await findByText("Recent");
    await findByText("My foods");
    expect(queryByText("Recents")).toBeNull();
    expect(queryByText("Custom")).toBeNull(); // (the segment label; row Badge differs)
    // Filter testIDs (the real values) stay stable for Maestro.
    await findByTestId("food-search-category-Recents");
    await findByTestId("food-search-category-Custom");

    // Section headers from the shared best/more split.
    await findByTestId("food-search-section-best");
    await findByTestId("food-search-section-more");
    await findByText("Best matches");
    await findByText("More results");

    // Legible confidence chips — the canonical shared
    // <SearchResultConfidenceChip> (testID `confidence-chip`), one Verified
    // (strong USDA) and one Estimated.
    await findByText("Verified");
    await findByText("Estimated");
  });

  it("flag ON: confidence chips render via the shared SearchResultConfidenceChip", async () => {
    flagOn("redesign_search_results");
    const { findAllByTestId } = render(
      <FoodSearchPanel
        query="chicken"
        onSelect={() => {}}
        supabase={SUPABASE_STUB}
        userId="u1"
        mode="full"
      />,
    );
    await drainDebounce();
    // Both rows carry the shared chip's default testID — proves the panel
    // delegates to the canonical component (no bespoke inline chip).
    const chips = await findAllByTestId("confidence-chip");
    expect(chips.length).toBe(2);
  });

  it("flag OFF: renders the old flat path — old pill labels, no sections, no confidence chip", async () => {
    // All flags off (default).
    const { findByText, queryByText, queryByTestId } = render(
      <FoodSearchPanel
        query="chicken"
        onSelect={() => {}}
        supabase={SUPABASE_STUB}
        userId="u1"
        mode="full"
      />,
    );
    await drainDebounce();

    // Old pill grammar still renders.
    await findByText("Recents");
    await findByText("Custom");

    // No redesign section headers and no confidence chip in the flat path.
    expect(queryByTestId("food-search-section-best")).toBeNull();
    expect(queryByTestId("food-search-section-more")).toBeNull();
    expect(queryByTestId("confidence-chip")).toBeNull();
    expect(queryByText("Verified")).toBeNull();
    expect(queryByText("Estimated")).toBeNull();
  });

  it("flag ON: a defensively-absent tier falls back to the conservative 'Estimated' label, never 'Verified'", async () => {
    // Both rows here carry NO confidenceTier — the defensive edge case. The
    // chip must render "Estimated" (the lower-trust label), never "Verified",
    // and never invent a third tier string.
    const untiered = ROWS.map(({ confidenceTier: _drop, ...rest }) => rest);
    const verifyRecipe = await import("@/lib/verifyRecipe");
    vi.mocked(verifyRecipe.searchFoods).mockResolvedValueOnce(untiered as never);
    flagOn("redesign_search_results");
    const { findAllByText, queryByText } = render(
      <FoodSearchPanel
        query="chicken"
        onSelect={() => {}}
        supabase={SUPABASE_STUB}
        userId="u1"
        mode="full"
      />,
    );
    await drainDebounce();

    // Both untiered rows render the conservative "Estimated" chip…
    const estimated = await findAllByText("Estimated");
    expect(estimated.length).toBe(2);
    // …and a missing tier NEVER over-claims "Verified" or invents a tier.
    expect(queryByText("Verified")).toBeNull();
    expect(queryByText("Likely")).toBeNull();
    expect(queryByText("Low confidence")).toBeNull();
  });
});
