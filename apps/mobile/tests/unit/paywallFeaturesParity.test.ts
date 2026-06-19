/**
 * Mobile paywall — feature/value parity with the web SSOT.
 *
 * PR-01 (audit 2026-04-28): Base tier removed; Pro-only paywall.
 *
 * Figma `284:2` rebuild (2026-06-08): the paywall no longer renders the
 * full `PRICING_TIERS.features` bullet list (the frame doesn't show it).
 * Pro's value is now presented as a 2×2 value-prop grid + a FREE/PRO
 * comparison matrix, both reading from a SHARED leaf SSOT
 * (`src/lib/landing/paywallValueProps.ts`) that web `/pricing` also
 * renders — so the two platforms can't drift. The paywall still imports
 * `PRICING_TIERS` from the leaf SSOT for the offline FALLBACK_PRICES.
 *
 * Structural invariants (the parity contract that must not break):
 *   1. The paywall imports `PRICING_TIERS` from the mobile-safe leaf
 *      (not from a hand-rolled copy, not from `content.ts`).
 *   2. The mobile value grid + comparison matrix read their copy from
 *      the shared `paywallValueProps` SSOT — not hand-rolled arrays —
 *      so a feature reworded on one platform reworded on both.
 *   3. The shared SSOT copy is rendered verbatim (the value-prop +
 *      comparison strings appear in the SSOT, which both platforms map
 *      over). The SSOT shape itself is pinned by
 *      `tests/unit/paywallValueProps.test.ts` (web side).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PRICING_TIERS } from "@suppr/shared/landing/pricingTiers";
import {
  PAYWALL_VALUE_PROPS,
  PAYWALL_COMPARISON_ROWS,
  getPaywallComparisonRows,
} from "@suppr/shared/landing/paywallValueProps";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");
const PAYWALL_SRC = readFileSync(PAYWALL_PATH, "utf8");
const VALUE_GRID_SRC = readFileSync(
  resolve(__dirname, "../../components/paywall/PaywallValueGrid.tsx"),
  "utf8",
);
const COMPARISON_SRC = readFileSync(
  resolve(__dirname, "../../components/paywall/PaywallComparison.tsx"),
  "utf8",
);

function tierByName(name: "Pro") {
  const t = PRICING_TIERS.find((x) => x.name === name);
  if (!t) throw new Error(`SSOT is missing the ${name} tier`);
  return t;
}

describe("mobile paywall — SSOT import parity", () => {
  it("imports PRICING_TIERS from the mobile-safe leaf file", () => {
    // The leaf file has no `@/…` aliases and is the only import path
    // that works under the mobile tsconfig. If someone moves this to
    // `src/lib/landing/content` the RN bundler graph blows up.
    expect(PAYWALL_SRC).toMatch(
      /from\s+["'][^"']*@suppr\/shared\/landing\/pricingTiers["']/,
    );
  });

  it("still resolves a Pro tier from the SSOT (fallback price source)", () => {
    const pro = tierByName("Pro");
    expect(pro.price.length).toBeGreaterThan(0);
    expect(pro.annualPrice && pro.annualPrice.length).toBeTruthy();
  });

  it("the value grid reads the shared PAYWALL_VALUE_PROPS SSOT", () => {
    expect(VALUE_GRID_SRC).toMatch(
      /from\s+["'][^"']*@suppr\/shared\/landing\/paywallValueProps["']/,
    );
    expect(VALUE_GRID_SRC).toContain("PAYWALL_VALUE_PROPS");
    // Mapped over (not hand-rolled).
    expect(VALUE_GRID_SRC).toMatch(/PAYWALL_VALUE_PROPS\.map\(/);
  });

  it("the comparison matrix reads the shared SSOT via the flag-gated selector", () => {
    expect(COMPARISON_SRC).toMatch(
      /from\s+["'][^"']*@suppr\/shared\/landing\/paywallValueProps["']/,
    );
    // ENG-1203 — the matrix now renders `getPaywallComparisonRows(flag)`
    // (which derives from `PAYWALL_COMPARISON_ROWS`), not the raw SSOT
    // array, so the two free MFP-switch wins can be gated.
    expect(COMPARISON_SRC).toContain("getPaywallComparisonRows");
    expect(COMPARISON_SRC).toMatch(/\.map\(/);
  });

  it("the comparison matrix gates the MFP-switch wins behind the default-on flag", () => {
    // The kill-switch must be honoured: the component reads
    // `isFeatureEnabled(PAYWALL_FREE_MFP_WINS_FLAG)` and feeds it to the
    // selector. If someone hardcodes the rows, the gate is dead.
    expect(COMPARISON_SRC).toContain("isFeatureEnabled");
    expect(COMPARISON_SRC).toContain("PAYWALL_FREE_MFP_WINS_FLAG");
  });
});

describe("mobile paywall — free MFP-switch wins (ENG-1203)", () => {
  it("the SSOT (mapped by the mobile matrix) carries both free callouts", () => {
    const byKey = Object.fromEntries(
      PAYWALL_COMPARISON_ROWS.map((r) => [r.key, r]),
    );
    // Both genuinely free → ✓/✓ (Pro keeps them too). Labels are what
    // the mobile matrix renders verbatim.
    expect(byKey.free_barcode_scanning.label).toBe("Barcode scanning");
    expect(byKey.free_barcode_scanning.free).toBe(true);
    expect(byKey.free_barcode_scanning.pro).toBe(true);
    expect(byKey.free_custom_macros.label).toBe("Custom macro goals");
    expect(byKey.free_custom_macros.free).toBe(true);
    expect(byKey.free_custom_macros.pro).toBe(true);
  });

  it("the selector drops both callouts when the flag is off (kill switch)", () => {
    const offKeys = getPaywallComparisonRows(false).map((r) => r.key);
    expect(offKeys).not.toContain("free_barcode_scanning");
    expect(offKeys).not.toContain("free_custom_macros");
    const onKeys = getPaywallComparisonRows(true).map((r) => r.key);
    expect(onKeys).toContain("free_barcode_scanning");
    expect(onKeys).toContain("free_custom_macros");
  });
});

describe("mobile paywall — value/comparison copy flows from the SSOT", () => {
  // Each value-prop title + comparison-row label is owned by the shared
  // SSOT and mapped over by both platforms. Guard the SSOT entries so a
  // copy change is a deliberate SSOT edit (which the web parity test
  // also pins), never a silent per-platform reword.
  for (const prop of PAYWALL_VALUE_PROPS) {
    it(`value prop "${prop.title}" is a non-empty SSOT entry`, () => {
      expect(prop.title.length).toBeGreaterThan(0);
      expect(prop.description.length).toBeGreaterThan(0);
    });
  }
  for (const row of PAYWALL_COMPARISON_ROWS) {
    it(`comparison row "${row.label}" is a non-empty SSOT entry`, () => {
      expect(row.label.length).toBeGreaterThan(0);
    });
  }
});
