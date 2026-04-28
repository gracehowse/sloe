# Decision — Group G IA collapse (Settings + More + Profile → Settings)

**Date:** 2026-04-28
**Area:** Product / IA / cross-platform parity
**Status:** Resolved

## Decision

**Collapse the "You" tab into 2 sub-tabs: Progress + Settings. Kill
the standalone More tab + the web Profile sidebar entry. Profile
becomes a row inside Settings; full editor stays at `/profile`.**

The current 3-pill scaffold (`apps/mobile/components/tabs/YouSubTabHeader.tsx:78-101`)
that surfaces Progress / Profile / Settings is the temp-parity
artefact memory `feedback_no_quick_temp_fixes.md` warns about.
Replace it with the genuinely-different axis: **Progress** (what's
happening to me) vs **Settings** (how the app is set up).

## Why

There is no user-meaningful axis that separates "Settings" from
"More" today. Both screens already host: Sign Out, Export CSV,
Export JSON, Manage subscription / View plans, Notifications row,
plan-tier label, promo code (Settings) / paywall row (More), reset
/ erase data path (More) / change password (Settings). The split
is an accident of porting two prototype templates side by side, not
a content design.

The 2026-04-27 strategic direction (memory
`project_strategic_direction_2026-04-27.md`) ratified 4 tabs total.
That's one screen of vertical real estate per primary tab. A
sub-tab pill that flips between Progress and Settings is the
genuinely different axis. A third "More" pill is cognitive tax —
users have to remember that household lives in More but theme lives
in Settings.

## Final IA

### Mobile + mobile-web — "You" tab

**Sub-tab pills:** Progress · Settings (2 pills, default Progress).

**`/(tabs)/progress`** — unchanged.

**`/(tabs)/settings`** — single page. Section order:

1. **Header card** — gradient avatar + display name + tier badge +
   "Joined Xw ago" + tap-to-edit chevron (routes to `/profile`)
2. **Stats strip** — Recipes / Streak
3. **Membership** — upgrade row (Free) or Manage subscription row
   (Pro)
4. **Goals & targets** — Daily targets, Dashboard widgets, Week
   starts on, Caffeine limit, Alcohol limit
5. **Body & activity** — Activity level + adjust-for-activity
6. **Household** — single row, hides when not in a household
7. **Connections** — Apple Health, Notifications, Weekly recap
8. **Journal display** — meal times, net carbs, weight surface,
   burn / deficit window
9. **Notifications detail** — toggles + open notifications screen
10. **Tracking extras** — caffeine + alcohol opt-in
11. **Recipes** — Create recipe row
12. **Appearance** — theme segmented
13. **Account** — Change password, Promo code
14. **Data** — Export CSV, Export JSON (single pair, drop the
    duplicate)
15. **About** — What's new, Help, Privacy, Terms
16. **Build** — `__DEV__`-gated build stamp
17. **Danger zone** — Reset/erase modal, Delete my account
    (typed-confirm)
18. **Sign Out** — standalone destructive button

**`/(tabs)/more`** — deleted as a tab destination. Route stays
alive as a redirect to `/(tabs)/settings` for one release.

**`/profile`** — unchanged (deep-link destination for full editor).

### Web (desktop + mobile-web) — "You" sidebar

Mirror exactly. 2-item sidebar group (Progress + Settings) where
there used to be 3 (Progress / Profile / Settings). Profile becomes
Settings → header card → "Edit profile" route.

## 5-batch shipping plan

Each batch is independently shippable, testable, revertible.

### Batch A — Mobile-web pill collapse (3 → 2)

**Scope:** drop the "More" pill from `YouSubTabHeader.tsx:94-101`
+ the mobile-web `YouSubTabPill` (Batch 10 `ce0bf0b`). Route taps
that would have gone to More → Settings.
**Risk:** trivial. Visual only.

### Batch B — Move 4+ sections from More to Settings (no deletions yet)

**Scope:** add Membership, Goals & targets, Connections, Recipes,
Household, Legal, About, Build, Danger zone to Settings as new
sections. **Don't delete from More yet.** Both screens exist; the
duplication is intentional and temporary.
**Risk:** medium. New rendering; no destructive deletions.

### Batch C — Web parity: collapse Profile sidebar entry into Settings

**Scope:** web only. Move Profile sidebar entry into Settings
header card. Add the same sections that mobile got in Batch B. Add
`?view=profile` query handler that scrolls to the editor link.
**Risk:** medium. New page composition.

### Batch D — Delete the old paths (HIGH RISK)

**Scope:** delete duplicated rows from `apps/mobile/app/(tabs)/more.tsx`
(everything except a redirect). Delete `Profile.tsx` from web
sidebar. Convert `more.tsx` into a thin redirect component.
**Why third, not first:** account-delete + reset-data flows live in
More (`more.tsx:929-994`). Test pin
`tests/unit/accountDeleteFlow*.test.ts` MUST stay green across this
batch.
**Ship signal:** Grace runs the full reset-data path AND the
typed-confirm delete path on TestFlight (throwaway account).

### Batch E — Cleanup

**Scope:** delete `apps/mobile/app/(tabs)/more.tsx` after one
release of redirect grace period. Drop `pathname.startsWith('/more')`
references from `_layout.tsx:156`.

## Backwards-compatibility surfaces

Cannot break in this restructure:

1. Push notification deep links (audit `app/api/push/*`)
2. `/paywall?from=settings` (preserve verbatim)
3. `?view=` query handlers (`Settings.tsx:80-83`'s
   `scrollToPromoOnOpen` pattern → generalise)
4. testIDs:
   - `settings-activity-level-row`
   - `settings-manage-subscription-row`
   - `settings-net-carbs-lens-toggle`
   - `settings-whats-new-row`
   - any account-delete IDs
5. Stripe customer-center invocation path (`presentCustomerCenter()`)
6. Profile editor deep link from header avatar (`/profile`)

## Test surface — load-bearing pins

1. `tests/unit/accountDeleteFlow*.test.ts` — typed-confirm delete
2. `apps/mobile/tests/unit/settingsScreenSweep.test.tsx`
3. `tests/unit/nutritionLogToCsv.test.ts` — CSV bytes pin
4. `apps/mobile/tests/unit/exportCsv*.test.ts`
5. `apps/mobile/tests/unit/weeklyRecapPushRoute*.test.ts`
6. `apps/mobile/tests/unit/activityLevelPicker*.test.ts`
7. `apps/mobile/tests/unit/managedSubscriptionRow*.test.ts`
8. Web `Settings.test.tsx` / `Profile.test.tsx`

## Notion mirror

- Decisions log row: "Group G IA — Collapse You into 2 sub-tabs
  (Progress + Settings); Profile-as-row" — Resolved (mirrored
  2026-04-28).
- Roadmap row: "Group G IA — Collapse You into Progress + Settings"
  — Open, target Next 2 sprints (mirrored 2026-04-28).

## Source

product-lead verdict, `agentId: ae4642429781de4e2`, 2026-04-28.
