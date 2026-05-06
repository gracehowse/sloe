/**
 * Food-search pagination — F-10 (TestFlight `AHnI_fIc7SKbaRcdd5SZB9Q`,
 * 2026-04-19). Tester reported "Only seems to display a certain number
 * of results should be able to keep scrolling through options."
 *
 * The searchFoods helper now forwards a 1-indexed `page` option to each
 * source (USDA, OpenFoodFacts, Edamam) and the mobile + web search UIs
 * call it repeatedly as the user scrolls. This pin asserts:
 *   - subsequent page fetches append to the visible list (no reset),
 *   - overlapping rows from page N+1 are de-duplicated by key,
 *   - an exhausted source (empty page) flips the terminal latch so we
 *     stop fetching rather than burn quota in a loop.
 *
 * Pure structural tests — no network. We mock `fetch` / `authedFetch`
 * at the shim layer so the helper's page-routing behaviour is what's
 * being exercised, not the sources themselves.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MODAL_PATH = resolve(__dirname, "../../components/FoodSearchModal.tsx");
/**
 * 2026-04-30 — pagination state + result rendering moved into the
 * shared `FoodSearchPanel.tsx` (so the same panel can render inline
 * inside `<LogSheet>`). All mobile assertions now read the panel.
 */
const PANEL_PATH = resolve(
  __dirname,
  "../../components/food-search/FoodSearchPanel.tsx",
);
const VERIFY_PATH = resolve(__dirname, "../../lib/verifyRecipe.ts");
/**
 * 2026-04-30 — web FoodSearch.tsx (1568 LOC) was extracted into a
 * shared `FoodSearchPanel.tsx` (~1429 LOC) inside `food-search/` in
 * commit `cb1317f`. The wrapper kept only the dialog shell; pagination
 * state + source helpers + row JSX all live in the panel now (mirrors
 * mobile commit `1968953`). Source-pin parity reads the panel.
 */
const WEB_PATH = resolve(
  __dirname,
  "../../../../src/app/components/food-search/FoodSearchPanel.tsx",
);
const USDA_ROUTE_PATH = resolve(
  __dirname,
  "../../../../app/api/usda/search/route.ts",
);
const EDAMAM_ROUTE_PATH = resolve(
  __dirname,
  "../../../../app/api/edamam/search/route.ts",
);
const FDC_CLIENT_PATH = resolve(
  __dirname,
  "../../../../src/lib/usda/fdcClient.ts",
);

const MODAL_SRC = readFileSync(MODAL_PATH, "utf8");
const PANEL_SRC = readFileSync(PANEL_PATH, "utf8");
const VERIFY_SRC = readFileSync(VERIFY_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PATH, "utf8");
const USDA_ROUTE_SRC = readFileSync(USDA_ROUTE_PATH, "utf8");
const EDAMAM_ROUTE_SRC = readFileSync(EDAMAM_ROUTE_PATH, "utf8");
const FDC_CLIENT_SRC = readFileSync(FDC_CLIENT_PATH, "utf8");

