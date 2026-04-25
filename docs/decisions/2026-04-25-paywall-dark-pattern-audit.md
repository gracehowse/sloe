# Decision log: paywall dark-pattern audit (2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** Apple pulled Cal AI from the App Store on 2026-04-21 for paywall billing-clarity violations (per-week prominence over actual charge, hidden auto-renew toggle, second paywall on dismiss). T22 in the [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md) requires a pass before App Store submission.

---

## Audit rubric + findings

Each criterion below was checked against `apps/mobile/app/paywall.tsx` (mobile route) and `app/pricing/page.tsx` + `src/app/components/suppr/upgrade-paywall-dialog.tsx` (web surfaces).

### A. Actual-charge prominence vs per-week framing — **PASS**

Suppr does not use any per-week framing. Every price label is per-month or per-year, matching how the product charges. No "$1/week" anchor that resolves to a higher monthly charge at checkout. Price + period are co-located in the same typography on every surface (mobile `paywall.tsx` MASCOT cards; web `PricingTiersGrid` tier cards; upgrade dialog pricing card). No action needed.

### B. Auto-renew above the fold — **PASS** (after T24)

- **Mobile** (`apps/mobile/app/paywall.tsx` ~540): full CMA-aligned disclosure renders below the CTAs, but it's anchored to the visible footer above the home indicator on the 320×600 reference viewport — pinned by visible-without-scroll spec at the call site. Includes the "renews automatically until cancelled" clause.
- **Web `/pricing`** (`PricingTiersGrid.tsx` `BillingDisclosure` ~346): renders inline below each tier card with the full charged-today + renews-each-period clause.
- **Web upgrade dialog** (T24, 2026-04-25): renewal note now matches the mobile shape — "Suppr {Base|Pro} renews automatically at {price} per {month|year} until cancelled. Cancel anytime from Account → Billing. Prices include any applicable VAT. 7-day refund policy: …". Pinned visible above the CTAs by the dialog footer; tested in `upgradePaywallDialog.test.tsx`.

### C. No second paywall on dismiss — **PASS**

- **Mobile**: `onClose()` in `paywall.tsx:454` routes via `router.back()` (or `router.replace` for forward-only flows like onboarding / trial-end). No interstitial / "are you sure" / second paywall.
- **Web /pricing**: standard navigation; no modal interception.
- **Web upgrade dialog**: dismiss closes the modal and resumes the page underneath. The session-cap in `UpgradePaywallDialog` (`SESSION_CAP_KEY`) actively *prevents* a second auto-open in the same session — explicit intent taps require `bypassSessionCap`. Cal AI's pulled behaviour was to *re-open* a different paywall on dismiss; we do the inverse.

### D. Cancel + refund visibility — **PASS** (after T24)

Disclosure on every surface includes the cancel path AND the refund policy:
- "Cancel anytime in Settings → Apple ID → Subscriptions" (iOS)
- "Cancel anytime in Google Play → Payments & subscriptions" (Android, when reached)
- "Cancel anytime from Account → Billing" (web)
- "7-day refund policy: support@suppr-club.com" (all surfaces)

Domain note: T17 (canonical domain decision) will sweep `support@suppr-club.com` vs `support@supprclub.com` once the call is made.

### E. UK/EU 14-day statutory cancellation — **OPEN** (out of scope this audit)

The legal-reviewer audit (§B7, 2026-04-24 sweep) flagged this separately — Suppr's 7-day refund policy is a goodwill commitment that on its own may understate the UK CCRs / EU CRD 14-day right of withdrawal on distance contracts for digital services. Two paths:
- (a) Surface the 14-day statutory right alongside the goodwill policy on UK/EU surfaces, OR
- (b) Collect an explicit waiver at checkout (industry-standard "by tapping Subscribe you waive your 14-day cooling-off in exchange for immediate access to Suppr") so the goodwill 7-day commitment governs.

Both paths require formal counsel sign-off; flagging as an open decision rather than fixing in this audit.

### F. Trial-clarity — **PASS**

Mobile paywall renders the trial timeline + first-charge-date when a trial-eligible Pro package is selected (line ~539 of `paywall.tsx`). No trial obfuscation; first charge date is computed from RC's `intro_pricing` fields and shown explicitly.

### G. Easy-leave — **PASS** (after T22 events)

Every paywall surface has a visible close affordance:
- Mobile: top-right `X` close button (line 829)
- Web /pricing: standard browser back / nav
- Web upgrade dialog: top-right `X`, "Continue for free" / "Stay on Base" secondary CTA, backdrop click, escape key

No coercive nag patterns, no "are you sure" friction.

### H. Funnel measurement parity (analytics) — **FIXED in T22**

Before this commit, only the web upgrade dialog emitted `paywall_dismissed`. Mobile route + web `/pricing` had no dismiss counterpart, so F2's conversion-rate denominator was indistinguishable from "still considering." Fixed:

- **Mobile** `paywall.tsx::onClose()` now emits `paywall_dismissed` with `{ from, reason: "close_button", surface: "route", platform }`.
- **Web `/pricing`** uses a new `PageDismissTracker` component that fires `paywall_dismissed` on unmount with `{ from, surface: "route", platform: "web" }`.
- **Mobile `paywall_viewed` dedup** by tier within a single mount (audit §I7 / analytics-engineer #7) — `viewedTiersRef = useRef<Set<string>>(new Set())` ensures each (mount, tier) fires once, eliminating the inflated denominator caused by tier-bouncing.

---

## Verdict

**PASS for App Store submission** on items A-D, F-H. Item E (UK/EU 14-day) needs counsel sign-off as a separate ticket but does not gate the immediate audit (the 7-day policy + cancel disclosure clears Apple's 3.1.2 baseline; UK/EU statutory framing is a CMA / CCRs concern, not an Apple Review concern).

Net delta from this commit:
- F2 funnel can finally measure dismissal vs conversion (before: dismissals were silent).
- F2 denominator no longer inflates on tier-bouncing.
- Web upgrade dialog disclosure now matches mobile (T24).

## Related

- [Cal AI App Store removal — TechCrunch coverage](https://techcrunch.com/2026/04/21/apples-cal-ai-crackdown-signals-its-still-policing-the-app-store/) — context for this audit being expedited
- [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md) — T22 + T24 origin
- [2026-04-19 pricing v1 decision](./2026-04-19-pricing-v1.md) — pricing structure baseline
- [2026-04-19 renewal disclosure rewrite](./2026-04-19-renewal-disclosure-rewrite.md) — earlier disclosure work
- [2026-04-19 consumer VAT posture (UK + EU)](./2026-04-19-consumer-vat-posture-uk-eu.md) — VAT-inclusive context for item E
- Test pin: `tests/unit/upgradePaywallDialog.test.tsx` (T24 disclosure assertions); future test for `PageDismissTracker` in a follow-up.
