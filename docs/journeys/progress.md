# User Journey: Progress & Weekly Recap

**Audience:** Product / Design

## Overview
User opens the Progress tab to review their week — how many days they logged, how close they stayed to their calorie + protein targets, whether their weight is trending, and how long their logging streak is. When the week has just ended, a polished Weekly Recap card fronts the screen; an optional local push notification nudges them back to open it.

## Entry Points
- Progress tab on the bottom navigation (mobile) / side navigation (web).
- Weekly-recap push notification (mobile) → deep-links to `/progress`.
- Today tab streak insight card linking to Progress (indirect).

## Streak freeze (Batch 4.11)

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

## Weekly Recap Card (Batch 4.11)

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
│  WEIGHT    -0.6 kg   change                  │  ← "No weigh-ins this week" when null
├──────────────────────────────────────────────┤
│  Best day — Wed · 180g, 2,000 kcal           │  ← hidden when no days logged
├──────────────────────────────────────────────┤
│  Got a usual lunch?                          │  ← usualMealInsight (M1 + Action 5 Item 8)
│  You've logged the same one 4 times in 2 wks │     OR "Save it once, log it in one tap."
├──────────────────────────────────────────────┤
│  Your maintenance landed at 2,150 kcal       │  ← Action 5 Item 7 — adaptive only
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

### Adaptive maintenance line (Action 5 Item 7, 2026-04-19)
Single line below the stat row, above the share button: "Your maintenance landed at 2,150 kcal this week (formula said 2,050)." Driven by `formatMaintenanceRecapLine(resolved)` in `src/lib/nutrition/resolveMaintenance.ts`. Render conditions (identical on web + mobile):
- `resolved.source === "adaptive"` (adaptive branch won — confidence ≥ medium and not stale).
- `resolved.formulaKcal != null` and `resolved.kcal !== resolved.formulaKcal`.
- `resolved.confidence !== "low"` (belt-and-braces — the resolver already enforces this).

Suppressed for formula fallback, low-confidence, stale-rejected adaptive, and identical values. The full chain explainer lives on Progress > Maintenance — the recap surfaces only the headline, no expandable. Pinned by `tests/unit/maintenanceRecapLine.test.ts`.

### Usual-meal growth-loop line (Ship M1 + Action 5 Item 8)
The recap surfaces a single growth-loop insight between `bestDay` and the maintenance line:
- **Celebration** ("You logged X 3 times this week") — when the user has saved meals AND ≥1 was logged in the recap window. Picks the most-logged.
- **Prompt — original gate (Ship M1)** ("Got a usual breakfast? Save it once, log it in one tap.") — when the user has zero saved meals AND logged ≥5 distinct days. Suggests the slot with the largest item-count.
- **Prompt — loosened gate (Action 5 Item 8, 2026-04-19)** ("Got a usual lunch? You've logged the same one 4 times in 2 weeks.") — when the user has saved meals BUT the most-repeated unsaved slot has ≥3 distinct-day repeats of the same `(title, kcal)` pattern over the 14-day window.
- Suppressed when all four canonical slots already have a saved meal, or when the dominant unsaved-slot pattern is repeated <3 times in 14 days.

Floor is `USUAL_MEAL_REPEAT_FLOOR = 3` (exported from `src/lib/nutrition/weeklyRecap.ts`). Pinned by `tests/unit/usualMealInsightLoosenedGate.test.ts` and the existing `tests/unit/usualMealHint.test.ts`.

## Weekly Recap Push (Batch 4.11, mobile-primary)

### Schedule
- Local `expo-notifications` `WEEKLY` trigger at 18:00 in the device's local timezone on the end-of-week day.
  - Monday-start users → Sunday 18:00.
  - Sunday-start users → Saturday 18:00.
- Stable identifier `weekly-recap-v1` — rescheduled on every app launch, never stacked.

### Opt-out
- Profile flag `weekly_recap_push_enabled` (default `true`). First-class Settings toggle on both platforms (H6 audit fix, 2026-04-18):
  - **Web** — `Settings.tsx` Notifications section, shadcn `<Switch>` row ("Weekly recap", sub: "Sunday 18:00 (respects your week start)." or "Saturday 18:00 …" depending on `week_start_day`). Writes the column via `savePref`; fires `weekly_recap_push_enabled_toggled { enabled }`.
  - **Mobile** — `app/(tabs)/more.tsx` Connections section, `SettingsRow` that opens a bottom-sheet modal hosting a RN `Switch` (`accessibilityRole="switch"`). Off → `cancelWeeklyRecapPush()` clears the `weekly-recap-v1` identifier from the iOS notification queue immediately; On → `scheduleWeeklyRecapPush()` reinstalls the `WEEKLY` trigger. Fires the same `weekly_recap_push_enabled_toggled` event.
