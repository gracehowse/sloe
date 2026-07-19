# User Journey: Progress & Weekly Recap

**Audience:** Product / Design

## Status — read this first

**The 5-section hierarchy behind the `progress_hierarchy_v1` flag is DEFAULT-OFF and the ramp has not started.** The flag is registered in `KNOWN_DEFAULT_OFF_FLAGS` on both platforms (`src/lib/analytics/track.ts`, `apps/mobile/lib/analytics.ts`). The PostHog flag row itself does not exist yet — the ramp runbook ([`docs/operations/posthog-rollout.md`](../operations/posthog-rollout.md), `progress_hierarchy_v1` entry) lists creating the PostHog row as the *first* pre-ramp step, and the ramp phase after that ("Internal (Grace) → 100%") has not run. **Every user today, including Grace on TestFlight, sees the legacy 13-card stack** described in "Legacy branch" below — nobody reaches the 5-section hierarchy without a manual dev override of the flag. The hierarchy branch landed in code on 2026-07-16/17, compiles, and is unit-tested; that does **not** mean it has shipped to a user. Read the "Hierarchy v1 branch" section further down as a real, tested code path that is currently dormant behind the flag — not as a description of today's live experience.

## Scope

This doc is the canonical journey for two loops:
- **Weekly Review & Adaptive Re-Target Loop** — a week of logging feeds the Weekly Recap / Week Digest, which surfaces the adaptive-vs-formula maintenance delta and a suggested re-tune.
- **Weight → Trajectory → Goal Loop** — a weigh-in updates the trend, the goal projection, and the maintenance calculation those numbers feed.

**In scope:** the Progress tab / `/progress` dashboard (both branches), the Weight/Trajectory card, the Energy/Maintenance surfaces, This Week / adherence, the Weekly Recap card + push, the streak-freeze panel, Body composition, Apple Health/Steps, the period control and weight-logging sheets.

**Out of scope — go here instead:**
- **How the calorie target itself is calculated** (BMR/TDEE formula, adaptive learning mechanics, Apple Watch handling) → [`docs/user/how-your-calorie-target-works.md`](../user/how-your-calorie-target-works.md). This doc covers where the number is *reviewed and re-tuned*; that one covers how it's *computed*.
- **The logging that feeds this data** (meal logging, the Log sheet, Today tab) → [`docs/journeys/food-tracking.md`](./food-tracking.md).
- **The fasting timer.** It is entered from the Today tab fasting pill and Settings — never from Progress — and is a Today-adjacent feature, not a Progress feature, even though its files (`apps/mobile/app/fasting.tsx`, `src/app/components/FastingTimer.tsx`) sit near this surface in the tree. No dedicated fasting journey doc exists yet; the closest current references are `docs/decisions/2026-04-fasting-web-scope.md` and `docs/ux/redesign/frames/fasting-305-2.md`. Do not describe fasting as part of the Progress loop in this doc or elsewhere.

## Overview
User opens the Progress tab to review their week — how many days they logged, how close they stayed to their calorie + protein targets, whether their weight is trending, and how long their logging streak is. When the week has just ended, a polished Weekly Recap card fronts the screen; an optional local push notification nudges them back to open it.

## Entry Points
- Progress tab on the bottom navigation (mobile) / side navigation (web).
- Weekly-recap push notification (mobile) → deep-links to `/progress`.
- Today tab streak insight card linking to Progress (indirect).

## Streak freeze

### The problem
A hard streak breaks the moment the user has a sick or travel day — that's a retention trap, not a retention signal. Duolingo-style "you missed today" messaging is shame-driven and doesn't belong in a nutrition tool.

### What the user sees
- On the Today streak insight card: "5-day logging streak" + optional sub-label "❄️ 2 freezes available" (only when the user actually has freezes).
- On the Progress dashboard streak tile: same count + small freeze pill inline.
- On the Progress dashboard "Streak freezes" panel:
  - Available / Earned / Used counters.
  - A compact list of recent freezes used — "Freeze used (Tue)", "Freeze used (Mar 12)".
  - A disclosure row comparing protected vs raw streak when they differ: "Raw streak (without freezes): 2 days."

### How it works
- Each user has a budget (default 3; configurable 0–10). Freezes are earned automatically when the protected streak crosses a multiple of 7 (7, 14, 21, 28…) — one per milestone.
- When the protected streak walks backward and hits a zero-meal day, it consumes one freeze and keeps walking.
- `streak_freezes_used_history` retains every consumed freeze (date + timestamp) so the UI can show "Freeze used (Tue)". Never dropped.
- `streak_freezes_earned_at` is pruned to 90 days to bound JSONB growth.

### Copy rules
- Factual. "Freeze used (Tue)" — never "Streak saved!".
- Feature can be disabled cleanly by setting `streak_freeze_budget_max = 0`. No UI appears in that case.

### Open product question — streak freeze panel on mobile

Whether the freeze panel described above should exist on mobile at all is unresolved, and the two platforms currently disagree in practice.

**Web** renders a dedicated `StreakFreezeCard` (`src/app/components/suppr/streak-freeze-card.tsx`) on **both** branches of `ProgressDashboard.tsx` (hierarchy at `:1431`, legacy at `:1932`). **Mobile** renders no equivalent component anywhere on Progress — the freeze count only surfaces inside `Digest.tsx` (as `recap.freezesAvailable`), and the streak metric drill-down (`/progress-metric?metric=streak`) shows contributing days but not the Available/Earned/Used ledger described above.

The split traces back to two specs that never converged: the hierarchy rebuild's design deltas say the freeze card keeps rendering below the This Week section, cross-platform, on both branches. The Sloe redesign (Figma frame 492:2, referenced inline at `apps/mobile/app/(tabs)/progress.tsx:811-814`) demoted the streak chips/freeze panel *out of* the Progress frame entirely on mobile, folding the streak and freeze figures into the Week Digest instead. Until product settles which read is correct — mobile is missing a card it should have, web should have followed the same demotion, or the divergence is intentional and the hierarchy spec's language needs correcting to "web-only" — neither side should be touched: no mobile `StreakFreezeCard`, and no removing web's.

## Weekly Recap Card

