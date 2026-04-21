# Upgrade dialog — dynamic upsell (D12 Option 3)

**Date:** 2026-04-21
**Status:** Accepted — pending legal-reviewer sign-off on items listed in §4
**Specialist:** monetisation-architect
**Related:**
- `docs/decisions/2026-04-19-pricing-v1.md`
- `docs/planning/design-system-sweep-plan-2026-04-21.md` §D12
- `src/app/components/suppr/upgrade-paywall-dialog.tsx`
- `src/lib/landing/pricingTiers.ts`
- `docs/ux/claude-design-bundles/prototype/project/flows.jsx:588–610`

---

## Decision

The `UpgradePaywallDialog` will display context-aware content based on the authenticated user's current tier:

- **Free user** → Variant A: Base upsell (existing content, refined copy).
- **Base user** → Variant B: Pro upsell (new variant, new feature set, same structural shell).

The dialog never shows both tiers simultaneously as a selectable picker. The prototype's two-card picker (flows.jsx:588–610) is not adopted here — that pattern is better suited to `/pricing` where cold-traffic users compare tiers. In the dialog the user already holds one tier; the pitch is the single next step up.

This resolves the conversion leak in D12: Base users who are Pro-curious currently leave the dialog and navigate to `/pricing`, losing context. The dynamic variant closes that gap without introducing a comparison table into an intent-driven modal.

---

## 1. Dialog content per tier context

### Variant A — Free to Base

Shown when: `userTier === "free"` (or unauthenticated — treat as free).

**Hero pill:** Suppr Base
**Headline:** The full meal planning loop
**Subtitle:** Plans that hit your macros. Shopping list from your plan. Cook mode with timers.

Feature rows:

| Icon (lucide) | Title | Description |
|---|---|---|
| CalendarDays | Meal plans matched to your macros | A week of meals tailored to your targets. Regenerate any day. |
| ShoppingCart | Shopping list from your plan | Aisle-sorted, quantities combined across recipes. |
| ChefHat | Cook mode with timers | Step-by-step with inline timers and per-step ingredients. |
| Link | Import from any source | Instagram, TikTok, blogs. 7-second parse, USDA-verified. |
| Infinity | Unlimited saved recipes | Free tier caps at 10. Base is uncapped. |

Pricing card:

| Field | Value |
|---|---|
| Label | Base |
| Badge | Most popular |
| Descriptor | The full meal planning loop |
| Price | Read from `PRICING_TIERS` — do not hardcode. Currently £3.99. |
| Period | /month |

Renewal note (below pricing card, above footer):
`Cancel anytime. Annual plan saves 37%.`

**Primary CTA:** `Continue with Base · £3.99/mo` (price interpolated from `PRICING_TIERS`)
**Secondary CTA:** `Continue for free`

---

### Variant B — Base to Pro

Shown when: `userTier === "base"`.

**Hero pill:** Suppr Pro
**Headline:** Log faster. Let the AI do the work.
**Subtitle:** Snap a photo or say what you ate. Pro handles the rest — no manual entry.

Feature rows:

| Icon (lucide) | Title | Description |
|---|---|---|
| Camera | AI photo meal recognition | Snap a plate and get verified macros. Up to 100 logs per day. |
| Mic | Voice food logging | Say "bowl of oats and a banana" and it's logged. Up to 100 per day. |
| Zap | Everything in Base | Plans, shopping list, cook mode, unlimited recipes — all included. |
| Mail | Priority email support | Real humans, faster response. |

Pricing card:

| Field | Value |
|---|---|
| Label | Pro |
| Badge | None — Base is "Most popular"; do not misattribute that to Pro. |
| Descriptor | Everything in Base, plus AI logging |
| Price | Read from `PRICING_TIERS` — do not hardcode. Currently £7.99. |
| Period | /month |

Renewal note (below pricing card, above footer):
`Cancel anytime. Annual plan saves 37%. Manage your plan at any time.`

NOTE (2026-04-21): Earlier draft read "You keep Base if you downgrade." `data-integrity` confirmed Pro cancel → Free (not Base) under current Stripe/webhook config — see `docs/decisions/2026-04-21-pro-downgrade-path.md`. Copy replaced with the neutral alternative.

