/**
 * ENG-698 — Paywall default billing period unified to monthly.
 *
 * Grace's decision (2026-05-25): retire the web-monthly/mobile-annual
 * divergence and unify both to monthly. The mobile change is feature-
 * flagged (`paywall-default-monthly`) so it can be ramped via PostHog
 * without a code deploy.
 *
 * This file pins:
 *   1. The flag name used in paywall.tsx is `paywall-default-monthly`
 *      (not a typo or renamed variant).
 *   2. `isFeatureEnabled` is imported from @/lib/analytics in the
 *      paywall — proving the flag gate is wired, not just referenced
 *      in a dead comment.
 *   3. `"annual"` is still present as the fallback default (ensures
 *      the annual SKU + 7-day trial still shows when the flag is off).
 *   4. The trial-applies guard (`trialApplies = billing === "annual"`)
 *      is unchanged — trial disclosure is only shown for annual, which
 *      is still reachable via the period toggle.
 *
 * Reference: docs/decisions/2026-05-25-sweep-parity-ia-pricing-resolutions.md
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");
const SRC = readFileSync(PAYWALL_PATH, "utf8");

describe("ENG-698 — paywall default billing period unification", () => {
  it("imports isFeatureEnabled from @/lib/analytics", () => {
    expect(SRC).toMatch(/import\s*\{[^}]*isFeatureEnabled[^}]*\}\s*from\s*"@\/lib\/analytics"/);
  });

  it("uses the canonical flag name `paywall-default-monthly`", () => {
    expect(SRC).toMatch(/isFeatureEnabled\(\s*"paywall-default-monthly"\s*\)/);
  });

  it("returns `monthly` when flag is on", () => {
    expect(SRC).toMatch(/isFeatureEnabled\([^)]+\)\s*\?\s*"monthly"/);
  });

  it("falls back to `annual` when flag is off (trial-SKU safety net)", () => {
    expect(SRC).toMatch(/:\s*"annual"/);
  });

  it("trial-applies guard is tied to billing===annual (trial stays discoverable via toggle)", () => {
    expect(SRC).toMatch(/trialApplies\s*=\s*billing\s*===\s*"annual"/);
  });
});