### Layout
```
┌──────────────────────────────────────────────┐  ← dismissible card
│  🏆 WEEK RECAP                       × close │
│  Your week — Apr 6 – Apr 12                  │
│  5 days logged                               │
├──────────────────────────────────────────────┤
│  AVG CAL   1,950     per day                 │
│  AVG PRO   142g      93% of target           │
│  STREAK    12 days   · 2 freezes             │
│  WEIGHT    -0.6 kg   first → last weigh-in   │  ← "No weigh-ins this week" when null
│  First → Last weigh-in: 78.4 → 77.8 kg (-0.6) │  ← explicit endpoints, not just a delta
├──────────────────────────────────────────────┤
│  Closest to target — Wed · 180g, 2,000 kcal  │  ← renamed from "Best day"
├──────────────────────────────────────────────┤
│  Got a usual lunch?                          │  ← usual-meal growth-loop insight
│  You've logged the same one 4 times in 2 wks │     OR "Save it once, log it in one tap."
├──────────────────────────────────────────────┤
│  Your maintenance landed at 2,150 kcal       │  ← adaptive-only line
│  this week (formula said 2,050).             │     suppressed on formula / low conf.
├──────────────────────────────────────────────┤
│  [Share week]  Got it                        │
└──────────────────────────────────────────────┘
```

### Gating
- The card surfaces the *previous* completed week. For Monday-start users it appears Sunday ≥18:00 local or Mon/Tue/Wed of the following week. For Sunday-start users: Saturday ≥18:00 or Sun/Mon/Tue.
- Hidden when the user already dismissed the same `weekKey` (matches `YYYY-Www`).
- Hidden when the previous week had zero days logged — the card would only say "0 days" which is noise.

### Share
- Web: tries `navigator.share` (mobile web PWA), falls back to clipboard `writeText`. Plain-text summary `formatRecapForShare`.
- Mobile: React Native `Share.share({ message })`.

### Copy rules
- Supportive + factual. "5 days logged this week" — never "You missed 2 days".
- Weight delta rounded to 0.1 kg. Never shown as `+0.0 kg` — when <2 weigh-ins, the cell reads "No weigh-ins this week" and the hint row flips to "log weight any day".
- Every stat has a factual hint ("per day", "% of target") so the numbers aren't naked.

### Adaptive maintenance line
Shipped 2026-04-19. Single line below the stat row, above the share button: "Your maintenance landed at 2,150 kcal this week (formula said 2,050)." Driven by `formatMaintenanceRecapLine(resolved)` in `src/lib/nutrition/resolveMaintenance.ts`. Render conditions (identical on web + mobile):
- `resolved.source === "adaptive"` (adaptive branch won — confidence ≥ medium and not stale).
- `resolved.formulaKcal != null` and `resolved.kcal !== resolved.formulaKcal`.
- `resolved.confidence !== "low"` (belt-and-braces — the resolver already enforces this).

Suppressed for formula fallback, low-confidence, stale-rejected adaptive, and identical values. The full chain explainer lives on Progress > Maintenance — the recap surfaces only the headline, no expandable. Pinned by `tests/unit/maintenanceRecapLine.test.ts`.

### Usual-meal growth-loop line
The recap surfaces a single growth-loop insight between the closest-to-target line and the maintenance line:
- **Celebration** ("You logged X 3 times this week") — when the user has saved meals AND ≥1 was logged in the recap window. Picks the most-logged.
- **Prompt — original gate** ("Got a usual breakfast? Save it once, log it in one tap.") — when the user has zero saved meals AND logged ≥5 distinct days. Suggests the slot with the largest item-count.
- **Prompt — loosened gate, added 2026-04-19** ("Got a usual lunch? You've logged the same one 4 times in 2 weeks.") — when the user has saved meals BUT the most-repeated unsaved slot has ≥3 distinct-day repeats of the same `(title, kcal)` pattern over the 14-day window.
- Suppressed when all four canonical slots already have a saved meal, or when the dominant unsaved-slot pattern is repeated <3 times in 14 days.

Floor is `USUAL_MEAL_REPEAT_FLOOR = 3` (exported from `src/lib/nutrition/weeklyRecap.ts`). Pinned by `tests/unit/usualMealInsightLoosenedGate.test.ts` and the existing `tests/unit/usualMealHint.test.ts`.

## Weekly Recap Push (server-cron, timezone-aware)

### Schedule
- Server cron runs hourly (`vercel.json`: `0 * * * *` → `app/api/push/weekly-recap/route.ts`). Each invocation filters eligible users via [`shouldPushWeeklyRecapNow`](../../src/lib/push/weeklyRecapTzFilter.ts): fires only for users whose current local time is 18:00 on their end-of-week day (Sunday for Monday-start, Saturday for Sunday-start). Daylight-saving transitions handled automatically because the filter uses the stored IANA zone name via `Intl.DateTimeFormat`.
- User's IANA zone lives in `profiles.tz_iana`. Web + mobile clients write `Intl.DateTimeFormat().resolvedOptions().timeZone` through [`src/lib/profile/tzSync.ts`](../../src/lib/profile/tzSync.ts) on session restore + auth-state-change (+ mobile foreground). Fire-and-forget; never blocks auth.
- Pre-migration users (null `tz_iana`) fall back to 18:00 UTC until their client writes a real value — this preserves the behaviour from before the timezone-aware rewrite shipped 2026-04-20.
- **Mobile-local `expo-notifications` scheduling was removed 2026-04-20.** Installs without a synced Expo push token now receive no weekly push — the remaining gap is token-registration coverage for those installs, still open.
- `cancelWeeklyRecapPush()` runs once on mobile boot (`apps/mobile/app/_layout.tsx` → `HandleWeeklyRecapPushOpen`) so pre-removal installs evict any stale `weekly-recap-v1` schedule from their OS queue. Idempotent.
- Dedupe: the route already had a 6-day `last_weekly_recap_push_sent_at` window; with the hourly cron that window is the backstop that prevents double-fires on the 24 cron invocations per day.

### Opt-out
- Profile flag `weekly_recap_push_enabled` (default `true`). First-class Settings toggle on both platforms, added 2026-04-18:
  - **Web** — `Settings.tsx` Notifications section, shadcn `<Switch>` row ("Weekly recap", sub: "Sunday 18:00 (respects your week start)." or "Saturday 18:00 …" depending on `week_start_day`). Writes the column via `savePref`; fires `weekly_recap_push_enabled_toggled { enabled }`.
  - **Mobile** — `app/(tabs)/more.tsx` Connections section, `SettingsRow` with an RN `Switch` (`accessibilityRole="switch"`). Toggle is DB-only now (server cron reads `profiles.weekly_recap_push_enabled` to decide fan-out); OFF also calls `cancelWeeklyRecapPush()` for immediate OS-queue cleanup. Fires `weekly_recap_push_enabled_toggled { enabled }`.
- DB write error (RLS reject, offline, etc.) reverts the toggle and surfaces a toast (web) / Alert (mobile); no analytics fires on error.

