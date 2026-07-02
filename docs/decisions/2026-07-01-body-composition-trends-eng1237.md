# Body-composition trends card (ENG-1237)

**Date:** 2026-07-01  
**Status:** Implemented behind `body_composition_trends_v1` (default-ON per ENG-1279).  
**Linear:** ENG-1237

## Problem

Progress showed at most a single body-fat % scalar (manual entry or latest HealthKit sync). The v3 prototype and Pro paywall promise **body fat and lean mass trended over time** — a Pro conversion surface with no product UI.

## Decision

Ship a **Pro-gated Body composition card** on Progress (web + mobile) that shows:

- **Body fat %** — current value + signed delta over 90 days when history exists.
- **Lean mass (kg)** — **derived only** from paired same-day `weight_kg_by_day` + `body_fat_pct_by_day` readings (`weight × (1 − bf%/100)`). Never stored; never guessed without weight.

Free/Base users see a factual upsell (no numbers). Pro users see metrics or an honest empty state.

## Data model

- New column: `profiles.body_fat_pct_by_day jsonb` (migration `20260702120700`).
- Latest scalar `body_fat_pct` unchanged — still powers legacy inputs and HealthKit “current” sync.
- Apple Health sync now writes **per-day** body-fat samples into the map (same last-write-wins-per-day rule as weight) and prunes mobile-written maps to the shared 400-day cap.

## Enforcement

- **UI:** Free/Base cards render the upsell from tier state only; they do not receive historical body-fat maps as props.
- **API:** Pro metric reads go through `GET /api/progress/body-composition-trends`, which returns **403 `pro_required`** for non-Pro — historical trends are not advisory-only.

Grace must run `supabase db push --linked` to apply the migration on the linked project.

## Flag

`body_composition_trends_v1` in `REDESIGN_DEFAULT_ON` (web + mobile). Off → card hidden (kill switch).

## Copy posture

- Factual Pro upsell — no countdowns, no shame.
- Delta labels: `±X% / 90d` and `±X kg / 90d`.
- Session-replay masking: body-fat numerals use `ph-mask` on web.