**Primary CTA:** `Upgrade to Pro · £7.99/mo` (price interpolated from `PRICING_TIERS`)
**Secondary CTA:** `Stay on Base`

"Stay on Base" is the correct label here. "Continue for free" is false — the user pays for Base. "Maybe later" is soft-manipulative. "Stay on Base" is accurate and neutral.

---

## 2. Copy rules

- No urgency language (countdowns, "limited time", "offer ends").
- No social proof pressure ("thousands of users").
- No false scarcity.
- Renewal terms explicitly present on every variant before the CTA.
- Feature descriptions must match the gating in `PRICING_TIERS` exactly. Any copy change that adds a claim requires a corresponding code gate.
- Prices must be read from `PRICING_TIERS` at render time, never hardcoded.
- The prototype uses USD (`$5`, `$12`). Those values must not appear in the live component.

---

## 3. Trigger surfaces — which variant fires where

The `from` value (trigger surface) and the `userTier` (variant selection) are independent inputs to the dialog.

### Free users — Variant A trigger surfaces

| `from` | Surface | Event that triggers |
|---|---|---|
| `recipes_library` | Library — save recipe | User hits the `FREE_SAVE_LIMIT` recipe cap |
| `meal_planner` | Plan tab | User taps "Generate week" without Base subscription |
| `shopping_list` | Shopping tab | User opens Shopping (plan-gated feature) without Base |
| `recipe_create` | Create screen | User attempts to publish a recipe to the community |
| `settings` | Settings — Upgrade row | Explicit intent tap |
| `onboarding` | Post-onboarding | If an upsell moment is introduced post-onboarding |

`recipe_import` is not a trigger surface — import is free tier functionality.

**Edge case — Free user reaches a Pro-gated surface (`voice_log`, `photo_log`):** Show Variant A (Base upsell) with an additional explanatory note: "Voice and photo logging require Pro. Base unlocks everything else." The user needs Base before Pro; pitching Pro to a Free user skips a necessary step and creates a confusing upgrade path. No structural change to Variant A is required; the note is appended below the subtitle.

### Base users — Variant B trigger surfaces

| `from` | Surface | Event that triggers |
|---|---|---|
| `voice_log` | Voice log entry point | User taps the mic icon — Pro-only feature |
| `photo_log` | Photo log entry point | User taps the camera icon — Pro-only feature |
| `settings` | Settings — Upgrade to Pro row | Explicit intent tap |

The settings row for Base users must read "Upgrade to Pro" (not "Upgrade") to disambiguate the destination. Tapping it opens Variant B. This is a small settings surface change in scope of this decision.

### Frequency cap

One dialog open per session, regardless of trigger surface. If the dialog was dismissed in the current session, do not re-open it automatically. Manual intent taps (settings upgrade row, explicit in-surface CTA) bypass the session cap.

---

## 4. Legal and billing implications

### Items requiring legal-reviewer sign-off before Variant B ships

1. ~~"You keep Base if you downgrade" claim.~~ **RESOLVED 2026-04-21** — `data-integrity` confirmed Pro cancel resolves to Free. Copy changed to `Manage your plan at any time.` See `docs/decisions/2026-04-21-pro-downgrade-path.md`.

2. **"Cancel anytime" claim.** Confirm no minimum commitment period applies to either Base or Pro on the monthly plan.

3. **Pro feature claims.** "AI photo meal recognition" and "Voice food logging" must not constitute regulated health, medical, or dietary claims in any jurisdiction Suppr serves. Route to legal-reviewer for a quick read.

4. **Renewal disclosure placement.** The renewal note must be visible without scrolling on the paywall surface before the user taps the primary CTA. This is a legal requirement for auto-renewing subscriptions in several jurisdictions. The current dialog has a scrollable body. The implementation must ensure the renewal note is not scroll-hidden on small viewports (320px minimum width, 600px minimum height as a reference breakpoint). Verify in implementation and include a screenshot in the PR.

### Price accuracy

Prices must be read from `PRICING_TIERS` at render time. The prototype's `$5` and `$12` are USD prototype placeholders and must never appear in the live component. Variant A already does this correctly. Variant B must follow the same pattern.

### Annual pricing

