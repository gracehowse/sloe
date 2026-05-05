# Numbers Audit — 2026-05-04

## Why this audit

Grace flagged: "a lot of numbers seem to be off, or not matching across pages. We need a full logic and visual review of ALL numbers (metabolism, TDEE, cals per day, streaks etc etc)."

This audit ran four specialist agents in parallel:
- **nutrition-engine** — math correctness (BMR/TDEE/macros/streaks/projections)
- **data-integrity** — cross-surface SSOT consistency
- **repo-auditor** — ground-truth code map (where do calcs live)
- **customer-lens** — what a real user sees and where numbers contradict

The four lenses were independent (no shared context) and converged on the same root causes — every P0 below was flagged by ≥2 agents. That convergence is the strongest signal that these are real bugs, not subjective design taste.

## Headline findings

The "lots of numbers off" symptom is **not** primarily a math bug. It's a **routing bug**: the same conceptual number is computed in 2-5 different places across web and mobile, with subtly different formulas, fallbacks, rounding, and staleness rules. Every divergence below renders as a tester-visible "this number doesn't match that number" pair.

Severity levels:
- **P0** — visible to user on the same screen / adjacent tabs, breaks trust
- **P1** — same number, different value across surfaces, user will spot it
- **P2** — same number, same value, different label or rounding
- **P3** — defense-in-depth or perf

## Master ranked list

### P0 — same screen / adjacent tabs

#### 1. Web Targets shows lagging `profile.weight_kg`; everywhere else uses `resolveLatestWeightKg`
- Mobile Targets/Progress + web Progress (inline) use the latest weigh-in from `weight_kg_by_day`
- Web Targets reads raw `profile.weight_kg` — stale when HealthKit writes only to the by-day map
- Repro: weigh in via mobile, then open `/account` → "Currently 55.3 kg" while web Progress says "55.2 kg"
- Source of the original audit-2026-05-04 #5 user-reported divergence
- Fix: `src/app/components/Targets.tsx:194-208,356` — import `resolveLatestWeightKg` from `src/lib/weightProjection.ts`
- Flagged by: data-integrity #1, customer-lens N2

#### 2. Web Progress goal-date headline uses prescriptive rate; everywhere else uses observed rate
- `ProgressDashboard.tsx:388-399` calls `weeksToGoal(currentKg, goalKg, planPace)` — uses constant `PACE_WEEKLY_KG[pace]` (e.g. "steady" = 0.5 kg/wk)
- All other surfaces (mobile Progress, both Targets, deeper-in-page web projection card on the SAME page at line 1730) use `calcGoalTimeline` which derives the rate from actual weigh-ins
- A user losing faster than prescribed sees an earlier ETA on mobile vs a later prescriptive one on web — for the same goal
- Two ETAs on the same web page if both render
- Fix: replace `weeksToGoal` call with `calcGoalTimeline`; reuse the timeline already computed below
- Flagged by: data-integrity #2

#### 3. Today calorie goal silently activity-adjusted vs Targets static
- Today ring goal = `targets.calories + dayActivityBudgetAddon(...)` (`apps/mobile/app/(tabs)/index.tsx:1885-1908`)
- Targets screen big number = `targets.calories` (raw, no addon)
- A user with `prefer_activity_adjusted_calories=true` and 8000 steps walked sees Today say "of 1,950 kcal" but Targets says "1,800 kcal"
- No breadcrumb on Targets explains the divergence
- Web has a SECONDARY bug: `NutritionTracker.tsx:1899` falls back `maintenance = profileMaintenanceTdee ?? baseCalorieTarget` — if a user has no adaptive TDEE, web treats their loss-target (1450) as maintenance, so bonus can never trigger. Mobile uses `maintenanceIntakeFromTargetCalories` which adds the goal adjustment back (1450+550=2000)
- Same day, **different effective calorie goal on web vs mobile**
- Fix: surface "(+150 from activity)" inline beside the Targets number when `prefer_activity_adjusted_calories=true`. Route web through shared `activityBudgetAddon` helper
- Flagged by: nutrition-engine Topic 6, customer-lens N1, data-integrity #7

### P1 — same number, different value across surfaces

#### 4. Streak count differs across surfaces (raw vs protected)
- Today / Progress / Recap render `protectedStreakLength` (with freezes applied)
- web Profile (`Profile.tsx:85`) + web ProgressMetricDetail (`:87`) + mobile progress-metric (`:152`) render `computeLoggingStreak` raw (no freezes)
- After a freeze auto-applies, Today shows "26-day streak", Profile shows "25-day streak" — same user, same moment
- Fix: route Profile + ProgressMetricDetail through `computeProtectedStreak` and pass the freeze ledger
- Flagged by: data-integrity #3, customer-lens N3

