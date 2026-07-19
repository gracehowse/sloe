/**
 * ENG-815 — web FoodSearchPanel redesigned results body (`redesign_search_results`).
 *
 * Pins the flag-gated redesign that mirrors the approved prototype
 * (`docs/prototypes/2026-05-31-design-direction/surface-search-results.html`)
 * and the mobile sibling lane:
 *   1. flag OFF → legacy flat hairline list (no redesigned container, no chip)
 *   2. flag ON  → elevated grouped result cards + Best/More section split
 *   3. flag ON  → legible Verified / Estimated confidence chip sourced from the
 *      data layer's `confidenceTier` (never source alone)
 *   4. flag ON  → one unified segmented control that filters real `_source`
 *      rows (no dead affordance)
 *
 * Cross-platform parity pair: mirror against the mobile sibling lane's
 * `redesign_search_results` coverage. The tier + split math is shared
 * (`foodSearchRanking.ts`), so both surfaces section + label identically —
 * `foodSearchConfidenceTierParity.test.ts` pins that wiring.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

void React;

// Custom-foods client mocked at the boundary (no Supabase reach).
vi.mock("../../src/lib/nutrition/customFoodsClient", () => ({
  listCustomFoods: vi.fn(async () => []),
  searchCustomFoods: vi.fn(async () => []),
  createCustomFood: vi.fn(),
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}));

// Flag + analytics module mocked so we can flip `redesign_search_results`.
vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

import { isFeatureEnabled } from "../../src/lib/analytics/track";
import {
  FoodSearchPanel,
  type FoodSearchPanelProps,
  type FoodSearchSelection,
} from "../../src/app/components/food-search/FoodSearchPanel";

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

/** Enable a specific set of flags; everything else reads OFF. */
function enableFlags(...flags: string[]) {
  const on = new Set(flags);
  flagFn.mockImplementation((f: string) => on.has(f));
}

// ── Fixtures ─────────────────────────────────────────────────────────
//
// A verified USDA generic (→ "verified" tier) and an unverified branded
// FatSecret row (→ "estimated" tier). Both pass the trust gates so they
// survive `mergeAndDedup` and stamp a real `confidenceTier`.

const USDA_VERIFIED = {
  fdcId: 200001,
  description: "tilapia, raw, fillet",
  dataType: "Foundation",
  calories: 96,
  protein: 20,
  carbs: 0,
  fat: 1.7,
};

const FATSECRET_BRANDED = {
  foodId: "fs-99",
  label: "Tilapia Fillet, Grilled",
  brand: "SomeBrand",
  macrosPer100g: { calories: 128, protein: 26, carbs: 0, fat: 2.6 },
  servingLabel: null,
  servingGrams: null,
  macrosPerServing: null,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeFetchStub(routes: Record<string, () => Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [needle, handler] of Object.entries(routes)) {
      if (url.includes(needle)) return handler();
    }
    return jsonResponse({ ok: true, hits: [], products: [] });
  });
}

// IntersectionObserver polyfill — jsdom ships none; the panel constructs one
// for the load-more sentinel.
class NoopIO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  root: Element | null = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
  constructor(_cb: IntersectionObserverCallback) {
    void _cb;
  }
}

function renderPanel(props: Partial<FoodSearchPanelProps> = {}) {
  const onSelect = vi.fn<(s: FoodSearchSelection) => void>();
  const ui = render(<FoodSearchPanel query="tilapia" onSelect={onSelect} {...props} />);
  return { onSelect, ...ui };
}

