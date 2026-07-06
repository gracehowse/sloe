/**
 * FoodSearchPanel (web) — public-API regression pin.
 *
 * Closes the deferred polish item from PR #5 commit `cb1317f`, which
 * extracted `src/app/components/food-search/FoodSearchPanel.tsx` (~892
 * LOC of the post-refactor file) out of the legacy `FoodSearch.tsx`
 * wrapper. Mobile already had dedicated panel coverage
 * (`apps/mobile/tests/unit/foodSearchPagination.test.ts`,
 * `apps/mobile/tests/unit/foodSearchPrimaryServingParity.test.ts`),
 * but the web panel was sat behind only the FoodSearch dialog wrapper
 * tests + the inline-search smoke tests in `logSheetPhase3.test.tsx`.
 * This file pins the panel's contract directly so a future refactor
 * can't silently break it.
 *
 * Cross-platform parity pair: mirror this file's coverage against
 *   apps/mobile/components/food-search/FoodSearchPanel.tsx
 * — sync-enforcer should treat them as a parity pair. Prop names +
 * shapes (query / onSelect / mode / supabase / userId) are kept
 * identical with the mobile panel for the same reason.
 *
 * What this pins:
 *   1. results render when query is non-empty (USDA hit fans through)
 *   2. empty state when query is empty (no results, no spinner)
 *   3. onSelect fires with the FoodSearchSelection shape after picking
 *      a row + confirming the preview
 *   4. infinite-scroll sentinel + IntersectionObserver wiring exists
 *   5. pagination state resets when query changes (results cleared)
 *   6. loading + error states forwarded (spinner, no crash)
 *   7. mode prop changes container density (px-3 vs px-6)
 *
 * Coverage already living in `logSheetPhase3.test.tsx` (inline-mode
 * mount + LogSheet's panel hand-off) is NOT re-pinned here.
 */
import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";

void React;

// ── Module-boundary mocks ────────────────────────────────────────────
// Custom-foods client is mocked at the module boundary so the panel
// renders without reaching Supabase. The default export is "no library
// rows" — individual tests that exercise the custom-food path can
// override.
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

// ── Test fixtures ────────────────────────────────────────────────────

/**
 * USDA "Foundation" hit. Three constraints stack on the test query:
 *   - `dataType: "Foundation"` → verified=true, dodges F-90 relevance gate.
 *   - multi-word description → dodges F-89 bare-generic-noun gate.
 *   - kcal>0 + plausible macros → passes F-77 Atwater check.
 *   - Query token must NOT match any entry in
 *     `src/lib/nutrition/genericFoods.ts` or `genericBeverages.ts` — if
 *     it does, the panel surfaces the generic row first, dedups the
 *     USDA hit out, and the test asserts the wrong shape. "Tilapia" is
 *     safe (not in either generic list, not in the bare-noun set).
 */
const USDA_HIT_TILAPIA = {
  fdcId: 100001,
  // All-lowercase so the panel's `titleCase` helper fires (it only
  // re-cases strings whose `lower>0 && upper===0`). Mixed-case strings
  // like "Tilapia, raw" pass through verbatim.
  description: "tilapia, raw, fillet",
  dataType: "Foundation",
  calories: 96,
  protein: 20,
  carbs: 0,
  fat: 1.7,
};

const USDA_HIT_TILAPIA_DETAIL = {
  ok: true,
  macrosPer100g: {
    calories: 96,
    protein: 20,
    carbs: 0,
    fat: 1.7,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 52,
  },
  portions: [],
  primaryPortion: null,
};

const TILAPIA_DISPLAY = "Tilapia, Raw, Fillet";

/**
 * `fetch` stub that routes by URL substring. Tests can swap the impl
 * mid-flow (e.g. to simulate a failure or a second page that reports
 * empty). Returning empty arrays for OFF / Edamam means USDA is the
 * sole source, which keeps result lists deterministic.
 */
function makeFetchStub(
  routes: Record<string, () => Promise<Response> | Response>,
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [needle, handler] of Object.entries(routes)) {
      if (url.includes(needle)) {
        return await handler();
      }
    }
    // Safety net: any URL we didn't model resolves to a generic empty
    // response so the panel never throws on an unexpected fetch.
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

/**
 * IntersectionObserver polyfill — jsdom doesn't ship one. The panel
 * mounts an IO instance to watch the load-more sentinel; without a
 * polyfill the `new IntersectionObserver(...)` call throws and the
 * panel's `if (typeof IntersectionObserver === "undefined") return;`
 * guard never fires (it's defined on globalThis, just not
 * constructible). We expose `triggerIntersect` so tests can synthesise
 * a viewport-intersection event without scrolling.
 */