#### 5. Streak definition: "any meal" vs "≥1 calorie-bearing meal"
- StreakPip / Settings / Progress use `computeLoggingStreak` (any entry, including water-only days)
- 30-day milestone modal uses `countDistinctLoggedDays` (≥1 positive-calorie meal)
- Same user, same day, two different streak numbers
- Fix: unify on `≥1 positive-cal meal` (water-only is not "logging your food")
- Flagged by: nutrition-engine Topic 8

#### 6. Mobile macro fallback uses 30/40/30 P/C/F; web uses g/kg-of-bodyweight
- Web onboarding + reveal use `calculateMacros(calories, strategy, weightKg)` — protein at 1.6/2.2/1.8 g/kg depending on strategy
- Mobile fallback `calcTargetsFromStats` uses hardcoded 30/40/30 calorie share
- 70 kg female on `balanced` at 1,600 kcal: web → 112 g P, 280 g C, 44 g F. Mobile → 120 g P, 160 g C, 53 g F. **Material drift on a daily target**
- Mobile fallback only fires when DB targets are null (legacy users + brand-new accounts pre-save)
- Fix: delete mobile's macro split; route through `calculateMacros` with stored `nutritionStrategy`
- Flagged by: nutrition-engine Topic 5, data-integrity #10

#### 7. Web Targets ignores net-carbs lens entirely
- Mobile Targets fixed in audit 2026-04-30 #1
- Web Targets carb tile shows gross carbs target/value with `lensEnabled=true`
- Same lens setting → mobile shows "Net Carbs 75g", web shows "Carbs 91g"
- Fix: `Targets.tsx:147,217-253` — read `netCarbsLensEnabled`, swap label and current/target
- Flagged by: data-integrity #5

#### 8. Web Today carb-tile label drops to "Carbs" when fiber not yet logged
- `today-dashboard-macro-tiles.tsx:138-149`: target uses `netCarbsForRow(carbsTarget, fiberTarget, lensOn)` (net) but label uses `carbsLabel(fiberCurrent, lensOn)` — `fiberCurrent=0` with no meals → label drops to "Carbs"
- User sees "Carbs 0 / 75g" with target net but label gross
- Mobile fixed this on 2026-04-30
- Fix: `label: carbsLabel(fiberTarget, lensOn)` to mirror mobile
- Flagged by: data-integrity #4

#### 9. Weekly recap ignores per-day target snapshots; Progress uses them
- `weeklyRecap.ts:151-156` calls `buildWeekStats` without `dayTargetOverrides`
- Mobile + web Progress both fetch `daily_targets` snapshots
- User who edits target mid-week sees one "% adherence" on Progress (snapshot-based) and a different one on Recap (current-target-based) for the same week
- Fix: plumb `getDailyTargets` into `buildRecap`
- Flagged by: data-integrity #6, nutrition-engine Topic 9 implicit

#### 10. Macro Detail header "0g" pill renders while body says "Loading..."
- `apps/mobile/app/macro-detail.tsx:117`: `total = meals.reduce(...)` runs on initial empty array
- Header pill: `0g`, body: spinner
- Same screen, two different states for the same metric
- audit 2026-05-04 #16 still open
- Fix: gate the header pill on `loading === false`
- Flagged by: customer-lens N10

#### 11. TDEE / Maintenance / Maintenance TDEE / Estimated TDEE — four labels, one quantity
- Today Activity Bonus card popover: "Maintenance TDEE"
- Today Activity Bonus tile label: "Maintenance"
- Progress card title: "Maintenance" with pill "Adaptive / Formula estimate"
- Targets caption: "Estimated TDEE based on Mifflin-St Jeor"
- User can't tell if they're different things
- Fix: pick one label, enforce via parity test
- Flagged by: customer-lens N11

#### 12. `resolveMaintenance` vs `getEffectiveTDEE` — different staleness rules
- `resolveMaintenance`: rejects adaptive when >14 days stale, falls back to formula
- `getEffectiveTDEE`: keeps using stale adaptive without rejection
- Today's Maintenance tile uses `resolveMaintenance`; Progress uses `getEffectiveTDEE` in some paths
- Same profile, two different numbers
- Fix: unify on `resolveMaintenance` (more conservative)
- Flagged by: repo-auditor §6

