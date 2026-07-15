# Onboarding seed taster-week tier semantics (Free = 1 day, paid = 7)

- **Date:** 2026-07-15
- **Area:** Onboarding / monetization / meal-plan gating
- **Status:** Decided (Grace) + shipped (ENG-1388 / #899)
- **Linear:** ENG-1388 (repair), ENG-1387 (server-side free-tier 1-day plan cap); amends D-2026-04-27-14

## Decision

The onboarding first-plan seeder (`buildFirstWeekFromSeeds`, `src/lib/onboarding/onboardingFirstWeek.ts`) seeds **1 day for Free signups** and **7 days for paid**. Implemented as the function's default `planDays: 1`; a paid onboarding path passes `planDays: 7`.

## Context

ENG-1388 found D-2026-04-27-14 ("onboarding ends with a populated first week") had been dead in production, for two independent reasons — both fixed in #899:

1. **0 seeds resolved.** The 2026-05-14 `replace_recipes_with_suppr_kitchen` migration deleted the old seed rows and re-seeded the recipes under `source_name = 'Suppr Kitchen'`, but `onboardingSeedResolver` still filtered the old `'Suppr onboarding'` — so every seed resolved to nothing. Fixed: the provenance gate now uses `SEED_RECIPE_SOURCE_NAME` (`'Suppr Kitchen'`), guarded by a new provenance-parity test (`tests/unit/onboardingSeedProvenanceParity.test.ts`) that ties the resolver constant + every seed matchTitle to the migration file.
2. **null `slot_id` → 23502.** Already fixed by ENG-1387's migration (`coalesce(p_slot_id, 'default')`).

Repairing resolution surfaced the tier question: ENG-1387 added a server-side cap that rejects meal-plan `day > 1` for Free users, and all new signups are Free. A repaired 7-day seed would roll back at day 2.

## Why 1 day for Free (not a trial-grant, not dropping the seed)

- **Satisfies the ENG-1387 gate by construction** — a 1-day seed never trips the server rejection, so no special-casing or entitlement plumbing is needed.
- **Preserves the activation moment** — Free users still land on a populated Today/Plan (a 1-day taster of the multi-day planner), not an empty dashboard.
- **Natural upgrade hook** — the full 7-day plan becomes a paid unlock.

Rejected alternatives: *trial-grant the full week* (needs entitlement/trial plumbing, touches the billing surface); *drop the seeded week* (loses the activation moment and abandons D-2026-04-27-14 entirely).

## Amends

D-2026-04-27-14 (`docs/decisions/2026-04-27-strategic-direction.md`): for Free users the onboarding end-state is a populated first **day**, not a full week. Paid users keep the full week.
