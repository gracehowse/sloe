# Canonical energy numbers — one input policy, one qualifier grammar, one goal vocabulary

**Date:** 2026-07-11 · **Status: Resolved (flag `energy_numbers_v1`, default-OFF)** · **Area:** Nutrition engine / cross-surface trust · **Tickets:** ENG-1506, ENG-1507 (recomp fidelity deferred → ENG-1538)

## Problem

The 2026-07-11 audit found the same account, in the same hour, showing **four
different "maintenance" numbers** (1,567 / 1,647 / ~1,720 / 1,778) plus a ring
goal (1,856) that reconciled with none of them, a paywall that said
"for lose weight" against a just-selected build-muscle plan, and a giant
"0 kcal maintenance" on an empty today.

Root causes (mapper evidence in the ENG-1506 workflow journal):

1. **Input drift, not algorithm drift.** The shared `resolveMaintenance`
   resolver was already correct and byte-identical on both platforms. But its
   INPUTS were hand-assembled per surface: web Progress fed the stale
   `profiles.weight_kg` snapshot (`weightKg ?? 70`), mobile Progress fed the
   latest `weight_kg_by_day` entry, mobile Progress also defaulted missing
   basics (`"unspecified"` / `|| 170` / `|| 30`) where Today strict-parsed
   them. Because `formulaKcal` is both the fallback AND the ENG-1057/ENG-1111
   below-formula floor, a weight skew doesn't just shift the number — it can
   **flip which branch wins** (the only mechanism by which the identical
   resolver printed 1,567 and 1,778 from one profile row).
2. **Three bypasses.** Targets showed raw `adaptive_tdee` gated only on
   confidence (mobile: fully ungated `adaptiveTdee ?? tdeeKcal`) → 1,647.
   The Expenditure card surfaced `measured_tdee` unconditionally with a
   hard-coded "high" chip → ~1,720. The adaptive-tdee API applied no
   staleness gate and defaulted activity to "moderate".
3. **Vocabulary collisions.** The net-energy ±60 band's STATE word
   ("maintenance") rendered an inch above the MAINTENANCE (TDEE) tile; the
   goal enum had two vocabularies (`lose|maintain|gain|recomp` vs
   `cut|maintain|bulk`) and three readers silently defaulted unknown → 'cut'
   / 'lose' (one wrote 'cut' back on save).
4. **The trial-path persist hole.** Mobile onboarding's "Start free trial"
   pushed `/paywall?from=onboarding` WITHOUT running the completion handler;
   every from=onboarding paywall exit replaces to Today, so
   `persistOnboarding` never ran on that path — the paywall rendered the
   PREVIOUS run's plan and the new plan was silently discarded.

## Decision — bless, don't invent

`resolveMaintenance` stays untouched. A thin canonical layer ships in front
of it: **`src/lib/nutrition/energyNumbers.ts`** (mobile mirror
`@suppr/nutrition-core/energyNumbers`):

- **`buildMaintenanceInputs(row)`** — THE input policy, decided once:
  weight = latest `weight_kg_by_day` entry, profile snapshot as fallback,
  null when neither (never `?? 70`); sex/height/age strict-null (never
  defaulted); adaptive/measured columns verbatim.
- **`selectMaintenance(row, opts)`** = `resolveMaintenance(buildMaintenanceInputs(row), opts)`
  — the ONE call every screen makes (Today, Progress, Targets, burn-detail,
  web + mobile).
- **`maintenanceQualifier(source, confidence)`** — the explicit qualifier
  beside every rendered maintenance numeral: `Apple Health · {conf}
  confidence` / `From your logs · {conf} confidence` / `Formula estimate
  from your stats`. One grammar everywhere (deliberately canonicalised over
  the design's per-surface variants).
- **`expenditureFromResolved(resolved, updatedAt)`** — the Expenditure card's
  flag-ON data path: phrased from the SAME resolved value the sibling
  Maintenance card shows; chip = real confidence; formula/null → the honest
  "still learning" state. Structurally cannot assert a rejected kcal.

**Goal vocabulary:** `src/lib/nutrition/goalVocabulary.ts` —
`normalizeDbGoal` (unknown/null → **null**, never 'cut'), `formatGoalLabel`,
`goalClauseGerund` ("for losing weight", fixing the broken grammar). All
readers (WhyThisNumber ×4, goal editor, maintenanceChain, weightProjection
fallback, paywall summary) route through it. The editor seats NO selection
on an unknown goal and disables Save until the user picks.

**Net-energy wording:** the balanced band's presentation strings become
"Balanced" / "kcal balanced" / "within 60 kcal of even" (union key stays
`"maintenance"` internally); an empty today (no burn, no food) renders an
em-dash + "No activity or meals logged yet today" instead of "0 kcal
maintenance".

**Onboarding:** the mobile flow's completion handler split into
`persistAndSeed()` (persist + seed + analytics, no navigation) and the
navigating `handleComplete`; "Start free trial" awaits `persist()` (busy CTA)
before opening the paywall, and `shouldLeadPaywallWithPersonalisedPlan`
requires `target_calories_source === "onboarding"` unconditionally
(from=onboarding alone no longer renders a stale row as "your plan").

**Frozen writers converged in the same change** (risk-2): `dailyTargetSnapshot`,
`recomputeTargetsFromProfile` (editors pass `weight_kg_by_day` when weight is
un-edited), and the weekly-recap push route all resolve via
`buildMaintenanceInputs`, so snapshots and push copy can't disagree with the
display policy after the ramp. The adaptive-tdee API gained the 14-day
staleness gate and the sedentary default (unflagged logic/API fixes).

## Flagging & rollout

`energy_numbers_v1` — **default-OFF**, registered in
`KNOWN_DEFAULT_OFF_FLAGS` on both platforms — gates every visual/numeric
change (input policy on screens, Targets/Expenditure re-sourcing, qualifier
lines, net-headline wording, empty state, period label, trajectory caption).
Legacy paths live in the else branches as the kill switch.

**Ramp with eyes open:** displayed maintenance MOVES for real users when this
flips (snapshot → latest weigh-in can flip the ENG-1057/1111 floor branch —
that convergence is the point). Ramp via PostHog with before/after screenshots
and a session-replay scrub; the Targets surplus caption may flip sign for
some users (it now names its basis: "… vs current maintenance estimate").

Unflagged (correctness/logic fixes with no legacy-visual surface): the
trial-path persist split, the paywall lead gate, the goal-vocabulary sweep
(unknown → honest "not set" instead of fabricated "lose"), the gerund
grammar fix, the API staleness/sedentary fix, and the frozen-writer input
migrations.

## Deferred

- **Recomp fidelity** — `mapV2GoalToLegacy` still collapses recomp → 'cut'
  at persist; a fully-persisted recomp user still reads "Lose weight" until a
  recomp-aware DB value/label ships. **ENG-1538.**
- Flag collapse: once `energy_numbers_v1` holds 100% for two weeks, delete
  the legacy input assemblies, `buildExpenditureTrendCopy`'s raw-column
  decision path, and the wording forks.

## Tests

`tests/unit/energyNumbers.test.ts` (input policy + the 1,567/1,778
branch-flip regression + qualifier + expenditure invariants),
`tests/unit/goalVocabulary.test.ts`, updates to `targetsView` /
`whyThisNumber` / `goalEditorPace` / `weightProjection` / `maintenanceChain`
/ `netEnergyBalance` / `paywallGate15Honesty`, and mobile pins
`energyNumbersAdoption.test.ts` (parity-of-import: no local input assembly)
+ `onboardingTrialPersistsPlan.test.ts` (persist-before-paywall).
