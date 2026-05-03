# Mobile App Changelog

## 2026-05-02 — Weekly check-in ritual modal

PR claude/weekly-checkin-ritual-v2 (rebuild of #26 on top of current
`main`). The Suppr math pipeline (`adaptiveTdee.ts` +
`refreshAdaptiveTdee.ts`) updates adaptive TDEE silently after each
weigh-in or log. MacroFactor's hook is the *moment*: a weekly modal
that says "your real burn changed, here's your new target". This
change closes the customer-lens audit gap — Suppr had the math,
MacroFactor users pay for the surface.

### Today
- **`WeeklyCheckinModal`** (`apps/mobile/components/today/WeeklyCheckinModal.tsx`) —
  MacroFactor-style soft prompt that surfaces the adaptive-vs-formula
  TDEE delta + a suggested new daily target. Two equal-weight CTAs:
  "Accept new target" applies the delta (preserves the user's existing
  deficit/surplus, never below 1200 kcal floor) and persists
  `target_calories_source = "digest_recalibration"`; "Keep current"
  stamps `last_weekly_checkin_decision = "kept_current"` and leaves
  the target alone. The close X + backdrop tap also route through
  Keep current.
- **Gate** (`src/lib/nutrition/weeklyCheckin.ts`, modal-ritual block) —
  fires when adaptive-TDEE confidence is medium/high AND ≥5 days
  logged in the current week AND the modal hasn't shown in the last
  6 days. Pure module re-exported via `apps/mobile/lib/weeklyCheckin.ts`
  so web + mobile share the gate exactly.
- **Persistence** (migration `20260509100000_weekly_checkin_state.sql`) —
  adds `profiles.last_weekly_checkin_shown_at` +
  `profiles.last_weekly_checkin_decision` (CHECK constraint:
  `accepted | kept_current | dismissed`). Migration ships unapplied
  per CLAUDE.md — Grace runs `supabase db push --linked` post-merge.

### Web parity
- `src/app/components/suppr/weekly-checkin-dialog.tsx` mounts on
  `NutritionTracker` with the same content payload, the same
  accept/dismiss handlers, and the same analytics events with
  `platform: "web"` in place of `"ios"`.

### Analytics
- New events: `weekly_checkin_shown`, `weekly_checkin_accepted`,
  `weekly_checkin_dismissed`. All carry `platform: "web" | "ios" |
  "android"`. Shown event payload includes `confidence`,
  `tdeeDeltaKcal`, `daysLoggedThisWeek` so the funnel can slice
  acceptance rate by delta size.

### Known gaps (PR follow-ups)
- The modal passes `weightDeltaKg: null` until the host wires real
  7-day weigh-in data through. The modal honestly suppresses the
  weight-delta row rather than fabricate "+0.0 kg".
## 2026-05-02 — Cancel-flow export prompt (replaces stale PR #43)

journey-architect P1. Pre-2026-05-02 the CSV-export prompt was buried
4-5 taps deep in Settings → Data; tapping "Manage subscription" routed
straight to RevenueCat's customerCenter without ever surfacing the
option. Users who cancelled and lost their backups had a justified
support claim. Now a Suppr-owned bottom sheet (mobile) / dialog (web)
surfaces between the Manage tap and the platform handoff.

Posture: calm trust, not retention-via-friction. Two equal-weight cards
(matched border, background, icon-tile treatment), no offers, no
upsells, no last-minute discount. The user came to manage their plan;
we are not the gatekeeper.

### What changed

- `apps/mobile/components/settings/CancelExportPromptSheet.tsx` (new)
  — mobile bottom sheet, two equal-weight cards.
- `apps/mobile/components/settings/SettingsBundleContent.tsx` —
  `handleManageSubscription` now opens the sheet first; CSV runner
  extracted into `runExportCsv` so the sheet and the standalone "Export
  nutrition log (CSV)" row share one code path.
- `src/app/components/suppr/cancel-export-prompt-dialog.tsx` (new) —
  web parity dialog.
- `src/app/components/Settings.tsx` — "Manage subscription" Link
  replaced with a button that opens the dialog; gate widened from
  `userTier === "pro"` to `userTier !== "free"` per spec; CSV runner
  extracted into `runCsvExport`.
- `src/lib/analytics/events.ts` — three new events:
  `cancel_export_prompt_shown`, `cancel_export_chosen`,
  `cancel_proceeded`. All carry `{ source: "mobile" | "web", tier: string }`.
- `docs/decisions/2026-05-02-cancel-export-prompt.md` — posture +
  non-goals + parity matrix.

### Behaviour

- **Take your data with you** → fires the existing `nutritionLogToCsv`
  export. Sheet stays open after success so the user can still
  continue or dismiss without a second round-trip.
- **Continue to manage** → closes the sheet; mobile routes to
  `presentCustomerCenter()` (with App Store / Play Store fallback);
  web hard-navigates to `/account/billing`.
- **X / backdrop tap** → dismiss without action. No event fires —
  silence is the signal.

### Tests

- `apps/mobile/tests/unit/cancelExportPromptSheet.test.tsx` — 5 RTL
  tests: equal-weight rendering, single-fire export CTA, success-state
  row count, close-vs-continue intent separation, null-export resilience.
- `tests/unit/cancelExportPromptDialog.test.tsx` — 6 RTL tests
  mirroring mobile coverage + state-reset on dialog close/re-open.
- `tests/unit/nutritionLogToCsv.test.ts` (existing) — pinned bytes
  continue to match for both entry points.

## 2026-05-02 — Ionicons → lucide sweep on Voice/Photo/QuickAdd/DayStrip

ui-critic finding #3 (P1). Replaces stale PR #32, rebuilt on current main per PR-staleness-prevention sweep.

Swept the remaining `@expo/vector-icons` Ionicons leak from four mobile surfaces to `lucide-react-native`:

- `VoiceLogSheet.tsx` — `mic` → `Mic`, `close-circle` → `XCircle`
- `PhotoLogSheet.tsx` — `camera` / `camera-outline` → `Camera`, `images` → `Images`, `sparkles-outline` → `Sparkles`, `close-circle` → `XCircle`
- `QuickAddPanel.tsx` — `ellipsis-vertical` → `MoreVertical`, `add-circle` → `PlusCircle`, `star` → `Star` (with `fill` for filled state)
- `charts/DayStrip.tsx` — `checkmark` → `Check`, `snow-outline` → `Snowflake`, `calendar-outline` → `Calendar`

Sizes route through canonical `IconSize` token in `apps/mobile/constants/theme.ts` (xs/sm/md/base/lg/xl/hero) instead of pixel literals. Stroke widths set deliberately for visual rhythm match.

Lock-in regression test `apps/mobile/tests/unit/iconLanguageNoIonicons.test.ts` fails CI if any of the four files re-imports `@expo/vector-icons` or references `Ionicons`.

## 2026-05-02 — Hex literals → theme tokens

ui-critic finding #2 (P1). Mixed raw hex literals (`#EF4444` / `#B91C1C`
destructive, `#F59E0B` / `#B45309` warning, `#fff` primary-foreground)
were sitting next to `Accent.*` token consumers in five mobile surfaces.
The hue-by-hue divergence makes dark-mode contrast brittle and lets
palette tweaks silently miss four files at a time. Suppr's
`Accent.destructive` is `#e04848`, not Tailwind's `#EF4444` — close
hue, distinct value.

### What changed

- `apps/mobile/components/VoiceLogSheet.tsx` — error banner border /
  background / text now use `Accent.destructive + "66"` / `+ "10"` /
  `Accent.destructive`. Active-mic icon + Parse / Try again / Log all
  CTA labels now use `colors.primaryForeground`. Local `Theme` prop
  contract gained `primaryForeground: string`.
- `apps/mobile/components/PhotoLogSheet.tsx` — same destructive
  banner sweep. Low-confidence item border / background switched to
  `Accent.warning + "55"` / `+ "0F"`; the "Low confidence — verify"
  caption switched to `Accent.warning`. Analyse / Try again / Save
  to today CTA labels now use `colors.primaryForeground`. Local
  `Theme` prop contract gained `primaryForeground: string`.
- `apps/mobile/components/today/TodayDateHeader.tsx` — Day / Week
  glyph active-state colour now reads `primaryForegroundColor` from
  a new required prop (matches the existing
  `textColor`/`textSecondaryColor`/etc. flat-prop convention).
- `apps/mobile/app/recipe/[id].tsx` — `stepNumberText`,
  `actionBtnText`, the portion-stepper active label, the Start
  Cooking icon, the Save (yield modal) text, the recipe Log row
  (icon + spinner + label), and the Cook Mode Next / Done labels
  now route through `colors.primaryForeground`.
- `apps/mobile/app/(tabs)/index.tsx` — call sites for
  `<VoiceLogSheet>`, `<PhotoLogSheet>`, and `<TodayDateHeader>` now
  pass `colors.primaryForeground` through.

