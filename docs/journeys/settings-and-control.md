# User Journey: Settings & Control Loop

**Audience:** Product / Design / Engineering

## Status — read this first

This is the first journey-level doc for Settings. Until now the only
narrative document covering this surface was
[`docs/ux/redesign/settings.md`](../ux/redesign/settings.md), which is
explicitly labelled **"Spec — not yet implemented"** for several of its
rows (icon-led rows, section eyebrows, the Units row, the
`NotificationPrefsSheet`, the weight-trend forecast chart). Readers who
skim that file without noticing the status line have mistaken proposed
UI for shipped UI. **This doc describes what Settings actually does
today**, based on the current product code, and cites
`docs/ux/redesign/settings.md` only where it correctly predicts a real,
currently-open gap.

Settings has ~17 distinct features and no prior journey-level narrative
tying them together — this doc is that narrative.

## Scope

**In scope:** the Settings hub (entry, layout, search), the "Personal"
identity block (name vs Display Name), the `/profile` write surface and
`/targets` read surface, the Membership card (entry point only), the
Preferences/Display card (theme, units, macro display, tracking extras,
week-start), the Reminders card + Notifications row, Connections
(Apple Health entry, Household entry), the Danger zone
(export → refresh-plan → erase-everything → delete-account → sign-out),
the Privacy & Security card's analytics-consent toggle — together
with the pre-Settings cookie/analytics consent ask it mirrors (web's
`CookieConsent` banner, mobile's `AnalyticsConsentPrompt`), since both
read and write the same stored choice and are one control loop, not two
features — and the Barcode contributions row (reviewing/withdrawing
foods the user has shared to the community food database, grouped with
the export rows in the same card as the consent toggle above).

**Out of scope — go here instead:**
- **Subscription management, pricing, billing rails, checkout/webhook/
  entitlement mechanics** →
  [`docs/journeys/monetisation-and-paywall.md`](./monetisation-and-paywall.md).
  This doc only covers the Membership card's entry point into that flow,
  not the flow itself.
- **Household sharing configuration (the 7×4 grid, presets, invites)** →
  [`docs/journeys/household-sharing.md`](./household-sharing.md). This doc
  only covers the Household row's entry point. For the shipped
  schema/privacy contract, see
  [`docs/decisions/2026-05-01-household-netflix-model-v1-schema.md`](../decisions/2026-05-01-household-netflix-model-v1-schema.md).
- **Apple Health sync mechanics** (per-category sync, import/export
  toggles, permission probing) →
  [`docs/integrations/apple-health.md`](../integrations/apple-health.md).
  This doc only covers the Settings entry row.
- **How the calorie/macro target itself is calculated** (BMR/TDEE,
  adaptive learning) →
  [`docs/user/how-your-calorie-target-works.md`](../user/how-your-calorie-target-works.md).
  This doc covers where targets are *edited*; that one covers how the
  number is *computed*.
- **The Notifications inbox** (the read surface the Notifications row
  routes to) has no dedicated journey doc yet either — this doc covers
  only the entry point (§6), not the inbox itself.

## Overview

Settings is not a funnel with a single conversion goal — it's the
**control plane every other loop reads from**. A user opens it low
frequency but high stakes: get a target wrong here and Today's ring is
wrong all day; can't find the units toggle and every input feels
foreign; can't export before cancelling and support gets a chargeback
dispute. The loop is:

1. Open Settings (avatar on Today, not a bottom tab).
2. Edit something — a target, a preference, a connection, a reminder.
3. The edit writes to `profiles` (or a local store) and stamps
   provenance where it matters (targets get
   `target_calories_source` + `target_calories_set_at` + a dirty flag).
4. Today, the Weekly Review loop, and the Daily Logging loop **read the
   new value back on next focus** — Settings doesn't push, the
   consumers pull.

This doc walks that loop start to finish, flags where web and mobile
genuinely diverge, and calls out every place the product currently
promises something in code comments or a redesign spec that a user
cannot actually do yet.

## Entry Points

**Mobile:** the avatar in the Today header (`TodayDateHeader.tsx`,
`GradientAvatar` →
`router.push("/(tabs)/settings")`). **Settings is reached via the
avatar, not a bottom tab** — the tab bar is Today / Plan / +(FAB) /
Recipes / Progress (`apps/mobile/CLAUDE.md`). The legacy `/more` route
still exists as a secondary redirect target. Deep links and settings
search results also land inside the bundle.

**Web:** the user menu, the desktop sidebar (`desktop-sidebar.tsx`), and
the mobile-web pill all route to the `App.tsx` view `"settings"`
(`/settings` — `app/(product)/settings/page.tsx` returns `null` and the
client shell renders `Settings.tsx`). The Stripe billing portal also
returns here after a manage-subscription round trip.

## 1. The Settings hub — layout and search

**What it is.** Mobile renders a single screen
(`apps/mobile/app/(tabs)/settings.tsx`) — back chevron, centred
"Settings" title (Newsreader serif), a search field, then the
~3,731-line `SettingsBundleContent` (profile row → Sloe Pro banner →
stats strip → roughly a dozen grouped cards: Personal, Membership, Goals
& targets, Display & extras, Connections, Reminders, Recipes, App/data,
Legal, Build, Danger zone), a single Sign Out row beneath the bundle
(confirm-gated), and a dev-only flag panel. Web renders the
same section set via `Settings.tsx`, single-scroll by default, with an
optional flag-dark two-pane desktop shell (`sloe_v3_settings`,
**default-OFF, web-only**).

**Why it's structured this way.** Before 2026-05-01 the mobile screen
rendered *two* settings shells stacked — a legacy in-file section list
plus the canonical bundle underneath — producing duplicate Sign Out
rows and three inconsistent visual languages on one scroll. The
single-shell collapse is what you see today; `SettingsBundleContent` is
the one source of truth, also reused as the `/more` redirect target.

**Search.** The mobile search box (`settingsSearchIndex.ts`) is a
substring keyword index over five entries only —
`fasting`, `daily-targets`, `notifications`, `health-sync`,
`weigh-in-reminder` — each routing to a full-screen destination.
**In-bundle modal rows are deliberately not indexed**: toggles (track
caffeine, track alcohol, net carbs lens), pickers (week-start, deficit
window, dashboard widgets), and the theme/macro-display segmenteds all
live inside the bundle and a search hit can't open a modal nested
inside another component without a larger refactor. Typing "units" or
"export" today returns "No matches" — this is a known, documented
scope limit (`settingsSearchIndex.ts` header comment), not a bug.

**Parity note.** `apps/mobile/app/(tabs)/settings.tsx` imports
`YouSubTabHeader` but never renders it (a dead import) — the
`ScreenSectionChrome` / `primary_screen_chrome_v1` header treatment used
elsewhere in the app is **not** present on this screen. Web's two-pane
shell (`SettingsTwoPaneShell.tsx`) has no mobile mirror by design — it's
a deliberate desktop-only layout decision, not a parity gap.
`SettingsBundleContent.tsx` is 3,731 lines, far past the
400-line screen budget — it's a **pinned legacy offender** in
`scripts/screen-line-budget.json` (may only shrink, never grow further).

## 2. Personal — the two-name split

Settings has **two distinct name fields**, and they are easy to
conflate. Get this wrong and you edit the wrong one.

| | **"Your name"** | **Display Name** |
|---|---|---|
| Lives at | Personal card, first row (both platforms) | `/profile` (mobile) / Personal card, 3rd row (web) |
| Writes | `auth.updateUser({ data: { full_name } })` — Supabase **auth** `user_metadata` | `profiles.display_name` column |
| Read by | The Today greeting (`firstNameFromMetadata`) | Household / shared surfaces (member lists, invite rows) |
| Helper | Shared `saveDisplayName()` (`src/lib/account/displayName.ts`) | Standard `profiles` upsert |

**Why two fields, not one — the actual reason, not a guess.** Before
this field existed, the only way the Today greeting ever got a name was
a one-time grab of Apple Sign-In's `FULL_NAME` scope at first
sign-in — a user who signed in with email, or declined that scope, could
never personalise their greeting. Writing the greeting name to
`profiles.display_name` instead was rejected because a generic
`profiles` update risks the tier-lockdown trigger (any write to a row
containing entitlement columns can reject the whole update) — writing to
`auth.updateUser` sidesteps that surface entirely. So "Your name" is a
narrowly-scoped, low-risk write path that exists specifically to feed
the greeting; "Display Name" remains the pre-existing, separately-owned
field for anything shown to other people. See
[`docs/decisions/2026-06-04-settings-your-name-greeting.md`](../decisions/2026-06-04-settings-your-name-greeting.md)
for the full history, including a 2026-06-04 relocation from a
standalone card into this shared "Personal" group at Grace's request.

**Behaviour.** Empty/whitespace on "Your name" clears it (greeting falls
back to "Good morning"/"Morning"). Commits on blur or Save; the screen
calls `getSession()` afterwards so the auth context re-emits and the
greeting updates without an app restart.

**Parity.** Identical placement and group name ("Personal") on both
platforms, pinned by `tests/unit/settingsYourNameParity.test.ts`.

## 3. Editing targets and body stats — `/profile` and `/targets`

Two screens split the read and write concerns deliberately:

- **`/targets`** is the **read** surface: calorie ring, TDEE/maintenance
  caption, macro tiles, a goal card with a status pill, a "How is this
  calculated?" sheet, and a Recalculate button. It exists so a user can
  inspect their number and its rationale without risking an accidental
  edit.
- **`/profile`** is the **write** surface for the core targets
  (calories, protein, carbs, fat, fibre, water) plus display name and
  dietary-preference chips. `canSave` requires every value finite and
  calories > 0; there's an amber safety warning under 1,200 kcal; Cancel
  reverts to a pre-edit snapshot.

### The real capability gap between platforms

This is not cosmetic — **web can do meaningfully more here than
mobile.**

**Web `Profile.tsx`** edits the full body-stat set inline on one screen:
sex, age, height, weight, activity level, goal, plan pace, nutrition
strategy, **measurement system (units)**, notification prefs,
week-start day, and tracked macros.

**Mobile `/profile`** edits only calories/macros, display name, and
dietary chips. Body stats (height/weight/age/activity/goal/pace) are
reachable only through a **flag-gated** `GoalPaceEditorSheet` row
(`goal_editor` flag) — when the flag is off, tapping the row shows an
`Alert` telling the user to "update your body stats during your next
target review" instead of actually letting them. **And mobile has no
units control anywhere** — every body-stat and nutrition input on
mobile is always presented in metric (g/kg/ml), regardless of the
user's actual preference, because there is nowhere on mobile to set
`profiles.measurement_system`. The code comment at
`apps/mobile/app/profile.tsx:896-907` is explicit that this was a
deliberate scoping call for that specific change (a units control on
`/profile` — a screen with no other body-stat inputs visible — would
mislead), not a claim that the underlying gap is closed anywhere else.
It isn't; see §5 below.

**Why this matters beyond inconvenience:** a UK-based mobile user typing
their weight in what they assume is stone/lb is silently storing
kilograms. There's no unit label correction anywhere on the mobile
input to catch this.

**Save behaviour (both platforms, shared logic):** the write upserts
targets, stamps `target_calories_source = "user"` and
`target_calories_set_at = now()`, calls `recordGoalHistory(...)`, sets
the `PROFILE_TARGETS_DIRTY_KEY`, and emits `profile_targets_saved`. This
provenance stamp is load-bearing for a downstream rule: the Weekly
Review loop's "Adjust calorie goal" suggestion suppresses itself for 14
days after a `source = "user"` write so it never re-suggests a number
the user just chose deliberately (see
[`docs/journeys/progress.md`](./progress.md), Rule 2 suppression
contract).

**→ What reads this back.** Today's macro spine re-reads targets on
next focus via the dirty flag; the Weekly Review loop
(`docs/journeys/progress.md`) reads the provenance stamp to decide
whether to suggest a recalibration; the Daily Logging loop
(`docs/journeys/food-tracking.md`) renders every macro ring against
whatever target is live here. **Editing a number in Settings is the
single upstream event both of those loops key off** — this is the
concrete shape of "Settings is the control plane."

## 4. Membership — entry point only

The Sloe Pro banner and Membership card live inside the bundle
(free → `/paywall?from=settings`; Pro → manage). "Manage subscription"
opens `CancelExportPromptSheet` — a Suppr-owned export-first
interstitial — **before** handing off to the platform's own billing UI
(RevenueCat customer center / App Store fallback on mobile, the Stripe
billing portal on web). A promo-code redeemer is a collapsible row
beneath.

This doc does not re-derive the billing mechanics, tier reconciliation,
or pricing rules — see
[`docs/journeys/monetisation-and-paywall.md`](./monetisation-and-paywall.md)
for the full trigger → checkout → webhook → entitlement → manage/cancel
loop, and
[`docs/product/subscriptions-stripe-and-iap.md`](../product/subscriptions-stripe-and-iap.md)
/ [`docs/product/tier-gates.md`](../product/tier-gates.md) for the
Stripe-vs-RevenueCat rail split and the tier-gate register.

## 5. Preferences — display, units, theme, macro layout, tracking extras

The Display & extras card (mobile) / Preferences card (web) holds:
theme (auto/light/dark), macro display style (**tiles / bars / rings** —
a three-way `SettingsSegmented` switcher, `MACRO_DISPLAY_OPTIONS` in
[`src/lib/preferences/macroDisplayStyle.ts`](../../src/lib/preferences/macroDisplayStyle.ts)),
net-carbs lens, calm mode, track caffeine/alcohol (with limit pickers),
dashboard widget selection, week-start day, and the deficit/burn summary
window.

**Macro display style, in detail.** Three Today-macros-block treatments,
same string keys and same `"suppr.prefs.macro_display"` storage key on
both platforms (web `localStorage`, mobile `AsyncStorage`) so the
preference reads identically pending cross-device sync:

| Value | Component | Look |
|---|---|---|
| `tiles` | `TodayDashboardMacroTiles` | 2×2 grid of icon tiles |
| `bars` | `TodayDashboardMacroBars` | Vertical `Name … Value / Target` rows, thin colored bar under each — Cronometer / Lose It aesthetic, packs more macros per vertical inch |
| `rings` | `TodayDashboardMacroRings` | Three small Protein/Carbs/Fat watch-dials, the v3 jewel-dial grammar scaled down |

`rings` is the **default** (`DEFAULT_MACRO_DISPLAY_STYLE`) since the Sloe
v3 prototype call on 2026-06-25 — v3's Today shows the ring donuts
out of the box; `tiles` was the default before that and predated
Grace seeing the prototype's rendered Today. `tiles` and `bars` remain
available in Settings → Display → Macro display.

**Internal QA harness — web only.** `app/dev/macro-display/page.tsx`
(`/dev/macro-display`) renders `TodayDashboardMacroTiles` and
`TodayDashboardMacroBars` side by side against identical fixture props,
for engineers to eyeball the two variants without touching the live
preference or logging real data. It 404s on `VERCEL_ENV === "production"`
(the same gate every other `app/dev/*` page uses — see
[`docs/development/mobile-visual-validation.md`](../development/mobile-visual-validation.md)
for the pattern) and is not linked from any in-app nav; it's reachable
only by URL on preview/local deploys. **It only previews two of the
three variants** — `rings` (the current default) has no column here,
and the page's own header comment still calls tiles "the default",
which has been stale since the 2026-06-25 rings default flip. Neither
gap affects what ships (the real Settings switcher and both live
components are unaffected) but a QA engineer using this page today
cannot preview the ring treatment or trust the comment's "default"
claim — worth a follow-up to add the `rings` column and correct the
comment next time this file is touched. No dedicated test covers this
route (it's a visual aid, not behaviour); the real macro-display
preference is covered by `apps/mobile/tests/unit/macroDisplayStyleSync.test.tsx`
and the component-level tests referenced above.

**Units is the same gap as §3, restated here because this is its actual
home.** `profiles.measurement_system` (metric/imperial) is editable
**only on web**, via both `Settings.tsx` and `Profile.tsx`. There is no
units row anywhere in the mobile bundle. This single source of truth —
`profiles.measurement_system` — is what §3's "mobile has no units
control" and this section's "no units row" both point back to; it is
one gap, not two. `docs/ux/redesign/settings.md` §3.8 proposed a
`settings_units_row` flag to close it in 2026-06-02; that flag has
never been built — it does not exist anywhere in the codebase, and the
row was never added.

Everything else in this card — theme, macro display, tracking extras,
week-start day — is at parity across platforms.

## 6. Notifications & reminders — two real, currently-open gaps

This is the area with the sharpest difference between what
`docs/ux/redesign/settings.md` §3.9 proposed and what actually shipped.
**Neither of the two gaps below has closed.** Both were spec'd as a
single `NotificationPrefsSheet.tsx` behind a
`settings_notification_prefs_sheet` flag; that component does not exist
anywhere in the repo — there is no file, no flag string, and no test
referencing it.

### Gap 1 — no reminder-time editor exists outside onboarding, on either platform

**Mobile** shows the current daily reminder time
(`profiles.notification_prefs.reminder_time`) as **read-only** text on
the "Notifications" row inside the Reminders card — "Daily reminder at
08:00" — and tapping the row routes to the Notifications **inbox**
(`/(tabs)/notifications`), which has no time-editing UI at all
(`SettingsBundleContent.tsx:2247-2266`).

**Web** doesn't even show the current time — `Settings.tsx` has no
reminder-time display or editor of any kind.

The only place a user can ever set this value is during onboarding.
Once onboarding is complete, the time is fixed for the life of the
account unless the user re-onboards via "Refresh my plan" (see §8).

### Gap 2 — per-kind notification toggles are web-only

**Web** `Settings.tsx` has five real toggles:
`showMealTimestamps` ("Show meal timestamps"),
`newRecipes` ("New recipes from people you follow"),
`mealReminders` ("Meal plan ready"),
`weeklyReport` ("Weekly summary"),
`creatorUpdates` ("Your recipe publish updates") — all written to
`notification_prefs`.

**Mobile has no equivalent of any of these.** A mobile user cannot turn
off "new recipes from creators you follow" notifications, cannot turn
off meal-plan-ready pushes, and so on — the web-only toggles are simply
absent from the mobile Reminders card.

### What mobile actually has that web doesn't

Two things partly offset the above, but don't close either gap: a
**Weekly recap picker** (toggle + Sun/Sat 18:00 time, respects
week-start day, calls `cancelWeeklyRecapPush()` on OFF) — present on
both platforms — and a flag-gated **Weigh-in reminder** row
(`weigh_in_reminder_v1`, default-ON since 2026-06-30) which is genuinely
mobile-only functionality, not a gap.

### The Notifications inbox itself

Both the mobile "Notifications" row and web's `NotificationsBell` route
to a read inbox (merging `app_notifications` +
`creator_publish_notifications`, partitioned Today/Earlier, with
mark-one/mark-all-read and tap-to-recipe). This inbox has no dedicated
journey doc of its own yet; this doc covers only that it's the
destination Settings routes to, not its internals.

## 7. Connections — Apple Health and Household

**Apple Health** — the Settings Connections row shows live connection
state (`probeHealthAccess()` on focus: connected / permission needed /
unavailable) and routes to `/health-sync` for the full sync surface.
Mobile-native by construction (HealthKit is iOS-only). Web's equivalent
row (gated `web_settings_connections_v1`) is deliberately **informational
only** — it explains that HealthKit connects on iOS and that web Health
data is read-only once connected there; it never fakes a web-side
connect. This is a documented, intentional divergence, not a gap
([`docs/integrations/apple-health.md`](../integrations/apple-health.md)).

**Household** — the Household row (hidden entirely when the user is
solo) routes to the full sharing surface. See
[`docs/journeys/household-sharing.md`](./household-sharing.md) for the
full setup/config/privacy walkthrough, and
[`docs/decisions/2026-05-01-household-netflix-model-v1-schema.md`](../decisions/2026-05-01-household-netflix-model-v1-schema.md)
for the sharing model and its "households see what's on the table, not
what's on the scale" privacy boundary. One entry-point-level parity note
worth flagging here rather than duplicating there (the full detail now
lives in `household-sharing.md`'s "Web-only gap" section): **web reaches
Household only via the legacy alias `/home?view=household-settings`**
(`src/app/components/Settings.tsx:1669`) — there is no first-class
`/household-settings` route on web, unlike mobile's real stack screen.

## 8. Danger zone — export, refresh, erase, delete, sign out

A deliberately graduated ladder, safest action first:

1. **Export nutrition log (CSV)** / **Export everything** (full archive,
   `/api/export/me`) — "Yours forever. Take your data anywhere." Both
   platforms.
2. **Refresh my plan** — re-runs onboarding, **keeps** food log, weigh-ins,
   recipes, plans, saves, shopping lists. The mobile copy states this
   explicitly: *"Refresh my plan keeps your food log, weight history,
   recipes, plans, saves, and shopping lists."*
3. **Erase everything** — type-`RESET`-to-confirm, wipes food
   log/journal/saves/shopping/recipes/activity via
   `nukeAllUserAppData()`. Mobile's own copy already reassures on the
   point Fitplan-style competitors get support tickets over: *"Erase
   everything wipes all of the above. **Your account and subscription
   stay.**"* (`SettingsBundleContent.tsx:2602`.)
4. **Delete account** — the highest-stakes action, and one where the
   shipped flow has moved on from what `docs/ux/redesign/settings.md`
   §3.11 describes. That spec assumed a single native `Alert.prompt`
   requiring the typed word "delete". Both platforms now ship a
   **3-step sheet** (`delete_account_sheet_v1`, default-on on both
   platforms): step 1 asks an optional leave-reason, step 2 shows the
   removal ledger plus a "download a copy first" export button and the
   published-recipe de-attribution note, step 3 requires typing `DELETE`
   before the button enables.
5. **Sign Out** — a separate, non-destructive, confirm-gated row beneath
   the bundle (mobile: an `Alert.alert` confirm, because it sits
   directly under Delete Account and an instant no-confirm tap would be
   a hazardous mis-tap).

### Delete account still doesn't warn about an active subscription

`docs/ux/redesign/settings.md` §3.11 proposed adding one line to the
delete-account confirmation copy — *"Deleting your account does not
cancel your subscription. Manage it first in Membership."* — citing
Fitplan's documented support trap (users delete their account expecting
that to also cancel billing, then get charged again and file a
chargeback).

**This warning has not shipped, on either platform.** The single shared
copy source both sheets render from
(`src/lib/settings/deleteAccountFlow.ts`, `DELETE_ACCOUNT_COPY` +
`DELETE_ACCOUNT_DEATTRIBUTION_NOTE`) and the older web
`DestructiveConfirmDialog` copy in `SettingsDialogs.tsx` both omit it —
neither the 3-step sheet's step 1/2/3 text nor the de-attribution
footnote mentions subscriptions, billing, or cancellation anywhere. A
Pro user who deletes their account today gets no warning that their
subscription is still active and will still bill. This is the exact
Fitplan trap the spec was written to prevent, and it is currently live
in production.

## 9. Privacy & Security — the cookie/analytics consent loop

This is the surface the Scope section above promises: the pre-Settings
consent ask and the Settings toggle that reads/writes the same stored
choice. It's implemented across
`src/app/components/CookieConsent.tsx`,
`src/app/components/AnalyticsProvider.tsx`,
`src/app/components/settings/AnalyticsConsentToggle.tsx`,
`apps/mobile/lib/analyticsConsent.ts`,
`apps/mobile/components/consent/AnalyticsConsentPrompt.tsx`, and
`apps/mobile/components/settings/AnalyticsConsentRow.tsx`.

**What it is.** A single three-state choice — `null` (never asked) /
`"accepted"` / `"declined"` — that gates PostHog product analytics +
masked session replay everywhere in the product. There are always two
surfaces reading and writing that one choice, never two independent
choices:

1. **The pre-Settings ask**, shown before the user has ever answered.
2. **The Settings toggle**, which reflects and can flip the same stored
   value at any time afterwards.

| | **Web** | **Mobile** |
|---|---|---|
| Pre-Settings ask | `CookieConsent` — a slim strip rendered **app-wide** from `app/providers.tsx` (`<CookieConsent />`, itself mounted by `app/layout.tsx`) | `AnalyticsConsentPrompt` — a non-modal card in the tabs shell (`apps/mobile/app/(tabs)/_layout.tsx`) |
| Settings toggle | `AnalyticsConsentToggle`, inside the **Privacy & Security** card (`Settings.tsx`, alongside the CSV/JSON export buttons) | `AnalyticsConsentRow`, inside the **Account** card (`SettingsBundleContent.tsx`, between the export rows/barcode contributions and the Legal section) |
| Storage | `localStorage["suppr_cookie_consent"]` | `AsyncStorage["suppr_analytics_consent"]` (renamed — no cookies on iOS) |
| Live sync mechanism | `window` `CustomEvent("suppr-consent")`, dispatched by `setConsentChoice()`, heard by both `AnalyticsProvider` and `AnalyticsConsentToggle` | an in-memory listener set (`onAnalyticsConsentChange`) driven by `setAnalyticsConsent()`, heard by the PostHog client glue and any mounted UI |

**Where the web banner actually appears — every route, not just
marketing.** Because it's rendered from the root `Providers` wrapper, the
strip shows on literally every URL — landing, pricing, roadmap, `/privacy`,
onboarding, and every authenticated product screen — until the user
answers, then never again (`getConsentChoice()` gates the initial
`visible` state). Positioning changes by route so it never blocks a
primary action, not because the surface itself changes:
- **Marketing/legal routes** (`isMarketingRoute` — everything that isn't
  the authed app) → top-anchored, so hero CTAs and the pricing grid stay
  tappable underneath it.
- **Authed product routes** (`today`, `plan`, `shopping`, `library`,
  `recipes`, `progress`, `settings`, `profile`, `recipe`) → bottom-anchored
  and lifted above the mobile bottom-nav/FAB height
  (`bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`).

**Mobile's ask moment is scoped narrower and by design.** Because the tabs
shell only mounts post-login + post-onboarding, `AnalyticsConsentPrompt`
never interrupts sign-up or onboarding — it's the first thing that can show
once a user reaches their first authenticated Today render, and persists
(un-modal, doesn't block the product) across tab switches until answered.
It deliberately avoids stacking with the separate `PostOnboardingPushExplainer`
modal that already owns that first-Today moment.

**Copy and equal-prominence.** Both surfaces present accept/decline as two
buttons of identical size and visual weight — never a small "reject" link
next to a large "accept" button — to satisfy the UK/EU equal-prominence
expectation for cookie/analytics consent. Web: "Essential only" / "Accept
all" (with a `/privacy` link inline). Mobile: "No thanks" / "Allow" (with a
`Privacy Policy` deep link to `{web}/privacy`, since there's no in-app
policy page).

**Fail-closed on both platforms, with mobile stricter.** Nothing is
captured until the stored choice is `"accepted"`. Web initialises PostHog
with `opt_out_capturing_by_default: consent !== "accepted"` — the client is
always constructed, just opted out pre-consent. Mobile is stronger:
`getPostHogClient()` returns `null` and never constructs the SDK at all
until consent is `"accepted"`, because `enableSessionReplay` is an
init-time-only option on `posthog-react-native` — an opt-out call after
construction can't reliably stop a replay recorder that's already running.
See `docs/decisions/2026-07-01-mobile-analytics-consent-gate.md` for the
full rationale and the accepted trade-offs (pre-consent PostHog flags read
`false`; pre-consent funnel events are unrecorded on both platforms).

**No consent event fires on either platform, on purpose.** Accepting or
declining never emits a PostHog event from the consent UI itself — capturing
a *decline* would itself be capture-before-consent, and an *accept* is
already visible indirectly via the `posthog_health_check` sentinel event
`AnalyticsProvider` fires once it adopts a consented client. This is called
out explicitly in both components' source comments as intentional, not an
instrumentation gap.

**Session replay rides the same single switch — there is no separate
replay toggle**, on either platform. `opt_out_capturing_by_default` (web)
and the null-client gate (mobile) cover events and replay together, which
is what lets the Settings copy say one thing truthfully: "Off means nothing
is collected."

**What the privacy policy promises, and where that promise is kept.**
`app/privacy/page.tsx` tells users they can "disable optional analytics or
error reporting via your cookie preferences" — this loop (ask banner +
Settings toggle, both platforms) is the literal mechanism that promise
points to. There is no separate cookie-policy page; `/privacy` is the only
legal surface either consent UI links to.

**Parity status: at parity.** Same three-state semantics, same live-sync
behaviour, same equal-prominence copy shape, same "no toggle event" rule,
same card-neighbour pattern (consent toggle sits beside the data-export
actions on both platforms, ahead of the separate, more-destructive Danger
zone card). The one **documented, deliberate** divergence is the
fail-closed strength difference above (mobile never constructs the SDK
pre-consent; web does, just opted out) — not a gap to close. The mobile
analytics consent gate decision originally noted that web had no
post-banner Settings surface at all; `AnalyticsConsentToggle` has since
shipped and closed that gap, so that note should now be read as
resolved.

**Test coverage.** Web's `AnalyticsConsentToggle` component has **no
dedicated render test** — only the underlying
`setConsentChoice`/`getConsentChoice` logic
(`tests/unit/cookieConsent.test.ts`) and the pre-Settings banner's chrome
(`tests/unit/cookieConsentRender.test.tsx`) are covered directly on web.
Mobile's mirror is fully covered: `AnalyticsConsentRow` and
`AnalyticsConsentPrompt` both have dedicated render/interaction tests in
`apps/mobile/tests/unit/analyticsConsentSurfaces.test.tsx`, and the
storage/gate semantics have their own suite,
`apps/mobile/tests/unit/analyticsConsentGate.test.ts`. Web is the side
missing test coverage here — the inverse of most other gaps in this doc.

## 10. Barcode contributions — reviewing and withdrawing shared foods

**What it is.** A collapsible row (`BarcodeContributionsSection`) sitting
in the same card as the export rows and the consent toggle from §9 —
web's **Privacy & Security** card, mobile's **Account** card
(`settings-card-app`) — directly after "Export everything" on both
platforms. Opening it lists every barcode product the signed-in user has
personally submitted to Suppr's shared community food database
(`user_foods`), each with a **Remove** action that withdraws it.
Component: `src/app/components/settings/BarcodeContributionsSection.tsx`
(web) / `apps/mobile/components/settings/BarcodeContributionsSection.tsx`
(mobile) — split out of the parent bundle purely to stay under the
file's line budget, not a separate feature area.

**Why it exists — the promise it closes.** Scanning a barcode offers two
separate paths that write to the shared `user_foods` table: correcting an
existing product's numbers inline, or — on a not-found barcode — an
explicit, default-OFF opt-in to additionally share the product after
logging it privately (`BarcodeShareOptIn`, flag
`barcode_community_contribution`). See
[Food tracking journey §"Not-found → save → community contribution → saved confirmation"](./food-tracking.md)
for the full flow. That opt-in's success copy promises: *"You can remove
your version any time from your saved items."*
[`docs/decisions/2026-06-27-shared-food-db-contribution-opt-in.md`](../decisions/2026-06-27-shared-food-db-contribution-opt-in.md)
records legal's re-review making a **reachable withdrawal
surface a must-fix before ramping that flag** — a stated deletion right
with nowhere to exercise it is a consent-integrity problem, not cosmetic
UX debt. This row is that surface. One step further back: until
`supabase/migrations/20260425100000_user_foods_update_with_check.sql`,
`user_foods` had **no DELETE policy at all** — a user who tried to retract
a bad submission was silently denied with no explanation. That migration's
own comment names this row's job directly: "so owners can remove their own
contributions."

**Two contribution sources feed this list.** Rows here come from either
(a) the not-found → opt-in path above (still flag-gated, default OFF,
with no ramp date set yet), or (b) the older, ungated
"found product, numbers look wrong" correction path inside the barcode
scan/log result (`submitFoodCorrection` — see food-tracking.md's "Trust +
correction" note). Both write the identical `user_foods` shape, so both
surface identically here regardless of which path produced them.

**What it does NOT cover.** `POST /api/barcode-mapping` writes a
different, older table — `barcode_mappings` (barcode → canonical
`foods.id`, attributed via `created_by`) — called today only from the
recipe-upload flow (`src/app/components/RecipeUpload.tsx`). This row has
no visibility into and no withdrawal path for `barcode_mappings` rows,
only `user_foods`. It's not the same promise this row was built to
satisfy — that decision is scoped to `user_foods` — so it isn't a gap in
this row's own scope, but "Barcode contributions" should not be read as
a complete "everything I've ever contributed" view; see Open question 9.

**Behaviour, both platforms:**
- The row header shows a live count ("No shared barcode products" / "1
  shared barcode product" / "N shared barcode products") plus the static
  subtitle "Remove products you shared to the community database.", or
  "Loading shared barcode products…" while a fetch is in flight. Opening
  the row always triggers a fresh fetch — the list is never cached across
  opens.
- Expanded, it always shows a fixed privacy line: *"When you correct or
  add a barcode product, Sloe stores the product data with your account
  as the submitter so you can withdraw it later from Settings."*
- Empty state: "Nothing shared yet. Barcode corrections you add will
  appear here."
- Each row shows a title (`brand · name`, falling back to `name` or the
  raw barcode if both are blank) and a subline of `barcode · status`,
  where status is **Verified** / **Rejected** / **Pending review**
  (`user_foods.verification_status`; `null`/missing also reads "Pending
  review").
- Remove is confirm-gated on both platforms — native `confirm()` on web,
  `Alert.alert` on mobile — before anything is deleted.

**Where the two platforms genuinely diverge (both correct, not a defect
— but real enough to name):**
- **Data path.** Web calls the API route —
  `GET /api/user-foods?mine=1&limit=25` / `DELETE /api/user-foods?id=`,
  Bearer-authed, a service-role client that re-scopes every
  lookup/delete to `submitted_by = auth.uid()` in application code (see
  `docs/api/endpoints.md` § "User foods (community catalog)"). **Mobile
  talks to Supabase directly** (`supabase.from("user_foods")…`), relying
  on the table's RLS SELECT/DELETE policies
  (`submitted_by = auth.uid()`, from the same
  `20260425100000_user_foods_update_with_check.sql` migration above) to
  enforce the identical rule. Both are equally safe today — two different
  enforcement layers reaching the same guarantee — but a regression in
  one path isn't caught by testing the other.
- **Confirm copy.** Mobile's `Alert.alert` explicitly reassures *"Your
  diary entries stay as they are"* — withdrawing a shared product can't
  retroactively change anything already logged, because a logged entry
  stores a macro snapshot at log time, not a live reference into
  `user_foods`. Web's `confirm()` prompt ("Remove {title} from the
  community database?") omits that reassurance — same underlying
  guarantee, asymmetric copy.
- **Post-action feedback.** Web shows a toast on success ("Barcode
  contribution removed."), on failure ("Could not remove that
  contribution."), and on a missing session ("Sign in to manage barcode
  contributions."). **Mobile shows nothing on success** — the row simply
  disappears from the list — and only surfaces an `Alert` on failure
  ("Couldn't remove contribution" / "Please try again."). Silent success
  after a destructive user action runs against the design craft
  contract's interaction-state rules; see Open question 10 below.

**What removal actually does.** The `DELETE` is a hard delete of the
shared row — it stops appearing in every other user's search results
going forward, not merely hidden from the submitter's own list (the
search read path only ever returned `verified` or
`pending`-with-2+-upvotes rows, so a withdrawn row simply ceases to exist
rather than being "unshared"). It never touches the submitter's own past
`nutrition_entries` — those hold a macro snapshot taken at log time, not
a live foreign key into `user_foods`.

**No analytics event fires** for opening this row, listing contributions,
or removing one, on either platform, so a future funnel question ("how
many users ever withdraw a contribution?") currently has no data source
to answer it from.

## Analytics touchpoints (selected)

- `profile_targets_saved` — `/profile` write commits.
- `weekly_recap_push_enabled_toggled { enabled }` — Reminders card toggle, both platforms.
- `cancel_export_prompt_shown` / `cancel_export_chosen` / `cancel_proceeded` — the Membership "Manage subscription" export-first interstitial.
- `settings-your-name` field writes do not emit a dedicated event today (session-refresh side effect only).
- `posthog_health_check { platform }` — fires when capture is confirmed live (already-accepted on boot, or the moment of first accept via the banner/prompt in §9); the only visible signal a session is capturing, since the consent accept/decline flips themselves are intentionally event-free (§9).
- `food_contribution_opt_in { barcode, policy_version }` — fires on a successful not-found → community-share opt-in (see food-tracking.md), the write that populates §10's list. §10's own view/remove actions on that list are event-free (§10).

Full taxonomy: `src/lib/analytics/events.ts`.

## Edge cases

- **Empty "Your name"** → clears `user_metadata.full_name`, greeting
  falls back to "Good morning" (web copy) / "Morning" (mobile
  `todayGreeting`), never a blank/undefined string.
- **Sub-1,200 kcal target on `/profile`** → amber inline warning, Save
  stays enabled (soft-warn, not a hard block — matches the same
  soft-warn posture used in the `goal_editor` recompute path).
- **Body-stats row tapped with `goal_editor` OFF (mobile)** → an
  informational `Alert`, not a dead tap and not a fake editor.
- **Search query with no match (mobile)** → an explicit "No matches for
  'X' — try a different word" row, never a blank screen.
- **Household row on a solo account** → hidden entirely, both platforms
  — not a disabled/greyed row.
- **Delete-account flow abandoned mid-sheet** → no partial state is
  written; nothing happens until the final `DELETE`-token step
  completes and the confirm button fires.
- **Erase-everything vs Delete-account confusion risk** — this is
  exactly why "Refresh my plan" (non-destructive) is visually ordered
  first and carries the explicit "keeps your data" subtitle: to stop a
  user who actually wants a fresh plan from reaching for the destructive
  option out of habit.
- **Consent ask answered on web, then the same user opens the mobile
  app for the first time (or vice versa)** → asked again. The stored
  choice is per-device/per-storage (`localStorage` vs `AsyncStorage`),
  not per-account — there is no cross-platform consent sync. Not a bug;
  just worth knowing before treating a "why is it asking me again"
  report as a defect.
- **Declining on web after a prior accept** (an already-capturing
  session) → `posthog.opt_out_capturing()` fires on the live client
  immediately; capture stops mid-session. Mobile's equivalent live-flip
  calls `optOut()` on the existing client too, but — unlike a fresh
  decline — never tears the client back down to `null`; only a
  **pre-consent** decline keeps the SDK uninitialised (§9).
- **Withdrawing a barcode contribution never touches past diary
  entries** (§10) — logged meals store a macro snapshot, not a live
  reference to `user_foods`, so removal is forward-only: it stops the
  product surfacing for future scans/searches by anyone, but changes
  nothing already logged.
- **Removing a contribution on mobile gives no success confirmation**
  (§10) — the row disappears from the list with no toast/banner. The
  delete itself succeeds; the gap is the missing confirmation, not the
  write.

## Open product questions

These are the places where Settings' current behaviour is a real
product decision waiting to be made, not a bug to quietly fix:

1. **Reminder-time editor.** No user can change their daily reminder
   time after onboarding, on either platform. Ship the
   `NotificationPrefsSheet` §3.9 proposed (never built), or rule
   onboarding-only intentional and remove the misleading "not yet
   wired" framing from the spec?
2. **Per-kind notification toggles.** Web has five; mobile has zero.
   Bring mobile to parity, or is the web set actually over-scoped and
   should shrink to match mobile instead?
3. **Units row.** `profiles.measurement_system` is web-editable only;
   mobile is metric-forced everywhere (body stats and nutrition
   inputs alike). This silently mis-stores a UK-toned mobile user's
   input today. Ship `settings_units_row` (spec'd, never built), or is
   metric-only acceptable given the current N=1 TestFlight reality?
4. **`goal_editor` flag ramp.** Mobile body-stat editing exists only
   behind this flag; when off, the row shows an `Alert` instead of an
   editor. What's the current ramp state, and is there a date to reach
   100% and drop the gate?
5. **Delete-account subscription warning.** Not shipped on either
   platform (see §8). This is a live support-ticket / chargeback risk
   today, not a hypothetical one — should this ship before the next
   build that touches this sheet?
6. **Household web entry point.** Reachable only via the legacy
   `/home?view=household-settings` alias, not a first-class route.
   Promote to a real route, or is the alias considered stable enough to
   leave as-is?
7. **`sloe_v3_settings` two-pane shell.** Default-OFF, web-only, with no
   documented ramp date. Is it still active work, or should it be
   archived?
8. **Web `AnalyticsConsentToggle` test coverage (§9).** No dedicated
   render test exists for the web Settings toggle, unlike its mobile
   mirror (`AnalyticsConsentRow`, fully covered). Worth a follow-up test
   next time that file is touched, or is the existing logic-level
   coverage (`cookieConsent.test.ts`) considered sufficient given how
   thin the component is?
9. **`barcode_mappings` has no review/withdrawal surface (§10).**
   `POST /api/barcode-mapping` writes user-attributed rows
   (`created_by`) with no equivalent of the Barcode contributions row —
   a user who contributes through the recipe-upload barcode path today
   has no way to see or retract it. Is this genuinely out of scope (a
   different table with a different consent story than the
   community-contribution decision covers), or should it be folded into
   the same Settings row now that the pattern exists?
10. **Mobile barcode-contribution removal has no success feedback
    (§10).** The row just vanishes from the list; web shows a toast.
    Silent success after a destructive action runs against the design
    craft contract — add a toast/confirmation on mobile, or is the
    visible list-shrink considered sufficient feedback on its own?

## Related documents

- [Settings redesign spec](../ux/redesign/settings.md) — the aspirational source most gaps in this doc trace back to; read the Status section here before trusting anything in that file as shipped.
- [Settings mobile structural fix](../decisions/2026-05-01-settings-mobile-structural-fix.md) — why the hub collapsed to a single shell.
- [Edit goal & pace editor decision](../decisions/2026-05-25-edit-goal-and-pace-editor.md) — the `goal_editor` flag and its recompute contract referenced in §3.
- [Progress / Weekly Recap journey](./progress.md) — the loop that reads back the `target_calories_source` provenance stamp §3 describes.
- [Food tracking journey](./food-tracking.md) — the loop that reads back whatever target is live in Settings on every render.
- [Session replay + feature flags decision](../decisions/2026-05-13-session-replay-and-feature-flags.md) — why session replay exists, its masking posture, and the web replay rollout §9 references.
- [User foods API contract](../api/endpoints.md) § "User foods (community catalog)" — the `GET`/`DELETE` `/api/user-foods` endpoints §10's web data path calls.

## Documentation coverage notes

The Notifications inbox — the destination the Notifications row routes
to on both platforms — has no dedicated journey doc of its own yet;
this doc covers only the entry point into it (§6).

## Change log

- **2026-07-19 — §10 Barcode contributions (new section).** Added
  coverage of the `BarcodeContributionsSection` Settings row —
  previously undocumented in any `docs/journeys/`, `docs/product/`, or
  `docs/user/` file despite being the reachable-withdrawal-surface
  must-fix that
  `docs/decisions/2026-06-27-shared-food-db-contribution-opt-in.md`
  required before ramping `barcode_community_contribution`. This row
  manages `user_foods` rows via `/api/user-foods` (web) or direct
  RLS-scoped Supabase calls (mobile) — **not** `/api/barcode-mapping`, a
  separate, older, unrelated route that writes to the `barcode_mappings`
  table from the recipe-upload flow only and has no review/withdrawal
  surface of its own (see Open question 9). Also cross-linked from
  [`food-tracking.md`](./food-tracking.md)'s "Not-found → save → community
  contribution → saved confirmation" section, which makes the "remove your
  version any time" promise this row fulfils.
- **2026-07-19 — §9 privacy & analytics consent (new section).** Added
  coverage of the pre-Settings cookie/analytics consent ask on both
  platforms (web `CookieConsent` banner, mobile `AnalyticsConsentPrompt`)
  and its Settings-mirror toggle (web `AnalyticsConsentToggle`, mobile
  `AnalyticsConsentRow`) — previously undocumented in any
  `docs/journeys/`, `docs/product/`, or `docs/user/` file despite being
  a live, app-wide GDPR-relevant surface rendered on every route via
  `app/providers.tsx`. Also noted that a "known follow-up" in
  `docs/decisions/2026-07-01-mobile-analytics-consent-gate.md` — that
  web had no post-banner consent surface — is now resolved:
  `AnalyticsConsentToggle` shipped after that decision was recorded. The
  one genuine gap that remains runs the other way: web's Settings toggle
  has no dedicated render test, unlike mobile's fully-tested mirror.
- **2026-07-19 — §5 macro-display coverage.** Corrected the "tiles vs
  bars" framing to reflect the switcher's actual three-way shape — tiles
  / bars / rings, rings default since 2026-06-25 — and added coverage
  of the internal `/dev/macro-display` QA preview page, including its
  two-of-three variant gap and the stale "default" wording in its
  header comment.
- **2026-07-18 — new doc.** First journey-level narrative for Settings,
  written against the current product code rather than the redesign
  spec. Established that: the delete-account "doesn't cancel your
  subscription" warning has not shipped on either platform; the
  reminder-time editor and per-kind mobile notification toggles remain
  open per `settings.md` §3.9, with no `NotificationPrefsSheet`
  component anywhere in the repo; the units row remains web-only with no
  `settings_units_row` flag built; and the delete-account flow itself
  has moved on from the `Alert.prompt` design `settings.md` §3.11
  describes to a shipped 3-step sheet (`delete_account_sheet_v1`) that
  still lacks the subscription warning.