type MockIOInstance = {
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
  disconnect: () => void;
  trigger: (isIntersecting: boolean) => void;
};
const ioInstances: MockIOInstance[] = [];
class MockIntersectionObserver {
  private cb: IntersectionObserverCallback;
  private targets: Element[] = [];
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    const handle: MockIOInstance = {
      observe: (t) => {
        this.targets.push(t);
      },
      unobserve: (t) => {
        this.targets = this.targets.filter((x) => x !== t);
      },
      disconnect: () => {
        this.targets = [];
      },
      trigger: (isIntersecting: boolean) => {
        const entries = this.targets.map(
          (t) =>
            ({
              isIntersecting,
              target: t,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRatio: isIntersecting ? 1 : 0,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: 0,
            }) as IntersectionObserverEntry,
        );
        this.cb(entries, this as unknown as IntersectionObserver);
      },
    };
    ioInstances.push(handle);
  }
  observe(t: Element) {
    ioInstances[ioInstances.length - 1]?.observe(t);
  }
  unobserve(t: Element) {
    ioInstances[ioInstances.length - 1]?.unobserve(t);
  }
  disconnect() {
    ioInstances[ioInstances.length - 1]?.disconnect();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  // Required-by-DOM-types fields. Values are inert.
  root: Element | Document | null = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
}

// ── Render helpers ───────────────────────────────────────────────────

function renderPanel(props: Partial<FoodSearchPanelProps> = {}) {
  const onSelect = vi.fn<(s: FoodSearchSelection) => void>();
  const ui = render(
    <FoodSearchPanel query="" onSelect={onSelect} {...props} />,
  );
  return { onSelect, ...ui };
}

// ── Lifecycle ────────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────

describe("FoodSearchPanel — query → results render path", () => {
  it("renders no results, no spinner when query is empty", () => {
    vi.stubGlobal("fetch", makeFetchStub({}));
    const { container } = renderPanel({ query: "", mode: "compact" });
    // No result row, no spinner, no 'no results' copy (empty query
    // suppresses both — the panel is a blank canvas waiting for input).
    expect(screen.queryByText(/No results for/i)).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeNull();
    // Sentinel only renders when results.length > 0.
    expect(
      container.querySelector('[data-testid="food-search-load-more-sentinel"]'),
    ).toBeNull();
  });

  it("renders a result row when query is non-empty and the search backend returns hits", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () =>
          jsonResponse({ ok: true, hits: [USDA_HIT_TILAPIA] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );

    renderPanel({ query: "tilapia raw" });

    // Drain the 400ms debounce + any micro-task work spawned by the
    // multi-source Promise.all.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    // Panel title-cased the description.
    expect(
      await screen.findByText(TILAPIA_DISPLAY),
    ).toBeInTheDocument();
  });

  it("shows the no-results copy when the backend returns empty for a non-empty query", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );

    renderPanel({ query: "zzzzzz-no-such-food" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    // Copy uses smart curly quotes around the query.
    await waitFor(() => {
      expect(
        screen.getByText(/No results for/i),
      ).toBeInTheDocument();
    });
  });
});

describe("FoodSearchPanel — onSelect callback shape", () => {
  it("fires onSelect with the FoodSearchSelection shape after picking a row + confirming", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () =>
          jsonResponse({ ok: true, hits: [USDA_HIT_TILAPIA] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
        "/api/usda/food": () => jsonResponse(USDA_HIT_TILAPIA_DETAIL),
      }),
    );

    const { onSelect } = renderPanel({ query: "tilapia raw" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    // Click the result. The click triggers an async USDA detail fetch
    // before the preview renders, so we wait for the "Use this" CTA to
    // appear before continuing.
    const rows = await screen.findAllByRole("button", {
      name: new RegExp(TILAPIA_DISPLAY, "i"),
    });
    // Logging-loop added a sibling "Quick log …" button per row; pick the main row.
    const row =
      rows.find(
        (b) => !b.getAttribute("data-testid")?.startsWith("food-search-quick-log"),
      ) ?? rows[0];
    fireEvent.click(row);

    // Drain the detail-fetch microtasks.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const useThis = await screen.findByRole("button", { name: /Use this/i });
    fireEvent.click(useThis);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const arg = onSelect.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      name: TILAPIA_DISPLAY,
      source: "USDA",
    });
    // Selection carries the per-100g macros…
    expect(arg!.macrosPer100g.calories).toBe(96);
    expect(arg!.macrosPer100g.protein).toBe(20);
    // …a chosen portion + a positive quantity…
    expect(arg!.chosenPortion).toBeDefined();
    expect(typeof arg!.chosenPortion.gramWeight).toBe("number");
    expect(arg!.quantity).toBeGreaterThan(0);
    // …and the available portion list (must include base 'g').
    expect(Array.isArray(arg!.portions)).toBe(true);
    expect(arg!.portions.some((p) => p.label === "g")).toBe(true);
  });
});