### Documented anchor exceptions (NOT swept)

- `Badge.tsx` `#94a3b8` slate-400 neutral variant anchor
- `Badge.tsx` `#8b5cf6` AI violet variant anchor (mirrors web `--chart-5`)
- `#00000066` modal-overlay tint shared with the web dialog

### Tests

- `apps/mobile/tests/unit/hexTokenSweep.test.ts` — new lock-in suite.
  Reads each guarded file's source (comment-stripped) and fails if
  any banned hex (`#EF4444` / `#B91C1C` / `#F59E0B` / `#B45309` /
  `#fff` / `#FFFFFF`) reappears outside the documented anchors. Also
  pins the three anchor exceptions so they don't get accidentally
  removed by an over-eager future sweep.

### Parity

Mobile-only surface — the web equivalents already use CSS custom
properties (`--destructive`, `--warning`, `--primary-foreground`)
and need no changes.

## 2026-05-02 — Recipe detail servings stepper

Customer-lens audit gap (Paprika persona): "open recipe, dial servings
4 → 6, ingredient grams update." Pre-2026-05-02 the recipe-detail
screen had no inline servings control on mobile — scaling was only
available via the planner / log-flow `?portion=N` deep-link, which is
not a surface the user can drive from the recipe page itself. Web had
a stepper but it was unbounded on the plus side (`setServings(servings + 1)`)
and undebounced. Both platforms now ship the same Paprika-tier control.

### What changed
- New shared module `src/lib/nutrition/recipeViewScale.ts` (pure, no
  React, no DOM, no React Native) — bounds (1..99), debounce window
  (200ms), `clampViewServings`, `stepViewServings`, `viewMultiplier`,
  and `initialViewServings`. One contract, two consumers.
- `apps/mobile/app/recipe/[id].tsx`:
  - New "Servings to view" stepper between the time-stats info row
    and the calorie / macro hero. Bounded 1..99, debounced 200ms,
    +/- pressables with `hitSlop={8}` and visible disabled-at-bounds
    states.
  - Ingredient amounts now multiply by
    `viewMultiplier(viewServings, recipe.servings)` instead of the
    raw `?portion=N` query param.
  - Per-portion kcal hero stays invariant under the stepper. A
    secondary "X kcal total for N portions" line appears below when
    the user has dialled away from the authored yield, so the visible
    number tracks the multiplier honestly.
  - `logPortion` (the "Add to today" target) now follows the stepper,
    so a journal write from the detail screen reflects the chosen
    portion count.
  - The old "Planned portion: Nx — quantities below are adjusted"
    banner is removed; the visible stepper is now the canonical
    surface for that signal.
  - Recipe id change resets the stepper seed (no carry-over A → B).
- `src/app/components/RecipeDetail.tsx` (web parity):
  - Stepper now bounded (was unbounded on the `+` side); 200ms
    debounce; label aligned to "Servings to view"; explicit
    `aria-label` on +/- buttons; `role="status"` + `aria-live="polite"`
    on the value readout; visible disabled-at-bounds styling.
  - Per-portion kcal headline binds to `perServingBase.calories`
    directly (was `scaledMacros.calories`, which silently scaled with
    the stepper) so per-portion truly stays per-portion.
  - Same secondary "X kcal total for N portions" line as mobile.

### Cook-mode (PR #72) interaction
The cook-mode flow already takes the user's scaled servings via the
PR #72 handoff (mobile reads `cookScaleFactor = logPortion`; web
takes `<CookMode servings={...} baseServings={...} />` and computes
`scaleFactor` internally). PR1's stepper just controls what those
inputs are when the user enters cook mode. PR #72's contract is
preserved by construction — the source-pin test
(`tests/unit/cookModeServingsHandoff.test.ts`) is unchanged and
still passes.

### Tests
- `tests/unit/recipeViewScale.test.ts` — 29 pure-helper tests pinning
  bounds, clamp, step, multiplier, and seed math (incl. the spec
  example: chicken 400g → 600g when stepping a 4-serving recipe to 6).
- `tests/unit/recipeViewScaleScreens.test.tsx` — 28 cross-platform
  source-pin tests plus a platform-agnostic RTL harness that exercises
  the `+`/`−` → state → display loop using the same shared helper
  both screens consume (chicken 400g → 600g via two `+` taps; minus
  disabled at 1; plus disabled at 99; deep-link `?portion=1.5` on a
  4-serving recipe seeds at 6).

### Parity
Web and mobile share the helper module, the bounds, the debounce
cadence, the label copy ("Servings to view"), the secondary kcal-total
line text ("X kcal total for N portions"), and the deep-link seed
behaviour. Visual differences are scoped to the per-platform primitive
(web `<button>` + Tailwind / mobile `<Pressable>` + `Spacing` tokens);
the contract surface is identical.

## 2026-05-02 — EmptyState: 72pt disc + headline/body type ladder + optional CTA

ui-critic finding #6 (P1). The pre-2026-05-02 `<EmptyState>` primitive
surfaced empty tabs as 13pt bold over a tiny gap — too quiet to read
as a state, and visually indistinguishable from a row separator. Lifted
on both platforms (mobile + web) to a richer composition while staying
backward compatible.

### What changed
- `apps/mobile/components/EmptyState.tsx` (and web mirror
  `src/app/components/suppr/empty-state.tsx`) gained three additive
  props:
  - `illustration?: ReactNode` — optional ~32pt lucide glyph rendered
    inside a 72pt circular `Accent.primary + "10"` (mobile) /
    `bg-primary/10` (web) tinted disc.
  - `cta?: ReactNode` — optional primary CTA below the description.
    Aliases the legacy `action` prop; `cta` wins if both are passed.
  - Title routes through `Type.headline` (17pt / 22 lh) on mobile and
    `text-[17px] font-semibold leading-[22px]` on web.
  - Description routes through `Type.body` (14pt / 20 lh) on mobile and
    `text-sm leading-5 text-muted-foreground` on web.
- The disc is **only rendered when `illustration` is set** — no empty
  ring on legacy callers.
- `icon`, `title`, `description`, `action`, `style`, `titleStyle`,
  `descriptionStyle` and `className` (web) keep working unchanged. A
  caller of `<EmptyState title="..." />` renders identically to before
  except for the title type-ladder bump.

### Call sites updated
- `apps/mobile/components/QuickAddPanel.tsx` and
  `src/app/components/suppr/quick-add-panel.tsx`: Favourites tab gets
  `Star`, Frequent gets `History`, Recent gets `Clock`.
- `apps/mobile/components/QuickAddPanel.tsx` saved-meals branch and
  `src/app/components/suppr/saved-meals-tab.tsx`: signed-out empty
  state gets `LogIn`; no-saved-meals empty state gets `Bookmark`.

### Tests
- `apps/mobile/tests/unit/emptyStateUpgrade.test.tsx` — 7 RTL tests
  pinning back-compat, disc-only-when-illustration, 72pt size + 6.25%
  primary tint, headline/body type ladder, all four slots together,
  and CTA `onPress` wiring.
- `tests/unit/emptyStateUpgrade.test.tsx` — 6 web mirror tests pinning
  back-compat, disc shape (`size-[72px] rounded-full bg-primary/10`),
  17px / leading-[22px] title, `text-sm` description, all four slots
  together, and `cta`-vs-`action` precedence.

### Parity
Mobile and web ship the same prop contract, the same empty-state copy
(unchanged from before), and the same illustration glyphs per surface.
Disc tint differs numerically — mobile = 6.25% alpha (`+ "10"` hex),
web = 10% alpha (`bg-primary/10` Tailwind) — visually similar enough
that any drift is captured by visual-qa, not numeric tests.

## 2026-05-02 — photo-log free taster (5/week) replaces blanket Pro gate

Photo-log was Pro-only — Free + Base users hit the AI paywall before
they could tap the camera once. Two final audits confirmed the gate
should land on the SECOND photo, not the first; Cal AI's runaway
growth model is built on giving every user free shots of the AI
before asking for money, and we have the better feature (kcal ranges
+ verified DB) but were gating it before users could taste it.

### Server (Next.js route, shared with web)
- New shared module `src/lib/nutrition/photoLogQuota.ts` exporting
  `FREE_PHOTO_LOG_WEEKLY_LIMIT = 5` and `FREE_PHOTO_LOG_WINDOW_MS =
  168h`. Single source of truth — imported by route + mobile sheet
  + web dialog + integration test so the number cannot drift.
- `app/api/nutrition/photo-log/route.ts`: removed the blanket `tier
  !== "pro"` 403; non-Pro now goes through a separate
  `api:photo-log:free-quota` rate-limit bucket (5 per rolling 168h
  via Upstash sliding window). Pro keeps the existing `api:photo-log`
  100/day bucket — untouched. 200 responses now include
  `freeQuotaRemaining: number | null`.