- Defensive fallback: the Progress-visit effect in `app/(tabs)/progress.tsx` still reads the column and reconciles the OS queue on every app open, so a flip made on device A converges on device B without user action.
- DB write error (RLS reject, offline, etc.) reverts the toggle and surfaces a toast (web) / Alert (mobile); no analytics fires on error.

### Content
- Title: "Your week in Suppr"
- Body: "Tap to see your weekly recap — avg calories, protein, streak, and weight trend."
- Deep-link data: `{ deepLink: "/progress", kind: "weekly_recap" }`.

### Analytics
- `weekly_recap_push_sent { weekKey }` — fires when the local notification is (re-)scheduled on mobile.
- `weekly_recap_push_enabled_toggled { enabled }` — fires once per committed flip of the Settings toggle on web or mobile. Added 2026-04-18 (H6 audit fix) so product can measure opt-out rate directly instead of inferring it from `_push_sent` drop-off.
- `weekly_recap_shown { weekKey }` — fires once per week when the card renders.
- `weekly_recap_dismissed { weekKey }` — dismiss / "Got it" / close.
- `weekly_recap_shared { weekKey, platform }` — share button tap.
- `streak_freeze_used { dateKey, freezesRemaining }` — each time a freeze is consumed.
- `streak_freeze_earned { newStreak }` — each milestone crossing.

### Web push
Deferred. Suppr does not currently run a service-worker-backed push registration flow, so the weekly push is mobile-primary. Web users see the recap card directly when they open Progress in the recap window.

## Progress Dashboard tiles & charts

### "Avg Calories" stat tile (Action 5 Item 3, 2026-04-19)
- Headline number = `weekStats.avgCalories` (`sum / daysWithFood`).
- Sub-label is the shared helper `formatAvgCaloriesLabel(daysWithFood)`:
  - **Full week (7/7 days logged)** — "Avg Calories".
  - **Partial week** — "Avg on logged days (X/7)" so the user can't read the headline as "average per day this week".
- Identical copy on web (`ProgressDashboard.tsx`) and mobile (`app/(tabs)/progress.tsx`) — the helper is the single source of truth. Pinned by `tests/unit/avgCaloriesLabel.test.ts`.

### Daily Calories chart — today bar dim (Action 5 Item 2, 2026-04-19)
- The bar whose `key === todayKey()` renders at `opacity 0.4`. Every other day renders at `opacity 0.75`. Future days within the rendered week (e.g. Sunday for a Wednesday user on a Monday-start week) are NOT dimmed.
- Web mirrors mobile's existing `isDayToday = d.key === todayKey` rule rather than the prior `i === 6` index check, which incorrectly dimmed Sunday for any mid-week visit. Pinned by `tests/unit/progressTodayBarDim.test.ts`.

### Weekly Insight card — removed (Action 5 Item 1, 2026-04-19)
- The blue "Weekly insight" card that sat below the macro adherence bars on both platforms has been removed. It restated numbers already on screen above (avg calories vs target; protein-on-target days; streak) and read as filler.
- Replacement is being scoped by `ui-product-designer` as a card-grammar-conformant component; re-introduce when the new spec lands.
- No new surface to test post-removal; existing tests continue to cover the underlying numbers via `progressWeekReport`.

## Edge Cases
- **Zero logs all week** — recap card is suppressed; no push is sent. The Progress dashboard falls back to its existing "Your progress will appear here" empty state.
- **Only 1 weigh-in in the window** — weight row shows "No weigh-ins this week" (still honest).
- **User changes `week_start_day` mid-week** — next recap rebuilds using the new preference; the push is rescheduled on the next Progress visit (ledgerKey changes).
- **Two devices open at once** — the dismiss update writes `weekly_recap_last_seen_week_key`; both devices converge on the next `loadData` call.
- **Freezes exhausted mid-walk** — the protected streak simply stops at the first unprotected zero day. The raw streak is unchanged.

## Change log
- **2026-04-19 — Action 5** — Removed the Weekly Insight card on web + mobile (Item 1). Fixed the today-bar dim bug on the web Daily Calories chart so it matches mobile's by-key rule (Item 2). Re-labelled the Avg Calories tile so partial weeks show "Avg on logged days (X/7)" via shared helper (Item 3). Added an adaptive-vs-formula maintenance one-liner to the WeeklyRecapCard, suppressed for formula / low-confidence weeks (Item 7). Loosened the `usualMealInsight` gate so it also fires when the most-repeated unsaved slot has ≥3 distinct-day repeats over the last 14 days (Item 8).
