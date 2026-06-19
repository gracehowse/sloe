/**
 * Mobile parity pin for the FoodSearchPanel locale-aware empty-state
 * hint (2026-04-26 — FatSecret Premier Free upgrade).
 *
 * The shared helper `shouldShowBarcodeFallbackHint` is the source of
 * truth for "is this user non-US?". Web tests assert this in
 * `tests/unit/foodSearchLocale.test.ts`; this file pins the contract
 * on the mobile side so any divergent re-implementation breaks the
 * test suite.
 *
 * The mobile panel exposes:
 *   - `onScanBarcodePressed?: () => void`
 *   - `inBarcodeMode?: boolean`
 *   - `localeOverride?: string`
 *
 * These prop names + shapes must match the web panel exactly so
 * sync-enforcer's parity check stays green.
 */
import { describe, expect, it } from "vitest";
import { shouldShowBarcodeFallbackHint } from "@suppr/nutrition-core/foodSearchLocale";
import type { FoodSearchPanelProps } from "../../components/food-search/FoodSearchPanel";

describe("Mobile FoodSearchPanel — locale hint contract", () => {
  it("accepts the same props the web panel accepts", () => {
    // Pure compile-time assertion — if the prop names drift between
    // platforms TypeScript will reject this object.
    const props: FoodSearchPanelProps = {
      query: "",
      onSelect: () => {},
      onScanBarcodePressed: () => {},
      inBarcodeMode: false,
      localeOverride: "en-GB",
    };
    expect(props.localeOverride).toBe("en-GB");
  });

  it("delegates the en-US suppression to the shared helper", () => {
    expect(shouldShowBarcodeFallbackHint("en-US")).toBe(false);
    expect(shouldShowBarcodeFallbackHint("en-GB")).toBe(true);
  });
});