### Content
- Title: "Your week in Suppr"
- Body — content-specific copy, shipped 2026-04-19. Composed by `formatWeeklyRecapPushBody(recap, suggestion)` in `src/lib/nutrition/weeklyRecapPushBody.ts`. See "Push body formatter" below for variant rules. This is the sole body path since the mobile-local generic fallback was killed 2026-04-20.
- Deep-link data: `{ deepLink: "/progress", kind: "weekly_recap", weekKey, bodyVariant }`. `weekKey` attributes opens to the recap window; `bodyVariant` lets `weekly_recap_push_opened` join against the body variant the user actually saw.

### Suggestion cascade
Added 2026-04-19. The Weekly Digest's "what should this user do this week" line is produced by a single shared cascade module: `src/lib/nutrition/weeklyDigestSuggestion.ts`, mobile re-export at `apps/mobile/lib/weeklyDigestSuggestion.ts`. Both platforms call `selectDigestSuggestion(input)` — same code path, same first-match-wins order, same copy. Module is pure (no React, no I/O); the caller assembles inputs from the existing helpers (`buildWeeklyRecap`, `resolveMaintenance`, `readFreezeLedger`, `buildUsualMealRecapInsight`).

The cascade is **strict first-match-wins** in this order:

| # | Rule | Gate | CTA | Tier |
|---|---|---|---|---|
| 1 | `re_log_prompt` | `usualMealInsight.kind === "prompt"` AND `saveSeedItemCount >= 2` | `Save {Slot} as a meal` → `/save-meal?slot={Slot}` | free |
| 2 | `maintenance_recalibration` | `resolved.source === "adaptive"` AND `confidence === "high"` AND `|adaptive − staticTdee| >= 100` AND no manual override in past 14d AND no accepted recalibration in past 21d | `Adjust calorie goal` → `/digest/recalibrate-maintenance` | free |
| 3 | `protein_nudge` | `proteinOnTarget < daysLogged * 0.5` AND `daysLogged >= 4` | `Browse high-protein recipes` → `/recipes?filter=high-protein` | base |
| 4 | `streak_protection` | `freezesAvailable === 0` AND `streakLength >= 7` AND no freeze earned in past 14d | _none — informational_ | n/a |
| 5 | `weight_trend_mismatch` | `goal === "cut"` AND `weightDeltaKg > 0` AND `daysLogged >= 5` AND `avgCalories <= targets.calories` | `Open Maintenance` → `/progress?metric=maintenance` | free |

When no rule fires (`null` return), the Digest UI renders the empty-state copy "Nothing to change this week. Your numbers held." — empty-state copy lives in the UI, not in the cascade module.

Hard rules pinned by `tests/unit/weeklyDigestSuggestion.test.ts`:
- No exclamation marks anywhere.
- No "great job" / "amazing" / performance adjectives.
- Headlines ≤120 chars (push body has ~178-char budget; cascade headline gets the first half, recap data the second).
- Bodies ≤200 chars.
- When a gate's required input is missing/null, the rule cannot fire — we never invent data to make a suggestion fit.

Per-rule cooldowns:
- Rule 2 manual-override: 14 days from `targetCaloriesSetAt` when `targetCaloriesSource === "user"`.
- Rule 2 accepted-recalibration: 21 days from `targetCaloriesSetAt` when `targetCaloriesSource === "digest_recalibration"`. The `applyMaintenanceRecalibration.ts` helper (separate task) writes that source value when a user accepts.
- Rule 4 recent-earn: 14 days from the most recent `ledger.earnedAt[*].earnedAt`.

The two new profile columns (`target_calories_source`, `target_calories_set_at`) come from the `data-integrity` migration shipping in parallel — the cascade module does not touch the schema. Older profiles with both columns null are treated as "no override on file" so Rule 2 can fire.

**Status:** module, types, and 47 tests are in place. It's wired into the server-side push route (see "Push body formatter" below) but not yet into the Digest UI on Progress.