const BOTH_SOURCES = makeFetchStub({
  "/api/usda/search": () => jsonResponse({ ok: true, hits: [USDA_VERIFIED] }),
  "openfoodfacts.org": () => jsonResponse({ products: [] }),
  "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
  "/api/fatsecret/search": () => jsonResponse({ ok: true, hits: [FATSECRET_BRANDED] }),
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  flagFn.mockReset();
  flagFn.mockReturnValue(false);
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = NoopIO;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function drain() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("ENG-815 — FoodSearchPanel redesigned results (flag-gated)", () => {
  it("flag OFF: renders the legacy flat list, no redesigned container or chip", async () => {
    flagFn.mockReturnValue(false);
    vi.stubGlobal("fetch", BOTH_SOURCES);
    const { container } = renderPanel();
    await drain();

    await screen.findByText("Tilapia, Raw, Fillet");
    // Legacy hairline list, not the elevated grouped redesign.
    expect(container.querySelector('[data-testid="food-search-results-redesign"]')).toBeNull();
    expect(container.querySelector('[data-testid="food-search-category-tabs"]')).toBeNull();
    expect(screen.queryByText("Best matches")).toBeNull();
    // No legible confidence chip in the legacy path.
    expect(container.querySelector('[data-testid="food-search-confidence-verified"]')).toBeNull();
  });

  it("flag ON: renders the redesigned container with the Best/More section grouping", async () => {
    enableFlags("redesign_search_results", "trust_source_name_v1");
    vi.stubGlobal("fetch", BOTH_SOURCES);
    const { container } = renderPanel();
    await drain();

    expect(
      await screen.findByTestId("food-search-results-redesign"),
    ).toBeInTheDocument();
    // The verified USDA row leads → "Best matches" section is present.
    expect(screen.getByText("Best matches")).toBeInTheDocument();
    // Result text still renders inside the redesigned cards.
    expect(screen.getByText("Tilapia, Raw, Fillet")).toBeInTheDocument();
    // Elevated card surface uses the soft elevation token.
    const card = container.querySelector('[data-testid="food-search-results-redesign"] .rounded-2xl');
    expect(card).not.toBeNull();
  });

  it("flag ON: names the source in the confidence chip for a source-backed row", async () => {
    enableFlags("redesign_search_results", "trust_source_name_v1");
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [USDA_VERIFIED] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
        "/api/fatsecret/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );
    renderPanel();
    await drain();

    expect(await screen.findByTestId("food-search-confidence-verified")).toBeInTheDocument();
    expect(screen.getByText("USDA")).toBeInTheDocument();
    // The verified row's byline names its source.
    expect(screen.getByText(/per 100g · USDA/i)).toBeInTheDocument();
  });

  it("flag ON: renders the Estimated chip for an unverified branded row", async () => {
    flagFn.mockImplementation((f: string) => f === "redesign_search_results");
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
        "/api/fatsecret/search": () =>
          jsonResponse({ ok: true, hits: [FATSECRET_BRANDED] }),
      }),
    );
    renderPanel();
    await drain();

    expect(await screen.findByTestId("food-search-confidence-estimated")).toBeInTheDocument();
    expect(screen.getByText("Estimated")).toBeInTheDocument();
    expect(screen.getByText(/per 100g · FatSecret/i)).toBeInTheDocument();
  });

  it("flag ON: the unified segmented control filters by source", async () => {
    flagFn.mockImplementation((f: string) => f === "redesign_search_results");
    vi.stubGlobal("fetch", BOTH_SOURCES);
    renderPanel();
    await drain();

    // Both the USDA generic and the FatSecret branded row are present on "All".
    expect(await screen.findByText("Tilapia, Raw, Fillet")).toBeInTheDocument();
    expect(screen.getByText("Tilapia Fillet, Grilled")).toBeInTheDocument();

    // Switch to "Branded" → only the FatSecret row survives.
    await act(async () => {
      fireEvent.click(screen.getByTestId("food-search-category-Branded"));
    });
    expect(screen.queryByText("Tilapia, Raw, Fillet")).toBeNull();
    expect(screen.getByText("Tilapia Fillet, Grilled")).toBeInTheDocument();

    // Switch to "Custom" → no custom foods → category-empty hint shows.
    await act(async () => {
      fireEvent.click(screen.getByTestId("food-search-category-Custom"));
    });
    expect(screen.getByTestId("food-search-category-empty")).toBeInTheDocument();
  });

  // ── ENG P5 parity (gap #11) — Estimated chip warm-amber, not warning orange ──
  it("flag ON: the Estimated chip uses the warm-amber --chip-estimated token, not the over-budget --warning orange", async () => {
    enableFlags("redesign_search_results");
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
        "/api/fatsecret/search": () =>
          jsonResponse({ ok: true, hits: [FATSECRET_BRANDED] }),
      }),
    );
    renderPanel();
    await drain();

    const chip = await screen.findByTestId("food-search-confidence-estimated");
    // Colour comes from the dedicated estimated token (mirrors mobile #BF8324),
    // applied as an inline style — NOT the over-budget `text-warning` class that
    // also paints the over-budget fat macro in the same row.
    expect(chip.style.color).toContain("var(--chip-estimated)");
    expect(chip.style.backgroundColor).toContain("var(--chip-estimated-soft)");
    expect(chip.className).not.toMatch(/\btext-warning\b/);
    expect(chip.className).not.toMatch(/\bbg-warning\b/);
  });

  // ── ENG P5 parity (gap #5) — soft elevation gated on design_system_elevation ──
  it("structure ON + elevation OFF: grouped cards stay flat (hairline border, no soft shadow)", async () => {
    enableFlags("redesign_search_results"); // elevation deliberately OFF
    vi.stubGlobal("fetch", BOTH_SOURCES);
    const { container } = renderPanel();
    await drain();

    const card = await screen.findByTestId("food-search-results-redesign");
    const group = card.querySelector<HTMLElement>(".rounded-2xl");
    expect(group).not.toBeNull();
    // Flag-off depth path = flat hairline, no soft shadow.
    expect(group?.style.boxShadow ?? "").toBe("");
    expect(group?.className).toMatch(/\bborder-border\b/);
    expect(group?.className).not.toMatch(/\bborder-0\b/);
    // Inactive segmented-control pills also drop the shadow when elevation is off.
    const inactivePill = container.querySelector<HTMLElement>(
      '[data-testid="food-search-category-Custom"]',
    );
    expect(inactivePill?.style.boxShadow ?? "").toBe("");
  });

  // Flat-card surfaces (2026-06-12, Withings grammar — decision:
  // docs/decisions/2026-06-12-flat-card-surfaces.md): the elevation-ON path is
  // now BORDERLESS-FLAT — the soft `--elev-card-soft` lift is retired; the
  // grouped card drops its border (Withings quiet-fill grammar) but carries NO
  // shadow. The inactive pills no longer carry any lift on either flag state.
  it("structure ON + elevation ON: grouped cards are borderless-FLAT (no soft shadow, no border)", async () => {
    enableFlags("redesign_search_results", "design_system_elevation");
    vi.stubGlobal("fetch", BOTH_SOURCES);
    const { container } = renderPanel();
    await drain();

    const card = await screen.findByTestId("food-search-results-redesign");
    const group = card.querySelector<HTMLElement>(".rounded-2xl");
    expect(group).not.toBeNull();
    // Flat: no soft lift, even with elevation ON.
    expect(group?.style.boxShadow ?? "").toBe("");
    // Borderless quiet-fill grammar retained.
    expect(group?.className).toMatch(/\bborder-0\b/);
    // Inactive pills carry no lift when elevation is on (flat-card).
    const inactivePill = container.querySelector<HTMLElement>(
      '[data-testid="food-search-category-Custom"]',
    );
    expect(inactivePill?.style.boxShadow ?? "").toBe("");
  });

  // ── ENG P5 parity (gap #30) — segmented control is query-gated, not result-gated ──
  it("flag ON: the segmented control renders on a zero-result query (matches mobile, not result-count gated)", async () => {
    enableFlags("redesign_search_results");
    // Every source returns empty → query is non-empty but results.length === 0.
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
        "/api/fatsecret/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );
    renderPanel();
    await drain();

    // The "No results" empty state proves results are empty…
    expect(
      await screen.findByTestId("food-search-no-result-empty-state"),
    ).toBeInTheDocument();
    // …yet the segmented filter control is still mounted (parity with mobile).
    expect(screen.getByTestId("food-search-category-tabs")).toBeInTheDocument();
  });

  it("flag ON: the segmented control is hidden until the user has searched (empty query)", async () => {
    enableFlags("redesign_search_results");
    vi.stubGlobal("fetch", BOTH_SOURCES);
    renderPanel({ query: "" });
    await drain();

    // No query typed yet → no search → no segmented control.
    expect(screen.queryByTestId("food-search-category-tabs")).toBeNull();
  });
});

