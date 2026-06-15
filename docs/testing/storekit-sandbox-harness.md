# StoreKit sandbox harness (ENG-1179)

Local subscription lifecycle testing without waiting on App Store Connect product approval.

## Files

| Path | Purpose |
|------|---------|
| `apps/mobile/storekit/SupprPro.storekit` | Xcode StoreKit configuration — `pro_monthly_v1`, `pro_annual_v1`, 7-day free trial |
| `apps/mobile/plugins/withStoreKitConfiguration.js` | Expo config plugin — copies `.storekit` into `ios/` on prebuild |

## Setup

1. Run prebuild (or open the existing `ios/` workspace after plugin runs):

   ```bash
   cd apps/mobile && npx expo prebuild --platform ios
   ```

2. In Xcode: **Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration** → select `SupprPro.storekit`.

3. Launch on Simulator. Open `/paywall` and complete a sandbox purchase.

## What to verify

- [ ] Offerings hydrate (`paywall_readiness` → `ok` in PostHog)
- [ ] Monthly + annual prices render from StoreKit config
- [ ] Trial disclosure matches 7-day intro offer
- [ ] Purchase → Pro entitlements → `syncTierToSupabase` promotes tier
- [ ] Restore purchases on a second sim launch
- [ ] Cancel / expire via **Debug → StoreKit → Manage Transactions**

## RevenueCat note

RevenueCat still needs dashboard wiring for production (`docs/operations/iap-launch-checklist.md`). The StoreKit file unblocks **local** lifecycle QA while ASC products are in "Ready to Submit".
