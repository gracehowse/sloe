# Progress + Burn detail + Weight tracker + Digest deep audit — 3 platforms

**Phase 6 comprehensive scope.** Mobile native, mobile-web, desktop-web.
**Source:** customer-lens, 2026-04-28.

---

## Top 5 most damaging issues

### 1. Calendar button silently dumps user into Weight Tracker — both platforms

**Where:**
- Mobile: `apps/mobile/app/(tabs)/progress.tsx:885-903` — `accessibilityLabel="Open calendar"` → `router.push("/weight-tracker")`
- Web: `src/app/components/ProgressDashboard.tsx:803-811` — `aria-label="Open calendar"` → `router.replace("/home?view=weight-tracker")`

**Mismatch:** Affordance lies. A11y label lies (announces "calendar" to VoiceOver, opens a weight editor). On top of that, the destination uses different range vocabulary than the screen the user just came from — `1W / 1M / 3M / 6M / 9M / 12M / All` vs `7d / 30d / 90d / All`. Comment at `progress.tsx:875` admits this is a temporary destination shipping since 2026-04-20.

**Severity:** P1 confusing + mislabelled. **P0 for VoiceOver users** (spoken label is wrong).

**Fix:** Either remove the button until a date-range modal lands, or stub it to a "Custom ranges coming soon" sheet and keep the existing 4-pill picker as the only date control.

---

### 2. Imperial users see "kg" leak through on Journey card

**Where:**
- `apps/mobile/app/(tabs)/progress.tsx:1188-1201` — Trend tile correctly uses `formatWeightForUnit({ kg, system: measurementSystem })` (respects imperial)
- `apps/mobile/app/(tabs)/progress.tsx:1918-1923` — Journey card hard-codes `${timeline.remainingKg} kg left to reach ${goalWeightKg} kg` and `~${Math.abs(timeline.weeklyRateKg)} kg/week`
- `apps/mobile/app/(tabs)/progress.tsx:1929-1947` — Start/Goal/Now bar labels also hard-coded `kg`
- `apps/mobile/app/(tabs)/progress.tsx:1955-1956` — Daily projection: `${dailyProjection.projectedWeightKg} kg`

**Mismatch:** Imperial user sees Trend "−1.4 lb", Weight Range "165.3 lb", but Journey says "2.3 kg left to reach 70 kg... Start: 75 kg / Goal: 70 kg / Now: 72.7 kg". Page is half-translated. Trust failure — user might think "kg" is the system-of-record and lb is a display conversion they can't trust.

**Severity:** P1 (wrong on every screen for every imperial user with goal weight set; trust concern).

**Fix:** Replace every `kg` literal in Journey card with `formatWeightForUnit({ kg, system: measurementSystem })`. Add a unit test asserting no Journey-card render path emits literal " kg" when `measurementSystem === "imperial"`.

---

### 3. Progress headline manufactures "Maintenance held steady this week" from hard-coded zeros

**Where:**
- `apps/mobile/app/(tabs)/progress.tsx:920-942` — passes `avgDailyIntake: 0` and `smoothedWeightChangeKgPerDay: 0` to `generateProgressCommentary`
- `src/app/components/ProgressDashboard.tsx:834-859` — same hard-coded zeros on web
- `src/lib/nutrition/progressCommentary.ts:78-115` — when `current.confidence === "high"` AND `loggingDays >= 14` AND no `prevWeekTdee`, returns `steady` copy: *"Maintenance held steady this week. Your estimate stayed at X kcal with high confidence — keep going."*

**Mismatch:** A 14-day-old user with high-confidence adaptive TDEE sees "Maintenance held steady this week" — but **there is no week-over-week comparison being made**. The `steady` branch is the literal fallback when `prev == null`. Comment in code (`progress.tsx:919`) acknowledges weekly TDEE history isn't yet persisted; commentary collapses to `steady`/`calibrating` for now. For a returning week-3 user this reads as a deliberate, validated claim. **It is not.**

**Severity:** **P0 — broken trust.** Page leads with a sentence the engine cannot honestly support.

**Fix:** Either (a) gate `<ProgressHeadline>` behind `prevWeekTdee != null` and render nothing / "we'll have your weekly story next Sunday" until weekly aggregate stream lands, or (b) change `steady` headline copy to read honestly — e.g. "Maintenance estimate: X kcal · We'll start showing your weekly trend after your next week of logging." Don't ship "Held steady this week" until the regression to last week's TDEE is real.

---

### 4. Range picker (7d/30d/90d/All) doesn't move 5 of 7 cards — silent decoy

**Where:**
- `apps/mobile/app/(tabs)/progress.tsx:944-994` — range picker
- `apps/mobile/app/(tabs)/progress.tsx:1293-1402` — Daily Calories chart uses `weekStats` (7-day), NOT `rangeKey`
- `apps/mobile/app/(tabs)/progress.tsx:1404-1441` — Macro Adherence card uses `weekStats` (7-day)
- `apps/mobile/app/(tabs)/progress.tsx:1564-1587` — Maintenance card "Weigh-ins X/7" + "Log days Y/21" hard-coded denominators
- `apps/mobile/app/(tabs)/progress.tsx:1842-1870` — Daily projection uses last 7 food days regardless of range
- `src/app/components/ProgressDashboard.tsx:359-382` — only weight chart and steps chart consume `rangeDays`; everything else uses `weekStatsBundle`

