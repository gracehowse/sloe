/**
 * Food search "no result" events — registry + cross-platform contract
 * (PR2, audit move-blocker #2, 2026-04-30).
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
});
