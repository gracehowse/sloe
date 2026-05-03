/**
 * Food search "no result" events — registry + cross-platform contract
 * (audit move-blocker #2, 2026-05-02; replaces stale PR #36).
 *
 * Locks the analytics surface so the parity contract between web
 * (`src/app/components/food-search/FoodSearchPanel.tsx`) and mobile
 * (`apps/mobile/components/food-search/FoodSearchPanel.tsx`) cannot
 * silently drift:
 *
 *   - Both events are registered in `src/lib/analytics/events.ts`.
 *   - The string values match the spec ("food_search_no_result" /
 *     "food_search_request_dictionary_add"). PostHog dashboards key
 *     off these literals.
 *   - The mobile panel emits `source: "mobile"` and the web panel
 *     emits `source: "web"` (asserted by source-text inspection so
 *     a future copy-paste between platforms can't accidentally
 *     mislabel the source).
 *   - Both panels render the empty-state container + add-custom +
 *     request-add testIDs so the RTL tests on each side have
 *     stable selectors.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AnalyticsEvents } from "../../src/lib/analytics/events.ts";

const ROOT = path.resolve(__dirname, "../../");

describe("food-search no-result events — registry contract", () => {
  it("registers `food_search_no_result` with the spec string", () => {
    expect(AnalyticsEvents.food_search_no_result).toBe("food_search_no_result");
  });

  it("registers `food_search_request_dictionary_add` with the spec string", () => {
    expect(AnalyticsEvents.food_search_request_dictionary_add).toBe(
      "food_search_request_dictionary_add",
    );
  });

  it("documents the payload shape `{ query, len, source }` in the registry comment", () => {
    const src = readFileSync(
      path.join(ROOT, "src/lib/analytics/events.ts"),
      "utf8",
    );
    // Both events must reference all three payload field names in
    // their adjacent doc-comment so analytics-engineer / dashboards
    // know the contract without reading the panel source.
    const noResultBlock = src.slice(
      src.indexOf("food_search_no_result:"),
      src.indexOf("food_search_request_dictionary_add:"),
    );
    expect(noResultBlock).toMatch(/query/);
    expect(noResultBlock).toMatch(/len/);
    expect(noResultBlock).toMatch(/source/);

    const requestAddStart = src.indexOf("/** User explicitly asked us to add a missing food");
    const requestAddBlock = src.slice(
      requestAddStart,
      src.indexOf("food_search_request_dictionary_add:") + 100,
    );
    expect(requestAddBlock).toMatch(/query/);
    expect(requestAddBlock).toMatch(/len/);
    expect(requestAddBlock).toMatch(/source/);
  });
});

describe("food-search no-result events — cross-platform parity", () => {
  it("mobile panel emits `food_search_no_result` with source: 'mobile'", () => {
    const src = readFileSync(
      path.join(ROOT, "apps/mobile/components/food-search/FoodSearchPanel.tsx"),
      "utf8",
    );
    expect(src).toContain("AnalyticsEvents.food_search_no_result");
    // The emit block uses `source: "mobile"` literal. Match defensively
    // — single OR double quotes, with whitespace tolerance.
    expect(/source:\s*["']mobile["']/.test(src)).toBe(true);
  });

  it("mobile panel emits `food_search_request_dictionary_add`", () => {
    const src = readFileSync(
      path.join(ROOT, "apps/mobile/components/food-search/FoodSearchPanel.tsx"),
      "utf8",
    );
    expect(src).toContain("AnalyticsEvents.food_search_request_dictionary_add");
  });

  it("web panel emits `food_search_no_result` with source: 'web'", () => {
    const src = readFileSync(
      path.join(ROOT, "src/app/components/food-search/FoodSearchPanel.tsx"),
      "utf8",
    );
    expect(src).toContain("AnalyticsEvents.food_search_no_result");
    expect(/source:\s*["']web["']/.test(src)).toBe(true);
  });

  it("web panel emits `food_search_request_dictionary_add`", () => {
    const src = readFileSync(
      path.join(ROOT, "src/app/components/food-search/FoodSearchPanel.tsx"),
      "utf8",
    );
    expect(src).toContain("AnalyticsEvents.food_search_request_dictionary_add");
  });

  it("both panels render the no-result empty state with both CTAs", () => {
    const mobile = readFileSync(
      path.join(ROOT, "apps/mobile/components/food-search/FoodSearchPanel.tsx"),
      "utf8",
    );
    const web = readFileSync(
      path.join(ROOT, "src/app/components/food-search/FoodSearchPanel.tsx"),
      "utf8",
    );
    for (const src of [mobile, web]) {
      expect(src).toContain("food-search-no-result-empty-state");
      expect(src).toContain("food-search-no-result-add-custom");
      expect(src).toContain("food-search-no-result-request-add");
    }
  });

  it("both panels dedupe per (case-insensitive trimmed) query", () => {
    const mobile = readFileSync(
      path.join(ROOT, "apps/mobile/components/food-search/FoodSearchPanel.tsx"),
      "utf8",
    );
    const web = readFileSync(
      path.join(ROOT, "src/app/components/food-search/FoodSearchPanel.tsx"),
      "utf8",
    );
    for (const src of [mobile, web]) {
      // Case-insensitive dedupe key — both panels normalise via
      // toLowerCase() before storing in the dedupe ref.
      expect(src).toContain("toLowerCase()");
      expect(src).toContain("lastNoResultQueryRef");
      expect(src).toContain("dictionaryAddRequestedRef");
    }
  });
});
