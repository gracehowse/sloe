/**
 * ENG-931 — instant log from search row (+) parity pin (web + mobile).
 *
 * ENG-1651 (`redesign_search_results` collapsed permanently-on, 2026-07-22)
 * removed mobile's dead old flat-list `renderItem` — and with it,
 * `onQuickLogResult`, since it had no other caller: mobile's redesigned
 * `FoodSearchFeedItem.tsx` was never wired with the equivalent affordance in
 * the first place (a pre-existing gap, not a regression this collapse
 * caused). Web's redesigned `FoodSearchResultRow.tsx` DOES still call
 * `onQuickLogResult` via its `onQuickLog` prop, so web keeps the feature.
 * Tracked to close the mobile gap: ENG-1659.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

const WEB_PANEL = "src/app/components/food-search/FoodSearchPanel.tsx";
const WEB_ROW = "src/app/components/food-search/FoodSearchResultRow.tsx";
const MOBILE_PANEL = "apps/mobile/components/food-search/FoodSearchPanel.tsx";
const MOBILE_FEED_ITEM = "apps/mobile/components/food-search/FoodSearchFeedItem.tsx";

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("ENG-931 — FoodSearchPanel quick-log from search row", () => {
  it("web defines onQuickLogResult (panel) and wires a row + affordance (extracted row component)", () => {
    const panelSrc = read(WEB_PANEL);
    expect(panelSrc).toMatch(/onQuickLogResult\s*=\s*useCallback/);
    expect(panelSrc).toMatch(/ENG-931/);
    expect(panelSrc).toMatch(/GenericBeverage|GenericFood/);
    expect(panelSrc).toMatch(/_source === "OFF"/);
    expect(panelSrc).toMatch(/_source === "USDA"/);

    // ENG-814/ENG-1532 (`redesign_search_results` collapsed permanently-on,
    // ENG-1651) — the row-level affordance now lives in the extracted
    // FoodSearchResultRow.tsx, not inlined in the panel.
    const rowSrc = read(WEB_ROW);
    expect(rowSrc).toMatch(/food-search-quick-log-/);
    expect(rowSrc).toMatch(/onQuickLog/);
  });

  it("quick-log bypasses preview for generic/OFF/USDA with default serving (web)", () => {
    const src = read(WEB_PANEL);
    const fnStart = src.indexOf("onQuickLogResult = useCallback");
    expect(fnStart).toBeGreaterThanOrEqual(0);
    const fnBody = src.slice(fnStart, fnStart + 4500);
    expect(fnBody).toMatch(/onSelect\(/);
    expect(fnBody).toMatch(/await onPickResult\(item\)/);
  });

  it("mobile does not yet have the affordance — known gap, tracked as ENG-1659", () => {
    expect(read(MOBILE_PANEL)).not.toMatch(/onQuickLogResult/);
    expect(read(MOBILE_FEED_ITEM)).not.toMatch(/onQuickLog/);
  });
});