Comment at `progress.tsx:996-1003` admits: *"Below-the-fold cards currently still use their own scoped windows... the deeper card restructure is deferred."*

**Mismatch:** Tap "30d" → overline updates to "LAST 30 DAYS" but Daily Calories chart, Macro Adherence, Maintenance counters, Journey daily projection, Streak, Protein Hit, Trend tile (90-day hard-coded) are all unchanged. **Decoy interaction.**

**Severity:** P1 (confusing + numerically misleading; trust-adjacent — label doesn't match data).

**Fix:** Either (a) wire every card through `rangeKey` (large rework), or (b) shrink the range picker's scope honestly: rename to "Trend window" / move it inside the Weight + Calories cards it actually controls; leave the rest of the page alone. The overline should not say "LAST 90 DAYS" if streak underneath is from last 7.

---

### 5. Burn detail — invented dates + broken back nav + "Bonus so far" inflates by extrapolation

**Where:**
- `apps/mobile/app/burn-detail.tsx:128-135` — projects `restingBurn` linearly to 24h via `futureBurn`
- `apps/mobile/app/burn-detail.tsx:137-143` — `formatDateLabel` doesn't validate `dateParam`; `?date=banana` renders literally
- `apps/mobile/app/burn-detail.tsx:146-156` — back button is `router.back()` without `useSafeBack` fallback. Cold-launch via push → dead button.
- `apps/mobile/app/burn-detail.tsx:84-89` — empty profile state "No profile found. Complete onboarding…" with no recovery button
- `apps/mobile/app/burn-detail.tsx:215-220` — Steps row gated on `data.steps > 0`. HK denied or simulator zeros → row vanishes silently. No parity with Progress steps card's tri-state retry (added 2026-04-19 #10).
- **No web mirror exists.** Today's burn ring on web has nowhere to go.

**Mismatch:** "Bonus so far" includes a forward-extrapolated `futureBurn` calculated by linearly projecting morning resting BMR across the rest of the day. At 8am with 800 resting kcal logged, screen tells you you'll burn 2,400 today and the bonus reflects that, even though you might not move at all between 8am and bedtime. Label says "Bonus so far" but calculation is "Bonus by midnight if morning rate continues." **Invented bonus number.**

**Severity:** P1 for "Bonus so far" mislabel (trust); P2 for the others stacked.

**Fix:**
1. Rename `Bonus so far` → `Projected bonus` whenever `isProjected && futureBurn > 0`. Surface projection as separate row: *"Earned now: 120 · Projected by midnight: +330"*.
2. Validate `dateParam` against `/^\d{4}-\d{2}-\d{2}$/`, fallback `todayKey`.
3. Use `useSafeBack("/(tabs)")`.
4. Steps row should mirror Progress card's tri-state (pending/failed/success) with "Retry sync" affordance.
5. Build a web equivalent.

---

## Other findings (held out of top 5)

- **Maintenance "Weigh-ins X/7" denominator is fictitious** (`progress.tsx:1568-1583`) — denominators 7 and 21 picked from thin air. Day 3 user reads "you're behind" rather than "we need ~3 weeks". P2.
- **`router.navigate({_t: String(Date.now())})`** at `progress.tsx:1141, 1333` — cache-buster code smell signalling Today's focus-effect doesn't reliably re-load on date change. P3.
- **Weight-tracker pill vocab** (`1W/1M/3M/6M/9M/12M/All`) differs from Progress (`7d/30d/90d/All`) on adjacent reachable screens. P2.
- **`ProgressMetricDetail` shows raw 7-day streak** while Progress page now uses *protected* streak (`streakDays = protectedStreakInfo.streakLength`). Numbers don't reconcile across screens. P1 trust-adjacent.

---

## Trust concerns (ranked)

1. Progress headline manufacturing "held steady this week" from missing comparison (Top-3)
2. Burn detail "Bonus so far" extrapolating future burn under "so far" label (Top-5)
3. Range picker decoy — overline says LAST 30 DAYS, numbers from last 7 (Top-4)
4. Imperial users seeing "kg" on Journey card (Top-2)
5. Streak mismatch between Progress (protected) and breakdown sheet (raw)

---

## Web vs mobile divergences

- Calendar button: mobile → `/weight-tracker`; web → `/home?view=weight-tracker`. Same broken affordance, different routes.
- Burn-detail screen: **mobile-only**. No web equivalent.
- Web Phase 2 grid: 4 cards (Weight, Calories, Protein, TrendSummary). Mobile: 2 cards. Mobile's 2×2 stat tiles partially compensate but not 1:1 (Protein on web = avg/day with sparkline; mobile = hit-rate X/Y).
- Range vocabulary parity: Progress uses `7d/30d/90d/all` on both. Weight-tracker uses `1W/1M/3M/6M/9M/12M/All`.
- ProgressHeadline: identical hard-coded zeros bug on both platforms.

---

## Files referenced

- `apps/mobile/app/(tabs)/progress.tsx`
- `apps/mobile/app/burn-detail.tsx`
- `apps/mobile/app/weight-tracker.tsx`
- `apps/mobile/app/progress-metric.tsx`
- `apps/mobile/components/progress/WeightChart.tsx`
- `apps/mobile/components/today/ProgressHeadline.tsx`
- `src/app/components/ProgressDashboard.tsx`
- `src/lib/nutrition/progressCommentary.ts`