#### 13. Activity-bonus inline functions: mobile vs web with different argument orders
- Mobile: `dayActivityBudgetAddon(prefer, _bonusOnly, activityByDay, basalByDay, maintenanceKcal, dk, workoutsByDay?)` — `apps/mobile/app/(tabs)/index.tsx:292-311`
- Web: `dayActivityBudgetAddonWeb(prefer, dk, maintenance, activityByDay, basalByDay, workoutsByDay)` — `src/app/components/NutritionTracker.tsx:203-219`
- Same algorithm, different signature, no parity test
- Fix: extract `src/lib/nutrition/activityBudgetAddon.ts` (single signature) used by both
- Flagged by: repo-auditor §2D, nutrition-engine Topic 6

#### 14. Coercion threshold 0.45 too lenient
- `coerceMacrosWhenCaloriesButNoGrams` allows recipes whose grams explain ≥45% of stated calories to pass uncoerced
- A recipe stated 500 kcal with grams summing to 230 kcal (46%) passes — journal writes macros that don't add up
- Violates "if uncertain, do not guess"
- Fix: raise threshold to 0.55
- Flagged by: nutrition-engine Topic 11

#### 15. Plan pace projection: two-point endpoint slope, not regression
- `weightProjection.ts:292-369`: `weeklyRateKg = round(((last_weight - first_weight) / day_span) * 7 * 10) / 10`
- Uses ONLY first and last weigh-in in the 28-day window — noise-sensitive
- A water-weight outlier on day 1 or day 28 distorts daysToGoal by months
- Plus `weeklyRateKg` rounded to 0.1 before downstream — 0.07 kg/wk reads as 0.1, overshoots ETA
- Fix: least-squares regression on smoothed weight series; round only at display
- Flagged by: nutrition-engine Topic 13

#### 16. `projectWeight` `targetCalories + 500` fallback assumes 500-kcal deficit
- When maintenance can't be resolved, falls back to `targetCalories + 500`
- A user on `relaxed` pace (275 kcal deficit) gets +500, overestimating TDEE by 225, mis-firing direction labels
- Fix: drop fallback; suppress projection when maintenance unresolved
- Flagged by: nutrition-engine Topic 13

### P2 — same value, different label/rounding/format

#### 17. TDEE caption rounding differs web vs mobile
- Mobile: rounds delta to nearest 50, drops below 50 → "550 kcal deficit"
- Web: rounds delta to integer, drops below 100 → "525 kcal deficit"
- Same data → different caption strings
- Fix: shared `deficitSurplusCaption` helper
- Flagged by: data-integrity #8

#### 18. Activity-level human label different word web vs mobile
- Mobile: light = "light activity", active = "active lifestyle", very_active = "very active lifestyle"
- Web: light = "lightly active", active = "very active", very_active = "athletic activity"
- Same `activity_level="active"` → mobile says "active lifestyle", web says "very active"
- Fix: centralise label set in `targetsView.ts`, consume from web
- Flagged by: data-integrity #9

#### 19. Goal-date format discontinuity at 365 days
- Within 365 days: "could reach by ≈ 14 July" (no year)
- Beyond 365 days: "≈ May 2027 · 1+ year out"
- A user 360 days out reads "10 May" — looks like THIS year (10 days away)
- Fix: always render year for projections >30 days
- Flagged by: customer-lens N6

#### 20. Adherence percent uses current target as denominator (not snapshot)
- `progressWeekReport.ts:138`: `avgMacro / currentTarget × 100`
- "Days hit protein" uses `dayTarget` (snapshot if present)
- Two adherence numbers side-by-side using different denominators
- Fix: when snapshots present, average per-day-against-per-day-target
- Flagged by: data-integrity #18

#### 21. Mobile Targets re-queries `meals` table; rest of mobile uses `nutritionByDay` cache
- `apps/mobile/app/targets.tsx:152-170`: separate Supabase query
- Today writes optimistic — Targets won't see it until remount
- Fix: inject `nutritionByDay` from shared context, or wire realtime
- Flagged by: data-integrity #11

#### 22. Mobile profile-edit doesn't recompute targets; web Settings does
- Web Settings: calls `recomputeTargetsForActivity` on activity-level change
- Mobile profile.tsx: persists raw fields; relies on next read to re-derive via 30/40/30 fallback
- Same activity-level edit → different persisted target on each platform
- Fix: mobile calls `recomputeTargetsForActivity` on save
- Flagged by: data-integrity #10

#### 23. `KCAL_PER_KG = 7700` declared 5 times across codebase
- `adaptiveTdee.ts`, `onboarding/targets.ts`, `whyThisNumber.ts`, `maintenanceChain.ts`, `weightProjection.ts`
- Comments acknowledge the duplication; tooling doesn't enforce
- Fix: `src/lib/nutrition/constants.ts` — single source
- Flagged by: repo-auditor §8.2