### Mobile sheet
- `apps/mobile/components/PhotoLogSheet.tsx`: accepts new `userTier`
  + `onUpgradeRequired` props. Non-Pro renders "X free logs remaining
  this week" under the caption (optimistic 5 until first response,
  authoritative `freeQuotaRemaining` after). On 403 from the server,
  fires `ai_photo_log_paywalled` and calls `onUpgradeRequired`.
- `apps/mobile/app/(tabs)/index.tsx`: `handleOpenPhotoLog` no longer
  checks tier — opens the sheet for any tier. `TodaySnapShortcut`
  + LogSheet photo entry + barcode-not-found photo fallback all
  drop their `locked` flag. `PhotoLogSheet` now wired with
  `onUpgradeRequired` that closes the sheet and opens
  `AiPaywallSheet { feature: "photo_log" }`.

### Paywall copy (mobile + web, identical)
- `AiPaywallSheet.tsx` + `src/app/components/suppr/ai-paywall-dialog.tsx`:
  `photo_log` `FEATURE_COPY` updated to "Get unlimited photo logs
  with Pro" / "You've used all 5 of your free photo logs this week.
  Pro unlocks unlimited AI photo logging (100/day) — …" so the
  conversion moment names the experience the user just had. The
  paywall now lands ONLY on quota exhaustion.

### Pricing copy
- `src/lib/landing/pricingTiers.ts`: Free tier gains "AI photo
  logging (5 per week)" bullet; Pro bullet sharpened to "Unlimited
  AI photo meal recognition (100/day)" so the gap is explicit.
- `docs/product/landing-maintenance.md`: photo-log row flipped from
  "Server-gated Pro" to "Free taster (5/week) + Pro 100/day".

### Tests
- `tests/integration/photoLogRoute.test.ts`: 8 scenarios pinning
  the new behaviour — unauthenticated, free-with-quota, free-
  exhausted, base-treated-as-free, pro-bypasses-free-quota, pro-
  100/day-exhausted, no OpenAI key, non-multipart.
- `tests/unit/photoLogDialogFreeTaster.test.tsx` (web) +
  `apps/mobile/tests/unit/photoLogSheetFreeTaster.test.tsx` (mobile)
  pin the quota line + back-compat-to-Pro default + 403-handoff
  contract on both platforms.

### Decision doc
- `docs/decisions/2026-05-02-photo-log-free-taster.md` — full
  rationale (5/week vs 1 vs 3/day, rolling 7d vs midnight TZ, two
  buckets vs lower-cap, quota-burn-on-error tradeoff, parity
  matrix, follow-ups).

## 2026-05-02 — Food search "no result" loop (MFP-refugee retention)

### New
- **Two-CTA empty state.** When food search returns zero hits across
  every source (USDA + Open Food Facts + Edamam + FatSecret + custom +
  generic fallback), the empty state now shows two actions instead of
  one paragraph: a primary "Add as custom food" button (opens the
  existing custom-food create flow with the query pre-filled) and a
  secondary "Tell us we're missing this" button. Mobile + web parity
  (`apps/mobile/components/food-search/FoodSearchPanel.tsx`,
  `src/app/components/food-search/FoodSearchPanel.tsx`).
- **Two new PostHog events** for backfill prioritisation:
  `food_search_no_result` (auto, deduped per query) and
  `food_search_request_dictionary_add` (user-confirmed tap on
  "Tell us we're missing this"). Both carry
  `{ query, len, source: "mobile" | "web" }`. Dedupe keys are
  case-insensitive + trimmed, so type-pause-resume on the same query
  is one emit.
- **Inline confirmation row** (mobile + web) after the user taps the
  dictionary-add CTA, so the action feels acknowledged. Mobile uses a
  dismissable inline row (NOT a native `Alert.alert`, per Grace's
  2026-05-02 softer-pattern call); web uses an inline `role="status"`
  paragraph. Dictionary-add events are deduped per query — a triple-
  tap is one emit.

### Decisions captured in this change
- The "Add as custom food" CTA reuses the existing
  `CreateCustomFoodSheet` / `CreateCustomFoodDialog` paths — no new
  flow, no pre-create. The empty state is a stronger surface for the
  same action, not a parallel one. The user still confirms creation
  in the sheet/dialog.
- "Tell us we're missing this" does NOT open a free-text input. The
  signal we need is the (anonymous, debounced) PostHog event payload
  of the search query that whiffed; a textarea would invite low-
  signal noise and add a moderation surface.
- Replaces stale PR #36 (41 commits behind main) — rebuilt from
  intent on current main per the PR-staleness-prevention sweep.

## 2026-05-02 — parity: web "All nutrients" + LogSheet meals empty state

User feedback: (1) web's "All nutrients" panel was the desired pattern and
should ship on mobile; (2) the web Today meals card's empty-state collage
("Log from today's plan" rows + Add custom meal / Photo log / Voice log)
"makes no sense" — it diverged from mobile, which has no in-card empty
collage and instead routes through the canonical raised "+" Log button
into the unified `<LogSheet>`.

### Parity 1 — `FullNutrientPanelSheet` (mobile == web, no code change)
- Investigation confirmed the mobile `FullNutrientPanelSheet`
  (`apps/mobile/components/today/FullNutrientPanelSheet.tsx`) and web
  (`src/app/components/suppr/full-nutrient-panel-sheet.tsx`) already share
  the canonical `buildFullNutrientPanelRows` helper, identical
  Macros / Vitamins / Minerals section taxonomy, the same %DV-descending
  sort rule, the same limit-tier color ramp (sodium / sat fat /
  cholesterol), and the same `DAILY_VALUES_SOURCE_LABEL` footer. Both
  ship with their own component-level unit tests
  (`tests/unit/fullNutrientPanelSheetWeb.test.tsx`,
  `apps/mobile/tests/unit/fullNutrientPanelSheet.test.tsx`).
- Added a structural source-grep parity test
  (`tests/unit/logSheetWebMobileParity.test.ts`) pinning both platforms to
  the shared row builder, count constant, footer label, section/row
  testID prefixes, and limit-tier ramp thresholds — so a regression on
  either side fails CI.

### Parity 2 — web Today meals empty state (web → mobile pattern)
- `src/app/components/suppr/today-meals-section.tsx`: removed the
  empty-state collage that diverged from mobile. It rendered:
  - a duplicated "Log from today's plan" rows block (already shown by
    `<TodayPlannedMealsCard>` directly above the meals card), and
  - 3 parallel CTAs (Add custom meal / Photo log / Voice log) which
    reproduced the LogSheet's right-edge icons.
- New empty state: a single primary "Log a meal" CTA that opens the
  unified `<LogSheet>` — the same entry as the bottom-bar raised "+" on
  mobile-web. The LogSheet's own scan / voice / photo icons cover the
  removed input modes; mobile is unchanged because mobile already
  omitted the collage.
- Props slimmed: `onOpenAddCustom`, `onOpenPhotoLog`, `onOpenVoiceLog`,
  `userTier`, `mealPlanFirstDay`, `onLogPlanMeal` removed; replaced by
  a single `onOpenLogSheet` callback. `TodayMealSectionPlanEntry` type
  removed (no longer referenced).
- Caller (`src/app/components/NutritionTracker.tsx`) updated to pass
  `onOpenLogSheet={() => setLogSheetOpen(true)}` — same handler the
  raised "+" button uses.
- Tests:
  - `tests/unit/todayMealsSectionEmptyState.test.tsx` — empty state
    renders the single CTA, hides the legacy collage strings, fires
    `onOpenLogSheet`, and disappears once meals are logged.
  - `tests/unit/logSheetWebMobileParity.test.ts` — pins web ↔ mobile
    `LogSheet` 3-tab structure (Recent / Library / Saved), the
    saved-tab dot indicator, scan/voice/photo icon order, the inline
    search testIDs, the "Or add manually" footer, AND that the web
    `today-meals-section` no longer carries the legacy collage hooks
    (`onOpenAddCustom` / `onOpenPhotoLog` / `onOpenVoiceLog` /
    `onLogPlanMeal`) — so a regression fails CI immediately.

## 2026-05-02 — Settings: make fasting findable + tap-to-configure

User report (TestFlight Build 40 outstanding feedback): typed "fast" in the
Settings search box → "No matches for 'fast'", with no other in-app way to
change the fasting window after onboarding. Today screen showed a "Fasting
— 24h 58m" pill (so fasting was active) but no accessible config path.

### Settings bundle (`apps/mobile/components/settings/SettingsBundleContent.tsx`)
- New **Intermittent fasting** row in Goals & targets (testID
  `settings-bundle-fasting-row`), uses lucide `Timer` icon, routes to
  `/fasting`. Sub copy reflects the user's stored window
  (`profiles.fasting_window`, e.g. "16:8 window · 16h fast / 8h eat") so
  the row is honest at a glance without forcing a tap.
- Bundle now reads `fasting_window` alongside the existing
  `tracked_macros, week_start_day, target_caffeine_mg, …` profile select,
  with a regex guard (`/^\d+:\d+$/`) before applying.

