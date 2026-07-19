/**
 * ENG-1607 — Cookbook single filter row (v3 conformance).
 *
 * The canonical v3 prototype's Cookbook has ONE chip row: provenance
 * (All / Saved / Created / Imported). `library_single_filter_row_v1`
 * ON removes the standing ENG-921 category pill row on BOTH platforms;
 * OFF preserves the legacy two-row stack byte-for-byte (kill switch).
 *
 * Source-wiring test (pattern: libraryFoodFallbackWiring.test.ts) —
 * the Library screens are too entangled with data hooks to render in
 * unit scope, so we assert the gate is wired, on both surfaces, and
 * registered in both flag registries.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = readFileSync(
  resolve(__dirname, "../../src/app/components/Library.tsx"),
  "utf8",
);
const MOBILE = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/(tabs)/library.tsx"),
  "utf8",
);
const WEB_REGISTRY = readFileSync(
  resolve(__dirname, "../../src/lib/analytics/track.ts"),
  "utf8",
);
const MOBILE_REGISTRY = readFileSync(
  resolve(__dirname, "../../apps/mobile/lib/analytics.ts"),
  "utf8",
);

describe("ENG-1607 — library_single_filter_row_v1 gates the category pill row", () => {
  it("web: reads the flag and gates the category row on it", () => {
    expect(WEB).toMatch(
      /const singleFilterRow = isFeatureEnabled\("library_single_filter_row_v1"\)/,
    );
    // The category row renders only on the legacy (flag-off) path.
    expect(WEB).toMatch(/\{singleFilterRow \? null : \(/);
    // Both rows still exist in source — provenance unconditional, category gated.
    expect(WEB).toMatch(/library-provenance-pills/);
    expect(WEB).toMatch(/library-filter-pills/);
  });

  it("mobile: reads the flag and gates the category row on it", () => {
    expect(MOBILE).toMatch(
      /const singleFilterRow = isFeatureEnabled\("library_single_filter_row_v1"\)/,
    );
    expect(MOBILE).toMatch(/\{singleFilterRow \? null : \(/);
    expect(MOBILE).toMatch(/library-provenance-\$\{p\.id\}/);
    expect(MOBILE).toMatch(/library-category-\$\{f\.id\}/);
  });

  it("registers the flag in both KNOWN_DEFAULT_OFF_FLAGS registries (parity)", () => {
    expect(WEB_REGISTRY).toMatch(/"library_single_filter_row_v1"/);
    expect(MOBILE_REGISTRY).toMatch(/"library_single_filter_row_v1"/);
  });

  it("provenance row is NOT gated — it is the single surviving row", () => {
    // The provenance block must appear before the singleFilterRow gate on
    // both surfaces, i.e. outside the gated region.
    expect(WEB.indexOf("library-provenance-pills")).toBeLessThan(
      WEB.indexOf("{singleFilterRow ? null : ("),
    );
    expect(MOBILE.indexOf("LIBRARY_PROVENANCE_PILLS.map")).toBeLessThan(
      MOBILE.indexOf("{singleFilterRow ? null : ("),
    );
  });
});