The dialog pitches monthly prices. The renewal note mentions the annual saving as a pointer to `/pricing`, not as an offer. No annual toggle lives in the dialog. If an annual toggle is ever added to the dialog, that constitutes a new billing surface and requires a fresh legal-reviewer pass before shipping.

---

## 5. Tracking event shape

Three new events to register in `src/lib/analytics/events.ts` under `AnalyticsEvents` before implementation. The component must reference the registered constants, not string literals.

### `upsell_variant_shown`

Fires on dialog mount, guarded against StrictMode double-fire (same `viewedForOpenRef` pattern as the existing `paywall_viewed` guard). Fire alongside `paywall_viewed` so the existing funnel is not broken.

```typescript
{
  event: "upsell_variant_shown",
  properties: {
    variant: "free_to_base" | "base_to_pro",
    from: PaywallViewedFrom,
    surface: "upgrade_dialog",
    platform: "web",
    user_tier: "free" | "base",
  }
}
```

### `upsell_variant_converted`

Fires when the primary CTA is tapped and checkout navigation begins. Fire alongside `checkout_started` so the existing funnel is not broken.

```typescript
{
  event: "upsell_variant_converted",
  properties: {
    variant: "free_to_base" | "base_to_pro",
    from: PaywallViewedFrom,
    target_tier: "base" | "pro",
    period: "monthly" | "annual",
    surface: "upgrade_dialog",
    platform: "web",
    user_tier: "free" | "base",
  }
}
```

### `upsell_variant_dismissed`

Fires on secondary CTA tap or backdrop/escape close. Fire alongside `paywall_dismissed` so the existing funnel is not broken.

```typescript
{
  event: "upsell_variant_dismissed",
  properties: {
    variant: "free_to_base" | "base_to_pro",
    from: PaywallViewedFrom,
    reason: "secondary_cta" | "close_button" | "backdrop",
    surface: "upgrade_dialog",
    platform: "web",
    user_tier: "free" | "base",
  }
}
```

`analytics-engineer` should add `upsell_variant_shown → upsell_variant_converted` as a funnel in PostHog, broken out by `variant` and `from`.

---

## 6. Go / No-go

**Go**, subject to the following:

### Blocking before Variant B merges

1. ~~`data-integrity` confirms downgrade path.~~ **DONE 2026-04-21** — Pro→Free confirmed; copy updated to `Manage your plan at any time.`
2. `legal-reviewer` signs off on the remaining three items in §4 (cancel-anytime, Pro feature claims, renewal disclosure placement).
3. `userTier` is wired as a prop from the app-level context. It must not be fetched inside the dialog on mount — that creates a loading state on a modal open path. The tier is available in the app context at the `App.tsx` call site; pass it through `UpgradePaywallDialogProps`.

### Non-blocking (resolve within the same sprint)

4. Three new events registered in `AnalyticsEvents` before the component references them.
5. Settings "Upgrade to Pro" row copy change for Base users can land in the same PR or immediately after.

### Out of scope for this decision

- Annual toggle in the dialog. If ever added, requires a fresh legal-reviewer pass.
- Mobile paywall (`apps/mobile/app/paywall.tsx`). The mobile paywall is a separate full-screen route with its own tier-selection flow. This spec covers web only. A mobile parity decision is a separate D-item. `sync-enforcer` should not flag the web-only scope as drift.
- The `/pricing` two-card tier picker. The prototype's selectable picker (flows.jsx:588–610) is appropriate for `/pricing` where comparison is the goal. That is a separate task.

---

## Handoffs

| Agent | Action |
|---|---|
| `legal-reviewer` | Sign off on §4 items 1–4 before Variant B merges |
| `data-integrity` | Confirm Stripe downgrade path: Pro cancel → Base or Free? |
| `analytics-engineer` | Register three event names in `AnalyticsEvents`; add funnel to PostHog |
| `executor` | Implement: add `userTier` prop, branch on variant, wire Variant B checkout to `tier: "pro"`, no hardcoded prices, guard StrictMode double-fire on new events |
| `sync-enforcer` | Web-only by explicit scope. Do not flag as mobile parity miss until a separate D-item is raised. |
| `product-memory` | Record this decision. |
