# Auditable math v1 — Maintenance + targets + expenditure (ENG-1481)

- **Date:** 2026-07-22
- **Status:** Spec (Wave 8) — implement after Grace ratification of this scope
- **Linear:** ENG-1481
- **Decision pack:** `docs/decisions/2026-07-22-full-backlog-decision-pack.md`

## Goal

Make the math behind Maintenance, daily targets, and expenditure **auditable**: a
user (or reviewer) can see which inputs produced which number, without opening
source code.

## v1 scope (ratified default)

| Surface | In v1? | Notes |
|---------|--------|-------|
| **Maintenance** | Yes | Already close via `selectMaintenance` / `energy_numbers_v1` |
| **Targets** | Yes | Show inputs → formula → output for calorie + macro targets |
| **Expenditure** | Yes | Activity / NEAT / exercise contribution trail |
| Weight projection | No | Deferred |
| Streak / freeze math | No | Deferred |

## Acceptance

1. One shared "math receipt" shape (inputs[], formula label, result, units).
2. Web + mobile parity on Progress / Targets surfaces that show these numbers.
3. Flag-gated visual reveal (`auditable_math_v1`, default OFF) until validated.
4. No silent rounding divergence between platforms (±1 kcal OK for display).

## Out of scope for v1

- Replacing the nutrition engine
- Exporting PDF receipts
- Third-party wearable expenditure (see ENG-1636 deferred wearable sync)
