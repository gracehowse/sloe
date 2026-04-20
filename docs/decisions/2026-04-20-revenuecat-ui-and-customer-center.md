# Decision: RevenueCat UI package + Customer Center (2026-04-20)

## Context

A RevenueCat integration request came in asking to:

1. Install the RN Purchases SDK (already present at `react-native-purchases@^9.15.2`).
2. Configure with a unified v2 `test_…` key.
3. Rename entitlement to "Suppr Pro".
4. Reshape products to `lifetime` / `yearly` / `monthly` (flat).
5. Swap the custom paywall for the hosted RC Paywall.
6. Add a Customer Center.

Items 3–5 would have been destructive to shipped decisions (pricing-v1, the custom paywall spec by `ui-product-designer`, and live subscribers' entitlements). Items 1, 2, and 6 are additive and safe.

## Decision

Scope of this change:

- **Install `react-native-purchases-ui@^9.15.2`** (matches the existing `react-native-purchases` major). Enables both Customer Center and the hosted Paywall — we use only Customer Center at this stage.
- **Support a unified v2 API key** (`EXPO_PUBLIC_REVENUECAT_API_KEY`) as a fallback to the existing platform-split keys. Prod continues to use split keys; the unified key is a dev/sandbox convenience so a single `test_…` key works on both platforms without re-entering two vars.
- **Add a "Manage subscription" row on the settings screen** for any user with `userTier !== "free"`. Calls `RevenueCatUI.presentCustomerCenter()` via dynamic import; falls back to the App Store / Play Store subscription URL when the native UI module is unavailable (Expo Go, web).

## Explicitly out of scope

- **Custom paywall → hosted RC Paywall.** The custom paywall at `apps/mobile/app/paywall.tsx` is the canonical sell per `ui-product-designer` round-1 (2026-04-19) and carries pricing-v1 trial-on-Pro-annual rules + analytics funnel F2 wiring. Swapping would regress both. Routed to `monetisation-architect` + `product-lead` for any future reconsideration.
- **Entitlement rename (`pro` → "Suppr Pro").** Renaming the dashboard entitlement would de-entitle every live subscriber at the moment the rename lands. Not a code change — a RC-dashboard migration. Out of scope here.
- **Lifetime SKU + flat product list.** Pricing-v1 (see [`2026-04-19-pricing-v1.md`](2026-04-19-pricing-v1.md)) intentionally does not include a lifetime product. Adding one is a `monetisation-architect` decision.

## Why

- Keeps the "manage my plan" gap filled without ripping up specced surfaces.
- Reversible: turning Customer Center off later is a one-line guard; rolling back the unified-key fallback is a two-line env-var removal.
- No existing subscriber is affected — nothing changes about entitlements, products, pricing, or the custom paywall.

## References

- `apps/mobile/lib/purchases.ts` — key resolution + `presentCustomerCenter()` helper
- `apps/mobile/app/(tabs)/settings.tsx` — "Manage subscription" row
- `apps/mobile/tests/unit/revenueCatKeyFallback.test.ts`
- `apps/mobile/tests/unit/customerCenterEntryPoint.test.ts`
- [`2026-04-19-pricing-v1.md`](2026-04-19-pricing-v1.md)
- [`2026-04-19-billing-architecture-pattern-a.md`](2026-04-19-billing-architecture-pattern-a.md)
- [`2026-04-revenuecat-offerings-empty.md`](2026-04-revenuecat-offerings-empty.md)