describe("FoodSearchPanel — pagination", () => {
  it("renders the IntersectionObserver-watched load-more sentinel once results exist", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () =>
          jsonResponse({ ok: true, hits: [USDA_HIT_TILAPIA] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
      }),
    );

    const { container } = renderPanel({ query: "tilapia raw" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    await waitFor(() => {
      expect(
        container.querySelector(
          '[data-testid="food-search-load-more-sentinel"]',
        ),
      ).toBeInTheDocument();
    });

    // The IntersectionObserver was constructed and attached.
    expect(ioInstances.length).toBeGreaterThan(0);
  });

  it("fires another search fetch when the sentinel becomes intersecting (load-more)", async () => {
    let usdaPageCalls = 0;
    const fetchStub = makeFetchStub({
      "/api/usda/search": () => {
        usdaPageCalls += 1;
        // Page 1 returns a hit. Page 2+ returns empty so the panel
        // latches to "no more" cleanly after the load-more attempt.
        if (usdaPageCalls === 1) {
          return jsonResponse({ ok: true, hits: [USDA_HIT_TILAPIA] });
        }
        return jsonResponse({ ok: true, hits: [] });
      },
      "openfoodfacts.org": () => jsonResponse({ products: [] }),
      "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
    });
    vi.stubGlobal("fetch", fetchStub);

    renderPanel({ query: "tilapia raw" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    // Wait for the first-page result to land.
    await screen.findByText(TILAPIA_DISPLAY);

    expect(usdaPageCalls).toBe(1);

    // Trigger the IO. The panel attaches the IO with rootMargin set so
    // we synthesise an `isIntersecting: true` event on the most recent
    // observer.
    const io = ioInstances[ioInstances.length - 1];
    expect(io).toBeDefined();
    await act(async () => {
      io!.trigger(true);
      // loadMore awaits Promise.all of three fetches — drain microtasks.
      await vi.advanceTimersByTimeAsync(0);
    });

    // The second USDA fetch (page 2) was issued.
    expect(usdaPageCalls).toBeGreaterThanOrEqual(2);
  });

  it("resets pagination state when the query changes (results cleared then refetched)", async () => {
    const fetchStub = makeFetchStub({
      "/api/usda/search": (() => {
        let n = 0;
        return () => {
          n += 1;
          // First query → "Greek yogurt". Second query → "Cottage cheese".
          if (n === 1) {
            return jsonResponse({
              ok: true,
              hits: [USDA_HIT_TILAPIA],
            });
          }
          return jsonResponse({
            ok: true,
            hits: [
              {
                fdcId: 100002,
                // All-lowercase so titleCase fires — see USDA_HIT_TILAPIA.
                description: "haddock, raw, fillet",
                dataType: "Foundation",
                calories: 74,
                protein: 16,
                carbs: 0,
                fat: 0.5,
              },
            ],
          });
        };
      })(),
      "openfoodfacts.org": () => jsonResponse({ products: [] }),
      "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
    });
    vi.stubGlobal("fetch", fetchStub);

    const { rerender } = renderPanel({ query: "tilapia raw" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    await screen.findByText(TILAPIA_DISPLAY);

    // Swap the query — old result should clear, new result should land.
    rerender(
      <FoodSearchPanel query="haddock raw" onSelect={vi.fn()} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    // Old row gone, new row visible.
    await waitFor(() => {
      expect(
        screen.queryByText(TILAPIA_DISPLAY),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("Haddock, Raw, Fillet"),
    ).toBeInTheDocument();
  });
});

describe("FoodSearchPanel — loading + error states", () => {
  it("shows the centered spinner while the first-page search is in flight", async () => {
    // ENG-686: the panel now streams results as each source resolves — the
    // spinner goes away as soon as the FIRST source responds. To test that
    // the spinner is visible while searches are in flight, ALL sources must
    // be held pending (not just USDA), otherwise OFF / Edamam resolve via
    // the safety-net branch and trigger setLoading(false) immediately.
    let releaseAll: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => { releaseAll = resolve; });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await gate;
        return new Response(JSON.stringify({ ok: true, hits: [], products: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const { container } = renderPanel({ query: "tilapia raw" });

    // Past the debounce — search has fired but no source has resolved yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    expect(container.querySelector(".animate-spin")).not.toBeNull();

    // Release all sources so the test cleans up.
    releaseAll?.();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  it("does not crash when the search backend rejects — falls back to empty results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        // Every fetch rejects. The panel's per-source try/catch must
        // swallow the error and render the "No results" copy without
        // throwing.
        throw new Error("network down");
      }),
    );

    renderPanel({ query: "tilapia raw" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    // No spinner, no row — and definitely no thrown error reaching the
    // test boundary.
    await waitFor(() => {
      expect(screen.getByText(/No results for/i)).toBeInTheDocument();
    });
  });
});

describe("FoodSearchPanel — mode prop changes density", () => {
  it("compact mode applies px-3 to the outer container", () => {
    vi.stubGlobal("fetch", makeFetchStub({}));
    const { container } = renderPanel({ query: "", mode: "compact" });
    const outer = container.firstElementChild as HTMLElement | null;
    expect(outer).not.toBeNull();
    expect(outer!.className).toContain("px-3");
    expect(outer!.className).not.toContain("px-6");
  });

  it("full mode applies px-6 to the outer container", () => {
    vi.stubGlobal("fetch", makeFetchStub({}));
    const { container } = renderPanel({ query: "", mode: "full" });
    const outer = container.firstElementChild as HTMLElement | null;
    expect(outer).not.toBeNull();
    expect(outer!.className).toContain("px-6");
    expect(outer!.className).not.toContain("px-3");
  });

  it("default mode (no prop) is full density", () => {
    vi.stubGlobal("fetch", makeFetchStub({}));
    const { container } = renderPanel({ query: "" });
    const outer = container.firstElementChild as HTMLElement | null;
    expect(outer).not.toBeNull();
    expect(outer!.className).toContain("px-6");
  });
});

/**
 * Locale-aware empty-state hint
 * (2026-04-26 — FatSecret Premier Free upgrade).
 *
 * The hint appears alongside the "No results" copy when:
 *   - the user's locale is non-US, AND
 *   - the host wired `onScanBarcodePressed`, AND
 *   - the host is not already in barcode mode.
 *
 * It is suppressed for en-US users (FatSecret Premier Free is a US
 * dataset; false-positive UK suggestions are the original concern).
 */
describe("FoodSearchPanel — locale-aware barcode-fallback hint", () => {
  function renderEmpty(props: Partial<FoodSearchPanelProps>) {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
        "/api/fatsecret/autocomplete": () =>
          jsonResponse({ ok: true, tier: "basic", suggestions: [] }),
      }),
    );
    return renderPanel({ query: "no-such-thing", ...props });
  }

  async function drain() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
  }

  it("shows the hint for en-GB users", async () => {
    const onScanBarcodePressed = vi.fn();
    renderEmpty({
      onScanBarcodePressed,
      localeOverride: "en-GB",
    });
    await drain();
    expect(
      screen.getByTestId("food-search-barcode-fallback-hint"),
    ).toBeInTheDocument();
  });

  it("shows the hint for en-AU users", async () => {
    renderEmpty({
      onScanBarcodePressed: vi.fn(),
      localeOverride: "en-AU",
    });
    await drain();
    expect(
      screen.getByTestId("food-search-barcode-fallback-hint"),
    ).toBeInTheDocument();
  });

  it("hides the hint for en-US users", async () => {
    renderEmpty({
      onScanBarcodePressed: vi.fn(),
      localeOverride: "en-US",
    });
    await drain();
    expect(screen.queryByTestId("food-search-barcode-fallback-hint")).toBeNull();
  });

  it("hides the hint when host is already in barcode mode", async () => {
    renderEmpty({
      onScanBarcodePressed: vi.fn(),
      localeOverride: "en-GB",
      inBarcodeMode: true,
    });
    await drain();
    expect(screen.queryByTestId("food-search-barcode-fallback-hint")).toBeNull();
  });

  it("hides the hint when no onScanBarcodePressed callback was provided", async () => {
    renderEmpty({
      localeOverride: "en-GB",
    });
    await drain();
    expect(screen.queryByTestId("food-search-barcode-fallback-hint")).toBeNull();
  });

  it("invokes onScanBarcodePressed when the user clicks the hint", async () => {
    const onScanBarcodePressed = vi.fn();
    renderEmpty({
      onScanBarcodePressed,
      localeOverride: "en-GB",
    });
    await drain();
    const btn = await screen.findByTestId("food-search-barcode-fallback-hint");
    await act(async () => {
      btn.click();
    });
    expect(onScanBarcodePressed).toHaveBeenCalledTimes(1);
  });

  it("never shows the hint when results.length > 0", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () =>
          jsonResponse({ ok: true, hits: [USDA_HIT_TILAPIA] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
        "/api/fatsecret/autocomplete": () =>
          jsonResponse({ ok: true, tier: "basic", suggestions: [] }),
      }),
    );
    renderPanel({
      query: "tilapia raw",
      localeOverride: "en-GB",
      onScanBarcodePressed: vi.fn(),
    });
    await drain();
    // A real result rendered, so the empty-state hint must not appear.
    expect(await screen.findByText(TILAPIA_DISPLAY)).toBeInTheDocument();
    expect(screen.queryByTestId("food-search-barcode-fallback-hint")).toBeNull();
  });
});

/**
 * Premier-tier autocomplete typeahead row
 * (2026-04-26 — FatSecret Premier Free upgrade).
 *
 *   - Premier tier + suggestions present → row renders above results.
 *   - Basic tier → row hidden, no flicker, no extra DOM nodes.
 *   - Empty query → row hidden.
 */
describe("FoodSearchPanel — Premier-tier autocomplete row", () => {
  it("renders the autocomplete row when the server reports tier=premier", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
        "/api/fatsecret/autocomplete": () =>
          jsonResponse({
            ok: true,
            tier: "premier",
            suggestions: ["whole milk", "skim milk"],
          }),
      }),
    );
    renderPanel({ query: "milk" });
    await act(async () => {
      // Drain BOTH debounces — autocomplete (250ms) + main search (400ms).
      await vi.advanceTimersByTimeAsync(450);
    });
    const row = await screen.findByTestId("fatsecret-autocomplete-row");
    expect(row).toBeInTheDocument();
    expect(row).toHaveTextContent("whole milk");
    expect(row).toHaveTextContent("skim milk");
  });

  it("hides the row on Basic tier (suggestions: [])", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub({
        "/api/usda/search": () => jsonResponse({ ok: true, hits: [] }),
        "openfoodfacts.org": () => jsonResponse({ products: [] }),
        "/api/edamam/search": () => jsonResponse({ ok: true, hits: [] }),
        "/api/fatsecret/autocomplete": () =>
          jsonResponse({ ok: true, tier: "basic", suggestions: [] }),
      }),
    );
    renderPanel({ query: "milk" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(screen.queryByTestId("fatsecret-autocomplete-row")).toBeNull();
  });

  it("does not call autocomplete on empty query", async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ ok: true, hits: [], products: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);
    renderPanel({ query: "" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    const autocompleteCalls = fetchSpy.mock.calls.filter(([u]) =>
      String(u).includes("/api/fatsecret/autocomplete"),
    );
    expect(autocompleteCalls.length).toBe(0);
  });
});

