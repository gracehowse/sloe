# IAP launch checklist — RevenueCat + StoreKit + EAS wiring

**Owner:** Grace (only-Grace dashboard work).
**Authority:** [ENG-101](https://linear.app/suppr/issue/ENG-101/).
**Status as of 2026-05-13:** code wiring complete + diagnostic
telemetry shipped; dashboard + EAS Secrets work pending.

The mobile paywall code is fully wired: `lib/purchases.ts` configures
the RevenueCat SDK with the platform-specific key, `getOfferings()`
hydrates packages, `classifyPackage()` resolves tier × period, and
`syncTierToSupabase()` runs the post-purchase reconcile. The
`paywall_readiness` analytics event fires once per paywall mount
with one of `{ ok, no-api-key, empty-offering, error }` so PostHog
can alarm on builds that don't reach `ok`.

What still has to happen — and only Grace can do it — is the
operational wiring across three dashboards. Work top-to-bottom; each
step depends on the one above.

---

## 1. EAS Secrets — bake the RevenueCat key into the build

The SDK resolves the key from `Constants.expoConfig?.extra` or
`process.env.EXPO_PUBLIC_REVENUECAT_*_KEY` (see
`apps/mobile/lib/purchases.ts:25-37`). Production builds get the
value via EAS Secrets.

**Action:**

```bash
# From repo root
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_APPLE_KEY --value "appl_..."
# (Android comes later; iOS-only until then per project_ios_only_no_android memory.)
```

Or set via the EAS dashboard: Project → Secrets → +Add → name
`EXPO_PUBLIC_REVENUECAT_APPLE_KEY`, scope `project`, value
`appl_…` (the iOS public API key from RC Project Settings → API
keys → Apple App Store).

**Verify:** the next `eas build --profile production` should fail
the build silently if the secret isn't found. After the build
boots, the `paywall_readiness` event should report
`reason: "empty-offering"` (key present, offering empty) instead
of `"no-api-key"`.

---

## 2. App Store Connect — create the StoreKit products

RevenueCat references App Store Connect product IDs, not its own
SKUs. The products must exist and be in **Ready to Submit** or
**Approved** before RC can serve them.

**Action (App Store Connect → My Apps → Suppr → Subscriptions):**

1. Create subscription group **"Suppr Pro"**.
2. Add two products inside the group:
   - **Pro Monthly** — product ID `pro_monthly_v1`, recurring 1
     month, base price £7.99 (UK; let Apple's price-tier matrix
     handle EU / US auto-conversion).
   - **Pro Annual** — product ID `pro_annual_v1`, recurring 1
     year, base price £71.88 (£5.99/mo equivalent, gives the
     "Save 37%" badge the math).
3. **Trial:** add a 7-day **Free Trial** introductory offer on
   the annual product only (matches the pricing decision).
4. Fill the required localised display name + description +
   review screenshot for each. App Store will reject the build
   submission without these.
5. Status: each product must read **Ready to Submit** (or
   **Approved** after the first build is reviewed).

**Verify:** open StoreKit in Xcode → Configuration → "Sync from
App Store" — both products should pull in.

---

## 3. RevenueCat — point Offerings at the StoreKit products

RC's dashboard turns App Store products into the `packages` the
SDK ships. Until the offering is wired and marked `current`, the
SDK returns `[]` and the paywall renders the
"Subscriptions unavailable" card.

**Action (RC dashboard → Products → Add):**

1. Add **Pro Monthly** — Identifier `pro_monthly_v1`, Store
   Apple App Store, App Store Product Identifier
   `pro_monthly_v1`.
2. Add **Pro Annual** — Identifier `pro_annual_v1`, Store
   Apple App Store, App Store Product Identifier
   `pro_annual_v1`.

**Action (RC dashboard → Entitlements → Add):**

3. Add entitlement **`pro`**. Attach both products above.
4. (Optional, for legacy users) Add entitlement **`base`** with
   no products attached — keeps `isBaseEntitled()` honest for
   anyone we grandfather in via promo codes.

**Action (RC dashboard → Offerings → Add):**

5. Create offering identifier **`default`** (or whatever the
   `$rc_…` placeholder resolves to). Mark it **Current**.
6. Attach two packages:
   - Package `$rc_monthly` → product `pro_monthly_v1`.
   - Package `$rc_annual` → product `pro_annual_v1`.

**Verify:** RC dashboard → Sandbox testers → install a TestFlight
build → boot the paywall → both cards render with Apple-localised
prices. `paywall_readiness` event reports `reason: "ok"`.

---

## 4. RevenueCat server webhook — already shipped

The `app/api/revenuecat-webhook/route.ts` endpoint exists and writes
`profiles.user_tier` via service-role (T2 lockdown bypass). See
`docs/decisions/2026-04-24-revenuecat-webhook-architecture.md` for
the full design + `docs/operations/revenuecat-webhook-runbook.md`
for replay/debug.

**Action:** in RC dashboard → Project Settings → Integrations →
Webhook, add `https://suppr.app/api/revenuecat-webhook` and paste
the shared-secret matching `REVENUECAT_WEBHOOK_SECRET` in Vercel
env. Send a test event from the RC UI and confirm a 200.

---

## 5. Smoke test via TestFlight

1. Sandbox tester account in App Store Connect (different Apple
   ID from Grace's primary) → sign into iOS Settings → Developer.
2. Install the next TestFlight build.
3. Open paywall. Expect: both cards, real prices, "Start 7-Day Free
   Trial" CTA on the annual one.
4. Tap subscribe → sandbox purchase flow → confirm
   `paywall_purchase_completed` analytics event + tier flips to
   `pro` within ~3s (RC webhook write).
5. Cancel from iOS Settings → Subscriptions → confirm tier stays
   `pro` until renewal date (Suppr never client-side downgrades
   per `resolveNextTier`).

---

## Failure modes mapped to `paywall_readiness.reason`

| `reason`          | What it means                                       | Fix                                |
| ----------------- | --------------------------------------------------- | ---------------------------------- |
| `no-api-key`      | EAS Secret not baked into the build.                | §1 above. Rebuild.                 |
| `empty-offering`  | Key present; RC `current` offering has no packages. | §2 + §3 above. No rebuild needed.  |
| `error`           | `getOfferings()` threw (network / SDK).             | Retry. Check RC status page.       |
| `ok`              | All wired.                                          | None.                              |

---

## Linked

- Decision: [2026-04-24 RevenueCat webhook architecture](../decisions/2026-04-24-revenuecat-webhook-architecture.md)
- Decision: [2026-04-25 RevenueCat webhook runbook](../decisions/2026-04-25-revenuecat-webhook-runbook.md)
- Decision: [2026-04 RevenueCat empty offerings UX](../decisions/2026-04-revenuecat-offerings-empty.md)
- Runbook: [RevenueCat webhook runbook](./revenuecat-webhook-runbook.md)
- Code: [apps/mobile/lib/purchases.ts](../../apps/mobile/lib/purchases.ts), [apps/mobile/lib/paywallReadiness.ts](../../apps/mobile/lib/paywallReadiness.ts), [apps/mobile/app/paywall.tsx](../../apps/mobile/app/paywall.tsx)
