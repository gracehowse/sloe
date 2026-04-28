/**
 * Mobile paywall features parity (sync-enforcer discretionary, round-6).
 *
 * PR-01 (audit 2026-04-28): Base tier removed from the SSOT per the
 * 2026-04-27 strategic direction. Mobile paywall already hides Base
 * via `SHOW_BASE_TIER = false`; the full code excision lands in batch
 * 20 (collapse the dialog Variant A/B + remove the Base block from
 * `paywall.tsx`). This test now defends the Pro-only parity contract.
 *
 * The mobile paywall lists the Pro feature bullets so users can see
 * what the tier includes. Those bullets MUST stay in sync with the
 * web SSOT in `src/lib/landing/content.ts` — any drift (a feature
 * silently added, removed, or reworded on one platform only) is a
 * parity bug that can escape review.
 *
 * Mobile reads `PRICING_TIERS` directly from the leaf SSOT file
 * `src/lib/landing/pricingTiers.ts` (see the big comment near
 * `paywall.tsx:57` for the historical context — the `@/` alias
 * resolution in `apps/mobile/tsconfig.json` did not cover
 * `src/lib/landing/content.ts`' full import graph, so the leaf file
 * was split out as a mobile-safe import).
 *
 * Structural invariants:
 *   1. Mobile imports `PRICING_TIERS` from the leaf SSOT (not from a
 *      hand-rolled copy, and not from `content.ts`' web entry-point).
 *   2. Mobile renders feature bullets by iterating over the imported
 *      `features` array (i.e. `PRO_FEATURES.map`) — NOT as a separate
 *      inlined array whose strings can drift.
 *   3. If the paywall ever goes back to inlining the feature strings
 *      as literals, every feature in the SSOT must appear verbatim in
 *      the source (fallback assertion).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PRICING_TIERS } from "../../../../src/lib/landing/pricingTiers";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");
const PAYWALL_SRC = readFileSync(PAYWALL_PATH, "utf8");

function tierByName(name: "Pro") {
  const t = PRICING_TIERS.find((x) => x.name === name);
  if (!t) throw new Error(`SSOT is missing the ${name} tier`);
  return t;
}

const PRO_TIER = tierByName("Pro");

describe("mobile paywall — feature parity with the web SSOT", () => {
  it("imports PRICING_TIERS from the mobile-safe leaf file", () => {
    // The leaf file has no `@/…` aliases and is the only import path
    // that works under the mobile tsconfig. If someone moves this to
    // `src/lib/landing/content` the RN bundler graph blows up.
    expect(PAYWALL_SRC).toMatch(
      /from\s+["'][^"']*\/src\/lib\/landing\/pricingTiers["']/,
    );
  });

  it("iterates the SSOT features (no hand-rolled mobile feature array)", () => {
    // The paywall renders features via the imported array. If someone
    // replaces this with a literal array, the assertion flips and the
    // fallback block below takes over as the guard.
    expect(PAYWALL_SRC).toContain("const PRO_FEATURES = PRO_TIER.features");
  });

  /**
   * Fallback guard: if the paywall ever stops iterating the SSOT
   * arrays and starts inlining strings instead, every SSOT feature
   * string must appear verbatim in the source. That's the last line
   * of defence before feature-list drift escapes review.
   */
  describe("fallback — if features get inlined, they must match the SSOT verbatim", () => {
    const usesSsotArrays = PAYWALL_SRC.includes(
      "const PRO_FEATURES = PRO_TIER.features",
    );

    for (const feature of PRO_TIER.features) {
      it(`Pro feature "${feature}" either flows from the SSOT or appears verbatim in paywall.tsx`, () => {
        if (usesSsotArrays) return;
        expect(PAYWALL_SRC).toContain(feature);
      });
    }
  });
});
