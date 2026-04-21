# D9 Promo-code move — backlog (2026-04-21)

Per `docs/planning/design-system-sweep-plan-2026-04-21.md` §D9 Option 3: MOVE promo-code redemption off Settings to `/pricing` (web) and paywall (mobile).

## Critical path

```
M2 (slate→tokens on /pricing)   [shipped ea5f798]
  └─ W1+W2 (web /pricing promo block, replaces footnote)   [shipped — PromoCodeBlock.tsx]
       └─ S2 (remove from web Settings + dead-prop cleanup)

M3 (mobile paywall gradient hero)   [shipped 9505e89]
  └─ M1 (mobile paywall promo block)
       └─ S1 (remove from mobile Settings)

A1 (analytics instrumentation) — after W1+M1
T1 (unit tests for shared promo logic) — after S1+S2
T2 (Maestro E2E) — after M1
```

Settings removal on each platform cannot merge until the replacement surface on that platform is live.

---

## TASK W1 — Web /pricing promo expander

- **Problem:** `app/pricing/page.tsx` has a footnote "Have a promo code? Redeem it in Settings." No actual redemption surface on /pricing today.
- **Goal:** "Have a promo code?" text-button that expands inline to input + Apply. Calls `redeemPromoCode` from `AppDataContext`. Success toast. Collapsed by default. Placed below FAQ section (where the footnote currently sits). Use tokens (no slate); matches M2-tokenised page.
- **Severity:** P1 · **Effort:** S
- **Dependencies:** None (M2 shipped). Must merge before S2.
- **Platforms:** Web
- **Validation:** Collapsed trigger renders. Expand shows input + Apply. Valid code → success toast + tier updates. Invalid → error toast. `npm run ci` green.

## TASK W2 — Remove /pricing footnote

- **Goal:** Delete `<p>` at the old footnote location. Bundle into W1 commit.
- **Severity:** P1 · **Effort:** XS
- **Dependencies:** W1

## TASK M1 — Mobile paywall promo expander

- **Problem:** `apps/mobile/app/paywall.tsx` has no promo UI. Users with codes must navigate to Settings.
- **Goal:** "Have a promo code?" Pressable near bottom of paywall (below feature list, above legal/restore). Expands to TextInput + Apply. Uses the same `supabase.rpc("redeem_promo_code")` pattern currently in settings.tsx:394-430 — extract to shared hook `apps/mobile/hooks/usePromoCode.ts` (per OD1 recommendation, default: extract). On success, Alert + `onClose`. On error, Alert with existing error messages.
- **Severity:** P1 · **Effort:** S
- **Dependencies:** None (M3 shipped). Must merge before S1.
- **Platforms:** Mobile
- **Validation:** Expander renders. Valid code closes paywall after success alert. Invalid shows error alert.

## TASK S1 — Remove promo from mobile Settings

- **Goal:** Delete `apps/mobile/app/(tabs)/settings.tsx:538-572` promo card. Remove unused `promoCode`/`promoSubmitting` state and `handleRedeemPromo` (moved to `usePromoCode` hook per M1). Remove `normalizeRedeemPromoRpcData` if no other consumer.
- **Dependencies:** M1 must merge first.
- **Platforms:** Mobile

## TASK S2 — Remove promo from web Settings + dead-prop cleanup

- **Goal:** Delete `src/app/components/Settings.tsx:405-460`. Remove `scrollToPromoOnOpen`/`onScrollToPromoConsumed` props (lines 72-74, 99-120) + all call sites.
- **Dependencies:** W1 must merge first.
- **Platforms:** Web

## TASK A1 — Analytics: register `promo_code_redeemed`

- **Goal:** Add to `src/lib/analytics/events.ts` `AnalyticsEvents` registry. Instrument success branch on both new surfaces with `track(AnalyticsEvents.promo_code_redeemed, { surface: "pricing_page" | "paywall", tier, platform })`. Add registry test in `tests/unit/analyticsEvents.test.ts`.
- **Severity:** P2 · **Dependencies:** W1, M1

## TASK T1 — Unit tests for shared promo logic

- **Goal:** `tests/unit/promoRedemption.test.ts` covering `normalizeRedeemPromoRpcData` + success/already_redeemed/invalid_or_expired branches. Mocked Supabase RPC.
- **Dependencies:** S1, S2

## TASK T2 — Maestro E2E for paywall promo expander (mobile)

- **Goal:** `~/.maestro/tests/paywall_promo_expand.yaml` — tap expander, assert input + Apply visible. No real code submission.
- **Dependencies:** M1

## Open decisions (defaulted)

- **OD1 Shared hook:** Extract to `apps/mobile/hooks/usePromoCode.ts`. Default: yes.
- **OD2 Close paywall on promo success:** Yes — user has access, paywall is no longer relevant. Alert → onClose.
- **OD3 Auth gate on /pricing:** Show block always; rely on existing `not_authenticated` toast with "Sign in to redeem" message.