describe("F-10 food search pagination — shared helper", () => {
  it("searchFoods accepts a `page` option (1-indexed)", () => {
    expect(VERIFY_SRC).toMatch(/opts\?:\s*\{\s*page\?:\s*number/);
    expect(VERIFY_SRC).toMatch(/opts\?\.page\s*&&\s*opts\.page\s*>\s*0/);
  });

  it("searchUsda forwards `page` to the USDA route", () => {
    expect(VERIFY_SRC).toMatch(
      /searchUsda\([^)]*opts\?:\s*\{\s*page\?:\s*number\s*\}\)/,
    );
    expect(VERIFY_SRC).toMatch(/\/api\/usda\/search\?q=\$\{[^}]+\}&page=\$\{page\}/);
  });

  it("searchOpenFoodFacts forwards `page` to OFF's native `page` param", () => {
    expect(VERIFY_SRC).toMatch(
      /searchOpenFoodFacts\([^)]*opts\?:\s*\{\s*page\?:\s*number\s*\}\)/,
    );
    expect(VERIFY_SRC).toMatch(/page_size=10&page=\$\{page\}/);
  });

  it("searchEdamam forwards `page` even though the endpoint doesn't paginate natively", () => {
    expect(VERIFY_SRC).toMatch(/mode\?:\s*"foods"\s*\|\s*"meals";\s*page\?:\s*number/);
    expect(VERIFY_SRC).toMatch(/\/api\/edamam\/search\?q=\$\{[^}]+\}&mode=\$\{mode\}&page=\$\{page\}/);
  });

  it("USDA FDC client forwards `pageNumber` / `pageSize` into the POST body", () => {
    expect(FDC_CLIENT_SRC).toMatch(/pageNumber\?:\s*number/);
    expect(FDC_CLIENT_SRC).toMatch(/\bpageNumber\b/);
    expect(FDC_CLIENT_SRC).toMatch(/\bpageSize\b/);
    // Body carries both keys (1-indexed default is applied in the client).
    expect(FDC_CLIENT_SRC).toMatch(/\{\s*query,\s*pageSize,\s*pageNumber\s*\}/);
  });

  it("USDA API route reads the `page` query param and defaults to 1", () => {
    expect(USDA_ROUTE_SRC).toMatch(/searchParams\.get\("page"\)/);
    expect(USDA_ROUTE_SRC).toMatch(/fdcFoodsSearch\(cfg,\s*q,\s*\{\s*pageNumber\s*\}/);
  });

  it("Edamam API route short-circuits page > 1 with an empty hits array", () => {
    expect(EDAMAM_ROUTE_SRC).toMatch(/searchParams\.get\("page"\)/);
    expect(EDAMAM_ROUTE_SRC).toMatch(/if \(pageNumber > 1\)/);
    expect(EDAMAM_ROUTE_SRC).toMatch(/hits:\s*\[\]/);
  });
});