#### Server-route wiring caveat
The server cron route assembles the cascade input from per-user data fetched in the route handler. One signal — `usualMealInsight` (Rule 1's input) — is **not** computed in the server path because it requires fetching the user's `saved_meals` rows + a 14-day extended window. The route passes `null` for `usualMealInsight` and `0` for `saveSeedItemCount`, which **structurally suppresses Rule 1** in the server-fanout path. Rules 2–5 fire normally. Worst case: a user who would have hit Rule 1 lands on Rule 2/3/4/5 instead, or on the unsuggested recap variant. Acceptable for now; promoting Rule 1 needs a `saved_meals` fetch in the route (cut from the 2026-05-03 delivery for scope). The Digest UI on Progress (when it ships) computes the full cascade from in-page state, so Rule 1 fires there.

### Push body formatter
Shipped 2026-04-19. Pure helper at `src/lib/nutrition/weeklyRecapPushBody.ts`. Imports the existing `WeeklyRecap` type and (optionally) `DigestSuggestion`. Returns `{ body, variant }` so analytics attribution is one lookup, not a regex parse.
- Four honest-claims variants:
  - **`zero_days`** (`daysLogged === 0`) — "Nothing logged this week. Open Suppr to get back on track." Only acceptable generic fallback. Suggestions are NEVER prepended onto this branch.
  - **`calories_only`** (`daysLogged > 0` AND `weightDeltaKg === null` AND no suggestion) — "{n} days logged, avg {kcal} kcal — see what changed." Weight is omitted entirely; we never invent a "no change" reading from missing data.
  - **`with_weight`** (`daysLogged > 0` AND `weightDeltaKg !== null` AND no suggestion) — "{n} days logged, {±X.X} kg this week — see what changed." Sign is always explicit. A `0.0` reading is treated as real data (the caller has already gated on ≥2 weigh-ins) and lands in this variant rather than falling through to calories-only.
  - **`with_suggestion`** (`daysLogged > 0` AND `selectDigestSuggestion(...) !== null`) — `"{cascade headline} · {recap sentence}"`. The recap sentence is whichever of `calories_only` / `with_weight` would have fired without a suggestion. Headline comes from the cascade module; suggestions are NEVER prepended onto the zero-days fallback.
- Body composition rules:
  - Default = `{headline} + " · " + {recap sentence}`.
  - When the composed body exceeds the APNs 178-char ceiling, the formatter truncates the recap (NOT the headline — the headline is the actionable hook the user opens for):
    1. Try `{headline} · {n} days logged, ±X.X kg this week.` (drop the "see what changed" + calories segment, keep the weight delta).
    2. Try `{headline} · {n} days logged.` (collapse the recap to a bare days-line).
    3. Pathological: headline alone exceeds 178 chars (cannot happen given the cascade's 120-char ceiling). Return the headline as-is and let APNs hard-truncate.
- Hard rules pinned by `tests/unit/weeklyRecapPushBody.test.ts`: no exclamation marks, no performance adjectives, body ≤178 chars (APNs lock-screen visible threshold).
- **Status:** wired into `app/api/push/weekly-recap/route.ts` (sole delivery path; mobile-local was killed 2026-04-20).

### Analytics
- `weekly_recap_push_sent { weekKey, bodyVariant, suggestionRule }` — fires once per successful Expo send from `app/api/push/weekly-recap/route.ts` via `serverTrack` (direct POST to PostHog `/capture/`). `weekKey` is the previous completed week (matches `weekly_recap_push_opened`). This is the sole emit path since the mobile-local scheduler (with its `currentWeekKey` off-by-one bug) was removed 2026-04-20.
- `weekly_recap_push_enabled_toggled { enabled }` — fires once per committed flip of the Settings toggle on web or mobile. Added 2026-04-18 so product can measure opt-out rate directly instead of inferring it from `_push_sent` drop-off.
- `weekly_recap_push_opened { weekKey: string | null }` — fires when the user taps the weekly-recap push and the OS routes the response into the app. Mobile-only — registered in `apps/mobile/app/_layout.tsx` via `Notifications.addNotificationResponseReceivedListener`, gated on `data.kind === "weekly_recap"`. `weekKey` is null when the push payload predates the field (older local schedule). Added 2026-04-19.
- `weekly_recap_shown { weekKey }` — fires once per week when the card renders.
- `weekly_recap_dismissed { weekKey }` — dismiss / "Got it" / close.
- `weekly_recap_shared { weekKey, platform }` — share button tap.
- `streak_freeze_used { dateKey, freezesRemaining }` — each time a freeze is consumed.
- `streak_freeze_earned { newStreak }` — each milestone crossing.

### Web push
Deferred. Suppr does not currently run a service-worker-backed push registration flow, so the weekly push is mobile-primary. Web users see the recap card directly when they open Progress in the recap window.

## Progress Dashboard tiles & charts

**Two branches since 2026-07-16, when the dashboard body was rebuilt into a prioritised hierarchy.** It is gated by `progress_hierarchy_v1` (default **OFF**, registered in `KNOWN_DEFAULT_OFF_FLAGS` on both platforms; read once on mount so the layout never flips mid-session):

- **Flag OFF (default, what every user sees today)** — the legacy 13-card
  stack documented in "Legacy branch" below, byte-identical to the page
  before the rebuild. This is the kill switch.
- **Flag ON** — the 5-section prioritised hierarchy documented in
  "Hierarchy v1 branch" below.

See the ramp runbook for flag status and rollout plan:
[posthog-rollout](../operations/posthog-rollout.md).

Shared by both branches: the period control (D/W/M/6M/Y), the "This Week"
narrative insight card (`ProgressHeadline` + its `<3`-logged-day
`ProgressStoryGate` empty state — see "Shared narrative chrome" immediately
below), StreakFreezeCard (web only in practice — see the open question in
"Streak freeze" above), the Activity section, LogWeightSheet,
milestone/win-moment overlays, and `?metric=` deep links.

### Shared narrative chrome — the "This Week" insight card (`ProgressHeadline`)

Renders above the `progress_hierarchy_v1` gate — on **both** the legacy
stack and the hierarchy layout, on both platforms. It is not one of either
branch's numbered cards; it is chrome sitting between the period control and
whichever branch renders below it (web `ProgressDashboard.tsx` ~1234–1281,
mobile `(tabs)/progress.tsx` ~1286–1324).

First shipped 2026-04-27 (internally nicknamed "Surface E") and has since
survived three full page rebuilds unchanged in mechanism — only its
position and visual weight on the page have changed each time. See
"Design history" at the bottom of this doc for that lineage; this section
describes what it does **today**.

**What it renders:** a one-line engine narrative reading the user's
adaptive-TDEE trend — not a static stat card. `generateProgressCommentary`
(shared lib `src/lib/nutrition/progressCommentary.ts`, mobile re-export
`apps/mobile/lib/progressCommentary.ts`) selects one of three regimes:

| Regime | Trigger | Example headline |
|---|---|---|
| `adjustment` | `abs(currentTdee − prevWeekTdee) > 30 kcal` | "Your maintenance adjusted up by 60 kcal" |
| `calibrating` | `current == null` OR `confidence === 'low'` OR `loggingDays < 14` | "We're still calibrating your maintenance" |
| `steady` | confidence ≥ medium AND delta ≤ 30 kcal | "Maintenance held steady this week" |

Rendered by `ProgressHeadline` (web
`src/app/components/suppr/progress-headline.tsx`, mobile
`apps/mobile/components/today/ProgressHeadline.tsx`) with a confidence chip
inline — confidence is always shown as metadata on the number, never a gate
that hides it.

**Empty-state gate:** below 3 logged days (`hasEnoughDataForStory`, shared
`progressStoryGate.ts`, mobile import path `@/lib/progressStoryGate`), the
card swaps to `ProgressStoryGate` — a same-shaped placeholder ("2 more days
to your first insight" + a 0/3–3/3 ring) so the slot doesn't visually jump
once real data arrives. Added 2026-04-30 after week-1 users saw
calibrating-copy that referenced data which didn't exist yet (see "Design
history").

**Known limitation:** the `adjustment` regime's inputs
(`prevWeekTdee`, `avgIntakeOnLossWeeksKcal`) need a weekly-aggregate stream
that isn't persisted yet — both hosts pass `null`/`undefined` today (see the
inline comment at `ProgressDashboard.tsx:1240-1242`), so in production this
card only ever shows `steady` or `calibrating`, never `adjustment`. It is
never faked to look like a real adjustment in the meantime.

**Voice rules (pinned by tests):** UK English, second person ("your" / "you"
/ "we" — never "the user"), no exclamation marks, numerals rendered
tabular-nums. Pinned by `tests/unit/progressCommentaryPhase4.test.ts`,
`tests/unit/progressHeadlinePhase4.test.tsx` (web), and
`apps/mobile/tests/unit/progressHeadlinePhase4.test.tsx` (mobile).

**Open question — overlap with the hierarchy's This Week section:** on the
hierarchy branch this narrative card sits directly above the hierarchy's own
"This Week" section (a *different*, numeric adherence read — see below).
Whether that back-to-back "This Week, narrated" then "This Week, in numbers"
layering is a deliberate pairing or simply a carry-over from before the
hierarchy existed is unresolved.

### Hierarchy v1 branch (`progress_hierarchy_v1` ON)

Composer `ProgressHierarchyV1` (web
`src/app/components/suppr/progress-hierarchy/`, mobile
`apps/mobile/components/progress/hierarchy/`) renders five sections in
order, each headed by the shared overline primitive. The host computes all
data; sections are render-only.

1. **Trajectory (hero)** — the ONLY tinted card on the page (hero-tint
   token gradient + hairline, flat, radius 24 — a deliberate exception to
   the flat-card rule used elsewhere on the page). Serif kg numeral
   (ph-masked), smoothed weekly rate
   (`signedObservedKgPerWeek`, never the raw two-point delta), the canonical
   weight chart with goal line, and the `computeTrajectory` projection —
   distance leads bold ("3.4 kg to go"), date hedged ("at this pace
   ~Sep 12"), footnote "An estimate, not a promise." **Goal-conditional:**
   weight-surface mode `show` → full hero; `trends_only` → trend-direction
   copy only, no absolute kg (legal-signed strings); opt-out / no data
   intent → no Trajectory section at all and This Week promotes to the top
   slot as a plain card. Sparse (<2 weigh-ins) → the WeightSparseState
   grammar renders inside the hero slot and its "Log your first weigh-in"
   button is the screen's one filled CTA; <14 days of weigh-ins or a flat
   slope drops the date + verdict ("Trend still settling — keep logging.").
   Absorbs the Journey card and the standalone TrajectoryCard.
2. **This Week** — always the current week regardless of the period
   control. Headline reconciles adherence average AND on-target count
   ("82% avg · 5 of 7 days on target" — two different numbers, never
   conflated), adherence numeral at the ~29px serif step (demoted from
   40px). Mon–Sun calorie bars (today boxed, per-day target reference,
   sage under / amber over / muted empty — never red; today emphasis
   suppressed for past weeks), macro label·value·bar rows, and a streak
   microrow whose affordance presses through to the streak drill-down so
   freezes stay reachable. Absorbs the Daily Calories card, Average
   Adherence card, and on-target ribbon.
3. **Energy** — the deficit/surplus is the ONE leading number (~33px
   serif; sage when it matches the user's goal direction, amber when it
   opposes it), with the equation in words as the support line —
   **maintenance − intake**, correct arithmetic. Confidence is a bare sage
   overline ("Adaptive · high confidence"), the "How maintenance works ›"
   explainer link stays, thin data degrades to "building estimate · low
   confidence" + the weigh-ins/logging-days progress bars
   (`computeAdaptiveDataProgressFromMeals`), and a subordinate expenditure
   sparkline renders quietly under the equation (no second TDEE numeral).
   Absorbs the Maintenance card, Energy triad, and standalone
   ExpenditureTrendCard.
4. **Body composition** — overline "Body composition · Pro" (Pro suffix
   for free users only). User-owned latest values (body fat %, lean mass
   from HealthKit/manual) **always render free when present**; the
   Pro-gated layer is the trend — free users with data see their values
   plus a masked mini-trend behind a lock + ghost "See Pro plans"; Pro
   users see the real BodyCompositionTrendCard content; free users with no
   data see the teaser only.
5. **Your Week** — serif verdict sentence (`resolveDigestHeadline`), one
   texture line (usual-meal insight, else best day), ghost Share (same
   analytics events + `formatRecapForShare` text as Digest). No restated
   avg/streak numerals — they live in §2. DigestStoryCard does not render
   on this branch.

#### Known limitation — mobile cannot yet honour the body-composition free-data rule

The hierarchy spec promises that a user's own body-fat % and lean-mass
values always render for free — only the trend line is Pro-gated. **Web
keeps that promise:** `ProgressDashboard.tsx:1397-1402` wires the real
`bodyFatPct` (plus a derived lean-mass value) into the section. **Mobile
cannot yet:** `apps/mobile/app/(tabs)/progress.tsx:1373-1377` hardcodes
`latestBodyFatPct: null, latestLeanMassKg: null` (mobile does track
`bodyFatPct` elsewhere in the file for other purposes — it just isn't wired
into this prop), because mobile has no host-level plumbing yet that surfaces
the user's own HealthKit or smart-scale body-fat reading to this section.
In practice, a free mobile user with a real smart-scale body-fat reading
sees only the Pro teaser once this branch ramps — the exact "locking a
user's own measurement behind a paywall" outcome the rule exists to
prevent, but only on mobile. The gap is already baked into the shipped
hierarchy code; it stays invisible only because the flag hasn't ramped yet.
Whether closing it is a ramp blocker or an acceptable post-ramp follow-up is
an open product question.

Direction-aware tone across §1 and §3 comes from one shared helper,
`trendDirectionTone` in `src/lib/weightProjection.ts` (sage toward goal /
amber away / neutral plum with no goal or at goal — never red), so the two
sections can never disagree. Every CTA on this branch is ghost except the
sparse-state "Log your first weigh-in".

**Not rendered on this branch:** Journey card, Maintenance card, Energy
triad, Daily Calories card, Average Adherence card, on-target ribbon,
demoted stat chips, DigestStoryCard, standalone TrajectoryCard /
ExpenditureTrendCard / BodyCompositionTrendCard.

### Legacy branch (flag OFF — the default)

The 13-card stack below. Every per-card note in the rest of this section
describes the legacy branch (many of these behaviours — the shared helpers,
copy rules, and honesty gates — are reused by the hierarchy sections, as
noted above).

### "Avg Calories" stat tile
- Headline number = `weekStats.avgCalories` (`sum / daysWithFood`).
- Sub-label is the shared helper `formatAvgCaloriesLabel(daysWithFood)`:
  - **Full week (7/7 days logged)** — "Avg Calories".
  - **Partial week** — "Avg on logged days (X/7)" so the user can't read the headline as "average per day this week".
- Identical copy on web (`ProgressDashboard.tsx`) and mobile (`app/(tabs)/progress.tsx`) — the helper is the single source of truth. Pinned by `tests/unit/avgCaloriesLabel.test.ts`.

### Daily Calories chart — today bar dim
- The bar whose `key === todayKey()` renders at `opacity 0.4`. Every other day renders at `opacity 0.75`. Future days within the rendered week (e.g. Sunday for a Wednesday user on a Monday-start week) are NOT dimmed.
- Web mirrors mobile's existing `isDayToday = d.key === todayKey` rule rather than the prior `i === 6` index check, which incorrectly dimmed Sunday for any mid-week visit. Pinned by `tests/unit/progressTodayBarDim.test.ts`.

### Weekly Insight card — removed
- The blue "Weekly insight" card that sat below the macro adherence bars on both platforms has been removed. It restated numbers already on screen above (avg calories vs target; protein-on-target days; streak) and read as filler.
- A replacement is being scoped as a card-grammar-conformant component; it will be reintroduced when that spec lands.
- No new surface to test post-removal; existing tests continue to cover the underlying numbers via `progressWeekReport`.

### Trend tile
- Headline = signed delta between the most recent weigh-in and a comparison entry ≥7 days old (or the oldest entry when none sits that far back).
- Sub-copy is driven by the shared `computeWeightTrendCopy` helper:
  - `Log weight to see trend` — fewer than 2 weigh-ins.
  - `on track` — heading toward the goal (lose/down OR gain/up; maintenance within ±0.5 kg).
  - `this week` — has data but moving away from the goal direction.
  - `no goal set` — has data but `goalKg` or `weightKg` is missing.
- Web + mobile both call the same helper; the prior two-IIFE web pattern (one for delta, one for copy) is gone, so the readouts can't drift. Pinned by `tests/unit/weightTrendTile.test.ts`.

### Macro Adherence bars
- Bar fill capped at 150% on both platforms via the shared `formatMacroAdherenceBar` helper. A user at 200% protein renders as a 150%-wide bar with the literal figure preserved in the label as `200% (capped at 150)` — never silently clipped.
- Pinned by `tests/unit/macroAdherenceBar.test.ts`.

### Daily Calories chart denominator
- Bar height denominator = `Math.max(targets.calories, ...weekStats.days.map(d => d.calories))`. Prior web code hard-capped at `targets.calories * 1.15`, which clipped any 200%-of-target day to the same height as a 115% day. Mobile already used the new rule; web now mirrors it.
- Pinned by `tests/unit/dailyCaloriesBarDenominator.test.ts`.

### Daily Calories chart snapshot cue
- A past day's bar renders with a small dashed border (web `border: 1px dashed`; mobile `borderStyle: dashed`) when its target is the current-target fallback (`d.isSnapshot === false`). The colour is unchanged so "green = on target" still reads correctly. Today and future days don't have historical-target ambiguity so the cue is skipped for them.
- Pinned by `tests/unit/dailyCaloriesSnapshotCue.test.ts` (helper-side flag).

### Metric drill-down (calories / protein / streak) — colour bug on mobile

Tapping a stat tile — or, on mobile, a day bar — opens a per-metric drill-down: calories = daily intake bars + a day list, protein = avg/on-target + per-day adherence bars, streak = contributing-days list. Web renders this inline (`ProgressMetricDetail.tsx`, opened via `openMetric()` in `ProgressDashboard.tsx`); mobile pushes a separate route (`apps/mobile/app/progress-metric.tsx?metric=calories|protein|streak`). This surface is not flag-gated — both the hierarchy and legacy branches route to the same drill-down.

This is a live bug, not a design choice. Mobile's calories drill-down renders over-budget day bars in destructive red (`apps/mobile/app/progress-metric.tsx:340`: `backgroundColor: ... over ? t.red : t.green`). The inline code comment at lines 334-339 still cites the "over = destructive red" rule from 2026-05-12, which was retired product-wide on 2026-07-01 in favour of amber (see the calorie-ring colour mapping in `.claude/agents/_project-context.md`). Web's equivalent (`src/app/components/ProgressMetricDetail.tsx:206`) already renders over-budget bars in `var(--warning)` amber, correctly. Mobile is also inconsistent with itself: the main Progress daily-calories card already uses amber correctly (`progress.tsx:1701`, `t.amber`) — only the drill-down route missed the fix. Net effect: every mobile user who opens the calories drill-down after an over-budget day sees the exact red-numbers-guilt-cycle signal the 2026-07-01 decision retired. The fix is small — swap `t.red` for the amber warning token and delete the stale comment.

### Trend / Weight unit drift
- All weight readouts on the mobile Progress screen go through the new `formatWeightForUnit` helper in `src/lib/measurements.ts`, respecting `profile.measurement_system`. Imperial users see `lb`; metric users see `kg`. Previously the Trend tile and Weight card were hard-coded to `kg` while every other weight surface respected the preference.
- Pinned by `tests/unit/measurementsFormat.test.ts`.

### Daily projection floor
- The "averaging X kcal/day puts you on track for Y kg in N weeks" line on the Journey card renders only when the user has ≥`MIN_DAYS_FOR_PROJECTION` (= 5) days with food logged in the recent window. Below the floor we suppress the line entirely — projecting from 2 days is dishonest.
- Single source: `shouldRenderDailyProjection(daysWithFood)` in `src/lib/weightProjection.ts`. Pinned by `tests/unit/weightProjectionFloor.test.ts`.

### Days-to-goal cap
- `calcGoalTimeline` now exposes `cappedAtMaxDays: boolean`. When a positive rate would land past `MAX_DAYS_TO_GOAL` (= 365), `daysToGoal` stays `null` and `cappedAtMaxDays` flips to `true`. The Journey card then renders `More than 1 year at current rate` (with the rate continuing in the descriptive line below) instead of an empty headline.
- A stalled or wrong-direction trend keeps `cappedAtMaxDays === false` so the renderer doesn't promise "more than a year" when the math doesn't even land at the goal.
- Pinned by `tests/unit/calcGoalTimelineCap.test.ts`.

### Maintenance source pill
- The Maintenance card now always renders an explicit source pill in the header:
  - **Adaptive** (success-tinted) when `resolved.source === "adaptive"`.
  - **Formula estimate** (muted) when the resolver fell back to the formula — including the low-confidence and stale-adaptive paths.
- The confidence bar block remains gated on `showAdaptiveExtras` (= source is adaptive), so a formula-fallback user no longer sees a confidence bar coupled to a number that didn't come from the adaptive branch.
- Pinned by `tests/unit/maintenanceSourcePill.test.ts`.

### Maintenance recalibration provenance (migration `20260427110000`)
Added 2026-04-19. The Maintenance Recalibrate suggestion (Progress Digest, Rule 2) needs to know **whether the user just hand-set their calorie target**. Re-suggesting a number the user picked themselves last week is presumptuous and erodes trust. To enable that without lying about provenance for older rows, `profiles` has two new columns:

- `target_calories_set_at timestamptz` — when the current value was last written.
- `target_calories_source text` — which write path produced it. Constrained to a 5-value enum:

| Value | Meaning |
|---|---|
| `onboarding` | Set during initial onboarding flow (skip path or `saveAndFinish`). |
| `user` | User manually edited macro/calorie targets in Profile/Settings. |
| `recompute` | Activity-level change re-ran the BMR/TDEE pipeline. |
| `digest_recalibration` | "Apply maintenance recalibration" CTA in the Digest. (Future — built when `applyMaintenanceRecalibration.ts` lands.) |
| `reset_default` | Post-destructive-reset write ("Reset plan", "Erase all my data") that reverts to `NUTRITION_DEFAULTS.calories`. Distinct from the others so Rule 2 can tell a fresh-default-with-no-real-target apart from a user-chosen number. |

**Rule 2 suppression contract:**
- `target_calories_source = 'user'` AND `target_calories_set_at` within the last 14 days → suppress the Maintenance Recalibrate suggestion.
- All other source values (`onboarding`, `recompute`, `digest_recalibration`, `reset_default`) do NOT suppress.

**Backfill honesty:** existing rows with a non-null `target_calories` are tagged `'onboarding'` with `set_at = COALESCE(created_at, NOW())` (the only honest historical attribution). Rows with `target_calories IS NULL` are left alone — no fabricated provenance for never-onboarded profiles.

**Step 2 (deferred):** both columns become `NOT NULL` in a follow-up migration after >=1 week of clean writes (earliest 2026-05-04). Verification SQL is pinned in the migration header.

**Write sites covered (9 total):** 2 mobile onboarding (`onboarding.tsx` skip + `saveAndFinish`), 1 web onboarding (`app/onboarding/page.tsx`), 1 mobile manual save (`profile.tsx`), 1 web manual save (`Profile.tsx`), 1 mobile activity recompute (`(tabs)/settings.tsx`), 1 web activity recompute (`Settings.tsx`), 2 reset paths (`(tabs)/more.tsx` + `nukeAccountData.ts`). Pinned by `tests/unit/profileTargetCaloriesProvenance.test.ts`.

### Maintenance chain weekly-loss caveat
- The "Projected weekly loss / gain" row in the Maintenance "How this works" chain now appends a long-term-fat caveat: `~0.50 kg* (*long-term fat loss; week-to-week varies with water/glycogen)`. 7700 kcal/kg is correct for fat mass, but week-1 scale weight is dominated by water + glycogen swings — the caveat keeps the projection honest.
- Pinned by `tests/unit/maintenanceChain.test.ts`.

### Steps card HealthKit sync state (mobile)
- The Steps card distinguishes three HK sync states:
  - **pending** — initial mount / fresh focus → renders an `ActivityIndicator` skeleton, never a literal `0`.
  - **failed** — HK call rejected (permissions, native bridge) → renders `Steps sync paused — open Health permissions` with a tap-to-retry button. No `0 / N` headline.
  - **success** — HK call resolved → renders the real count (`0` is legitimate).
- Previous version swallowed errors with `.catch(() => {})` and rendered `(stepsByDay[todayKey] ?? 0)`, making a permissions failure visually identical to "you haven't walked yet".
- Web doesn't read HealthKit (no equivalent surface), so this fix is mobile-only by construction.

## Weekly Recap Card — additional refinements

### Closest to target
- **Was** "Best day" — selected the day with the highest protein.
- **Now** "Closest to target" — selected by the smallest summed normalised L1 deviation (`|actual - target| / target` per macro). Ties broken by the most-recent date.
- **Eligibility floor** — a day must log ≥80% of macros that have a target (rounded up). A protein-only day no longer crowns the week just because the other macros are zero.
- **Suppressed** when no eligible day exists or no macro target is set.
- Field name in code stays `recap.bestDay` for back-compat with the share-string + analytics; user-facing label is "Closest to target" everywhere.
- Pinned by `tests/unit/closestToTargetDay.test.ts` and the existing `tests/unit/weeklyRecap.test.ts`.

### Weight delta relabel
- The recap card's Weight stat tile sub-hint changed from `change this week` to `first → last weigh-in`. A new explanatory line below the stat grid surfaces the explicit `First → Last weigh-in: 78.4 → 77.8 kg (-0.6 kg)` so the user can see exactly what they're reading rather than implying a smoothed average.
- The recap shape now exposes `weightFirstKg` and `weightLastKg` (both null when fewer than 2 weigh-ins, mirroring `weightDeltaKg`).
- Pinned by `tests/unit/weeklyRecap.test.ts`.

## Edge Cases
- **Zero logs all week** — recap card is suppressed; no push is sent. The Progress dashboard falls back to its existing "Your progress will appear here" empty state.
- **Only 1 weigh-in in the window** — weight row shows "No weigh-ins this week" (still honest).
- **User changes `week_start_day` mid-week** — next recap rebuilds using the new preference; the push is rescheduled on the next Progress visit (ledgerKey changes).
- **Two devices open at once** — the dismiss update writes `weekly_recap_last_seen_week_key`; both devices converge on the next `loadData` call.
- **Freezes exhausted mid-walk** — the protected streak simply stops at the first unprotected zero day. The raw streak is unchanged.

## Related documents
- [How your calorie target works](../user/how-your-calorie-target-works.md) — the BMR/TDEE/adaptive math this loop reviews and re-tunes; this doc does not re-derive that math.
- [Food Tracking journey](./food-tracking.md) — the daily logging loop that feeds every number on this page.
- [Progress hierarchy v1 decision](../decisions/2026-07-16-progress-hierarchy-v1.md) — the hierarchy rebuild's ratified design deltas and its default-off ramp plan.
- [PostHog rollout runbook — `progress_hierarchy_v1`](../operations/posthog-rollout.md) — flag status, ramp schedule, pre-ramp screenshot requirement.
- [2026-07-01 sweep decisions](../decisions/2026-07-01-sweep-decisions.md) — the decision that retired destructive red for over-budget values; the mobile drill-down bug documented above still violates it.
- [Weekly recap timezone-aware fanout](../decisions/2026-04-20-weekly-recap-tz-aware-fanout.md) — the architecture behind the server-cron push schedule.

## Change log
- **2026-07-18 — merged `progress-2026-04-27.md` into this doc.** That file was the original "Surface E" story-hero journey doc, predating both the Sloe redesign and the hierarchy rebuild. It is now superseded and redirects here. Its still-current mechanics — the `ProgressHeadline` three-regime commentary card, the `ProgressStoryGate` empty-state gate, the voice rules — are documented under "Shared narrative chrome" above. Its superseded framing (the commentary card as sole page hero, demoting the maintenance/weight/calorie cards below it) and the reasoning behind the original weekly-story direction moved to "Design history" at the bottom of this file.
- **2026-07-18 — documentation update.** Clarified that `progress_hierarchy_v1` is default-off and its ramp has not started (the PostHog flag row has not been created; the "Internal (Grace) → 100%" ramp phase has not run) — no user, including Grace, sees the hierarchy branch today. Documented the StreakFreezeCard web/mobile disagreement as an open product question (the hierarchy spec says the card renders cross-platform; the Sloe redesign demotes it out of the Progress frame on mobile) rather than resolving it either way. Documented a live bug: the mobile calories metric drill-down (`apps/mobile/app/progress-metric.tsx:340`) still renders over-budget days in red, using a colour rule that was retired product-wide; web's equivalent and mobile's own main card already use amber. Documented that mobile Body Composition cannot yet honour the "user-owned values are always free" rule because `latestBodyFatPct`/`latestLeanMassKg` are hardcoded null on mobile pending host-level plumbing, while web wires the real values. Added a Scope section with explicit loop-boundary links (calorie-target math, food logging, fasting) so the doc's edges are clear.
- **2026-07-16 — Progress dashboard hierarchy rebuild.** The dashboard body split into two branches behind `progress_hierarchy_v1` (default off): the legacy 13-card stack (kill switch, byte-intact) versus the 5-section prioritised hierarchy (Trajectory hero, This Week, Energy, Body composition, Your Week). Introduced the goal-conditional tinted hero card, corrected the maintenance − intake equation, added the direction-aware `trendDirectionTone` helper, and made user-owned body-composition values always render free. Over-target colour corrected from red to amber on both branches.
- **2026-04-19 — Progress dashboard correctness fixes.** Trend tile uses one shared `computeWeightTrendCopy` helper so the on-track copy and delta can't drift; fixes the `(weightKg ?? Infinity)` "always on track for gain users" bug. Macro Adherence bars cap at 150% with truthful labels via the shared `formatMacroAdherenceBar` helper. Web Daily Calories bar denominator now scales to the largest day. Mobile Trend tile and Weight card route through `formatWeightForUnit` so imperial users see `lb` everywhere. Daily projection block requires ≥5 logged days; below the floor it's suppressed entirely. Weekly recap "Best day" renamed to "Closest to target," selected using normalised L1 deviation. Steps card distinguishes HealthKit pending / failed / success states with a retry CTA (mobile). Daily Calories chart adds a dashed border on past days that fall back to the current target. Maintenance chain weekly-loss line carries a long-term-fat caveat. Weekly recap weight delta relabelled "First → Last weigh-in" with both endpoints surfaced. Maintenance card always renders an explicit "Adaptive" or "Formula estimate" pill — never a confidence bar coupled to a formula value. `calcGoalTimeline` exposes `cappedAtMaxDays` so the Journey card renders "More than 1 year at current rate" instead of an empty headline.
- **2026-04-19 — Progress dashboard cleanup and growth-loop insight.** Removed the Weekly Insight card on web and mobile. Fixed the today-bar dim bug on the web Daily Calories chart so it matches mobile's by-key rule. Re-labelled the Avg Calories tile so partial weeks show "Avg on logged days (X/7)" via a shared helper. Added an adaptive-vs-formula maintenance one-liner to the Weekly Recap Card, suppressed for formula or low-confidence weeks. Loosened the usual-meal insight gate so it also fires when the most-repeated unsaved slot has ≥3 distinct-day repeats over the last 14 days.

## Design history

*Historical rationale for how this surface got here — not a description of
what renders today. For current behaviour, see "Progress Dashboard tiles &
charts" above, and specifically "Shared narrative chrome" for the one piece
of this history that is still live.*

### Why Progress is a weekly story, not a live-updating dashboard
Ratified 2026-04-27
([`docs/decisions/2026-04-27-strategic-direction.md`](../decisions/2026-04-27-strategic-direction.md)):
*"MacroFactor's recap is the gold standard because it's narrative, not
numeric... Best-day-by-protein is stat-card thinking."* Paired with the
companion principle that adaptive TDEE is always shown, with confidence
carried as metadata on the number rather than a gate that hides it. This
pair is the throughline that has survived four iterations of this surface
(below): none of them reverted to a live-refreshing numeric dashboard, and
each kept either a narrative lead or a single prioritised hero over a wall
of equal-weight cards.

### Iteration 1 — the "Surface E" narrative hero (shipped 2026-04-27)
The first build made the engine commentary line **the visual lead of the
whole page**, replacing the stat-card dashboard at the top of Progress and
demoting the existing maintenance/weight/calorie cards below it as a
"supporting trend layer." That page-hero framing didn't last — two
correctness gaps shipped with it (Iteration 2, below), and every later
redesign (the Sloe redesign, the hierarchy rebuild) gave the page a
different hero instead. What DID survive is the underlying mechanism — the
three-regime commentary engine, the empty-state gate, the voice rules —
which is still live today as shared chrome (see "Shared narrative chrome"
above), just no longer styled or positioned as *the* page hero. The
original standalone journey doc for this iteration,
`docs/journeys/progress-2026-04-27.md`, is now superseded and redirects
here.

### Iteration 2 — the 2026-04-30 correction
Two correctness gaps in Iteration 1 were fixed
([`docs/decisions/2026-04-30-progress-story-not-dashboard.md`](../decisions/2026-04-30-progress-story-not-dashboard.md)):
the narrative line was rendering calibrating-copy against zero data for
week-1 users (fixed by the `ProgressStoryGate` empty-state gate — still
live, see above), and the 2×2 stat-card grid was kept for its drill-down
navigation but visually demoted to a 2-column chip row (later fully
absorbed into the branch-specific card lists documented above). A new
always-visible `DigestStoryCard` was introduced as a *separate* narrative
lead from the Sunday-only `<Digest>` recap card — that split still holds
today (see "Weekly Recap Card" above; `DigestStoryCard` renders on the
legacy branch only, per the hierarchy section's "not rendered" list above).

### Iteration 3 (the Sloe redesign) → Iteration 4 (the hierarchy rebuild, 2026-07-16)
The frame-section rebuild (the Sloe redesign, Figma frame 492:2) replaced
the demoted chip row with dedicated cards (Average Adherence, Energy Triad,
on-target ribbon, Expenditure trend, Body Composition) and moved
`StreakFreezeCard` on mobile out of the Progress frame into the Digest — a
change that now conflicts with the hierarchy rebuild's spec, which expects
the card cross-platform (see the open question in "Streak freeze" above).
The hierarchy rebuild then consolidated those cards again into the
5-section hierarchy documented above (default-off pending ramp). Neither
rebuild touched the narrative card from Iteration 1 — it has now outlived
three full-page redesigns unchanged in mechanism, only relocated and
restyled each time.
