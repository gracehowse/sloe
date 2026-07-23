# ENG-1247 — Sloe v3 prototype conformance completion status

**Date:** 2026-06-28  
**Status:** Launch-critical slice shipped (flag-gated); full 100% blocked on product decisions  
**Canonical prototype:** `docs/ux/redesign/v3/Sloe-App.html`  
**Trackers:** `docs/ux/redesign/v3/conformance-backlog.md`, `docs/planning/2026-06-24-eng1247-conformance-backlog.md`

## Summary

ENG-1247 is **not** "every surface pixel-perfect to the prototype." It never was — the audit found ~72 divergences across 79 surfaces, and ~29 are structural IA / feature calls Grace must ratify (planning backlog §B).

What **is** complete for launch:

1. **Daily loop (Today)** — de-card hero, quick-add recents, header bell, LogHub quick actions: implemented web↔mobile, behind default-OFF flags, ready for PostHog ramp.
2. **Recipe spine (RecipeDetail)** — hero overlay, standfirst, borderless macro strip, sticky Cook/Log bar, real web journal Log: behind `recipe_detail_v3_conformance`.
3. **Plan v3 shell** — header verdict row, week strip, meal body (`sloe_v3_plan`); Adjust-constraints glyph removed until B1 sheet ships (no more silent Templates alias).
4. **Tab bar** — NC-style liquid-glass pill (PR #609).
5. **Autonomous cosmetic backlog** — majority of section A items done or explicitly deferred with Linear/decision refs; A1 + A14 closed 2026-06-28.

## What remains

### Autonomous (can implement without Grace)

- ~~CompleteDay stat trio + trendline (A5)~~ ✅ 2026-06-28
- ~~MealDetail / EntryDetail serif grammar (A4)~~ ✅ 2026-06-28
- ~~MealEdit mobile expander rows (A8)~~ ✅ 2026-06-28
- ~~PlanImport token snaps (A10)~~ ✅ 2026-06-28
- ~~Barcode copy (A12)~~ ✅ 2026-06-28
- ~~**A6 WhyNumber** — serif hero, set-ic rows, Keep-this-target CTA (`eng1247_section_a_v1`)~~ ✅ 2026-06-28
- ~~**A7 Verify flush list** — leading ver-dot + divided card (mobile)~~ ✅ 2026-06-28
- ~~**CookMode dark theme** — `recipe_detail_v3_conformance` (web + mobile inline + `/cook`)~~ ✅ 2026-06-28
- ~~**B15–B16 ImportFlow** — paste clear (×) + verify review-banner / ver-dot grammar~~ ✅ 2026-06-28

### Grace-gated (§B — ratified 2026-06-28; registry synced 2026-07-23)

29 structural decisions **resolved** — see `docs/decisions/2026-06-28-eng1247-section-b-ratified.md` (incl. 2026-07 addendum) and 🔒/✅ registry in `conformance-backlog.md`. **2026-07-23 reopen challenge: reopen none** under ENG-1247.

### Net-new prototype screens (reframed 2026-07-23)

| Surface | Status |
|---------|--------|
| **Coach** | ✅ Shipped (ENG-1240, `coach_screen_v1`) — supersedes B9 “distributed only” |
| **AdaptiveTDEE** | 🔒 Keep inline on Progress (B2) — not a full-screen build |
| **ScanLabel standalone destination** | 🔒 Won’t-do (B13) — job covered by LogHub Label (ENG-1336) + custom-food OCR |
| **ResetPlan** | ✅ B28 sheet shipped (`reset_plan_confirm_v1`) |

## Definition of done (revised)

| Tier | Criterion | State |
|------|-----------|-------|
| **L0 Launch** | Today + Recipes + Log critical path conforms behind flags; no lying affordances (Plan Adjust fix) | ✅ Shipped on `main`; ramp flags in PostHog |
| **L1 Autonomous** | Section A cosmetic backlog cleared or explicitly deferred | ✅ A6 + A7 closed 2026-06-28 |
| **L2 Structural** | Grace ratifies §B options; 🔒 keep-current recorded in backlog | ✅ Ratified 2026-06-28; registry in `conformance-backlog.md` |
| **L3 Full audit** | All 79 surfaces ✅ or 🔒 with rationale | 🔄 21 ✅ · 33 🔒 · 21 ⬜ · 3 🔄 · 1 🆕 (2026-06-28 tally) |

## Scope boundaries (2026-06-28)

These are **not** open ENG-1247 ⬜ rows:

| Item | Status |
|------|--------|
| **BatchCook assign-portions / fridge pips** | 🔒 Out of scope — beyond Grace B3 minimal v1 (ENG-1255 ships scaling + shopping only). Fuller meal-prep planner = new Grace product call only (not ENG-1247). |
| **Web Profile read showcase** | Follow-up — B6 mobile showcase ships behind `profile_showcase_v1`; web keeps legacy `Profile.tsx` editor until parity work lands. |
| **CookMode dark aubergine theme** | ✅ Shipped behind `recipe_detail_v3_conformance` (2026-06-28). |

## Next actions

1. ~~**Ship follow-ups:** ENG-1255 BatchCook; ENG-1257 ConfirmFood; RecipeDetail method/banner; A6/A7; CookMode dark; B15–B16~~ — ✅ Done 2026-06-28. **Open:** ENG-1256 web Profile showcase.
2. ~~**Mark 🔒** every ratified keep-current row~~ — ✅ Done 2026-06-28.
3. **Close remaining ⬜:** autonomous §A + B15–B16, B18, B21, B26, B28 builds; ramp flags after two-week hold.

## Grace product calls (2026-06-28; addendum 2026-07)

Recorded in `docs/decisions/2026-06-28-eng1247-section-b-ratified.md`: B1 build AdjustConstraints ✅ shipped; B2 inline AdaptiveTDEE; B3 build BatchCook minimal; B6 Profile showcase; A2b ConfirmFood mix. **Addendum:** B9 Coach ✅ ENG-1240; B13 ScanLabel 🔒 no standalone destination (LogHub Label ENG-1336); reopen challenge = none.

## Flags (default OFF, on `main`)

- `today_hero_decard_v3`
- `today_quickadd_recents_v3`
- `loghub_quick_actions_v1`
- `recipe_detail_v3_conformance` (RecipeDetail + CookMode dark backlog)
- `profile_showcase_v1` (mobile read showcase only)
- `sloe_v3_plan` (Plan tab v3 surface)
- `eng1247_section_a_v1` (CompleteDay, MealDetail, MealEdit rows, Barcode copy, **WhyNumber A6**)