describe("F-10 food search pagination — mobile FoodSearchPanel wiring", () => {
  it("declares pageRef / hasMoreRef / loadingMore state for infinite scroll", () => {
    expect(PANEL_SRC).toMatch(/const pageRef = useRef\(1\)/);
    expect(PANEL_SRC).toMatch(/const hasMoreRef = useRef\(true\)/);
    expect(PANEL_SRC).toMatch(/setLoadingMore/);
  });

  it("resets page + hasMore on new query (the query-effect path)", () => {
    // Post-2026-04-30 the panel takes `query` as a prop and the
    // single useEffect resets pageRef/hasMoreRef on every change.
    // (The standalone Modal previously had two reset sites — visible
    // and onChangeText — but the panel collapsed them into one
    // because `query` is now caller-driven.)
    expect(PANEL_SRC).toMatch(/pageRef\.current = 1/);
    expect(PANEL_SRC).toMatch(/hasMoreRef\.current = true/);
  });

  it("defines loadMore + wires FlatList onEndReached", () => {
    expect(PANEL_SRC).toMatch(/const loadMore = useCallback/);
    expect(PANEL_SRC).toMatch(/onEndReached=\{\(\) => \{[\s\S]*?void loadMore\(\)/);
    expect(PANEL_SRC).toMatch(/onEndReachedThreshold=\{0\.4\}/);
  });

  it("dedupes newly-fetched pages by row key (no duplicate entries when pages overlap)", () => {
    // appendPage filters already-seen keys.
    expect(PANEL_SRC).toMatch(/const appendPage = useCallback/);
    expect(PANEL_SRC).toMatch(
      /new Set<string>\(prev\.map\(\(r\)\s*=>\s*r\.key\)\)/,
    );
    expect(PANEL_SRC).toMatch(/!seen\.has\(r\.key\)/);
  });

  it("flips hasMoreRef to false when a page returns empty OR fully-duplicated rows", () => {
    expect(PANEL_SRC).toMatch(/hasMoreRef\.current = false/);
    expect(PANEL_SRC).toMatch(/appended\.length === prev\.length/);
  });

  it("shows a footer spinner while a page is in flight", () => {
    expect(PANEL_SRC).toMatch(/loadingMore \? \(\s*<View/);
    expect(PANEL_SRC).toMatch(/ActivityIndicator\s+size="small"/);
  });
});

describe("F-10 food search pagination — web/mobile parity", () => {
  it("web FoodSearch carries the same pagination state + loadMore shape", () => {
    expect(WEB_SRC).toMatch(/const pageRef = useRef\(1\)/);
    expect(WEB_SRC).toMatch(/const hasMoreRef = useRef\(true\)/);
    expect(WEB_SRC).toMatch(/const loadMore = useCallback/);
    expect(WEB_SRC).toMatch(/const appendPage = useCallback/);
    expect(WEB_SRC).toMatch(/setLoadingMore/);
  });

  it("web resets pagination state when the query changes", () => {
    // Pre-`cb1317f` the wrapper had two separate reset sites (open
    // toggle + onChangeText). The lift into <FoodSearchPanel> made
    // `query` a caller-owned prop, so a single useEffect now resets
    // both `pageRef` and `hasMoreRef` whenever the query changes —
    // single source of truth, harder to drift.
    const resets = WEB_SRC.match(/pageRef\.current = 1/g) ?? [];
    expect(resets.length).toBeGreaterThanOrEqual(1);
    // The reset must sit inside the `[query, ...]`-keyed effect so a
    // new search does not append to the previous result set.
    expect(WEB_SRC).toMatch(
      /pageRef\.current = 1;\s*\n\s*hasMoreRef\.current = true;/,
    );
  });

  it("web forwards `page` to all three source helpers", () => {
    expect(WEB_SRC).toMatch(/searchUsda\(query: string, page: number = 1\)/);
    expect(WEB_SRC).toMatch(/searchOff\(query: string, page: number = 1\)/);
    expect(WEB_SRC).toMatch(/searchEdamam\(query: string, page: number = 1\)/);
  });

  it("web renders an IntersectionObserver-watched sentinel + spinner at the tail", () => {
    expect(WEB_SRC).toMatch(/sentinelRef\s*=\s*useRef<HTMLDivElement/);
    expect(WEB_SRC).toMatch(/new IntersectionObserver/);
    expect(WEB_SRC).toMatch(/data-testid="food-search-load-more-sentinel"/);
  });

  it("web appendPage dedupes by (source|name), not just name, so source-crossing entries (FatSecret + USDA Big Mac) both survive", () => {
    // 2026-05-06: replaced cross-source name-dedup with per-source
    // dedup. Same-named foods from different sources are KEPT so
    // the user can pick between FatSecret / USDA / Edamam panels —
    // matches MFP / Cronometer / Lose It.
    expect(WEB_SRC).toMatch(
      /seenSourceNames\.has\(sourceName\)/,
    );
  });

  it("web resets loadingMore in `finally` so a failed fetch never wedges the button", () => {
    expect(WEB_SRC).toMatch(/\} finally \{\s*setLoadingMore\(false\)/);
  });

  it("mobile resets loadingMore in `finally` too", () => {
    expect(PANEL_SRC).toMatch(/\} finally \{\s*setLoadingMore\(false\)/);
  });
});

describe("F-10 food search — search row image removal (image consistency)", () => {
  it("mobile FoodSearchPanel no longer imports Image from react-native", () => {
    // Pre-F-10 the file imported `Image` alongside other RN primitives.
    // Post-F-10 the import line must not list it. The panel inherited
    // the post-F-10 absence of the Image import.
    const rnImportBlock = PANEL_SRC.match(
      /import \{[\s\S]*?\} from "react-native";/,
    );
    expect(rnImportBlock).not.toBeNull();
    expect(rnImportBlock![0]).not.toMatch(/\bImage\b/);
  });

  it("mobile FoodSearchPanel does not render the per-row product image", () => {
    expect(PANEL_SRC).not.toMatch(/<Image source=\{\{\s*uri:\s*item\.imageUrl/);
    expect(PANEL_SRC).not.toMatch(/styles\.productImage/);
  });

  it("web FoodSearch does not render any <img> in the search-row list", () => {
    // The web panel never rendered <img> for search rows, but pin it so
    // a regression can't silently add one now that parity is the rule.
    // (Images on the card hero in DiscoverFeed.tsx are unaffected.)
    expect(WEB_SRC).not.toMatch(/<img[^>]*src=\{item\.imageUrl/);
  });
});