### Fasting screen (`apps/mobile/app/fasting.tsx`)
- **In-app window picker** added — pill row with the 16:8 / 18:6 / 20:4 /
  14:10 presets (matches the web `FastingTimer.tsx` `WINDOW_PRESETS`
  exactly so values round-trip cross-platform). Picker is hidden while a
  fast is active so we don't silently rebase the goal time mid-session.
- Tapping a preset persists immediately to `profiles.fasting_window` and
  re-renders the ring + ETA + Goal timestamp against the new fast length.
- Tests: `apps/mobile/tests/unit/settingsFastingFindable.test.ts`.

### Settings search (`apps/mobile/app/(tabs)/settings.tsx`)
- New `apps/mobile/lib/settingsSearchIndex.ts` keyword index with entries
  for Fasting, Daily targets, Notifications, Apple Health (only routable
  destinations indexed; toggles/modal-rows deferred — tapping a search
  hit must lead to a real config screen).
- The screen no longer renders an unconditional "No matches" for any
  non-empty query. It runs `filterSettingsIndex(trimmedQuery)` and:
  - empty query → existing canonical bundle body + Sign Out;
  - non-empty + ≥1 match → list of routable result rows
    (`testID="settings-search-results"`, each row's
    `testID="settings-search-result-{id}"` taps through to its route);
  - non-empty + 0 matches → existing empty-state copy.
- Keywords for Fasting include "fast", "fasting", "intermittent", "fasting
  window", "16:8", "18:6", "20:4", "14:10", so the literal user query
  ("fast") now surfaces the row.
- Tests: `apps/mobile/tests/unit/settingsSearchIndex.test.ts`,
  `apps/mobile/tests/unit/settingsFastingFindable.test.ts`. Existing
  `settingsSearch.test.ts` and `settingsBundleParity.test.ts` updated
  (parity row added; existing search-gate regex still matches).

### Web parity (`src/app/components/Settings.tsx`)
- New **Intermittent fasting** link inside the existing Preferences card
  (`data-testid="settings-fasting-link"`) routing to `/fasting`. Web
  Settings has no search box and no bundle, so the lightest-touch parity
  is a single Link; `/fasting` already renders `FastingTimer` which has
  had the four-preset chip row since launch.
- No change to `FastingTimer.tsx` itself — its `WINDOW_PRESETS` array is
  the canonical source the mobile picker mirrors.
## 2026-05-02 — UX consistency bundle: household chevron + section rename + streak alignment + web sidebar collapse

User feedback (TestFlight + web, 2026-05-02). Three small UX fixes
shipped as one PR (`claude/household-section-streak-sidebar-bundle`).

### Fix 1 — Household member-row chevron is wired

User report: "clicking on the arrow next to my name (you) doesn't go
anywhere".

- **Mobile** (`apps/mobile/app/household-settings.tsx`) — the own
  ("you") row is now a `Pressable` that pushes `/targets`, the
  existing targets editor. The chevron renders only on the self row
  so other-member rows (which have no destination today) don't carry
  a misleading affordance. Each row now exposes
  `testID="household-settings-member-row-${userId}"`.
- **Web** (`src/app/components/HouseholdSettingsPage.tsx`) — own row
  becomes an `<a href="/home?view=targets">`. Chevron is gated on
  `isSelf` to match mobile. Same testID convention.

### Fix 2 — Section header rename: "Everything else" → "People"

User report: "title 'everything else' for one thing doesn't make
sense" — the section wrapped only a Household row.

- **Mobile** (`apps/mobile/components/settings/SettingsBundleContent.tsx`):
  `<SectionHeading title="Everything else" />` →
  `<SectionHeading title="People" />`.
- **Web** (`src/app/components/Profile.tsx`): heading text updated
  from "Everything else" to "People". Comments + a few inline doc
  references were also refreshed so future readers don't grep the
  old name.

### Fix 3A — "Why this number?" panel reads the streak value

User report: "this screenshot says logging for 26 days (which is
it?)" — the StreakPip showed a 26-day consecutive streak while the
panel called the user "calibrating" referencing distinct-day counts
(40+).