#### 24. `apps/mobile/lib/calcTargets.ts` duplicates `calculateTDEE`, `getEffectiveTDEE`, `ACTIVITY_MULT`
- Other shared modules use the shim pattern (re-export from `src/lib/`); this one doesn't
- Fix: convert to re-export shim
- Flagged by: repo-auditor §8.1

#### 25. Adaptive TDEE EMA seeds at raw first weight
- `emaSmooth` at `adaptiveTdee.ts:70`: `let ema = entries[0][1]`
- Asymmetric: first = raw, last = EMA-cooked. Slope biased.
- Fix: seed EMA at mean of first 3 datapoints, or use least-squares slope
- Flagged by: nutrition-engine Topic 3

#### 26. Sugar/Sodium reference values hardcoded WHO refs presented as personal targets
- "Sugar 0 / 50 g · ref 50 g" — same number twice in one tile
- Fix: explicit "WHO recommends" framing; remove redundant ref caption
- Flagged by: customer-lens N9

#### 27. iOS-only HealthKit; no steps→kcal fallback for iPhone-only users
- Users without Apple Watch get no `ActiveEnergyBurned` → no activity bonus
- App appears broken
- Fix: steps-based estimate (`~0.04 kcal/step × bw_kg/70`) with explicit "Estimated from steps" badge
- Flagged by: nutrition-engine Topic 12

#### 28. `dayActivityBudgetAddon` workouts-only fallback is dead code
- Comment says "fallback when no resting energy: logged workout calories"
- Both call sites omit `workoutsByDay` argument
- Users with manually-logged workouts but no HealthKit basal see no bonus
- Fix: pass `workoutsByDay` through OR remove the fallback
- Flagged by: nutrition-engine Topic 6

### P3 — defense-in-depth

#### 29. Web Today calorie sum unclamped; mobile clamps `Math.max(0, m.calories)`
- A corrupted negative meal silently lowers web total but not mobile's
- Fix: clamp on web
- Flagged by: data-integrity #13

#### 30. Pre-rounded grams compounding: "Protein 47.5 / 145 g remaining 98" (145-47.5=97.5)
- `formatMacro` 1dp; remaining caption integer round
- User sees two values that don't subtract
- Fix: round remaining caption from raw, not pre-rounded grams
- Flagged by: customer-lens N13

#### 31. `MIN_LOGGING_DAYS / MIN_WEIGH_INS` redeclared in `whyThisNumber.ts`
- "RN-safe" rationale doesn't hold (other shared modules already imported from RN)
- Fix: import from `adaptiveTdee.ts`
- Flagged by: repo-auditor §8.3

#### 32. Mobile `calcTargetsFromStats` lacks input clamps that `calculateTDEE` (same file) has
- Future Settings field with bad weight could pass through unbounded
- Fix: add same clamp
- Flagged by: nutrition-engine §1

#### 33. Closest-to-target day weights all macros equally
- 100-kcal calorie miss (0.05 of 2000) scores same as 10g protein miss (0.1 of 100)
- Calories conventionally weighted higher
- Fix: weight calories 2× in L1 sum
- Flagged by: nutrition-engine Topic 10

## Recommended execution order

This session — top-of-list quick wins (small diffs, large symptom relief):
1. **Finding 1** — web Targets `resolveLatestWeightKg` port
2. **Finding 2** — web Progress goal-date `calcGoalTimeline` swap
3. **Finding 4** — streak protected on Profile + ProgressMetricDetail (web + mobile)
4. **Finding 7** — web Targets net-carbs lens parity port
5. **Finding 8** — web Today carb-tile label fix

These are 5 trivial swaps that close real divergences a tester would see.

Next session — medium effort:
- Finding 3 (activity bonus inline indicator + web shared helper)
- Finding 9 (recap snapshot plumbing)
- Finding 10 (macro detail header gate)
- Findings 17 + 18 (shared formatters)
- Finding 22 (mobile profile recompute)

Bigger PRs:
- Finding 15/16 (regression-based pace projection — requires new tests)
- Finding 6 (mobile macro fallback unification — needs onboarding integration check)
- Finding 12/13/24 (consolidation of TDEE resolvers + activity-bonus addon)
- Finding 25 (EMA seed change — needs adaptive-TDEE behaviour test)

## Sign-off

Audit produced by 4 specialist agents in parallel — independent, all converged on the same root cause (routing/duplication, not math).

Next: ship the 5 P0/P1 quick wins above as a single PR.