// ── ENG-1532 — component grammar dedup: ONE search-row grammar ─────────
//
// Fable ruling 2026-07-16: with `component_grammar_dedup` ON, best-match
// results render as PLAIN ROWS with the Past-logged skeleton — hairline
// `divide-y` separators instead of the grouped card, the unified
// kcal-leads-basis-trails sub-line (shared `formatFoodSearchRowSubline`),
// and NO big right-aligned KCAL display numeral (it invited misreading
// per-100g values as per-serving). The tier chip stays inline; section
// overlines stay. Flag OFF → today's carded render, byte-intact (the
// PostHog kill switch). Mobile sibling coverage:
// `apps/mobile/tests/unit/foodSearchRedesignResults.test.tsx`.
describe("ENG-1532 — unified search-row grammar (component_grammar_dedup)", () => {
  it("flag ON: best matches render as plain rows — no card wrapper, unified sub-line, no KCAL numeral", async () => {
    enableFlags("redesign_search_results", "component_grammar_dedup", "trust_source_name_v1");
    vi.stubGlobal("fetch", BOTH_SOURCES);
    const { container } = renderPanel();
    await drain();

    const redesign = await screen.findByTestId("food-search-results-redesign");
    // Section overlines survive the dedup.
    expect(screen.getByText("Best matches")).toBeInTheDocument();
    // No grouped-card wrapper — the Past-logged hairline grammar instead.
    expect(redesign.querySelector(".rounded-2xl")).toBeNull();
    expect(redesign.querySelector(".divide-y")).not.toBeNull();
    // Plain rows carry the `search-row-` testID prefix.
    expect(redesign.querySelector('[data-testid^="search-row-"]')).not.toBeNull();
    // Unified sub-line: kcal LEADS, basis TRAILS, source name last
    // (USDA fixture: 96 kcal / 20 P / 0 C / 1.7 F per 100g → 2g F rounded).
    expect(
      screen.getByText("96 kcal · 20g P · 0g C · 2g F · per 100g · USDA"),
    ).toBeInTheDocument();
    // The big right-aligned KCAL display numeral is gone — the kcal value
    // only appears inside the sub-line string, never as a standalone numeral.
    expect(screen.queryByText("96")).toBeNull();
    // The tier chip stays inline and names the actual source.
    expect(screen.getByTestId("food-search-confidence-verified")).toBeInTheDocument();
    expect(screen.getAllByText("USDA").length).toBeGreaterThan(0);
    void container;
  });

  it("flag OFF (kill switch): the carded render stays byte-intact — card wrapper + KCAL numeral, no plain rows", async () => {
    enableFlags("redesign_search_results"); // component_grammar_dedup OFF
    vi.stubGlobal("fetch", BOTH_SOURCES);
    renderPanel();
    await drain();

    const redesign = await screen.findByTestId("food-search-results-redesign");
    // Grouped card + right-rail kcal numeral still render.
    expect(redesign.querySelector(".rounded-2xl")).not.toBeNull();
    expect(screen.getByText("96")).toBeInTheDocument();
    // No plain-row grammar leaks into the OFF path.
    expect(redesign.querySelector('[data-testid^="search-row-"]')).toBeNull();
    expect(
      screen.queryByText("96 kcal · 20g P · 0g C · 2g F · per 100g · USDA"),
    ).toBeNull();
  });
});
