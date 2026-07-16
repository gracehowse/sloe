---
date: 2026-07-16
area: progress
status: Resolved
owner: Grace (ENG-1525, Redesign — Design Direction 2026)
linear: ENG-1525
---

# Progress hierarchy v1 — 13 equal-weight cards → 5 prioritised sections

## Decision

Rebuild the Progress tab (web + mobile, in parity) as a **5-section
prioritised hierarchy** behind the flag **`progress_hierarchy_v1`**,
**default OFF** (in `KNOWN_DEFAULT_OFF_FLAGS` on both
`src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts`). The
legacy 13-card stack stays byte-alive in the `else` branch of both
hosts — it is the kill switch. The flag is read **once on mount** into
state in each host (the `digestBlendEnabled` pattern), so the layout
never flips mid-session.

Section order (composed by `ProgressHierarchyV1`, one per platform,
receiving host-computed data as props):

1. **Trajectory (hero)** — the ONLY tinted card on the page. Serif kg
   numeral + smoothed weekly rate + the canonical weight chart +
   `computeTrajectory` projection ("3.4 kg to go" leads bold; the date
   is hedged — "at this pace ~Sep 12", footnote "An estimate, not a
   promise."). Absorbs the Journey card and the standalone
   TrajectoryCard.
2. **This Week** — adherence numeral demoted from 40px to the ~29px
   serif step; headline reconciles both stats ("82% avg · 5 of 7 days
   on target" — adherence average and on-target count are different
   numbers, shown as such); Mon–Sun calorie bars (today boxed, per-day
   target reference, sage under / amber over — never red); macro bars;
   streak microrow. Absorbs the Daily Calories card, the Average
   Adherence card, and the on-target ribbon. Always pins to the
   current week regardless of the period control (delta 4).
3. **Energy** — ONE number leads: the deficit/surplus (~33px serif),
   with the equation in words as the support line, **correct
   arithmetic**: "2,073 maintenance − 1,840 intake" (maintenance −
   intake = deficit; the legacy Energy Balance card typeset it
   sign-backwards). Confidence as a bare sage overline, not a pill;
   thin data degrades to "building estimate · low confidence" + the
   existing weigh-ins/logging-days progress bars; subordinate
   expenditure sparkline. Absorbs the Maintenance card, the Energy
   triad, and the standalone ExpenditureTrendCard.
4. **Body composition** — overline carries "· Pro" only for free
   users. User-owned latest values (body fat %, lean mass) always
   render free; the Pro layer is the TREND (masked mini-trend behind a
   lock + ghost "See Pro plans" for free users with data; the real
   BodyCompositionTrendCard content for Pro).
5. **Your Week** — serif verdict sentence (`resolveDigestHeadline`) +
   ONE net-new texture line (usual-meal insight, else best day) +
   ghost Share (same analytics + `formatRecapForShare` ownership as
   Digest). No restated avg/streak numerals — they live in §2.
   DigestStoryCard does not render on the new branch.

The period control (D/W/M/6M/Y) stays above the sections and drives
§1's chart window and §3's averaging window. The story gate (<3 logged
days) renders above §2 unchanged; StreakFreezeCard keeps rendering
below §5 in v1; the Activity section stays below §4; milestone dialog,
win-moment overlays, LogWeightSheet, and `?metric=` deep links are
unchanged.

### The 7 Fable deltas (ratified in Linear ENG-1525 comment 230ffc29)

1. **The hero is goal-conditional, not unconditional.** Weight-goal
   users in weight-surface mode `show` get the Trajectory hero;
   `trends_only` users get trend-direction copy only
   (`describeTrendOnly` / `TREND_ONLY_MODE_NOTE` — legal-signed
   2026-07-01, no absolute kg anywhere); full opt-out / no-data-intent
   users get **no Trajectory section** — This Week promotes to the top
   slot as a plain card (the tint belongs to the weight hero only). A
   weight hero shoved at a user who opted out of weight tracking is a
   body-neutrality own-goal.
2. **§4 never masks data the user already owns.** Latest user-owned
   values (HealthKit / smart-scale body fat, lean mass) always render
   free; only the trend chart + analysis is Pro-gated. Locking a
   user's own measurements behind a paywall reads as extortion on a
   trust surface.
3. **Direction-aware semantics everywhere.** Colour and verdict copy
   derive from `sign(rate) × sign(goal delta)`, never the raw sign —
   sage when moving toward the goal, amber when away, neutral plum
   with no goal, never red. One shared helper,
   `trendDirectionTone(rateKgPerWeek, latestKg, goalWeightKg)` in
   `src/lib/weightProjection.ts` (mobile re-export via
   `@suppr/shared/weightProjection`), drives both §1's rate/verdict
   tone and §3's deficit/surplus framing so the two sections can never
   disagree. For a gain-goal user, ↓ is amber and a *surplus* is the
   success state.
4. **Period control ruling.** Keep the global D/W/M/6M/Y control in
   v1 (drives §1 + §3); **§2 pins to the current week** regardless — a
   "This Week" section showing last month is nonsense. Per-section
   range toggles are a follow-up ticket, not v1.
5. **Copy ruling: keep "An estimate, not a promise."** The register
   has an exact shipped voice precedent ("Barcode scan is free —
   always. No paywall. No asterisk."). This register *is* the brand.
6. **Sparse states are part of the skeleton.** Zero/one weigh-ins →
   the hero slot renders the existing WeightSparseState grammar, and
   its "Log your first weigh-in" filled CTA is the screen's ONE filled
   CTA in that state (every other CTA on the new branch is ghost).
   <14 days of weigh-ins or a flat slope → the date and verdict drop:
   "Trend still settling — keep logging."
7. **Slimming §5 must not orphan streak mechanics.** Streak texture
   moves to §2's microrow; streak **freezes** stay reachable from the
   streak affordance (press-through to the existing streak
   drill-down, plus StreakFreezeCard below §5). DigestStoryCard is
   killed on the new branch; the verdict/texture/Share section keeps
   Digest's share-sheet + analytics ownership.

### Tinted hero — a deliberate ENG-1497 carve-out

The ENG-1497 card-grammar ruling (2026-07-10) is page-ground cards
FLAT + hairline, one treatment per surface. The Trajectory hero
deliberately carves out **one tinted card on an otherwise flat field**:
still flat (no shadow), still hairline-bordered, radius 24 — but its
background is `linear-gradient(180deg, var(--hero-tint),
var(--hero-tint-to))` with `var(--hero-tint-border)` as the hairline.
Exactly one card on the page may carry the tint, and only when it is
the weight hero (a promoted This Week leads by position, not tint).
New tokens (`--hero-tint` / `--hero-tint-to` / `--hero-tint-border` in
`src/styles/theme.css` light + dark, `@theme inline` mappings;
`Colors.light/dark.heroTint/.heroTintTo/.heroTintBorder` in
`apps/mobile/constants/theme.ts`) — components consume by reference
only. The elevation pin tests keep their legacy assertions scoped to
the legacy branch and gain the carve-out assertion for the new branch.

### Flag, kill switch, ramp

- **Flag:** `progress_hierarchy_v1`, registered in
  `KNOWN_DEFAULT_OFF_FLAGS` on both platforms with the inline
  ENG-1525 comment + "keep in sync with <other platform>". A full-tab
  structural rebuild follows the `energy_numbers_v1` precedent
  (deliberately default-OFF with a before/after-screenshot ramp), not
  the "always flag on" additive-card convention.
- **Kill switch:** the `else` branch — the legacy 13-card stack —
  stays byte-intact in both hosts. Flag OFF (or a PostHog kill)
  renders exactly what shipped before ENG-1525.
- **Ramp plan:** create the PostHog row → validate flag-on pixels on
  web (`web-drive`) + iOS sim with before/after screenshots → ramp to
  100% (one tester, Grace) → after 2 stable weeks at 100%, a cleanup
  PR removes the gate + the dead legacy branch. Runbook entry:
  `docs/operations/posthog-rollout.md`.

### In-scope fixes that benefit both branches

- **ENG-1296:** `ProgressHeroMetric` (mobile) + `progress-hero-metric`
  (web) over-target destructive red → amber (`Accent.warning` family),
  matching the ENG-1431 ruling. A bug fix, not a redesign — lands on
  both branches.
- Web trend stroke re-points `var(--macro-protein)` → `var(--primary)`
  in the **new branch only**; legacy untouched.

## Why

The live Progress tab renders ~13 equal-weight cards: TrajectoryCard
tenth (after Body comp), maintenance/TDEE surfaced six times, the week
summarised five times (THIS WEEK, adherence, on-target ribbon, Digest,
DigestStoryCard), and the Energy Balance card typesetting its equation
sign-backwards. Nothing leads; the most consequential read (is the
weight trend moving toward the goal?) is buried below the fold. The
5-section consolidation — validated against MacroFactor, Cronometer,
Lifesum (all promote weight-trend to a hero) and re-derived by Fable
from a fresh code census rather than inherited from the audit summary
— gives the page one hero, one week read, one energy read, one Pro
surface, and one verdict. Behind a default-OFF flag because a rebuild
that visibly moves an entire surface ships ramped, never blind.

## Pressure-tested failure modes

- **Body-neutrality own-goal.** A weight hero forced on opt-out users
  — prevented structurally by delta 1: the hero is goal-conditional;
  opt-out promotes This Week; `trends_only` reuses the legal-signed
  no-absolute-kg strings.
- **Loss-good hardcoding.** The v3 prototype hardcoded sage-↓; a
  gain-goal user would see their success state rendered amber.
  `trendDirectionTone` derives tone from rate × goal-gap sign, with
  neutral at-goal (amber-at-goal reads as shame for maintaining) and
  a 0.05 kg/wk epsilon so noise never gets a verdict. Unit-tested.
- **Paywalling the user's own data.** Delta 2 draws the hard line:
  values free, trend Pro.
- **False projection confidence.** Distance leads; the date needs the
  ≥5-day projection floor AND ≥14 days of weigh-ins; thin/flat data →
  "Trend still settling — keep logging." with no date, no verdict.
  Rate comes from the smoothed weekly rate, never the raw two-point
  delta.
- **Mid-session layout flip.** Flag read once on mount into state on
  both hosts — PostHog resolving after first paint can't restructure
  the page under the user.
- **Legacy regression while flag-off.** ~20 source-grep pin tests
  match the hosts' SOURCE text; the legacy render stays byte-intact
  in the `else`, all new code lives in new files
  (`apps/mobile/components/progress/hierarchy/`,
  `src/app/components/suppr/progress-hierarchy/`, every file <400
  lines), and the hosts landed at-or-under their only-shrink pins by
  extracting untested legacy blocks (`AppleHealthCardHost` on mobile,
  `progress-digest-block` on web) after pin-checking the candidates.
- **Token/contrast drift.** The prototype's raw `rgba(91,59,110,.11)`
  gradient + literal border would trip `check:token-scale`; tokens
  were added first (ratchet-exempt in the token files) and consumed
  by reference. Ink-on-tint pairs get AA (≥4.5:1) contrast pins in
  light + dark.
- **Duplicated numbers.** Each stat renders once: avg/streak live in
  §2 and are banned from §5; the TDEE renders once in §3 (the
  sparkline is subordinate, no second numeral).

## Validation status

Foundations + section components + host gates landed 2026-07-16 on
`agent/claude/eng-1525-progress-hierarchy-v1` (default OFF — no user
sees the new branch yet). `trendDirectionTone` unit tests green.
Hierarchy render tests (5 overlines in order, mode-conditional hero,
no-absolute-kg in trends_only, equation arithmetic fixture,
§2 dual-stat headline, §4 free-values-plus-lock, §5 no-restated
numerals), flag-parity test, contrast pins, and the elevation-test
amendments ship in the same change per the build spec. Pre-ramp:
before/after screenshots on web + iOS sim per the feature-flag rule;
the visual-audit e2e baselines change on flag-on runs.

Deviation from the build spec, recorded deliberately: §5 is a
dedicated `ProgressYourWeekSection` component that mirrors Digest's
share/analytics ownership (same event family, host-supplied
`formatRecapForShare` text) rather than a `variant="verdict"` prop on
Digest itself — the slimmed surface shares Digest's *contract*, not
its component body. Digest is untouched and keeps rendering on the
legacy branch.

## Files

- `src/app/components/suppr/progress-hierarchy/` — web composer +
  sections (`progress-hierarchy-v1.tsx`, `progress-trajectory-hero.tsx`,
  `progress-week-section.tsx`, `progress-energy-section.tsx`,
  `progress-body-comp-section.tsx`, `progress-your-week-section.tsx`,
  `hierarchy-section-overline.tsx`).
- `apps/mobile/components/progress/hierarchy/` — mobile mirror
  (`ProgressHierarchyV1.tsx`, `ProgressTrajectoryHero.tsx`,
  `ProgressWeekSection.tsx`, `ProgressEnergySection.tsx`,
  `ProgressBodyCompSection.tsx`, `ProgressYourWeekSection.tsx`,
  `HierarchyOverline.tsx`).
- Hosts (flag gate + props wiring, legacy stack in the `else`):
  `src/app/components/ProgressDashboard.tsx`,
  `apps/mobile/app/(tabs)/progress.tsx`.
- Host-shrink extractions:
  `src/app/components/suppr/progress-digest-block.tsx`,
  `apps/mobile/components/progress/AppleHealthCardHost.tsx`.
- Shared helper: `src/lib/weightProjection.ts` (`trendDirectionTone`).
- Tokens: `src/styles/theme.css` (`--hero-tint/-to/-border`, light +
  dark + `@theme inline`), `apps/mobile/constants/theme.ts`
  (`Colors.light/dark.heroTint*`).
- Flag registration: `src/lib/analytics/track.ts`,
  `apps/mobile/lib/analytics.ts` (`KNOWN_DEFAULT_OFF_FLAGS`).
- ENG-1296 amber fix:
  `apps/mobile/components/progress/ProgressHeroMetric.tsx`,
  `src/app/components/suppr/progress-hero-metric.tsx`.
- Tests: `tests/unit/trendDirectionTone.test.ts` (+ the hierarchy
  render / flag-parity / contrast / elevation suites per the build
  spec).
- Runbook: `docs/operations/posthog-rollout.md` (Active-flags entry).
