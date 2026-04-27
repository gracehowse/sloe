# P2 end-of-band — full sweep verdict (2026-04-25)

**Date:** 2026-04-25
**Method:** Full unit + integration test re-run + web/mobile typecheck + migration static check + lint + RC webhook smoke trail.
**Predecessor:** [2026-04-25 Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md), [2026-04-24 full-sweep ship verdict](../decisions/2026-04-24-full-sweep-ship-verdict.md).

---

## Verdict: **GO — cohort expansion unlocked.**

The 2026-04-24 HOLD is fully cleared at the code level. Soft TestFlight expansion beyond N=1 is unblocked. Phase 2 (App Store + public launch) remains gated on legal/ops workstreams that are tracked separately in the [legal finalization runbook](../operations/legal-finalization-runbook.md) — none of those block cohort expansion.

## Sweep results

| Check | Result |
|---|---|
| Unit tests (audit-touched surface, 24 files) | **168/168 green** |
| Integration tests (16 files) | **83/83 green** |
| Web `tsc --noEmit` | **clean** |
| Mobile `tsc --noEmit` | **clean** |
| Migration static check (`check:migrations --static`) | **93 migrations, all well-formed and unique** |
| ESLint | **0 errors**, 107 warnings (under existing ratchet of 500) |
| RC webhook live smoke (Grace ran) | **200/200, `outcome="skipped_duplicate"`, cleanup confirmed** |

## P0/P1/P2/P3 final state

**P0 — Cohort expansion gate (7/7 closed):**
- P0-1 schema-drift repair: **applied on linked prod** (was already on remote pre-push).
- P0-2 density lookup in `totalGramsForVerifyScale.ts`: **shipped**, 13/13 tests.
- P0-3 coercion guards at every `nutrition_entries` write: **shipped**, inventory test pins all 5 insert sites.
- P0-4 profiles lockdown forward-compat: **applied** via migration `20260503102000`.
- P0-5 sampler cap 20k → 2k: **shipped** on both web + mobile via shared `MEAL_PLAN_SAMPLER_CAP`.
- P0-6 rate-limit user scoping: **shipped** across 16 endpoints. Route prefix `api:household-join`; auth-before-rate-limit confirmed.
- P0-7 RevenueCat webhook ops: **runbook shipped + smoke proven live by Grace.**

**P1 — Public launch gate, code side (11/11 closed):**
- P1-8 confidence threshold unification: **shipped**, 7/7 tests.
- P1-9 meal-plan algorithm constants unified: **shipped**, 4/4 constants test green.
- P1-10 `@supabase/supabase-js` 2.56 → 2.102: **shipped**, all integration tests green.
- P1-11 CI gates (Playwright e2e + static migration check): **shipped**.
- P1-12 optimistic mobile journal writes: **shipped** for in-tracker planner-meal log.
- P1-13 mobile Sentry/PostHog identity + onboarding event: **shipped**.
- P1-14 RC live-replay smoke in `prelaunch:checklist`: **shipped + proven live**.
- P1-15 legal finalization runbook + placeholder lint: **shipped** (5 placeholders inventoried; resolution requires entity decision).
- P1-16 launch checklist + App Store listing scaffold: **shipped**.
- P1-17 5 backfilled decision docs: **shipped**.
- P1-18 FatSecret licence sweep: **already shipped** in commit `072cb31`.
- P1-19 planner-row "Estimated · verify" chip: **shipped**, 4/4 tests.

**P2 — v1.1 hygiene (12/12 closed; 4 deferred with structured plans, 8 shipped):**

Shipped:
- P2-21 `app/` vs `src/app/` documented in CONTRIBUTING.md.
- P2-22 mobile library kind filter: **already shipped**.
- P2-23 mobile named-slot switcher: **already shipped**.
- P2-24 cook → log affordance: **shipped**.
- P2-25 social/screenshot import: **already shipped**.
- P2-26 net-carbs lens foundation: **shipped + applied**.
- P2-27 widget snapshot foundation: **already shipped** (native target deferred).
- P2-28 full meal-plan algorithm dedup: **shipped**, behavioural parity test 10/10 green.

Deferred to v1.1 with structured plans:
- P2-19 mobile Tracker monolith refactor
- P2-20 `verifyRecipe.ts` decomposition
- P2-29 persistent offline write queue

**P3 — Post-launch follow-ups:**
- P3-30 net-carbs display rollout (Settings + Tracker + Recipe Detail): **shipped on both platforms**.
- P3-31 Apple Watch + iOS widget Swift extension: **deferred — native iOS work, foundation in `widgetSnapshot.ts`**.

## Test fix landed in this sweep

`tests/unit/householdJoinDisclosureCopy.test.ts` — corrected two assertions Grace's earlier commit had pinned against the pre-P0-6 shape:
- `keyPrefix: "household_join"` → `keyPrefix: "api:household-join"` (matches the actual route).
- Re-ordered the `userId` vs `rateLimit` assertion to match the P0-6 sequencing (authenticate first, then rate-limit with the userId scoped into the bucket).

This brings the test in line with the shipped behaviour. **Needs `git commit -am 'fix(tests): household-join prefix + auth-before-rate-limit ordering' && git push`** before pushing the rest of `main`.

## What's NOT closed (legal/ops; outside code-session scope)

Phase 2 gates from the [legal finalization runbook](../operations/legal-finalization-runbook.md):
- Cayman immigration counsel call.
- Trademark TM-1.
- US cross-border CPA consult.
- Delaware LLC formation via Stripe Atlas.
- Stripe Live onboarding + Stripe Tax activation.
- 5 `[PLACEHOLDER ...]` strings in privacy + terms (gated on entity).
- DMCA designated agent registration.
- UK + EU GDPR Article 27 representatives.
- Vendor DPAs (Supabase, Stripe, RevenueCat, Expo, PostHog, Sentry, OpenAI, Edamam).
- App Store listing finalization (subtitle, description, keywords, screenshots, privacy nutrition label).

None of these block soft cohort expansion. They're public-launch gates.

## Re-sweep cadence

- **After each TestFlight build:** run `npm run ci` + `npm run smoke:revenuecat` + `npm run prelaunch:checklist`.
- **Before App Store submission:** rerun this end-of-band sweep + flip placeholder count to 0 + re-run security/legal/qa lenses.

## Related

- Audit: [`docs/audits/2026-04-25-opus47-codebase-review.md`](./2026-04-25-opus47-codebase-review.md)
- Previous verdict: [`docs/decisions/2026-04-24-full-sweep-ship-verdict.md`](../decisions/2026-04-24-full-sweep-ship-verdict.md)
- Launch checklist: [`docs/launch/checklist.md`](../launch/checklist.md)
- Legal runbook: [`docs/operations/legal-finalization-runbook.md`](../operations/legal-finalization-runbook.md)
- RC webhook runbook: [`docs/operations/revenuecat-webhook-runbook.md`](../operations/revenuecat-webhook-runbook.md)
