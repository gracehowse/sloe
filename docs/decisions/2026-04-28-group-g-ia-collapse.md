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

### Batch B — Move 4+ sections from More to Settings (no deletions yet) ✅ Shipped 2026-04-29

**Approach (final, differs from straight-copy):** the More-tab body
was extracted into a single shared component
`apps/mobile/components/settings/SettingsBundleContent.tsx` that owns
its own state, all 6 modals, and the entire row stack (Profile card,
Stats, Membership, Household, Goals & targets, Connections, Recipes,
App, Legal, Build, Danger zone, Sign Out). Both `/(tabs)/more` and
`/(tabs)/settings` mount the bundle, so revertibility is `git revert`
on a single PR and a Batch D cleanup of `more.tsx` only deletes the
screen wrapper — not the shared rendering.

The bundle takes a `context: "more" | "settings"` prop. Today the
prop only suppresses the self-routing "Settings" row when rendered
on Settings; future divergence (e.g., a Settings-only header) lives
behind the same prop.

**Scope:** add Membership, Goals & targets, Connections, Recipes,
Household, Legal, App, Build, Danger zone, Sign Out to Settings as
new sections (via the shared bundle). **Don't delete from More yet.**
Both screens exist; the duplication is intentional and temporary.

**Test pins added:**
- `apps/mobile/tests/unit/settingsBundleParity.test.ts` — locks the
  testID contract, the 6-modal mount count, the delete-account
  network shape, and the "both screens import the bundle" guarantee.
- `apps/mobile/tests/unit/upgradeBannerCopyParity.test.ts` —
  repointed from `more.tsx` to the bundle.
- `tests/unit/uiConsistencyRound2.test.ts` (B13) — repointed.

**Maestro:** `00_screenshot_tour.yaml` gained two scrolled captures
(`tour-08b-settings-mid`, `tour-08c-settings-bottom`) so the
baseline includes the bundle's new rows on the Settings surface.

**Risk:** medium. New rendering; no destructive deletions.

### Batch C — Web parity: collapse Profile sidebar entry into Settings ✅ Shipped 2026-04-29

**Scope shipped:**
- `DesktopSidebar.SUB_TABS.you` collapsed 3 → 2 (Progress + Settings).
  `profile` stays in `leaves` so /profile still highlights "You".
- `App.tsx` `YouSubTabPill` (mobile-web) collapsed 3 → 2 pills with the
  type signature narrowed to `"progress" | "settings"`. The /profile
  case renders with Settings highlighted on the pill so the user
  understands they are inside the Settings flow when on the editor.
- `Settings.tsx` gained a profile header card at the very top: 56px
  brand-gradient avatar + display name + "{Tier} tier · {email}"
  subtitle + "Edit profile →" affordance routing to `/home?view=profile`.
  testIDs: `settings-profile-header-card` (root) and
  `settings-edit-profile-link` (CTA).
- `/profile` route remains alive as the full editor — no behavioural
  change to the editor itself.

**Scope deferred (intentional):**
- The literal "?view=profile query handler that scrolls to the editor
  link" wording from the original decision was not implemented. The
  current `?view=profile` URL still routes to the full editor (no
  bookmark breakage). The header card is unconditionally visible so
  the editor entry point is always one tap away regardless of how the
  user arrived. If TestFlight feedback shows a tighter scroll-to
  affordance is needed, it lands as a follow-up in the post-D
  cleanup.
- The full mobile bundle's Goals & targets / Connections / Recipes /
  Household / Build / Danger zone sections were NOT ported to web
  Settings. Web has its own equivalent surfaces (full Profile editor,
  inline body-stats panel, Plan-tab Household card) so a 1:1 port
  would duplicate UX. This batch is sidebar-collapse + header-card
  parity, not section-by-section bundle parity.

**Test pins added:**
- `tests/unit/settingsProfileHeaderCardParity.test.ts` — 9 tests
  pinning the header-card testIDs, brand gradient, tier collapse,
  sidebar SUB_TABS shape, leaves mapping, mobile-web pill items, and
  the `/profile` → `currentView="settings"` highlight rule.
- `tests/unit/desktopSidebar.test.tsx` — existing test updated
  (Progress/Profile/Settings → Progress/Settings) with an explicit
  guard that the Profile sub-tab is gone.

**Risk:** medium. New page composition. No destructive deletions. The
deeplink contract for `?view=profile` is unchanged.

### Batch D — Delete the old paths (HIGH RISK) ✅ Shipped 2026-04-30

**Verification before merge:** Grace ran the app on her iPhone 17
Pro via `expo run:ios --device` and walked the bundle on /settings
(reset-data + typed-confirm-delete + Apple Health connect + Daily
targets + Dashboard widgets + Caffeine/Alcohol + Weekly recap).
Confirmed every section reachable from /settings; no regressions vs
pre-Batch D /more behaviour. The TestFlight requirement was relaxed
to simulator-or-device since iOS Simulator now supports HealthKit.

**Scope shipped:**
- `apps/mobile/app/(tabs)/more.tsx` collapsed from a 110-line wrapper
  to a 17-line `<Redirect href="/(tabs)/settings" />`. Push
  notifications, bookmarks, and any external system that still
  deep-links to `suppr:///more` redirects to `/(tabs)/settings`.
- `apps/mobile/tests/unit/settingsBundleParity.test.ts` — assertion
  set updated: dropped the "/more renders the bundle" pin; added a
  new "/more is a thin redirect, no state, no bundle render" pin.
- Web sidebar Profile entry — already deleted in Batch C.
- Maestro flows repointed (4 of 4):
  - `00_screenshot_tour.yaml` — `tour-09-more` renamed to
    `tour-09-more-redirected` (capture proves the redirect resolves).
  - `04_profile_settings.yaml` — deeplink `/more` → `/settings`,
    assertions updated to match the post-bundle copy ("Goals &
    targets" / "Privacy policy" / "Terms of use").
  - `29_more_menu.yaml` — full rewrite. Same intent (verify every
    bundle section + reset modal + dashboard widgets + week start),
    pointed at `/settings`, stale assertions purged ("Score" pill,
    "Reset or erase everything", "Delete my account permanently",
    "Multi-day plans" upgrade copy).
  - `31_settings_hub.yaml` — same treatment.
- Decision doc + master P0 list updated; Notion roadmap row updated.

**What's intentionally still alive (until Batch E):**
- `apps/mobile/app/(tabs)/more.tsx` exists as the redirect.
- The `pathname.startsWith('/more')` listener in
  `_layout.tsx:162` (the You-tab tap handler that re-routes to
  /progress when the user is already on /settings or /more).

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