- **Both platforms** — the `WhyThisNumberSheet` (mobile) and
  `WhyThisNumberDialog` (web) now receive `streakDays` (the same
  consecutive-streak number the StreakPip pip renders) for both the
  `loggingDays` and `mealLogDays` props. Distinct-day counts via
  `Object.keys(byDay).filter((k) => (byDay[k] ?? []).length > 0).length`
  / `loggedDays.size` are no longer surfaced through the panel — if a
  future panel wants both, it must surface them explicitly ("X
  consecutive of Y total").
- **Behavioural impact** — for users with high streaks (e.g. 26)
  both metrics already cleared the calibrating gate so the visible
  copy is unchanged. For sub-7-day streaks the gate becomes
  marginally more conservative (we trigger the "keep logging meals"
  ask off the streak rather than off total distinct days). That's
  honest given the new label means streak.

### Fix 3B — Web sidebar collapse

User report: "I can't get this side bar to collapse".

- **Web** (`src/app/components/suppr/desktop-sidebar.tsx`) — the
  desktop sidebar gains a collapse toggle in its header. Tapping
  collapses to a 64 px icon-only rail; tapping again expands to the
  248 px default. Sub-tabs hide while collapsed (the icon rail is
  single-column). Width animates over 200 ms ease-in-out via inline
  `style.width`.
- **Persistence** — preference stored under
  `localStorage.suppr.sidebar.collapsed` so the choice survives
  reloads. SSR-safe: read defaults to expanded when `window` is
  missing.
- **Keyboard shortcut** — Cmd+B / Ctrl+B toggles the same state.
  Bypassed when focus is in an `<input>` / `<textarea>` /
  contenteditable so search inputs that bind ⌘B for "Bold" still
  win.
- **Accessibility** — toggle exposes `aria-expanded` +
  `aria-controls` + `aria-label="Collapse navigation" /
  "Expand navigation"`. Primary nav buttons gain `aria-label` while
  collapsed so VoiceOver still announces "Today" / "Recipes" / "Plan"
  / "You" with the visible labels hidden.
- **Mobile-web** — unchanged; the sidebar is `hidden md:flex` so
  collapse only matters at >= 768 px.

### Tests
- `tests/unit/desktopSidebar.test.tsx` — extended with eight new
  pins for the collapse behaviour (default expanded, click toggle,
  localStorage round-trip across re-mount, Cmd/Ctrl+B shortcut,
  input-focus shortcut bypass, sub-tabs hidden while collapsed,
  aria-expanded toggling, accessible names while collapsed).
- `tests/unit/householdSectionStreakBundle.test.ts` (new) —
  source-grep pins for all three bundle fixes: own-row Pressable +
  testID, isSelf-gated chevron on both platforms, "People" heading
  on both platforms with no remaining literal "Everything else", and
  `loggingDays={streakDays}` / `mealLogDays={streakDays}` wiring at
  both call sites.

## 2026-05-02 — Recipe wizard step 4: lock Calories field + restore actuals to full text colour

User report (TestFlight, 2026-05-02), step 4 of the create-recipe wizard ("Macros look right?"):
- "the light grey text makes the values look like placeholders but they are actuals"
- "shouldn't be able to edit the cals they are calculated from the ingredients selected"

### Wizard component (`apps/mobile/components/recipe/CreateRecipeWizard.tsx`)
- **`MacroOverrideRow` no longer surfaces the resolved value via the input's `placeholder` slot.** The auto-computed (or override) value now feeds the input's controlled `value` prop, picking up `colors.text` at fontWeight 600 — same strength as any other resolved figure in the app. Previously every per-serving number rendered in `colors.textTertiary`, making 40kcal / 1.6g / 0g read like greyed-out hints rather than actuals. The `placeholder` slot is now reserved for an "auto" cue that's only ever visible if the input is blanked out (rare in practice — per-serving math always produces a finite number).
- **Calories row is read-only.** Calories per serving is derived from the ingredient sum / servings — it is not a user-editable independent variable, and inventing a kcal that diverges from the underlying USDA / OFF / Edamam data is a nutrition-accuracy violation per CLAUDE.md. The row now passes `readOnly` to `MacroOverrideRow`, which:
  - sets both `editable={false}` (RN-native lock) and `readOnly` (react-native-web mirror) on the `TextInput`;
  - dims the input to `opacity: 0.6` and drops its border, so it reads as derived rather than tappable;
  - renders a small lucide `Calculator` glyph next to the "Calories" label;
  - prints a helper caption — `Calculated from your ingredients · {N} kcal` — under the row.
- **`override={undefined}` is forced for the Calories row** so any stale `macroOverrides.calories` value from an older code path can never display.
- **Subtitle copy update** on the macros step: "…Override any **macro** if the auto-compute looks wrong — calories stay calculated." (was "Override any **field**…").

### Tests (`apps/mobile/tests/unit/createRecipeWizard.test.ts`)
- New structural pins under "structural pins for the wizard component":
  - `MacroOverrideRow` resolves `displayedNumber = override ?? value` and passes it to the input's `value` prop (full-strength colour, not placeholder colour).
  - The override style applied to the input is `{ color: colors.text, fontWeight: "600" }`.
  - `readOnly` propagates to `editable={false}` AND `readOnly`, with 0.6 opacity for the disabled treatment.
  - The Calories row is rendered with `readOnly` + a `helperText` of `Calculated from your ingredients · ${perServing.calories} kcal`, and pulls in lucide's `Calculator` icon.
  - The Calories row passes `override={undefined}` and never wires `setOverride("calories", …)`.
  - Step-4 subtitle includes "calories stay calculated".

### Web parity
The web equivalent (`src/app/components/RecipeUpload.tsx`, `mode="create"`) is a single-screen form, not a 5-step wizard — there is no editable Calories input on web. Fix is mobile-only by surface; the shared step-machine in `src/lib/recipes/createRecipeWizard.ts` is untouched (Calories override slot remains in `WizardMacroOverrides` for type-shape compatibility but is no longer reachable from the wizard UI).

## 2026-05-02 — Stimulant bump centralisation + net-carbs lens focus refresh

### Today (caffeine + alcohol chips)
- **`bumpStimulantsForLoggedMeal`** (`src/lib/nutrition/bumpStimulantsForLoggedMeal.ts`) — shared helper that any meal-log commit path can call to bump the daily caffeine + alcohol totals on `profiles.extra_caffeine_by_day` / `extra_alcohol_g_by_day`. Reads from `meal.micros` first, falls back to top-level `caffeineMg` / `alcoholG` for legacy / synthetic shapes. Bulk variant sums across an array and fires one supabase round-trip.
- **`insertClonedRowsIntoDay`** (mobile) — now bumps the target day's stimulant totals on duplicate-day / copy-meal-to-range. Pre-fix the cloned meal carried `micros.caffeineMg` forward via `cloneMealWithoutId` but `profiles.extra_caffeine_by_day` was never updated for the target day. Closes a parity gap with web's `addLoggedMealsForDate`.
- **`commitAiLoggedItems`** (web + mobile) — forwards optional `caffeineMg` / `alcoholG` from `AiLoggedItem` into the meal's `micros` map so future API revisions that resolve "cortado" → 95 mg caffeine flow through the existing commit path without further code changes. Per CLAUDE.md "no invented values" rule, the AI pipeline must source these deterministically — this PR adds the plumbing only.
- **`logHistoryItemToSlot` / `handleFoodSearchSelect` / `logPlannedMealWithPortion`** (mobile) and **`useNutritionJournalState`** (web) — refactored to call the shared helper. Same behaviour, one source of truth for the "skip on 0 / non-finite, sum + round on bulk" rule.

### Settings → "Show net carbs" toggle
- **Mobile lens flag refresh on focus** — pre-fix, `(tabs)/index.tsx`, `app/recipe/[id].tsx`, and `app/targets.tsx` each loaded `net_carbs_lens_enabled` once on `userId` change and never refreshed. Toggling "Show net carbs" in Settings persisted correctly but the consumers stayed frozen on the launch-time value until cold start. Now the flag is folded into each screen's existing focus refresh path:
  - Today: included in `loadProfileTargets`'s select.
  - /targets + Recipe Detail: small `useFocusEffect` re-reads the column on screen focus.
- Web is unchanged — `AppDataContext.setNetCarbsLensEnabled` already broadcasts to every consumer.

### Tests
- New `tests/unit/bumpStimulantsForLoggedMeal.test.ts` (17 tests) — covers single + bulk paths, missing / non-finite / negative inputs, integer caffeine + 1dp alcohol rounding.
- New `tests/unit/bumpStimulantsParity.test.ts` (8 tests) — parity pin keeping web + mobile aligned on the helper, plus per-path assertions for the AI commit + clone-rows fixes.
- `tests/unit/netCarbsLensRoundTrip.test.ts` — extended with three pins for the mobile focus-refresh fix (Today, /targets, Recipe Detail).

### Decision
- `docs/decisions/2026-05-02-stimulant-bump-helper-and-net-carbs-focus-refresh.md`.
## 2026-05-02 — Why-this-number panel: correct goal label + specific calibrating ask

User report (TestFlight, 2026-05-02):
- "this is wildly incorrect"
- "I'm not maintaining" — panel showed `Goal: Maintain` for a Lose user
- "40 days of logging but still calibrating" — panel said
  `calibrating — keep logging` with no hint that **weight** logs were
  the missing input.

### Helper (`src/lib/nutrition/whyThisNumber.ts`)
- **`paceKgPerWeek` is now `number | null`.** `null` means the user
  hasn't picked a `plan_pace` preset yet — distinct from explicit
  `Maintain` (=0). The renderer surfaces null as **"Goal not set"**
  rather than mislabelling the user as maintaining.
- **`paceKgPerWeekFromPreset(preset, "lose"|"gain")`** now returns
  `null` for unknown / null presets (was `0`). This was the upstream
  source of the "Goal: Maintain" mislabel — both web + mobile callers
  pass through this helper and were collapsing every unset preset into
  the maintain branch.
- **New optional inputs `mealLogDays` / `weightLogCount`.** When TDEE
  is null and either is supplied, the helper builds a SPECIFIC ask
  ("Log your weight 3+ times for an accurate maintenance estimate.",
  "Keep logging meals — we'll calibrate after 7 days.") instead of the
  generic "calibrating — keep logging" tail. Both can be supplied; the
  copy lists each missing gate. The ask also lifts into the `summary`
  sentence so screen readers + the bottom-sheet subhead announce it.
- **Result row no longer says "no deficit (maintaining)" when goal is
  unknown.** Renders `—` instead of lying about a deficit when both
  TDEE and pace are missing.

### Mobile sheet (`apps/mobile/components/today/WhyThisNumberSheet.tsx`)
- Renders `result.calibratingAsk` as a compact tertiary line under the
  headline when present (replaces the `Early estimate` qualifier in the
  no-TDEE branch). Carries the `why-this-number-calibrating-ask`
  testID for screen-reader and test verification.
- Caller (`apps/mobile/app/(tabs)/index.tsx`) now passes
  `mealLogDays = count of byDay entries with ≥1 meal` and
  `weightLogCount = Object.keys(profileWeightKgByDay).length`.

### Web dialog (`src/app/components/suppr/why-this-number-dialog.tsx`)
- Mirrors the mobile change: same `data-testid` on the ask paragraph,
  same conditional ordering. Caller (`NutritionTracker.tsx`) wires
  `mealLogDays = loggedDays.size` and
  `weightLogCount = Object.keys(profileWeightKgByDay).length`.

### Tests
- `tests/unit/whyThisNumber.test.ts` (shared) — pins the new null-pace
  → "Goal not set" branch, the spec fixture
  (`weekly_pace_kg=-0.5, meal_log_days=40, weight_logs=0`), and the
  three calibrating-ask permutations (only weight short, only meals
  short, both short, both satisfied). Pins that the ask is lifted into
  `summary` for accessibility.
- `tests/unit/whyThisNumberDialog.test.tsx` (web) +
  `apps/mobile/tests/unit/whyThisNumberSheet.test.tsx` (mobile) — pin
  that `Goal not set` and the specific weight-logging ask both render.

## 2026-05-02 — F-72: recipe save crash on non-integer macros

### Recipes (create + import)
- **Schema** (migration `20260508100000_recipes_macros_numeric.sql`) — widens `recipes.{calories,protein,carbs,fat}` and `recipe_ingredients.{calories,protein,carbs,fat}` from `INTEGER` to `NUMERIC(10, 2)`. Fixes `invalid input syntax for type integer: "2.3"` on save when fractional per-serving macros (or a typed override like `fat: 2.3`) hit the columns.
- **Client rounding** — `roundMacro` (1 dp) and `roundCalories` (whole kcal) helpers exported from `src/lib/recipes/createRecipeWizard.ts`. Both the mobile wizard (`apps/mobile/components/recipe/CreateRecipeWizard.tsx`) and the web upload form (`src/app/components/RecipeUpload.tsx`) round at the recipes / recipe_ingredients insert boundary. Defensive against future code paths that bypass `computePerServing` and aligned with the seeded-recipes backfill rounding.
- **Override hardening** — `computePerServing` now rounds user-typed overrides too (an over-precise input like `2.345` is collapsed to `2.3`).

### Web parity
- `src/app/components/RecipeUpload.tsx` imports the same helpers and applies them at both insert sites (per-recipe row + per-ingredient rows).

### Tests
- New `tests/unit/recipesMacrosNumericMigration.test.ts` pins the migration shape (8 columns altered, USING clause, PostgREST NOTIFY, CLAUDE.md apply-path note).
- `apps/mobile/tests/unit/createRecipeWizard.test.ts` extended with rounding-helper unit tests + integration-shape pin (recipe payload with `fat: 2.3` survives the round → insert pipeline) + structural pins on the wizard save handler.
- `apps/mobile/tests/unit/createRecipeNormalisationParity.test.ts` extended with web parity pins (RecipeUpload imports the helpers + uses them on both insert sites).

### Decision
- `docs/decisions/2026-05-02-recipe-macros-numeric.md`.

## 2026-05-02 — 30-day logging milestone moment

### Today
- **`Milestone30DayModal`** (`apps/mobile/components/today/Milestone30DayModal.tsx`) — Lifesum/MacroFactor-style trust moment that fires once when the user crosses 30 *distinct* logged days (gaps don't cost the badge). Surfaces avg daily kcal, top 3 most-logged foods, longest streak, and total weight delta first→last (when ≥2 weigh-ins). Single CTA: "Keep going". No paywall, no upsell.
- **Gate** (`src/lib/nutrition/milestone30Day.ts`) — once-and-done via `profiles.milestone_30_shown_at`. Pure module re-exported from `apps/mobile/lib/milestone30Day.ts` so web + mobile share the gate exactly. Top-foods list deterministic (count desc, then alphabetical tie-break).
- **Persistence** (migration `20260507100000_milestone_state.sql`) — adds nullable `profiles.milestone_30_shown_at`.

### Analytics
- New events: `milestone_30_shown`, `milestone_30_dismissed`. Shown event payload: `{ daysLogged, longestStreak, topFoodCount, platform }`.

## 2026-05-01 — Today week chart: target rule + animated entrance + tap-scrubber (MacroFactor-tier)

### Today (week mode)
- **Top-only rounded bars** (radius 6) — bars now read as bars-from-the-baseline rather than floating pills.
- **Horizontal dashed target rule** at the calorie-target y-position so over/under is readable at a glance. Hidden when the target is invalid (e.g. 0 kcal — would render as the baseline and read as noise).
- **Animated bar entrance** via Reanimated's `withTiming` on mount / mode-change, with a 40ms-per-bar stagger so the chart paints in left-to-right. Skipped when the user has Reduce Motion on.
- **Tap-scrubber tooltip** — tapping a bar opens a floating card with day name, kcal logged, kcal target, and a signed delta ("400 kcal over" / "20 kcal under" / "On target"). Tap the same bar again or anywhere outside the chart to dismiss. Long-press still routes to the day-detail view.
- **Above-chart summary line** "7-day avg: X kcal · closest to target: [day]". The closest-to-target day matches the project's "Best Day" direction (per `project_progress_direction` memory, 2026-04-30).
- Closes the ui-critic finding #5 (P1) on Today's week chart.

### Web parity
- `src/app/components/suppr/today-week-view.tsx` ships the matching upgrades using CSS height transitions (no Reanimated dependency on web). Same target rule, same scrubber, same closest-to-target summary line.

## 2026-05-01 — `SlotColors` token (resolve magenta=fat=snack collision)

ui-critic P2 #10. Snacks meal-slot tint previously borrowed `MacroColors.fat` (magenta `#e04888`), colliding 1:1 with the Fat macro tile on Today. Same hue, two unrelated meanings.

- New `SlotColors` export in `apps/mobile/constants/theme.ts` (roles: breakfast / lunch / dinner / snack). Snack is cyan `#06b6d4` — distinct from `MacroColors.fat`.
- `TodayMealsSection.tsx` and `app/(tabs)/planner.tsx` swap `MacroColors.fat` for `SlotColors.snack` in slot-color contexts. Macro tokens stay reserved for the Macro tile row.
- Web parity: matching `--slot-{breakfast,lunch,dinner,snack}` (+ `-soft`) tokens in `src/styles/theme.css`, four `slot-*` tones added to `IconBox`, web `today-meals-section.tsx` Snacks slot uses `tone: "slot-snack"`.
- Pinned by `tests/unit/slotColorTokensParity.test.ts` (12 tests, source-grep + token-export invariants) and `tests/unit/todayMealsSectionSlotColors.test.tsx` (3 render tests, 4 canonical slot tints render and the magenta hex is absent from any wrapper bg).
- Decision: `docs/decisions/2026-05-01-slot-colors-token-fix-magenta-collision.md`. Doc: `docs/ux/brand-tokens.md` (new "Meal-slot colours" section).

## 2026-05-01 — Today: first-meal empty-state CTA (journey-architect P1)

### Today
- **First-meal empty-state card** on Today (`apps/mobile/components/today/TodayFirstMealEmptyState.tsx`). Renders only when the user has logged 0 meals today AND has zero journal history at all. Headline "Ready to log your first meal?" + a single primary CTA "Log a meal" that opens the unified `LogSheet` (same surface as the centred raised tab-bar plus button). Closes the journey-architect P1 finding "Empty states are silent. No journey has an empty state with a clear 'do this next' action."
- **IG/TT recipe-paste tip line** for brand-new accounts only (`auth.users.created_at < 24h ago`). Single dismissable line, persisted via AsyncStorage under `suppr.first-meal-tip-dismissed.v1`. Returning users (account ≥ 24h) never see the tip.
- **Analytics**: existing `empty_state_cta_clicked` event fires on CTA tap with `surface: "today"` so the funnel matches other empty-state surfaces.

### Web parity
- `src/app/components/suppr/today-first-meal-empty-state.tsx` ships the matching surface inside `NutritionTracker.tsx`. Same gate (today selected + zero today + zero history), same brand-new check (< 24h), same tip + localStorage key.

## 2026-05-01 — LogSheet: 3-tab discoverability (journey-architect P1)

### LogSheet
- **Saved-meal dot indicator** on the Saved tab in the LogSheet's Recent / Library / Saved toggle row. Renders a 6×6 primary-blue dot when the user has 3+ saved meals so first-time openers learn the tab exists. Closes the journey-architect P1 finding "Log lunch via saved meal: 5 taps. At target but requires the user to know the toggle exists."
- **Equal-weight tab pills** confirmed (all pills share `flex: 1` + identical typography). Tests pin both invariants so future refactors don't silently regress: `apps/mobile/tests/unit/logSheetPhase3.test.tsx` + `tests/unit/logSheetPhase3.test.tsx` both ship 4 new pinning tests.
- **Accessible saved-count label** on the Saved pill when the dot is showing — screen readers announce "Saved meals — N saved" so the dot's signal is not visual-only.

### Web parity
- `src/app/components/suppr/log-sheet.tsx` ships the matching dot + accessible label inside the Recent / Library / Saved toggle row.

## 2026-05-01 — LogSheet Library tab (one-tap log from saved recipes)

### Today screen / LogSheet
- **Library tab** added to the LogSheet browse strip (between Recent and Saved meals). Surfaces the user's saved recipes inline so logging from the saved set no longer routes through Recipes → Library → Detail → Log. Sourced from TestFlight Build 40 feedback `AECfotBlQgwfgxYHr4dDaM8` ("No way to add recipes saved to library from here") + sibling reports.
- Each Library row shows a thumbnail, title, kcal-per-portion, and a meal-type pill (Breakfast / Lunch / Dinner / Snacks) so the user knows which slot a one-tap log will land in.
- Tapping a row routes through `logPlannedMealWithPortion` so the macro-coercion guard (P0-3 / T4) fires identically to the Recipe → Add to today path — recipes with kcal but no ingredient-resolved P/C/F surface the Verify prompt rather than persisting estimates.
- Empty state renders friendly copy ("Save recipes from the Recipes tab to see them here. We'll show your most-cooked recipes first.") plus a "Browse recipes" CTA that routes to the in-app Library tab.
- Browse-tab order is Recent / Library / Saved meals — Recent stays first to preserve the eat-again default; Library sits next so the saved-recipe path is discoverable.
- Tab bar adapts: hidden when only one source is wired; renders 2-up or 3-up depending on which props the host passes.

### Shared
- **`journalSlotFromMealTypes` helper** lives in `src/lib/nutrition/recipeJournalSlot.ts` (already extracted in PR #16). The LogSheet Library tab pick handler (mobile + web) imports the same function so all surfaces share one slot-resolution rule.

### Web parity
- Same Library tab on web (`src/app/components/suppr/log-sheet.tsx` + wired in `src/app/components/NutritionTracker.tsx`). Pick handler routes through `fetchPlannedMealMicros` for the same macro-coercion guard.

## 2026-05-01 — Cook handsfree v1 shell shipped dark behind a feature flag

### Cook
- **`COOK_HANDSFREE_FEATURE_ENABLED` feature flag** (`apps/mobile/lib/cookHandsfree.ts`) gates whether the in-cook header mic toggle renders at all. Defaults to **OFF**.
- The v1 shell ships dark because the audio listener is queued for v2 (see `docs/decisions/2026-05-01-cook-voice-handsfree.md`). Shipping the toggle live would let users tap it, see no microphone behaviour, and conclude the app is broken (journey-architect P1 friction risk).
- Flag is wired to `EXPO_PUBLIC_COOK_HANDSFREE_ENABLED=true`; flipping it requires a JS reload (kill-switch, not a per-user toggle). When v2 ships the listener, flip the default to `true` and remove the guard at the same commit.
- Header layout: a same-size invisible spacer renders when the flag is off so the centered step counter stays visually centred either way.
- The AsyncStorage hydration effect short-circuits when the flag is off — no unused storage round-trip on cook-mode mount.
- Lock-in test: `apps/mobile/tests/unit/cookHandsfreeFeatureFlag.test.tsx`.

## 2026-05-01 — Onboarding: restore data-bridges step

### Onboarding (re-introduces a data-bridge path; mobile + web parity)
- **New `data-bridges` step** at position 13 (after Reveal) bundling four bridge cards: Manual targets (paste-in kcal/P/C/F), Apple Health (HealthKit + first sync), Notifications, Recipe URL. Each card is independently skippable; a "Maybe later" affordance lets the user advance the empty path. Decision doc: `docs/decisions/2026-05-01-onboarding-data-bridges.md`.
- **Manual-target override** — when all four manual fields are set + finite + > 0, the new `effectiveTargetsForPersist()` helper synthesises a `V2Targets` (with 14g/1000kcal fiber heuristic) and writes it to `profiles` instead of the BMR-computed values. Partial overrides fall through to computed (half a target is worse than none). The override path also works on the `weightSkipped` branch — if the user knows their numbers, scale interaction isn't required.
- **Apple Health (iOS-only)** — `requestHealthPermissions` → `syncHealthData(userId)` on grant; opens iOS Settings via `Linking.openURL("app-settings:")` on deny. Per `project_ios_only_no_android.md`, web omits this card (intentional parity carve-out).
- **STEP_IDS** — 12 → 13. The displayed step counter still tops out at 12 because Reveal remains the aha; `data-bridges` is purely additive.
- **Analytics** — two new events registered: `onboarding_data_bridge_chosen { option }` and `onboarding_data_bridge_skipped { reason }`. `onboarding_completed` payload extends with `data_bridge_chosen` (LAST card actioned) and `manual_targets_set`.

### Tests
- `tests/unit/onboardingState.test.ts` — extended for 13 steps + new `data-bridges` `canAdvance` cases.
- `tests/unit/onboardingDataBridgesPersist.test.ts` (NEW, 13 cases) — `effectiveTargetsForPersist` precedence + manual-override branch of `buildProfileUpsertRow`.
- `tests/unit/onboardingDataBridgesWeb.test.tsx` (NEW, 8 cases) — manual entry / partial entry / skip behaviour on web.
- `apps/mobile/tests/unit/onboardingDataBridges.test.tsx` (NEW, 5 cases) — manual entry / skip behaviour on mobile.

## 2026-05-01 — Photo-log re-architected: itemized breakdown with kcal ranges

The previous photo-log pipeline blanket-failed (502 `verify_failed`)
the moment any single item couldn't be matched against an external
food database — which is most of the time on a real plate (the
matchers are tuned for clean recipe ingredient strings, not vision
output like "salami", "olives", "half egg"). The mobile sheet then
showed a generic "Couldn't analyse this food" alert and the user got
nothing, even when the model had correctly identified 8 of 10 items.

Rewritten as a single GPT-4o vision call returning a ChatGPT-grade
itemized breakdown:

- Items grouped by macro role ("Bread + dips", "Protein + fats",
  "Extras", "Drinks", "Sweets", or a custom group like "Pasta + sauce"
  when the plate calls for it).
- Per-item kcal RANGES (`~120–150 kcal`), not point estimates — honest
  about vision uncertainty.
- Verbal portion hints in plain language ("~40-50g", "1 piece").
- Optional add-on chips for things NOT in the photo that commonly go
  with what IS visible (a glass of wine with charcuterie, a bun for a
  burger). Tap to add — chip moves into the items list and the plate
  total updates.
- Plate total banner with the same range format.
- Free-text caveats from the model rendered italicised below the items
  ("dressing not visible — likely +30-50 kcal").
- Never blanket-fails on partial / low-confidence items. Low-confidence
  rows are flagged amber but stay savable.
- "Save to today" projects each ranged item to the journal's existing
  `AiLoggedItem` shape: calories collapse to the range MIDPOINT for the
  `meal_logs.calories` column; the full range is preserved on
  `AiLoggedItem.range` for uncertainty-aware analytics.

The optional per-item "Verify with database" affordance routes a
single ingredient to `/api/nutrition/verify-recipe` to swap that one
row from AI-estimated range to a USDA / OFF / FatSecret single-number
match — preserved for users who want a verified row.

Web dialog (`src/app/components/suppr/photo-log-dialog.tsx`) ships the
identical grouped layout — same response shape, same en-dash range
format, same add-on chips, same "Save to today" CTA copy. Only styling
diverges: sonner toast on web vs AsyncStorage + ToastAndroid +
Alert.alert on mobile (existing platform-native pattern).

Two new analytics events: `ai_photo_log_addon_added` and
`ai_photo_log_item_verified`. Existing `ai_photo_log_started`,
`_committed`, `_paywalled`, and `photo_log_correction_persisted`
unchanged.

See `docs/decisions/2026-05-01-photo-log-rangefirst.md` for the full
rationale, prompt strategy, and target output (Grace's screenshot bar).

## 2026-05-01 — Build 41 P0 batch (TestFlight Build 40 feedback)

Four P0 fixes consolidated for TestFlight Build 41. All sourced from
TestFlight feedback IDs filed during a single Build 40 session.

### Calorie ring — solid green at-or-above target
TestFlight `AEvjNTAVsipFKDysDkJD2g4`: "Why is the ring now gradient even
when the user has logged instead of green?". The post-59cc821 brand
gradient ran across the whole consumed-vs-target range, so users never
saw the "you're done" success signal once they hit their target.

Build 41 fix: keep the gradient for the in-progress arc
(`consumed < goal`), switch to solid `Accent.success` once
`consumed >= goal`. Going over no longer flips the ring to destructive
red — going over a daily calorie target is normal tracking, not an
error state. Centre text colour still flips to warning amber when
the user is over and viewing in `remaining` displayMode.
Mirrored on web via `src/app/components/suppr/daily-ring.tsx`.

### Tracking-extras quick-add chips persist again
TestFlight `AEsaeOW2Qw-BQa29teBp-Ns`: "Adding alcohol or coffee still
not impacting these numbers." The previous (round 3) fix relied on
capturing the computed `next` map inside a `setState((prev) => ...)`
updater and reading `persisted` on the next line. React 18 invokes
functional updaters lazily during the next commit, so `persisted` was
always `null` when the persist branch checked it. The supabase write
therefore never fired, and the Build 40 server row stayed at zero —
on next focus the local state hydrated from the (still-zero) server
and the count appeared to "reset".

Build 41 fix: compute `next` synchronously from the closure-captured
map, persist with that value directly, use a non-functional setState
call. Same pattern applied to `addCaffeineMg`, `addAlcoholG`,
`addWaterMl`, and `resetHydrationStimulantsForDay`. Web's
`addCaffeineMgForSelectedDay` was always correct (persists inside the
updater) so no web change was needed.

### Recipe → Log honours `recipe.meal_type` first, time-of-day second
TestFlight `AB1PYpfPjbd9li7jtnlAsIE`: "Doesn't give me an option of
which meal to log this for and it ended up logging it as lunch.
Also this was a breakfast recipe and I marked it as such when I
imported it." The mobile recipe Log button used a helper that
hard-fell-back to "Lunch" when meal_type was null/unmatched —
explicitly tagged recipes already worked, but a recipe imported
without a meal_type tag and logged at 7pm landed in Lunch.

Build 41 fix: extracted `journalSlotFromMealTypes` to
`src/lib/nutrition/recipeJournalSlot.ts` and added a
`fallbackSlotFromTimeOfDay` ladder (Breakfast < 11, Lunch < 15,
Snacks < 17, Dinner). Priority is now: explicit meal_type → tag
match → time-of-day fallback → normaliseMealSlot last-chance →
time-of-day fallback. Web's CookMode (`src/app/components/CookMode.tsx`)
now imports the same shared helper so both platforms agree on which
slot a given recipe + clock resolve to.

A meal-slot picker (Breakfast / Lunch / Dinner / Snack) is the better
long-term answer per the user's request, but the cheapest correct fix
for Build 41 is honour the recipe's tag + time-of-day fallback.

### FatSecret in mobile food search (regression pin only)
TestFlight `AKhE2_le-T2ml0cjmysFB1w`: "Still no fat secret option
showing for big mac." The Lane-A wire-up (PR #11, commit 8889411,
2026-04-30) added `searchFatSecret`, `getFatSecretFood`, and merged
FatSecret into `searchFoods`'s parallel fan-out before Build 40 was
cut. Build 40 must have been cut before that PR landed. No code
change required for Build 41 — the wiring is already in `verifyRecipe.ts`
and pinned by `apps/mobile/tests/unit/foodSearchFatSecretMerge.test.ts`.

### Tests
- `tests/unit/recipeJournalSlot.test.ts` — 12 tests covering meal_type
  priority, time-of-day fallback, last-chance normalise.
- `tests/unit/calorieRingSolidGreenAtTarget.test.ts` — 6 source-pin
  tests across mobile + web ring stroke logic.
- `apps/mobile/tests/unit/trackingExtrasPersist.test.ts` — 12 source-
  pin tests across the four quick-add handlers, locking in the
  direct-capture pattern.

## 2026-04-30 — EAS Update (OTA JS pushes)

### Infra
- **`expo-updates`** installed (`~29.0.17`, SDK-aligned). Wires the
  iOS binary up to receive over-the-air JS bundle updates.
- **`app.json`** now declares `expo.runtimeVersion.policy = "appVersion"`,
  `expo.updates.url` (EAS Update endpoint for the existing project ID),
  `expo.updates.fallbackToCacheTimeout = 0`, and
  `expo.updates.checkAutomatically = "ON_LOAD"`. The runtime-version
  policy means OTA updates only ship to binaries with a matching
  `expo.version` — native or `app.json`-config changes still require a
  fresh TestFlight build.
- **`eas.json`** build profiles now declare matching `channel` values
  (`development`, `preview`, `production`). Channels are how EAS Update
  routes a publish to the right binaries — without them, OTA cannot land.

### Why
JS-only fixes used to require a 15-25 minute TestFlight build cycle
before they reached the test device. With OTA wired, the publish path
is `cd apps/mobile && eas update --branch production --message "..."`
and the new bundle lands on devices in ~30s on the next launch.
Workflow + safety rules at
`docs/operations/eas-update-workflow.md`. Decision record at
`docs/decisions/2026-04-30-eas-update-ota.md`.

## 2026-04-20 — RevenueCat Customer Center + v2 API key support

### RevenueCat
- **`react-native-purchases-ui`** added at matching major (`^9.15.2`). Pulls in RC's native Customer Center + Paywall view components. Does not touch the existing custom paywall at `apps/mobile/app/paywall.tsx` — that surface remains the canonical sell per `ui-product-designer` round-1 spec.
- **Unified v2 API key fallback** in `lib/purchases.ts`. Platform-specific keys (`EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `…_GOOGLE_KEY`) still win in prod; a new `EXPO_PUBLIC_REVENUECAT_API_KEY` works as a single-var fallback on both platforms (intended for dev/sandbox with RC v2 `test_…` keys).
- **Customer Center entry point** on the settings screen. New "Manage subscription" row on the Plan card, shown only when `userTier !== "free"`. Calls `RevenueCatUI.presentCustomerCenter()` via a dynamic import in `lib/purchases.ts`; falls back to `apps.apple.com/account/subscriptions` (iOS) / `play.google.com/store/account/subscriptions` (Android) if the native UI module is unavailable (Expo Go, web, or missing API key).

### Decisions captured in this change
- RC hosted Paywall was **not** adopted — the custom paywall has a specced pricing-v1 trial-on-Pro-annual rule and analytics funnel F2 hooks that the hosted template would regress. Routed to `monetisation-architect` + `product-lead` for future reconsideration.
- Entitlement IDs `pro` and `base` remain canonical — user request to rename to "Suppr Pro" was declined here because renaming the dashboard entitlement without migration would de-entitle every live subscriber.

## 2026-04-12 — Onboarding, Nutrition Accuracy, Search Improvements

### Onboarding Flow (NEW)
- **14-step guided onboarding** (`/onboarding`) — goal selection, body metrics, activity level, plan pace, calorie budget, nutrition strategy, calorie schedule, intermittent fasting, motivation/mindset questions, weight projection, summary
- **TDEE calculator** (`lib/tdee.ts`) — Mifflin-St Jeor equation with activity multiplier, safe 1200 cal floor, macro calculation per strategy (Balanced / High Protein / High Satisfaction / Low Carb)
- **Plan pace selection** — Relaxed (0.25 kg/wk) / Steady (0.5 kg/wk) / Accelerated (0.75 kg/wk) / Vigorous (1 kg/wk) with calculated calories and weeks-to-goal
- **Skip button** on every onboarding screen — marks onboarding complete, goes straight to app
- **Projection screen** — shows goal date with weight progress bar and summary of choices

### Authentication
- **Apple Sign-In** on login screen (iOS) via `expo-apple-authentication` + `signInWithIdToken`
- Login checks `profiles.onboarding_completed` to route new users to onboarding

### Subscription & Notifications
- **Paywall screen** (`/paywall`) — free trial flow with timeline (Program Created → Build Momentum → See Progress → Trial Ends), "Start Free Trial" + "Continue for free" buttons. Placeholder for RevenueCat/StoreKit integration.
- **Notifications prompt** (`/notifications-prompt`) — requests push notification permission with "Turn on" / "No thanks" options

### Nutrition Lookup Accuracy
- **Preserve nutrition-critical words** — "cooked", "raw", "dried", "frozen", "canned" are no longer stripped from USDA search queries (raw rice = 365 kcal/100g vs cooked = 130)
- **50+ UK/AU→USDA name aliases** — courgette→zucchini, minced beef→ground beef, prawns→shrimp, double cream→heavy cream, coriander→cilantro, butter beans→lima beans, aubergine→eggplant, etc.
- **Search Foundation/SR Legacy/Survey first** — generic whole foods before branded products, with USDA dataType API filter
- **Smart confidence scoring** — neutral USDA descriptors (raw, peeled, boneless) don't penalise; dish words (bread, cake, fried, oil) heavily penalise; prevents "Bread, zucchini" matching "zucchini"
- **Open Food Facts added to import pipeline** — searches between USDA and FatSecret for worldwide food coverage (UK/EU/global products)
- **Better small-item weights** — anchovy (5g), olive (5g), prawn (15g), mushroom (15g), deli meat slices (~10g)
- **Food-specific USDA portion weights** — uses USDA's portion data for the matched food instead of generic defaults
- **Error resilience** — USDA/FatSecret failures now fall through to estimation fallback instead of killing the entire pipeline

### Search UI
- **Unified search results** — single ranked list (no more "Products & Brands" / "Whole Foods (USDA)" section headers)
- **Progressive loading** — whichever source responds first shows results immediately
- **15s/12s timeouts** — USDA and OFF searches timeout gracefully on slow networks
- **MFP-style serving picker** — serving size (g, oz, tbsp, tsp, cup, ml + USDA portions) + number of servings input with decimal/fraction support

### Fibre/Micros
- `fiber_g`, `sugar_g`, `sodium_mg` columns added to `recipes` table and now saved during import and verification
- Recipe detail screen queries and displays fibre ring in Macronutrients card
- Verify screen totals include fibre/sugar/sodium
- Ingredient macros compute from actual ingredients (not stale recipe-level values)

### Import Pipeline
- **Amount/unit preserved** — parsed amounts and units from ingredient lines are now saved to the database (previously always null)
- **"heaped tbsp" parsing** — modifier words (heaped, level, rounded) before units are handled correctly
- **siteNutrition fallback** — if per-ingredient verification fails, recipe-level macros are populated from the site's JSON-LD nutrition data

### Shopping List
- **Generate Shopping List** button on planner — fetches ingredients from all planned recipes, merges duplicates, multiplies by recipe count, categorises (Meat & Fish, Dairy & Eggs, Carbs & Grains, Fruit & Veg, Pantry)
- Falls back to matching recipes by title when `recipeId` is null (older plans)

### Recipe Detail
- **Macros computed from ingredients** — calorie hero and macro rings always match the ingredient list (not stale recipe-level values)
- **Bookmark save button** — replaced star icon with bookmark matching library tab
- **YouTube thumbnail cleanup** — swaps hqdefault for maxresdefault (removes baked-in play button)
- **Save to Library works** — toggleSave correctly inserts/deletes from saves table

### Other
- **Nutrition sources page** (`/nutrition-sources`) — explains USDA, Open Food Facts, FatSecret with links, accessible from More tab
- **Ingredient name persisted** — when selecting a food from search, the matched name is saved (not the original raw ingredient text)

### Database Migrations
- `20260411180000_add_recipe_source_attribution.sql`
- `20260411200000_ensure_recipe_ingredients_micros.sql`
- `20260412100000_onboarding_profile_fields.sql` — adds `goal_weight_kg`, `plan_pace`, `nutrition_strategy`, `calorie_schedule`, `high_days`, `fasting_enabled`, `fasting_window`, `onboarding_completed`, `target_fiber`, `dob` to profiles; converts `weight_kg`/`height_cm` to numeric
