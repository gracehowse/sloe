---
date: 2026-06-30
area: progress/nutrition
status: Resolved
owner: Grace (ENG-953, category-leading growth)
linear: ENG-953 (parent ENG-1220)
---

# Expenditure trend card — calm, soft-confidence, no false precision

## Decision

Ship a **net-new calm "Expenditure" trend card** on the Progress tab (web +
mobile), sitting directly under the Maintenance card. It surfaces the energy
the body is using as a soft, sentence-led read — never a bro-dashboard number.

Gated behind `expenditure_trend_card`, **default-ON** (in `REDESIGN_DEFAULT_ON`
on **both** `src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts`).
The card renders by default; the `else` (collapsed "How this works" expandable
under the Maintenance card) is the kill switch — removing the flag from the
default-on set, or a PostHog kill, returns it.

> **Flipped default-ON 2026-06-30** (Grace, "always flag on" for beta-window
> growth builds — the solo tester should see her own features, not dark flags).
> Originally shipped default-OFF; the flip is a one-line move between the two
> flag sets on each platform, with no behaviour change to the card itself.

### Reuses data already in state — recomputes nothing

The card reads the adaptive / measured TDEE **already loaded** in the Progress
hosts (`adaptive_tdee`, `adaptive_tdee_confidence`, `adaptive_tdee_updated_at`,
and `measured_tdee`) on web `ProgressDashboard.tsx` and mobile
`(tabs)/progress.tsx`. It does **not** re-derive a TDEE; the shared helper only
decides how to phrase the value the engine already produced.

### Copy rules (pinned by unit tests)

All copy comes from one shared helper, `src/lib/progress/expenditureTrend.ts`
(`buildExpenditureTrendCopy`), so web and mobile can never drift. Three rules:

1. **Never a false-precision integer.** The TDEE is an estimate, so the figure
   is rounded to the nearest 10 kcal and led with "about ~". `2347` → "about
   ~2,350". The raw integer never appears.
2. **Soft confidence drives the framing.**
   - A confident **measured** (Apple Health) value wins — it's observed:
     *"Your body's been using about ~X kcal/day lately, going by your Apple
     Health activity."* (high chip)
   - Otherwise a **medium/high-confidence adaptive** value gives:
     *"You've been burning about ~X kcal/day lately."* (medium/high chip) plus a
     recency line from `updated_at`.
   - A **low-confidence** value or **no estimate yet** shows the reassurance
     state with **no number**: *"We're still learning your expenditure
     pattern. Keep logging meals and weighing in, and a personalised daily burn
     will settle in here."* (low chip only if confidence is explicitly low).
3. **Body-neutral, calm, no health claim.** Expenditure is described plainly as
   the energy the body uses — not a target to chase, no diet-culture framing.

The card uses the existing `ConfidenceChip` and theme tokens only
(`theme.ts` / `theme.css`); its chrome matches the Maintenance sibling exactly
(soft-lift `SupprCard`, `IconBox` + headline header, chip on the right).

## Why

Real expenditure (how many calories the body is actually using) is one of the
most reassuring numbers a tracker can show — it's the honest counterweight to
"calories in". But it's also the easiest to get wrong tonally: a precise daily
integer reads as authority the model doesn't have, and a loud number reads as a
bro-dashboard. A separate, calm card lets us surface the value with the right
softness without crowding the Maintenance card's existing derivation chain.

## Pressure-tested failure modes

- **False precision.** Mitigated structurally: the helper rounds to 10 and
  prefixes "about ~"; tests assert the raw integer never appears.
- **Leaking a low-confidence number.** The low-confidence path returns the
  learning state with `roundedKcal: null`; a test asserts no digit appears in
  the line at low confidence.
- **Stale read presented as fresh.** The recency line degrades to "This hasn't
  refreshed in a while — keep logging to sharpen it" past ~45 days, and omits
  entirely on a future/unparseable timestamp (clock skew).
- **Web/mobile drift.** One shared copy helper + a flag-registration parity test
  (`expenditureTrendFlagParity.test.ts`) + a mobile-resolution test prevent the
  two platforms from diverging.

## Validation status

Default-ON since 2026-06-30. **Web pixels visually verified** with the card live
on the Progress dashboard (driven in `web-drive`, card present + legible). **Mobile
pixels** rely on Grace's on-device / TestFlight check (the iOS-sim glance is the
gated path) — the card is a by-construction mirror of the web component sharing
one copy helper, and the mobile build is green on typecheck + vitest. Headless
gates (typecheck / vitest / mobile typecheck / mobile vitest / screen-budget) green.

## Files

- `src/lib/progress/expenditureTrend.ts` — shared copy helper (pure).
- `src/app/components/suppr/expenditure-trend-card.tsx` — web card (self-gating).
- `apps/mobile/components/progress/ExpenditureTrendCard.tsx` — mobile card.
- Hosts: `src/app/components/ProgressDashboard.tsx`,
  `apps/mobile/app/(tabs)/progress.tsx` (flag-gated mount, net-neutral lines).
- Flag registration: `src/lib/analytics/track.ts`,
  `apps/mobile/lib/analytics.ts`.
- Tests: `tests/unit/expenditureTrend.test.ts`,
  `tests/unit/expenditureTrendFlagParity.test.ts`,
  `apps/mobile/tests/unit/expenditureTrend.test.ts`.
