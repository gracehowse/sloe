# Web Settings parity + token fixes

- **Date**: 2026-04-30
- **Status**: Resolved
- **Area**: web Settings; account billing portal
- **Decided by**: web executor (audit dispatcher: Grace)

## Problem

Three P0s + four P1s on the web Settings surface:

1. **Pro users had no in-app cancel path** on web. The "Your plan" card
   only rendered "View plans" when the user was non-Pro; Pro users had
   to email support or guess the `/account/billing` route existed.
2. The Dashboard widget swatches in the Preferences card used hardcoded
   hexes (`#5B8DEF`, `#F5A623`, `#E05C5C`, `#22c55e`, `#D87FE8`,
   `#7FB5E8`, `#4FC3F7`) that drifted from the canonical macro tokens
   in `src/styles/theme.css`. Result: the colour you picked in Settings
   wasn't the colour shown on the Today rings.
3. The destructive zone collapsed three semantically-distinct rows
   onto one red plate — including the reversible "Delete local data &
   sign out" — so users couldn't tell which actions were permanent.
4. Page header H1 carried `bg-clip-text text-transparent` with no
   gradient set; the cog icon sat on `bg-primary/30` next to neutral
   chrome.
5. Erase Everything dialog copy read as shame energy ("this will
   permanently delete your food log, journal, library saves, …").
6. Five segmented controls in the Preferences card used five
   slightly-different border / active-state recipes.
7. Three toggle patterns (native checkbox, peer-checked div, shadcn
   Switch) coexisted on the same surface.

## Decision

- **P0-1**: Add a "Manage subscription" link for Pro users that routes
  to `/account/billing`. Extended the existing
  `resolveBillingPortalOutcome` decision helper so Pro users without a
  `stripe_customer_id` now resolve to the `app_store_managed` static
  fallback (which already carries the iOS Settings → Apple ID →
  Subscriptions copy required by Apple policy). Non-Pro users continue
  to redirect to `/pricing?ref=billing`.
- **P0-2**: Verified `measurement_system` and "Dietary Restrictions"
  controls already exist in `Settings.tsx`. No-op for web. Mobile
  parity work owned by the parallel mobile executor.
- **P0-3**: New canonical module
  `src/lib/theme/macroColors.ts` exports `MACRO_COLOR_VARS` (CSS-var
  refs — preferred) and `MACRO_COLORS_LIGHT` (hex literals for
  runtime-style cases). `WIDGET_MACRO_OPTIONS` now reads from the var
  map. `tests/unit/settingsMacroTokens.test.ts` pins the values to the
  `:root` block in `theme.css` so future drift fails the suite.
- **P0-4**: Destructive ladder split into three plates:
  - Erase everything → amber (warning) — recoverable from export.
  - Delete local data & sign out → neutral — reversible.
  - Delete account permanently → destructive (red) — irreversible.
- **P1-5**: Stripped `bg-clip-text text-transparent` from the H1; cog
  icon now uses neutral `bg-muted`.
- **P1-6**: Erase confirm dialog rewritten — title points at recovery
  ("Delete your data and start fresh?") with the affected categories
  on a single lowercase line.
- **P1-7**: New `<SettingsSegmented>` primitive at
  `src/app/components/ui/settings-segmented.tsx`. Replaces the five
  bespoke variants (theme picker, week-start, measurement-system,
  burn-deficit, weight-surface). Renders as a `radiogroup` with
  arrow-key navigation.
- **P1-8**: All toggles in Settings now use the shadcn `Switch`
  primitive (Activity-adjusted, Net carbs lens, the notification
  loop). The peer-checked CSS-only toggles are gone.

## Files

- `src/app/components/Settings.tsx` — surface changes, primitive
  wiring, copy rewrites.
- `src/lib/theme/macroColors.ts` — new canonical macro colour module.
- `src/app/components/ui/settings-segmented.tsx` — new primitive.
- `src/lib/stripe/billingPortalDecision.ts` — `userTier` input + App
  Store fallback branch.
- `app/account/billing/page.tsx` — fetch + pass `user_tier` to the
  decision helper.
- `tests/unit/settingsManageSubscription.test.tsx` — new.
- `tests/unit/settingsMacroTokens.test.ts` — new.
- `tests/unit/settingsDestructiveCopy.test.ts` — new.
- `tests/unit/accountBilling.test.tsx` — extended with App Store
  branch coverage.

## Parity

- Web: implementation in `src/app/components/Settings.tsx`.
- Mobile: untouched in this PR (parallel mobile executor owns parity).
  Web copy strings + token names were chosen to mirror the mobile
  surface (`apps/mobile/app/(tabs)/settings.tsx` +
  `SettingsBundleContent.tsx`) so the future port is mechanical.
- Intentional difference: web "Manage subscription" link routes to
  `/account/billing` (Stripe Customer Portal); mobile uses
  RevenueCat's `presentCustomerCenter()` with App Store URL fallback.
  Same surface intent, different SDK underneath.

## Validation

- 4 new / extended test files (44 new + extended assertions); all
  pass on the worktree.
- `tsc --noEmit` clean.
- Full vitest suite passes.

## Risks / follow-ups

- **App Store cancel path is informational, not transactional**: a
  Pro user who paid via App Store and lands on `/account/billing`
  sees the static fallback (with iOS Settings → Apple ID →
  Subscriptions copy). Apple policy forbids server-side IAP
  cancellation. This is the correct outcome but worth flagging if a
  future user complains they expected a one-tap cancel button on web.
- **Manage subscription text colour** uses `text-success` to match
  the existing "View plans" link style. If `ui-critic` would prefer a
  different treatment, swap is one-line.
