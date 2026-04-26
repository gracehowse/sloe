# Decision log: Opus 4.7 codebase review (2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** Grace requested an end-to-end codebase review by Opus 4.7 to identify launch-readiness gaps and the fixes that would move Suppr from "shippable" to "best-in-class / competition-beating".
**Audit artefact:** [2026-04-25 Opus 4.7 codebase review](../audits/2026-04-25-opus47-codebase-review.md)

---

## Verdict (one line)

**Conditional GO for cohort expansion** once the seven P0 items in §7 of the audit ship. Six are code, one is ops (RevenueCat dashboard wiring).

## Decision

The 2026-04-24 HOLD verdict is mostly cleared at the code level — at least 12 of the 20 prior blockers have shipped in the last 24 hours (T6, T7, T12, T13, T15, T19–T24, F-71/F-73/F-77/F-78/F-79). What remains is a smaller but sharper list:

### P0 (this week, before any cohort expansion beyond N=1)

1. Apply `supabase/migrations/20260503101000_schema_drift_repair.sql` via `supabase db push --linked`; regenerate `database.types.ts`.
2. Add a density lookup to `src/lib/nutrition/totalGramsForVerifyScale.ts`; flip the deliberate `it.fails(...)` markers in `tests/unit/totalGramsForVerifyScale.test.ts` to `it(...)`.
3. Wire `wouldCoerceMacros` (or the `isCoerced` flag from `src/lib/nutrition/coerceRecipeMacrosForPlanning.ts`) into every `nutrition_entries` insert path on web and mobile.
4. Extend the `profiles` column-lockdown trigger (`supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql`) to cover `subscription_status`, `trial_started_at`, `trial_ends_at`, `trial_days_given`.
5. Wrap `generateSmartPlan` in `InteractionManager.runAfterInteractions` at `apps/mobile/app/(tabs)/planner.tsx`; reduce the sampler at `src/lib/nutrition/mealPlanAlgo.ts:498` from 20 000 → 2 000 stratified.
6. Scope the `/api/household/join` rate-limit key to `userId:ip` (not `ip` alone) at `src/lib/server/rateLimit.ts:112`. Add rate limits to `/api/nutrition/photo-log`, `/api/nutrition/voice-log`, `/api/usda/search`, `/api/stripe/checkout`.
7. Complete RevenueCat webhook ops setup (RC dashboard URL + `REVENUECAT_WEBHOOK_AUTH` secret in Vercel env). Confirm via test event.

### P1 (next two weeks, before public launch)

Eleven items (8–18 in the audit) covering confidence-threshold unification, planner-algo unification, Supabase client version sync, e2e + drift checks in CI, mobile journal optimism, mobile Sentry wiring, RevenueCat live-replay test, incorporation finalization, written launch checklist, missing decision docs, FatSecret licence-page sweep.

### P2 (post-launch v1.1)

Architecture and parity polish — Tracker monolith refactor, `verifyRecipe.ts` decomposition, `app/` vs `src/app/` consolidation, mobile library kind-filter, mobile named-slot switcher, cook-mode → log affordance, social/screenshot import, net-carbs lens, Apple Watch complication.

## Rationale

Three audit lenses converged on the same picture:

1. **Nutrition-honesty is the moat — and two bugs invalidate it.** The Atwater plausibility gate (F-77), macro-split confidence (F-82), and source-aware vocabulary are real moats vs MFP / Cronometer / Lifesum / LoseIt. But `totalGramsForVerifyScale` ml=g and unenforced macro coercion silently invalidate the precision claim. P0 #2 and P0 #3 close the gap.
2. **Security posture is mostly good but partial.** RLS lockdown shipped only for `user_tier` + `stripe_customer_id`; `subscription_status` + `trial_*` remain client-writable. Household-join rate-limit is IP-only. These are a-day's-work fixes, not architectural rewrites.
3. **Performance is the most-felt-by-users bug.** `generateSmartPlan` still blocks the JS thread for 6–11 seconds; users will force-quit. Wrapping in `InteractionManager` + 2 k stratified sampling closes it.

## Alternatives considered

- **Ship now, fix in v1.0.1.** Rejected for §2.1, §2.2 (nutrition correctness), §2.3 (RLS), §2.4 (perf). Acceptable for everything in P1 and P2.
- **Defer §2.1 (ml=g) until a full density-table is available.** Rejected. The minimum viable fix is a small staple-table lookup; full coverage can come post-launch. Live in production today, the bug undoes the marketing claim.
- **Skip the schema-drift repair migration since the type system passes.** Rejected. Type-checks against a schema that doesn't match production is the worst possible state — runtime errors only surface under specific code paths (barcode correction, recipe publish, follower counts).

## Platforms affected

- **Web:** `nutrition_entries` write paths, profiles lockdown trigger, household-join rate-limit, schema-drift apply, FatSecret licence page copy, e2e CI, Supabase client bump.
- **Mobile:** `nutrition_entries` write paths, `generateSmartPlan` wrap + sampler, journal optimistic updates, Sentry wiring, library kind filter (P2), named-slot switcher (P2).
- **Supabase:** `20260503100000_profiles_tier_column_lockdown.sql` extension, `20260503101000_schema_drift_repair.sql` apply.
- **Ops:** RevenueCat dashboard webhook + secret, Stripe Tax dashboard activation (P1), incorporation jurisdiction (P1).

## Related artefacts

- [2026-04-25 Opus 4.7 codebase review](../audits/2026-04-25-opus47-codebase-review.md) — full findings + verification + competitive read
- [2026-04-24 full-sweep audit](../audits/2026-04-24-full-sweep.md) — predecessor
- [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md) — Phase 1/2/3 gating
- [2026-04-25 schema drift audit](../audits/2026-04-25-schema-drift.md) — migration apply prerequisite
- [Best-in-class plan](../best-in-class-plan.md) — the bar this review measures against

## Revisit when

- Any P0 item ships → re-run nutrition-engine + security-reviewer for that surface → green-light next P0.
- All P0 items shipped → cohort expansion gate (re-run release-gate end-to-end).
- All P1 items shipped → public launch gate.
- Any future audit flips an item from "shipped" back to "regression".

## Open questions for Grace

1. **Coercion policy decision (P0 #3):** When `wouldCoerceMacros` returns true at journal-write time, do we (a) reject the insert and force a re-verify trip, or (b) persist with `is_coerced = true` flag + UI "estimated" chip? Recommend (b) for journal logs, (a) for planner-driven auto-logs.
2. **Density table scope (P0 #2):** Ship density for ~20 staples (oils, vinegars, syrups, milks, flours) now and broaden later — or wait for a fuller table?
3. **Sampler cap reduction (P0 #5):** 2 k stratified is the prior audit's recommendation; willing to a/b a 1 k cap to halve generation time further if variety stays acceptable on a fixture pool?
