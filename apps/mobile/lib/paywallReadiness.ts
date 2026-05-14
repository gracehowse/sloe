/**
 * paywallReadiness — classify the IAP wiring state so the paywall
 * can render the right diagnostic + fire one analytics event per
 * mount with the resolved state.
 *
 * **Authority:** ENG-101 + `docs/operations/iap-launch-checklist.md`.
 *
 * The 2026-04-30 audit flagged "Subscriptions unavailable" rendering
 * indistinguishably for three different root causes:
 *   - the EXPO_PUBLIC_REVENUECAT_*_KEY env var isn't baked into the
 *     build (`reason: "no-api-key"`),
 *   - the key is present but RevenueCat returned an empty `current`
 *     offering — usually because the RC dashboard hasn't been wired
 *     to App Store Connect StoreKit products yet (`reason:
 *     "empty-offering"`),
 *   - `getOfferings()` threw — network, SDK init, or an
 *     unrecoverable RC error (`reason: "error"`).
 *
 * Each case needs a different next-action — env var vs dashboard
 * config vs network retry. This module gives the paywall a single
 * source of truth for which one we're in, and the analytics event
 * (`paywall_readiness`) lets Grace verify TestFlight + production
 * builds resolve to `ok` without manually opening the paywall.
 *
 * Pure module — no React, no I/O. The paywall provides `packages`
 * + `hasApiKey` + `errored`; this returns the readiness verdict.
 */

export type PaywallReadinessReason =
  | "ok"
  | "no-api-key"
  | "empty-offering"
  | "error";

export interface PaywallReadinessInput {
  /** Result of `isPurchasesApiKeyPresent()`. */
  hasApiKey: boolean;
  /** Packages array returned by `getOfferings()`. Empty if RC
   *  returned no `current` offering or no `availablePackages`. */
  packages: { length: number } | ReadonlyArray<unknown>;
  /** True if `getOfferings()` threw — surfaced from the catch path
   *  in the paywall's effect. */
  errored?: boolean;
}

export interface PaywallReadinessResult {
  /** `true` when the paywall can actually present plans. */
  ready: boolean;
  /** Machine-readable reason; safe to ship to PostHog. */
  reason: PaywallReadinessReason;
  /** One-line operator-facing message — used in analytics + the
   *  dev-only banner. Never user-facing. */
  diagnostic: string;
  /** What the operator (Grace) should do next. */
  nextAction: string;
}

export function classifyPaywallReadiness(
  input: PaywallReadinessInput,
): PaywallReadinessResult {
  const pkgCount =
    "length" in input.packages ? input.packages.length : 0;

  if (input.errored) {
    return {
      ready: false,
      reason: "error",
      diagnostic:
        "getOfferings() threw — likely network or RC SDK init failure.",
      nextAction:
        "Retry once. If it persists, check the RevenueCat status page and the network. If keys recently rotated, redeploy the app with the new EAS Secrets.",
    };
  }

  if (!input.hasApiKey) {
    return {
      ready: false,
      reason: "no-api-key",
      diagnostic:
        "EXPO_PUBLIC_REVENUECAT_APPLE_KEY / _GOOGLE_KEY / _API_KEY is not baked into the build.",
      nextAction:
        "Set the platform-specific RevenueCat key in EAS Secrets and rebuild. See docs/operations/iap-launch-checklist.md §1.",
    };
  }

  if (pkgCount === 0) {
    return {
      ready: false,
      reason: "empty-offering",
      diagnostic:
        "API key present but RevenueCat's current offering has no packages.",
      nextAction:
        "Open the RC dashboard → Offerings → confirm the `current` offering has packages attached AND those packages reference App Store Connect StoreKit product IDs in 'Ready to Submit' or 'Approved'. See docs/operations/iap-launch-checklist.md §2-§3.",
    };
  }

  return {
    ready: true,
    reason: "ok",
    diagnostic: `RC offering loaded with ${pkgCount} package${pkgCount === 1 ? "" : "s"}.`,
    nextAction: "No action — paywall is ready.",
  };
}