describe("FoodSearchPanel — ENG-1445 sticky commit CTA layout", () => {
  // JSDOM doesn't run a real layout/flex engine, so the "Use this" footer
  // staying pinned at the sheet bottom on scroll can't be asserted from a
  // rendered tree here — it's verified visually (see
  // docs/ux/captures/eng1445-sticky-commit/). This is a source-pin guard
  // against the specific regression that motivated the fix: the preview
  // root reverting to `h-full`, which lets `min-height: auto` win inside
  // the log-sheet's `flex min-h-0 flex-1 flex-col` chain and pushes the
  // footer below the visible sheet.
  const src = readFileSync(
    resolve(__dirname, "../../src/app/components/food-search/FoodSearchPanel.tsx"),
    "utf8",
  );
  // Scope to just the `if (preview && scaled) { ... }` branch — the
  // sibling default-results branch further down legitimately still uses
  // `flex flex-col h-full` (it has no sticky footer below it, so the
  // min-height:auto pitfall doesn't apply there).
  const previewBranchStart = src.indexOf("if (preview && scaled) {");
  const previewBranch = src.slice(previewBranchStart, previewBranchStart + 1200);

  it("the preview root uses min-h-0 + flex-1, not h-full", () => {
    expect(previewBranchStart).toBeGreaterThan(-1);
    expect(previewBranch).toMatch(/flex min-h-0 flex-1 flex-col \$\{px\}/);
    expect(previewBranch).not.toMatch(/flex flex-col h-full \$\{px\}/);
  });

  it("the preview body scrolls independently (flex-1 overflow-y-auto)", () => {
    expect(previewBranch).toMatch(/flex-1 overflow-y-auto pb-3 space-y-4/);
  });

  it("the 'Use this' CTA footer stays out of the scroll region (shrink-0)", () => {
    expect(src).toMatch(
      /border-t border-border bg-card -mx-3 px-3 py-3 shrink-0 flex gap-2/,
    );
  });
});
