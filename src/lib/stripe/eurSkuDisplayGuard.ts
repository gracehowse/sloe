/**
 * ENG-1442 (MP-10/LEGAL-009) — startup safety rail for the
 * shown-£/charged-€ mismatch.
 *
 * The bug this guards against: `resolveProStripePriceId()` (this
 * directory's `resolveProStripePrice.ts`) resolves to a EUR-denominated
 * Stripe Price the instant `STRIPE_PRICE_PRO_MONTHLY_EUR` /
 * `STRIPE_PRICE_PRO_ANNUAL_EUR` are set — but `/pricing` renders the
 * hardcoded GBP strings in `PRICING_TIERS`
 * (`src/lib/landing/pricingTiers.ts`) unconditionally, because no tier's
 * `displayByCurrency.EUR` has ever been populated. Set those two env
 * vars alone, with no other code change, and a EU visitor sees "£7.99"
 * on `/pricing` and gets charged whatever amount is on the EUR Stripe
 * Price object — a shown-price != charged-price defect, activated by a
 * single env var flip.
 *
 * This module is the single readiness check both enforcement points
 * call:
 *   - `scripts/verify-production-env.ts` — the CI/deploy gate. Fails
 *     the build/deploy pipeline unconditionally (not gated by
 *     `VERIFY_STRICT`/`VERCEL_ENV` like the rest of that script's soft
 *     warnings) because this is an active-mischarge risk, not a missing
 *     integration.
 *   - `src/instrumentation.ts` `register()` — the actual Next.js
 *     process-startup hook ("Runs once when the Node.js process
 *     starts"). Throwing here crashes server boot, so even a deploy
 *     that skipped `verify-production-env` (env var added directly in
 *     the Vercel dashboard post-deploy, for example) can't serve live
 *     traffic in the broken state.
 *
 * Deliberately does NOT change `resolveProStripePriceId`'s runtime
 * resolution logic — that function's existing GBP-fallback behaviour
 * (tested in `tests/unit/resolveProStripePrice.test.ts`) is unchanged.
 * The fix is preventing the invalid environment (EUR env set + EUR
 * display not ready) from ever reaching a running process, not
 * reshaping what happens once inside one.
 *
 * See `docs/decisions/2026-07-20-eng1442-currency-display-guard.md`.
 */

import { isEurPricingDisplayReady } from "../landing/pricingTiers";

/** The only two EUR SKU env vars that exist today (Pro monthly/annual —
 *  Free has no Stripe Price). Mirrors `proPriceEnvVar()` in
 *  `resolveProStripePrice.ts`; kept as a literal list here rather than
 *  importing that internal helper so this guard has no dependency on
 *  that module's period-branching logic, only on the env var names. */
const EUR_SKU_ENV_VARS = [
  "STRIPE_PRICE_PRO_MONTHLY_EUR",
  "STRIPE_PRICE_PRO_ANNUAL_EUR",
] as const;

function configuredEurSkuEnvVars(): string[] {
  return EUR_SKU_ENV_VARS.filter((name) => Boolean(process.env[name]?.trim()));
}

export type EurSkuDisplayReadinessResult =
  | { ok: true }
  | { ok: false; message: string; envVars: string[] };

/**
 * Pure check — no throw, no process.exit. Returns `{ ok: true }` when
 * either no EUR SKU env var is set (the safe default today) or the
 * display layer is actually ready for EUR. Returns `{ ok: false, ... }`
 * with an actionable message otherwise.
 */
export function checkEurSkuDisplayReadiness(): EurSkuDisplayReadinessResult {
  const configured = configuredEurSkuEnvVars();
  if (configured.length === 0) return { ok: true };
  if (isEurPricingDisplayReady()) return { ok: true };
  return {
    ok: false,
    envVars: configured,
    message:
      `EUR Stripe Price env var(s) set (${configured.join(", ")}) but the pricing ` +
      "display layer can't render EUR yet. Every checkout-eligible tier in " +
      "PRICING_TIERS (src/lib/landing/pricingTiers.ts) needs a populated " +
      "displayByCurrency.EUR — and PricingTiersGrid needs to actually read it via " +
      "resolveTierDisplay() — before these env vars can be set anywhere. Unset them, " +
      "or finish the EUR display wiring first. See " +
      "docs/decisions/2026-07-20-eng1442-currency-display-guard.md.",
  };
}

/**
 * Throws when EUR SKU env vars are set without EUR display readiness.
 * Call at process startup — see the file-level doc block for exactly
 * where and why.
 */
export function assertEurSkuDisplayReadiness(): void {
  const result = checkEurSkuDisplayReadiness();
  if (!result.ok) {
    throw new Error(`[ENG-1442] ${result.message}`);
  }
}
