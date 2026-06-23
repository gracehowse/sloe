# Independent Product, Engineering & Launch-Readiness Audit — Suppr / Sloe

**Date:** 2026-06-22
**Reviewer:** External due-diligence audit (autonomous, founder-commissioned, ultracode fan-out)
**Production DB reviewed:** project `fnfgxsignmuepshbebrl` (live, read-only SELECT + Supabase advisors)
**Code baseline:** branch `agent/claude/sloe-v3-phase0-tokens` @ `cd1f339f` (`main` + the sloe-v3 wave). HEAD moves during agent sessions, so all file/branch claims are time-stamped to this run; the load-bearing findings are anchored to the **production database**, which does not move with git state.
**Supersedes / extends:** `docs/ux/reviews/2026-06-21-launch-readiness-audit.md` and its predecessors (06-11, 06-12, 06-14). This is an **independent re-audit**: it re-verifies the prior P0/P1 set against current code **and live production**, audits the **net-new surface since 06-21** (ENG-1223 scheme-aware macros, ENG-1225 unified import, ENG-1226 trusted-IP rate-limit, ENG-1227 mobile DMCA sheet), and adds what every prior pass lacked — **fresh iOS-primary pixels** (the simulator now has a runtime). Written to today's date and left **untracked** for Grace's review; it does not overwrite the dated prior files.

## Method (evidence-first; ultracode)

- **Inline scouting** by me: repo structure, all four prior audits, the 2026-06-10 nutrition-calculations audit, the SPOF/PITR/alerting runbooks, the Linear backlog (195 open via the GraphQL API), and the net-new commit range.
- **12 parallel specialist deep-dives** (architecture, security, nutrition-engine, vendor, food-logging, recipe-platform, meal-planning, code-quality, design/UX, competitive, data-integrity, production-readiness) — each read actual code at HEAD — followed by **adversarial re-verification of every P0/P1 candidate** (each independently re-checked: true? reachable? already-fixed? correct severity?). Fan-out totals: **39 agents, 3.2M tokens, 907 tool calls, ~31 min.** The adversarial pass overturned finder errors in both directions (it down-corrected 6 over-severe findings to P2 and re-rated the weekly-recap P0 → P1, while confirming the data-loss and ops blockers).
- **Live production database verification by me** via Supabase MCP (SELECT-only): RLS state + grants on the net-new claim/report tables, the full security advisor lint set, the applied-migration ledger, org subscription plan, and row counts.
- **Live iOS pixels by me** — the prior three passes had **zero** fresh mobile captures (no runtime). This pass booted the dev client against Metro and drove **seven core surfaces** (Today, Progress, Recipes, unified Import, Log, Plan, splash), reading every PNG.

> **Evidence discipline.** Items I queried against prod are **DB-VERIFIED**; items I rendered on the sim are **LIVE-VERIFIED**; items confirmed by reading code at HEAD are **CODE-VERIFIED**; anything I could not exercise is **UNVERIFIED**. Two limits stated plainly: **(1)** authed **web** surfaces redirect to `/login` (the e2e auth state is expired), so web UX was audited by component render + mobile-web parity, not driven live; **(2)** a few runtime-only facts (whether `AI_BUDGET_ENFORCEMENT_ENABLED` and `SUPABASE_PAT` are actually set in Vercel prod) cannot be confirmed from a read-only checkout and are marked UNVERIFIED with the exact `vercel env ls production` check to close them.

---

## 1. Executive Summary

Suppr/Sloe is a genuinely ambitious **eight-pillar** product (nutrition tracker, food logger, recipe manager, recipe importer, recipe discovery, meal planner, grocery planner, health-insights surface). On the two axes that matter most for a solo pre-launch build it is **materially ahead of the field**: the **core nutrition math is trustworthy** (the entire 2026-06-10 nutrition-audit P0/P1 cluster is independently re-verified **fixed, with regression tests** — adaptive-TDEE slope, the gain-goal 2× mismatch, per-day weight smoothing), and the **import wedge** (attributed Reel/TikTok → make-it-fit-your-macros, on free) occupies real category white-space and is the most production-grade pillar in the codebase. The **iOS app renders premium, calm and on-brand** — I drove seven core surfaces live and every one rendered cleanly with **no crashes**, including the v3 calorie ring that a Linear hotfix (ENG-1207) flagged for a Skia crash. The server/data tier shows real discipline: fail-closed rate limiting, signature-verified webhooks, SSRF-guarded import fetch, deterministic-first AI (the LLM never invents nutrition), and the net-new ENG-1225 import classifier is clean, pure, well-tested code.

**But the single most important finding is that the headline P0 the prior audit named 24 hours ago is still live in production today, and the control built to catch it is itself broken.** I verified three independent ways against prod that `public.recipe_claims` has **RLS disabled, zero policies, and full `anon` + `authenticated` INSERT/UPDATE/DELETE/SELECT/TRUNCATE grants** — the Supabase linter flags it **ERROR · `rls_disabled_in_public` · EXTERNAL-facing**. The fix exists in `supabase/migrations/20260702120000_eng870_recipe_claim.sql:57` (`enable row level security` + `revoke all … from anon, authenticated`), but that migration **version is already in the applied ledger** (DB-confirmed), so `supabase db push` **skips it forever** — it was edited in place after being applied. No new fix migration exists. The sibling `recipe_reports` table was applied correctly (RLS on), which proves the team can do this right; `recipe_claims` simply slipped through the migration-drift trap. And the **daily Supabase advisor cron — Alarm 6, the exact tripwire designed to catch `rls_disabled_in_public`** — is dark: its `SUPABASE_PAT` is unset, that prerequisite is **not in the production-env gate**, and a misconfigured run returns silently with no Sentry alert. The live ERROR was found by a human audit, not by the alarm. The current blast radius is *bounded* (the table is empty and no claim flow writes to it yet — DB-VERIFIED 0 rows), but shipping an anon-writable/truncatable public table to a viral audience is unacceptable, and because of the migration-process bug **it will not self-heal**.

Alongside it, the **three operational launch blockers every prior audit named are all still open and now further overdue**: **four of six minimum production alarms are still "Not yet wired"**; the **PITR backup decision is still OPEN with production on the Supabase free plan** (24h RPO, restore never rehearsed — DB-VERIFIED `plan: free`), ~3 weeks past its own deadline; and the **founder legal critical path** (DMCA designated agent, incorporation, Apple SBP, GDPR Art.27 reps, vendor DPAs) is entirely "Pending Grace." Below that sits a P1 band that is **mostly trust/parity failures, not correctness catastrophes**, but several silently corrupt user data: re-logging a saved meal on **iOS** (the primary surface) and re-logging from food-search Recents on both platforms still **drop sugar/sodium/all micros**; the **web planner "Log today" logs every planned meal to the current day** (no planned-vs-consumed loop on web); and the **flagship ENG-1225 unified-import routing is mobile-only** (web has the detection chip but no routing) — a net-new parity break on the launch feature, against the CLAUDE.md "web and mobile in sync" non-negotiable.

**Bottom line: CONDITIONAL-GO for a small, closed, comped founding cohort on the production TestFlight binary** — but **only after the `recipe_claims` lockdown is actually applied to production via a NEW migration** (not the existing skipped one) and the production alarms are wired. **NOT READY for the 2026-07-01 viral free push** until: the recipe-claim lockdown is live (RLS-on + owner-scoped policies + the claim-fraud CHECK that also never landed), the migration-drift checker is upgraded to compare *content* (so this class never recurs), the four alarms are wired and the advisor cron un-darkened, PITR is decided + rehearsed (which requires the Pro/compute upgrade the team's own scaling doc already calls for), the data-loss P1 cluster is fixed (mobile saved-meal + Recents micros, web planner date), the unified-import web parity gap is closed, and the import parse-rate floor (GROW-61/62) is actually measured.

**Confidence: 9/10.** The headline P0 is DB-VERIFIED three ways (RLS bit, grants, advisor ERROR) plus the applied-migration ledger; the ops blockers are code- and DB-verified; the data-loss P1s carry exact file:line; and unlike the prior three passes the mobile verdict rests on **fresh live pixels**, not inference. −1 for: authed web not driven live, and two enforcement facts (AI budget, advisor PAT) that need a one-line `vercel env ls` to settle.

## 2. Overall Product Score — **6.5 / 10**

A differentiated, defensible wedge no shipping competitor combines, and a daily loop + import hero that render premium and on-message (LIVE-VERIFIED on iOS). The nutrition-trust cluster that dragged prior scores is **repaired and test-pinned**. Held back by: web↔mobile parity gaps on **load-bearing, launch-flagged** flows (unified-import routing, planner date, mobile saved-meal micros), **no recipe collections** (the Paprika gap a successful import spike actively *creates*), the recipe-claim creator primitive being schema-only with no flow, Pro pricing above the validated single-tracker band, and the fact that the launch is gated by **founder-owned ops/legal items**, not features.

## 3. Overall Engineering Score — **6.5 / 10**

Server/data tier is **strong (~8)**: fail-closed rate limiting, signature-verified + idempotent webhooks, SSRF guard with DNS re-resolution, deterministic-first AI, disciplined new-schema provenance work, and a genuinely healthy shared business-logic spine (176 nutrition modules, 144 tested, zero `@ts-ignore`, zero raw TODO/FIXME). Pulled to 6.5 by: the **migration-drift P0** (a hardening that lives in the file and the test but not the database) and the **drift checker that can't see it** (compares version+name, never content); the **client-state monoliths that grew, not shrank** — the mobile Today component is **6,985 lines / 266 hooks** after ENG-619 "extracted" it (the extraction was a 40-line rename), the web god-context is **2,418 lines** re-rendering all 21 consumers on any mutation, six components exceed 3,000 lines; and the **screen-budget ratchet defeated by upward re-pinning** (`--write` re-pins to current size; a commit already grew the Today pin 6,939→7,003 with green CI). The roadmap (AI coach, wearables, household) lands squarely on the client architecture two refactors claimed to address.

## 4. Overall UX Score — **7 / 10**

This is the score I can defend with pixels, which the prior pass (5.5, pixel-blind) could not. Across **seven live iOS surfaces** the product is **premium, calm, coherent and on-brand**: the Sloe wordmark + palette, flat-card cohesion, a confident multi-modal Log sheet, a story-driven Progress surface with progressive unlock, and pointed anti-MFP positioning ("Barcode scan is free — always. No paywall. No asterisk."). Nothing crashed; the hero ring renders. Held below 8 by the **forensic token census on the net-new surfaces**: the ENG-1223/1225/cook-mode wave reintroduced craft debt the design system exists to prevent — `cook.tsx` uses a raw `'Menlo'` font string + off-ramp `fontSize: 38`, ~13 ad-hoc font sizes, four raw `Pressable`s with no haptic, and `WeeklyRecapCard` ships two unthemed hex literals; `cook.tsx` is also **1,921 lines** (the 400-line cap). The design *system* is right; the write-time discipline is not being enforced on new surfaces.

## 5. Overall Security Score — **6 / 10**

Code-level posture is **fundamentally strong (the security lens scored it 8)**: Supabase JWT verified server-side via `auth.getUser` (never trusting JWT contents), all 30 state-changing routes carry a deliberate CSRF-Origin + JWT posture, SSRF guard with DNS re-resolution, webhooks verified + idempotent, `getUserTier` fails to `free`, and the ENG-1226 trusted-client-IP fix is sound (prefers edge-injected `x-vercel-forwarded-for`/`x-real-ip`, rightmost-XFF fallback). **Knocked to 6 by the live `recipe_claims` exposure (P0) and — worse — the fact that the RLS-regression tripwire built to catch it is itself dark.** Residual: anonymous report/DMCA routes have no second abuse factor beyond IP (a rotating botnet can flood the reviewer queue); `/api` routes self-enforce auth with no middleware defense-in-depth; the account-delete route treats any `permission`-containing error as ignorable; HIBP leaked-password protection is off; two functions carry mutable `search_path`; ~13 anon-executable SECURITY DEFINER functions remain advisor-WARN (carried-safe — they enforce `auth.uid()`/membership internally).

## 6. Overall Nutrition Accuracy Score — **8.5 / 10**

**The strongest pillar after the import wedge, and the audit's clearest good-news story.** Every 2026-06-10 nutrition-audit P0/P1 is **independently re-verified FIXED on HEAD with regression tests**: the adaptive-TDEE slope bias (per-weigh-in EMA replaced by a gap-filled daily least-squares slope + confidence-aware cap, ENG-1024/1116 — CODE-VERIFIED by me), the gain-goal 2× display/math mismatch, per-day smoothing, the on-track tile. Residual is small and mostly precision/labeling: the **mobile saved-meal re-log strips `nutrition_micros`** (P1, see §17/§18); the **`verified_food_canonical` store is empty in prod (DB-VERIFIED 0 rows)** so the "Verified" badge is a vendor-source label, not consensus; OFF's Atwater plausibility filter drops alcoholic beverages (omits alcohol's 7 kcal/g); and recipe min/avg ingredient confidence is computed over rows excluded from the totals.

## 7. Overall Recipe Platform Score — **6.5 / 10**

Import is the **most production-grade pillar** (multi-source verify cascade with confidence floors, SSRF-guarded fetch, strict structured extraction, an **honest "Calories not yet computed" pending state** — the prior "persists 0 kcal" claim is partly stale; it's surfaced honestly in the UI, only the DB row carries `calories:0`). The **cook-mode wave is built and web/mobile parity-symmetric** (multi-timer, ingredient checklist, swipe-steps, text-size) — but ships **dark behind default-OFF flags**, so none of it is exercised by real users yet. **Gaps:** no persistent recipe **collections/folders** (the signature Paprika feature, and exactly what a viral import spike creates demand for — P1); **ENG-870 recipe-claim is schema + read-only display only — no claim flow exists anywhere** (P1 feature-incompleteness, and the same table is the security P0); the flagship **unified-import routing is mobile-only** (P1 parity break); and the import parse-rate floor is a manual checklist line, never measured programmatically.

## 8. Overall Meal Planning Score — **6 / 10**

A genuinely capable macro-aware planner: a shared generator, leftovers/batch pass, named slots, templates, and — correcting a stale prior claim — **a real pantry/staples suppress-list that is fully wired on both platforms**. The Plan tab renders well (per-slot macro aims summing to the day budget, one-tap "Generate fills all 7 days"). **But the planned-vs-consumed loop is silently broken on web:** "Log today" writes every planned meal to **today**, ignoring the plan day's date (the mobile ENG-1132 fix was never ported — CONFIRMED P1). Deleting a named plan slot **orphans its relational `meal_plan_days`/`meal_plan_meals` rows**, and the shopping list has no non-ingredient skip filter ("to taste", water, section headers all become purchasable lines).

---

## 9. Launch Readiness Assessment

**Verdict: CONDITIONAL-GO for a small closed comped founding cohort on the production TestFlight binary** — once the `recipe_claims` lockdown is actually applied to prod (new migration) and the production alarms are wired. **NOT READY for the 2026-07-01 viral free push.**

| Gate | Requirement | Status (this pass) |
|---|---|---|
| **Recipe-claim lockdown** | `recipe_claims` RLS on + owner-scoped policies + `recipes` claim-guards + claim-fraud CHECK **in production** | **OPEN — P0.** DB-VERIFIED un-hardened in prod; advisor ERROR; fix stranded in an already-applied migration; **still open 24h after the prior audit flagged it.** |
| Migration-drift class | Drift checker detects edited-after-apply migrations | **OPEN — P1.** Compares version+name only, never content; this whole class is invisible to CI. |
| Production alarms | 6 minimum alarms wired + tested | **OPEN — P0.** 4 of 6 "Not yet wired"; the one wired (advisor cron) is dark (`SUPABASE_PAT` unset, not in env gate). |
| Backups / DR | PITR decided + one rehearsed restore | **OPEN — P0.** Decision OPEN; prod on free plan (DB-VERIFIED), 24h RPO, restore never rehearsed. |
| Compute headroom | Pro + ≥Small before Phase 1 | **OPEN — P1.** Single-region Micro/Free; team's own doc says "borderline at 1,000 concurrent." |
| Legal | DMCA agent, incorporation, Apple SBP, GDPR Art.27, DPAs | **OPEN — P0** for the viral push; bounded for a tiny cohort. All "Pending Grace." |
| Data-loss P1 cluster | mobile saved-meal + Recents micros; web planner date | **OPEN — P1.** All CONFIRMED with file:line. |
| Flagship parity | Unified import routing on web | **OPEN — P1.** Web has the chip, no routing. Net-new. |
| Nutrition math | 2026-06-10 cluster fixed | **CLOSED.** CODE-VERIFIED + regression tests. |
| iOS render/crash | Hero surfaces render, no crash | **CLOSED.** LIVE-VERIFIED 7 surfaces, incl. the ENG-1207 ring. |

**First things real users will hit:** (1) a viral spike at single-region Micro compute → 5xx during the acquisition moment, with no alarm to lead it; (2) iOS users silently under-counting sodium/sugar/micros on the most common re-log paths; (3) web users who plan a week finding every meal logged to today; (4) MFP refugees who can't find CSV import behind the recipe-link-first framing; (5) importers with no way to organise a growing library (no collections).

---

## 10. P0 Findings (must fix before onboarding any users)

> Consolidated + de-duplicated across lenses; every item adversarially verified. The recipe-claim issue was independently surfaced by the security, data-integrity, production-readiness **and** recipe lenses.

### P0-1 — `recipe_claims` is RLS-disabled + anon-writable in production; the fix is stranded in an already-applied migration · security / data-integrity · **DB-VERIFIED (CONFIRMED)**
- **Evidence:** Live prod `fnfgxsignmuepshbebrl`: `pg_class.relrowsecurity = false`, **0 policies**, and `anon` + `authenticated` hold `SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` on `public.recipe_claims` (I queried `information_schema.role_table_grants`). Supabase advisor: **`rls_disabled_in_public` · ERROR · EXTERNAL**. The fix is `supabase/migrations/20260702120000_eng870_recipe_claim.sql:57-58` (`enable row level security` + `revoke all … from anon, authenticated`), but version `20260702120000` **is in `supabase_migrations.schema_migrations`** (DB-confirmed) — `db push` skips it. The sibling `recipe_reports` (`20260702120100`) applied correctly (RLS on, 1 policy). Data-integrity widened it: the hardened `recipes` claim-guard policies (`:68-104`) and the claim-fraud CHECK constraint (`:13-31`) **also never reached prod** — so a normal authenticated user can still `UPDATE recipes SET content_origin='claimed', claimed_by=auth.uid()` and mint a fake "official verified creator" recipe.
- **Impact:** Any holder of the public anon key (shipped in every client) can read/insert/forge/update/delete/**TRUNCATE** `recipe_claims` via `/rest/v1/recipe_claims`. Current blast radius is **bounded** (DB-VERIFIED 0 rows, no claim flow writes to it yet), but it is a live abuse/storage-injection vector that becomes catastrophic the moment a claim flow ships, and the claim-provenance trust model is already defeated via the missing `recipes` guards.
- **Recommendation:** Cut a **NEW forward-only migration** (e.g. `20260703120000`) — **do not edit `20260702120000`** — that runs the four idempotent statements: enable RLS + revoke grants on `recipe_claims`, add owner-scoped policies, re-apply the hardened `recipes` claim-guards, and add the `recipes_claimed_requires_verified_claim` CHECK. `supabase db push --linked`. Verify live.
- **Suggested Linear:** "P0: re-apply recipe_claims RLS + recipes claim-guards via a NEW migration (stranded by drift)."
- **Acceptance criteria:** Live prod shows `relrowsecurity=true` + ≥1 owner-scoped policy on `recipe_claims`; anon REST INSERT/SELECT/DELETE is rejected (401/403); the CHECK constraint is present; advisor `rls_disabled_in_public` clears.
- **Tests:** Live-DB RLS assertion (anon client INSERT/SELECT/DELETE on `recipe_claims` must 401/403) in the security regression suite; an integration test that an authenticated non-service `UPDATE recipes SET content_origin='claimed'` fails; pin `recipe_claims` in the migration-drift check.

### P0-2 — Four of six minimum production alarms are unwired, and the one "wired" alarm (the Supabase advisor cron) is dark · production-readiness / observability · **CONFIRMED (CODE-VERIFIED)**
- **Evidence:** `docs/operations/alerting.md` marks Alarms 1/2/4/5/7 "Not yet wired" (`:40,:52,:81,:93,:127`); Alarm 6 (the daily advisor cron, `app/api/cron/supabase-advisor-check/route.ts` + `src/lib/server/supabaseAdvisorCheck.ts`) is "Wired" but its `SUPABASE_PAT` is unset and that prerequisite is **not in `scripts/verify-production-env.ts`**, so a misconfigured run returns a silent 503 with **no Sentry capture** (`supabaseAdvisorCheck.ts:152-157`). The one code-wired alert (`upstashMonitoring.ts:44-55` → Sentry) only routes if Alarm 1's rule exists, which it doesn't. The dispositive proof: the live `recipe_claims` ERROR was found by a manual audit, not by the alarm built to catch exactly that lint. (A secondary structural defect: the route is POST-only gated on `x-cron-secret`, but Vercel native crons invoke via GET with `Authorization: Bearer`, so a native cron would 405 — UNVERIFIED against prod runtime logs.)
- **Impact:** During a viral spike the founder is blind to error spikes, Sentry quota burn, Stripe webhook failures (entitlement-leak risk), 5xx storms, and the single-Upstash SPOF — and the RLS-regression tripwire is non-functional.
- **Recommendation:** Run the runbook's "test all 6 alarms in one afternoon" script; set `SUPABASE_PAT` on Vercel prod and add it to the env gate; make a misconfigured advisor run emit a Sentry alert; add a 24h dead-man switch; reconcile the cron POST/GET contract.
- **Suggested Linear:** "P0: wire the 4 unwired production alarms + un-dark the Supabase advisor cron."
- **Acceptance criteria:** All 6 alarms show "Wired \<date\>" with a recorded canary test delivering to `gracehowse@outlook.com`; `recipe_claims` appears in Sentry; dead-man switch fails if no run in 24h.

### P0-3 — PITR backup decision still OPEN; production on the Supabase free plan (24h RPO), restore never rehearsed · production-readiness · **CONFIRMED (DB-VERIFIED + CODE-VERIFIED)**
- **Evidence:** `get_organization` → `plan: "free"` (DB-VERIFIED). `docs/decisions/2026-06-01-pitr-posture.md:4` Status OPEN, blank Decision; `docs/runbooks/disaster-recovery.md:41-42` confirms free / RPO 24h / PITR NOT ENABLED / never rehearsed. ~3 weeks past its own deadline.
- **Impact:** A single-region incident or bad write loses up to 24h of real users' logs/recipes/plans with a restore process never timed. The founder-safety-net doc names this as the one scenario with no auto-recovery.
- **Recommendation:** Founder spend decision now — Option A (Pro + PITR, RPO ≤5min) or at least Pro + compute (also unblocks the rehearsable restore and the §11 compute-headroom P1). Then run one timed restore-to-scratch and record RTO.
- **Suggested Linear:** "P0: enable PITR (Supabase Pro) + run one timed restore rehearsal."
- **Acceptance criteria:** Decision recorded with date + option; project on Pro (+PITR); one timed restore-to-scratch logged with measured RTO and row-count diff vs live.

### P0-4 — Founder legal critical path unresolved: DMCA designated agent, incorporation, Apple SBP, GDPR Art.27 reps, vendor DPAs · legal / production-readiness · **CONFIRMED (CODE-VERIFIED)**
- **Evidence:** `docs/launch/checklist.md:34-46` rows 9-18 all "Pending Grace"; DMCA registration (`#15`) blocked on incorporation (`#12`); the in-app reporting/DMCA **code** is ready (routes `app/api/dmca-takedown` + `app/api/recipe-report` exist, `recipe_reports` queue live in prod, legal contact = `dmca@getsloe.com`) — the gap is the **formal USCO designated-agent filing**, a legal action not code.
- **Impact:** Launching an import-driven viral push without a registered DMCA agent removes the §512(c) safe-harbour shield exactly when user-imported (potentially infringing) content scales. No incorporation → no Stripe Live → no web payments. No Apple SBP before the first paid sub locks 30% for 12 months.
- **Recommendation:** Sequence the long-lead founder path now: Cayman immigration call → CPA → Delaware LLC via Stripe Atlas → Stripe Live; file the USCO designated agent ($6) the moment the entity exists; enrol Apple SBP before any paid iOS sub.
- **Suggested Linear:** already tracked — GROW-47 (DMCA), GROW-55/50 (immigration/CPA), GROW-53 (SBP), GROW-66 (TM-1). Keep as the founder-gated launch cluster.
- **Acceptance criteria:** DMCA agent listed on the USCO directory + referenced on legal pages; entity formed + Stripe Live; SBP active; `npm run prelaunch:checklist` reports 0 placeholders.

> **Note on the "ENG-870 no-claim-flow P0" (recipe lens):** verified real, but it is *feature-incompleteness*, not a user-breaking defect — and it is the reason P0-1's blast radius is currently bounded (nothing writes to `recipe_claims`). Folded into P0-1 (security) + a P1 (feature) in §11. Not double-counted as a standalone P0.

---

## 11. P1 Findings (fix before broader beta)

### P1-1 — Mobile saved-meal re-log silently drops all micros (sugar/sodium/vitamins/alcohol/caffeine); web keeps them · food-logging / nutrition / parity · **CONFIRMED**
`apps/mobile/app/(tabs)/_today/TodayScreen.tsx:1608-1623` and `:1707-1722` re-map the saved meal without copying `e.micros`; `apps/mobile/lib/nutritionEntryRow.ts:59,99,133` then persists `nutrition_micros={}`. The builder *does* emit micros (`src/lib/nutrition/savedMealsLogic.ts:229-232`); web is correct (`NutritionTracker.tsx:935-…`). **Impact:** silent, cumulative, irreversible under-counting on the highest-frequency re-log surface — on iOS, the primary surface. **Fix:** copy `e.micros` when non-empty in both re-maps. **AC:** a micro-bearing saved meal logged via the QuickAdd "Usual meals" tap or the slot-header pill on iOS persists `nutrition_micros` identical to source + web. **Test:** behavioural mobile test on `logSavedMealFromPanel`/`logSavedMealFromSlotHeader` + cross-platform parity (current coverage is source-grep string-pins, not behavioural).

### P1-2 — Re-logging from the food-search Recent/Past-logged rows drops sugar/sodium/fiber/all micros on BOTH platforms · food-logging · **CONFIRMED**
`apps/mobile/components/food-search/FoodSearchPanel.tsx:1305-1336` (`sugarG:0/sodiumMg:0`, no micros); `src/app/components/food-search/FoodSearchPanel.tsx:1308-1336` (macros-only, drops fiber too); `onSelectHistoryItem` at `TodayScreen.tsx:2273-2282` + `NutritionTracker.tsx:3427-3436`. **Impact:** a primary daily re-log surface under-counts on both platforms; compounds P1-1. **Fix:** carry `item.micros` through the Recent maps and `onSelectHistoryItem`. **Test:** web + mobile behavioural test asserting persisted micros + parity.

### P1-3 — Web planner "Log today" always logs to the current day, ignoring the plan day's date · meal-planning / parity · **CONFIRMED**
`src/app/components/MealPlanner.tsx:617-653` (`handleLogToday → addLoggedMeal`, no date, toast "Logged … to today"); the button is on every meal row across all day columns (`:2025-2028`, `:2104-2112`). Mobile fixed this in ENG-1132 (`apps/mobile/app/(tabs)/planner.tsx:4320` `planDayCalendarDateKey` + "Log as planned"). I confirmed this first-hand by reading the handler. **Impact:** no working planned-vs-consumed loop on web; Thursday's planned dinner logs onto today, double-counting. **Fix:** port the mobile fix — compute the plan day's calendar date and call `addLoggedMealForDate`; relabel "Log as planned." (There is a `planWebParity` flag that hides the button — the team is mid-migration here; finish it.)

### P1-4 — Flagship ENG-1225 unified-import routing is mobile-only; web has the detection chip but no routing entry · recipe / parity · **CONFIRMED (net-new)**
`apps/mobile/lib/importRouting.ts:19` (`routeImport`) + `apps/mobile/components/import/UnifiedImportSheet.tsx`; web's only consumer is `src/app/components/suppr/import-detected-chip.tsx` (display-only) — no `routeImport`/`UnifiedImport` in `src/`. **Impact:** violates the CLAUDE.md "web and mobile in sync" non-negotiable on a *launch-flagged* feature; web users (the cloud-runnable surface, a real share of MFP refugees) get the detection cue but not the unify-everything routing. **Fix:** add a web UnifiedImport entry consuming `classifyImport` + a web `routeImport` mirror. **AC:** a pasted URL/CSV/plan/recipe-text on web is detected *and* routed to the correct existing flow, mirroring mobile.

### P1-5 — No persistent cross-platform recipe collections/folders (the Paprika gap a viral import spike creates) · recipe / competitive · **CONFIRMED**
`src/lib/discover/collections.ts:1` is a browser-only `localStorage` stub (`suppr-collections-v1`); `DiscoverFeed.tsx:131-132,583-585` notes "no wired data source yet"; no `collection` code on mobile; no `recipe_collections` table. **Impact:** a user importing dozens of TikTok recipes (the stated wedge) gets a flat, unorganisable library — the exact failure mode the viral hook creates. **Fix:** DB-backed `recipe_collections` + join table, owner-scoped RLS, parity UI on iOS (primary) + web.

### P1-6 — Mobile Today is a single 6,985-line / 266-hook component; ENG-619 "extraction" was a rename · code-quality / architecture · **CONFIRMED**
`wc -l apps/mobile/app/(tabs)/_today/TodayScreen.tsx` = 6,985 (118 `useState` / 33 `useEffect` / 69 `useCallback` / 49 `useMemo`); `useToday.ts` is 40 lines returning only router/params/insets/session. **Impact:** the highest-risk fragile file sits on the primary surface and retention loop, and is exactly where the AI-coach/wearables/household roadmap must land; unreviewable in one pass. **Fix:** real extraction (a `useTodayData()` hook owning fetch/supabase/derived state; sections into `components/today/*`; host < ~800 lines; ratchet the pin **down** in the same PR).

### P1-7 — Migration-drift detection compares version+name only, never content · data-integrity / CI · **CONFIRMED**
`scripts/check-migration-drift.ts:106-138,206-225` joins by name and compares version only; no `sha`/`hash`/`checksum` anywhere. **Impact:** the entire "edited an applied migration" class (which produced P0-1) is invisible to CI with green builds. **Fix:** store a committed content hash / git-blob sha per migration and fail CI when a file whose version is already applied changes content. **Test:** unit test — editing an already-applied migration exits non-zero; a new higher-version file passes.

### P1-8 — Supabase advisor cron is dark while a live RLS-off P0 exists · architecture / observability · **CONFIRMED**
(See P0-2 evidence.) Distinct framing for the backlog: the detection control for the P0 class is non-functional because its `SUPABASE_PAT` is unset, that prerequisite isn't gated, and misconfig is silent. **Fix:** verify the cron runs (logs + Sentry), gate the PAT, alert on misconfig, add a dead-man switch.

### P1-9 — Weekly-recap retention cron silently truncates at 5,000 unordered rows · production-readiness / retention · **CONFIRMED (severity P0→P1)**
I confirmed first-hand: `app/api/push/weekly-recap/route.ts:282-290` selects opted-in profiles with `.range(0, 4999)` and **no `.order()`** and **no cursor** — arbitrary heap order, single page. **Impact:** the instant opt-ins exceed 5k (a TikTok spike), an arbitrary ≤5,000 subset gets the weekly recap each run and the rest silently never do — a retention lottery, no error, no alarm, landing precisely when retention matters most. Bounded today (17 profiles) → P1 scaling, P2 for the current cohort. **Fix:** deterministic `ORDER BY` + keyset/offset drain across invocations; emit a dispatched-vs-eligible count. **Test:** seed 5,001+ eligible profiles, assert none dropped across runs.

### P1-10 — AI cost circuit-breaker defaults to monitoring-only; live enforcement unverified · production-readiness / cost · **CONFIRMED (enforcement UNVERIFIED)**
`src/lib/server/aiBudget.ts:28` (default `false`), `:197-198` (`isAiBudgetEnforcementEnabled = process.env.AI_BUDGET_ENFORCEMENT_ENABLED === 'true'`). The decision doc claims it's enabled, but it depends on an env var that can't be confirmed from a read-only checkout. **Impact:** if unset in Vercel prod, the cost ceiling is non-binding during the highest-cost window (a viral photo-log spike). **Fix:** confirm `AI_BUDGET_ENFORCEMENT_ENABLED=true` via `vercel env ls production` before the push; record it; add hard monthly caps on the Anthropic + OpenAI dashboards as the real backstop. **Test:** local `AI_BUDGET_GLOBAL_DAILY_GBP=1` + enforcement on → 2nd photo-log returns 503 `ai_capacity_reached`.

### P1-11 — Production single-region on Supabase Micro/Free compute ("borderline at 1,000 concurrent") · production-readiness / scaling · **CONFIRMED**
`docs/operations/supabase-scaling.md` (verified 2026-05-16: Micro, `max_connections 60`, pool 15/200; "borderline at 1,000 concurrent users"; "upgrade to Pro + Small before Phase 1"); org on free (DB-VERIFIED). **Impact:** at viral concurrency the pooler queues then errors → 5xx during the acquisition moment, with no alarm to lead it (P0-2). **Fix:** Pro + ≥Small compute before any non-founder traffic (also unblocks P0-3). **Test:** post-upgrade `pg_stat_activity` reading < 80% of `max_connections` at projected concurrency.

### P1-12 — Solo-founder recovery vault + trusted contact unconfigured · production-readiness · **CONFIRMED**
`docs/operations/founder-safety-net.md:98-99,103` — both boxes unchecked, Blocker 6 open, deadline 2026-06-15 passed (the kill-switch banner *is* wired: `DrOutageBanner.tsx`). **Impact:** at public scale the founder is the SPOF; a lost laptop or a week offline during an incident is unrecoverable. **Fix:** populate a credential vault (portal logins + 2FA seeds + recovery codes), print a physical recovery key, brief a trusted contact.

---

## 12. P2 Findings (important improvements)

- **Vendor — no retry on FatSecret/Edamam clients** (`CONFIRMED→P2`): a single transient error silently drops the source from the verify cascade. Add bounded retry + jitter.
- **Vendor — FatSecret Premier Free is US-dataset-only** (`CONFIRMED→P2`): UK branded foods uncovered for a UK-first product. Document + plan the tier call (GROW-64 territory).
- **Vendor — OFF still written to `food_sources` despite the cache-only ODbL decision** (`NEEDS-SEVERITY-CHANGE→P2`): re-introduces the attribution exposure the decision closed (GROW-64).
- **Vendor — OFF `searchProducts.ts` bypasses the Redis cache** (every search a live API call); **Edamam free-tier 1,000/day shared between search+detail** (exhausted by ~500 lookups); **USDA quota guard miscalibrated** (page-1 fires 2 HTTP calls, consumes 1 unit); **no schema validation on vendor responses** (schema changes fail silently).
- **Food-logging — favourited foods structurally cannot retain micros** (`user_favorite_foods` has no `nutrition_micros` column); micros-retention paths covered only by source-grep string-pin tests.
- **Meal-planning — deleting a named plan slot orphans relational `meal_plan_days`/`meal_plan_meals` rows**; shopping list has no non-ingredient skip filter ("to taste", water, headers become purchasable).
- **Recipe — cook-mode wave ships dark behind default-OFF flags** (the differentiators aren't exercised by users); **import parse-rate floor never measured programmatically** (GROW-61/62).
- **Code-quality — screen-budget ratchet has no monotonic guard** (`--write` re-pins upward; the Today pin already grew 6,939→7,003); **six components > 3,000 lines, 37 > 1,000**; **web AppDataContext (2,418 lines) re-renders all 21 consumers on any mutation**; **cook-timer logic duplicated** (shared reducer only consumed by mobile; web reimplements).
- **Design — net-new craft debt:** `cook.tsx` raw `'Menlo'` + `fontSize 38` (`CONFIRMED→P2`), ~13 ad-hoc font sizes, 4 raw `Pressable`s without `PressableScale`/haptic (Previous/Stop/star-rating/segmented-control); `targets.tsx` 18 ad-hoc font sizes + macro-tile missing `PressableScale`; `WeeklyRecapCard` two unthemed hex literals (`#1d1329`, `#C9C2D6`); `targets.tsx`+`discover.tsx` non-canonical macro-colour pattern instead of `useMacroColors()`; `ImportDetectedChip` 11pt mobile vs 13px web (`NEEDS-SEVERITY-CHANGE→P2`).
- **Data-integrity — `nutrition_entry_ingredients` lacks `UNIQUE(entry_id,name,source)`** (retry/backfill duplicates the immutable snapshot); **tier-lockdown `app.tier_writer` GUC bypass unproven against a hostile client** (no negative test); **re-importing the same recipe URL / duplicate saved meals create duplicate rows** (no source dedup).
- **Security — anonymous report/DMCA routes have no second abuse factor** beyond IP (rotating botnet floods the reviewer queue).
- **Competitive — no recipe collections** (above); **micronutrient breadth is a real Cronometer-tier strength but mis-positioned** if marketed as the headline.

## 13. P3 Findings (future / polish)

- Failed-verification imports persist recipe-level `calories:0` to the DB (honestly surfaced in UI; brittle data shape).
- Recipe min/avg ingredient confidence computed over rows excluded from the totals.
- `account/delete` treats any `permission`-containing error as ignorable (risks orphaned data); cascade docs stale (7+ tables rely on undocumented `auth.users` cascade).
- `/api` routes self-enforce auth with no middleware defense-in-depth.
- nutrition-core boundary = 150 one-line re-export shims + a parallel mobile shim layer (indirection bloat, not enforced).
- 289 `as any` concentrated ~60% in the monolith screens.
- Design: a long tail of off-scale radius/spacing/lineHeight literals in `cook.tsx`/`targets.tsx`/`discover.tsx`/`CreatorRail`; `cook.tsx` is 1,921 lines (400-line cap); missing `accessibilityRole`/`Label` on the active-cook Exit button.
- HIBP leaked-password protection off; two mutable-`search_path` functions; ~13 anon SECURITY DEFINER functions (carried-safe).
- No grocery-delivery integration (grocery pillar stops at the list).
- Custom-food/quantity inputs mis-parse comma-decimal locales → silent 0/truncated values (relevant for the EU-first market).

## 14. Architecture Findings

**Score 6/10.** Solid foundations — a real shared business-logic spine, deterministic-first AI, provider-agnostic health schema, fail-closed rate limiting — under three scale-gating problems plus the dark-tripwire P1. The **client-state monoliths** are the structural ceiling: mobile Today (6,985 lines), web AppDataContext (2,418 lines, all-consumers re-render), six files > 3,000 lines. The **screen-budget ratchet is launderable** (`--write` re-pins upward; already exploited). The **nutrition-core "boundary"** is 150 re-export shims that nothing lint-enforces. The roadmap the founder named (AI coaching, wearables, household, social, tiers) lands on exactly the client architecture two refactors claimed to fix but only relocated. Extensibility of the *server* tier is good; of the *client* tier is the risk.

## 15. Code Quality Findings

**Score 5/10.** The shared logic spine is genuinely healthy (176 nutrition modules, 144 tested, zero `@ts-ignore`, zero raw TODO/FIXME, no duplicate date/HTTP/state libs). Dragged down by the monolith debt (§14), the non-monotonic ratchet, duplicated cook-timer logic (web reimplements the shared reducer), and 289 `as any` concentrated in the biggest files. The fragile-area ranking is unambiguous: **`TodayScreen.tsx` is the single highest-risk file** — touch it for any roadmap feature and you risk regressions across unrelated state.

## 16. Security Findings

**Score 6/10** (code-level 8, pulled down by the live P0 + dark tripwire). Strong: server-side JWT verification, deliberate CSRF+JWT posture on all 30 mutating routes, SSRF guard, verified+idempotent webhooks, `getUserTier` fails to `free`, the sound ENG-1226 trusted-IP fix. The ENG-1226 fix is correctly applied to the two new abuse routes — **verify it also covers the other rate-limited routes** (auth, import, AI) rather than the forgeable leftmost-XFF. Open: P0-1 (`recipe_claims`), P0-2 (dark advisor cron), anon report/DMCA abuse factor, no middleware auth defense-in-depth, HIBP off, two mutable-`search_path` functions, ~13 anon SECURITY DEFINER (carried-safe). **Precision note:** the three `rls_enabled_no_policy` INFO tables (`promo_redeem_throttle`, `revenuecat_events`, `stripe_webhook_events`) carry anon grants too, but RLS-enabled + no-policy = **deny-all**, so they are safe — which is exactly why the linter rates them INFO and `recipe_claims` ERROR (its RLS is *disabled*, so the identical grants are live).

## 17. Food Logging Findings

**Score 6.5/10.** The core write path is strong — a shared row builder (`apps/mobile/lib/nutritionEntryRow.ts`), `eaten_at`-derived `date_key`, optimistic rollback, multi-modal input (search/scan/voice/photo/quick-add/NL-describe). The Log sheet (LIVE-VERIFIED) is best-in-class for input breadth with honest "review every item" AI framing and pointed free-barcode positioning. **The defects are micro-retention on the re-log paths** (P1-1, P1-2) and the favourites table lacking a micros column (P2) — silent under-counting concentrated on the highest-frequency surfaces, worst on iOS. Comma-decimal locale parsing (P3) matters for the EU-first market.

## 18. Nutrition Engine Findings

**Score 8.5/10 — the strongest area.** The 2026-06-10 audit's P0 (adaptive-TDEE slope bias) and P1 cluster are **CODE-VERIFIED fixed with regression tests** (gap-filled daily least-squares slope + confidence-aware cap; gain-goal 2× reconciled; per-day smoothing; on-track tile on the trend not raw readings). The math is trustworthy at the macro level. Residual: the saved-meal micros loss (P1-1, an engine-output integrity issue on the persist path), the empty `verified_food_canonical` store vs the "Verified" badge semantics (DB-VERIFIED 0 rows), OFF Atwater filter dropping alcohol's 7 kcal/g, and confidence computed over excluded rows. **Recommended tests:** a property test that recipe per-line macros sum (within rounding) to the recipe total after scaling; a parity test that saved-meal/Recents re-log preserves micros web=mobile; a guard test on the FatSecret v1→v2 %DV migration (v2 returns absolutes — a silent ~13× inflation risk).

## 19. Vendor Integration Findings

Substantially more mature than a typical early-stage product — timeouts on every external call, a per-vendor Upstash quota guard, the FatSecret Basic-tier compliance scrub. The gaps cluster around **resilience and economics at scale**: no retry on FatSecret/Edamam (single transient error drops a source), no circuit breaker (sustained outage = repeated timeout waits), OFF search bypasses the Redis cache, the Edamam free tier (1,000/day shared) is exhausted by ~500 lookups, the USDA quota guard is miscalibrated, and there's no schema validation on vendor responses. **Source-precedence/trust** is sound (deterministic-first, confidence floors); the **FatSecret US-only dataset** is the most user-visible gap for a UK-first launch. Cost model is fine at founder scale but the cache-bypass + shared-cap issues will bite economically in the viral window.

## 20. Recipe Platform Findings

**Score 6.5/10.** Import is the most production-grade pillar (multi-source verify cascade, SSRF-guarded fetch, strict structured extraction, honest pending-state). The net-new ENG-1225 classifier (`src/lib/recipe-import/classifyImport.ts`) is clean, pure, well-tested, with a conservative `recipe-text` fallback and an explicitly-tracked "collection" gap — a genuine strength. The unified Import **sheet** renders well on iOS (LIVE-VERIFIED). **But:** the routing is mobile-only (P1-4), there are no collections (P1-5), the claim feature is schema-only with no flow (and the same table is the security P0), and the whole cook-mode wave is dark behind flags. The import parse-rate floor — the moat's named weak spot — is unmeasured (P2).

## 21. Meal Planning Findings

**Score 6/10.** A capable macro-aware generator with leftovers/batch, named slots, templates, and a real pantry suppress-list (correcting the stale prior "no pantry"). The Plan tab renders well (LIVE-VERIFIED). The loop is broken on web (P1-3: "Log today" ignores the plan date), slot deletion orphans relational rows (P2), and the shopping list lacks a non-ingredient skip filter (P2). A serious Plan-To-Eat/Mealime user would adopt the generation but trip on the web logging loop and the flat (collection-less) library.

## 22. Design System Findings

The system itself is right — Sloe palette, flat-card cohesion, a real type ramp and token set, premium calm execution (LIVE-VERIFIED across seven iOS surfaces, all crash-free). The failure is **write-time enforcement on net-new surfaces**: the forensic census found 28 distinct violations on the ENG-1223/1225/cook-mode wave — a raw `'Menlo'` font string, off-ramp font sizes, raw `Pressable`s without haptics, unthemed hex literals, off-scale radii/spacing, and a 1,921-line `cook.tsx`. None are individually fatal; together they show the UI write-discipline contract isn't being applied as new surfaces ship. The fix is process (lint the tokens at write time), not redesign.

## 23. Competitive Analysis Findings

**8/10 concept, 6.5/10 shipped-and-exploited.** Suppr genuinely spans all eight pillars at a credible bar — real Claude-vision photo logging, real LLM voice/NL parse, Cronometer-tier micros, MacroFactor-tier adaptive TDEE, all on *free*. The wedge (attributed Reel/TikTok import → make-it-fit) is real white-space no single competitor combines.

| Category | vs best-in-class | Verdict |
|---|---|---|
| Nutrition tracking | MFP, Cronometer, MacroFactor | **Ahead on free** (free adaptive TDEE + micros + barcode); behind on database breadth (vendor-dependent, FatSecret US-only). |
| Food logging | MFP, Cal AI | **At/above bar** for input breadth + honest AI framing; the free-barcode line is a sharp anti-MFP wedge. |
| Recipe management | Paprika, Crouton, Mela | **Behind** — no collections/folders, no true tagging depth. The signature gap. |
| Recipe import | ReciMe, Pestle | **Ahead** on multi-source + nutrition + attribution; but replicable (defensibility = parse-rate moat, currently unmeasured). |
| Meal planning | Mealime, Plan To Eat | **At bar** on generation; behind on the web logging loop + no grocery delivery. |
| Health insights | Oura, Whoop, Zoe | **Behind by design** (no wearable hardware); Apple Health bridge is the right scope. |

**Copy:** Paprika collections, Cronometer's region-aware DV picker. **Avoid:** marketing micros as the headline (it's a depth signal, not the hook). **Biggest differentiation opportunity:** make the import wedge *defensibly* good — measure and publish a parse-rate floor — and ship collections before the import spike creates the demand it can't serve.

## 24. Linear Backlog Assessment

**195 open issues** (21 urgent/P1, 48 high/P2, 59 medium, 20 low); top labels `platform/mobile:64`, `platform/web:61`, `agent/cursor:55`, `launch-blocker:6`. The backlog is well-structured and the launch-blocker cluster is correctly identified, but **the live audit reality outruns the ticket states** in three places worth fixing:

- **ENG-1226** ("Harden report/DMCA rate-limit to trusted edge IP") is P0 In Progress — but the code (`clientIp.ts`) is shipped and sound; this is a *verify-coverage* task, not net-new build.
- **ENG-1207** ("Skia JS/native mismatch crashes Today calorie ring") is "Duplicate" — LIVE-VERIFIED non-reproducing on the current v3 ring; safe to close with a note.
- **ENG-34** ("[Audit P0] FatSecret search returns no results") is Blocked/P1 — overlaps the vendor-resilience cluster; should be re-scoped under the vendor work.
- The **`recipe_claims` P0 has no dedicated ticket** that captures the *migration-drift* root cause — the existing ENG-870 work believes it's done. **Open a P0 ticket** (and the P1 drift-checker upgrade) so it can't be re-closed by a passing unit test.

Otherwise: the monetisation wiring (RevenueCat/IAP GROW-67 Duplicate, GROW-46, Apple SBP GROW-53) and the parse-rate gate (GROW-61/62) are correctly open and on the critical path.

## 25. Recommended New Issues

1. **P0** — Re-apply `recipe_claims` RLS + `recipes` claim-guards + claim-fraud CHECK via a **new** migration (stranded by drift). *(AC/tests in P0-1.)*
2. **P0** — Wire the 4 unwired production alarms + un-dark the Supabase advisor cron (set + gate `SUPABASE_PAT`, alert on misconfig, dead-man switch, fix the cron POST/GET contract).
3. **P0** — Enable PITR (Supabase Pro) + run one timed restore rehearsal; record RTO.
4. **P1** — Upgrade Supabase to Pro + ≥Small compute before any non-founder traffic (also unblocks #3).
5. **P1** — Migration-drift checker: fail CI when an already-applied migration's content changes (content hash / git-blob sha).
6. **P1** — Fix mobile saved-meal re-log to persist `nutrition_micros` (+ behavioural parity test).
7. **P1** — Fix food-search Recents re-log to carry micros on both platforms (+ parity test).
8. **P1** — Port the planner date fix to web ("Log as planned", plan-day `date_key`).
9. **P1** — Build the web UnifiedImport routing entry (consume `classifyImport` + `routeImport` mirror).
10. **P1** — DB-backed recipe collections (table + join + owner-scoped RLS + iOS/web parity UI).
11. **P1** — Paginate the weekly-recap cron (deterministic ORDER BY + cursor drain + dispatched-vs-eligible metric).
12. **P1** — Confirm `AI_BUDGET_ENFORCEMENT_ENABLED=true` in prod + add hard provider-dashboard spend caps.
13. **P1** — Genuinely decompose `TodayScreen.tsx` to < ~800 lines before any roadmap feature touches it.
14. **P2** — Make the screen-budget ratchet monotonic-down (block upward re-pins, even via `--write`).
15. **P2** — Vendor resilience pass: retry + circuit breaker + response schema validation + Redis-cache the OFF search path; calibrate the USDA quota unit.
16. **P2** — Add `nutrition_micros` to `user_favorite_foods`; add `UNIQUE(entry_id,name,source)` to `nutrition_entry_ingredients`.
17. **P2** — Token-lint the net-new surfaces (`cook.tsx`, `targets.tsx`, `discover.tsx`, `WeeklyRecapCard`, `ImportDetectedChip`) to clear the 28-violation census.

## 26. Recommended Implementation Order

**Gate A — before ANY users (founding cohort):** #1 (recipe_claims), #2 (alarms), #5 (drift checker — so #1 can't silently regress), #6/#7 (micros data-loss), then verify the ENG-1226 IP fix covers all rate-limited routes. *These are days, not weeks.*
**Gate B — before the viral push (2026-07-01):** #3 + #4 (PITR + compute), #4 unblocks the rehearsal; #8 + #9 (planner date + web import parity); #11 (recap pagination); #12 (AI budget); the founder legal path (P0-4); and **measure the import parse-rate floor (GROW-61/62)** — do not launch the import-led campaign on an unmeasured moat.
**Gate C — beta hardening:** #10 (collections, before the import spike), #13 (Today decomposition), #14–#17 (ratchet, vendor resilience, schema, token-lint).

## 27. Recommended Test Strategy

- **Live-DB security regression** (new): anon REST INSERT/SELECT/DELETE on every public table must 401/403; assert RLS-on + ≥1 policy on each. This is the test that would have caught P0-1 and that code-only CI cannot.
- **Migration-drift content gate** (new): editing an applied-version migration fails CI.
- **Cross-platform parity behavioural tests** (new): saved-meal + Recents re-log preserve `nutrition_micros` identically web=mobile; planner logs to the plan day's date; unified-import routing maps each `ImportKind` to the same flow on both platforms.
- **Nutrition property tests** (new): recipe per-line macros sum to the recipe total after scaling; FatSecret v1→v2 %DV migration guard.
- **Retention drain test** (new): 5,001+ eligible profiles → recap cron drops none.
- **Keep + extend** the strong existing nutrition unit suite (144/176 modules); replace the saved-meal *source-grep string-pin* tests with behavioural assertions.
- **Visual/E2E:** the Maestro + Playwright layers plus the new fresh-sim capture path; add a contrast/token CI lane for the design census.

## 28. Biggest Long-Term Risks

1. **Migration process, not any single migration.** P0-1 is a symptom; the disease is "edit-an-applied-migration with a checker that can't see content." Until #5 lands, every future RLS/constraint hardening can silently no-op against prod with green CI. This is the highest-leverage fix in the report.
2. **The client monoliths are the roadmap ceiling.** AI coach, wearables, household, social all land on `TodayScreen.tsx` (6,985 lines) and AppDataContext (2,418 lines). Two refactors relocated complexity without reducing it; the third must actually reduce it or the roadmap slows to a crawl.
3. **Solo-founder SPOF + free-tier ops.** No PITR, four dark alarms, no recovery vault, single-region Micro compute — the operational base is sized for N=1, and the entire growth thesis is a sudden N=10,000.
4. **Wedge defensibility is unmeasured.** The import moat is replicable; its only durable edge is parse quality, which is currently a manual checklist line. Measure it or the differentiation is a slogan.
5. **Trust erosion from silent data loss.** Micros under-counting is invisible until a user cross-checks against Cronometer — and nutrition trust, once lost, doesn't come back.

## 29. Open Questions

- Is `AI_BUDGET_ENFORCEMENT_ENABLED=true` and is `SUPABASE_PAT` set in Vercel prod? (One `vercel env ls production` settles both — the only two enforcement facts I couldn't verify read-only.)
- Does the daily advisor cron actually execute in prod (Vercel cron POST/GET contract), or has it never run?
- Is the ENG-1226 trusted-IP fix applied to the auth/import/AI rate-limited routes, or only the two DMCA/report routes?
- Is the recipe-link-first framing of the unified Import sheet intentional, given the classifier also handles CSV/meal-plan? (MFP refugees need to find CSV import.)
- What is the real, measured TikTok-Reel parse-rate today? (GROW-61/62 gate.)

## 30. Final Recommendation

**Do not start the 2026-07-01 viral free push on the current state.** The product's *substance* is strong — trustworthy nutrition math, a genuine wedge, a premium crash-free iOS app — and a **small closed comped founding cohort on the TestFlight binary is a reasonable CONDITIONAL-GO once P0-1 (recipe_claims) is actually applied to prod via a new migration and the production alarms are wired** (Gate A — days of work). But the public push is gated by a cluster that is mostly **process, ops and founder-legal**, not features: the migration-drift class (P0-1 + P1-7), the unwired/dark alarms (P0-2), PITR + compute (P0-3/P1-11), and the legal critical path (P0-4) — plus the data-loss and parity P1s that will quietly erode trust at exactly the moment acquisition spikes. **The most important single sentence in this audit: the headline P0 was named 24 hours ago and is still live today because the fix can't reach production and the alarm that should flag it is dark — fix the migration *process*, not just this migration, and the rest is a focused two-gate sprint.**

---

## Real User Walkthrough Findings

Driven live on the iOS simulator (dev client `com.supprclub.supprapp` against Metro 8082; device `Sloe-Verify` 25D9EF51, iOS 26.5). Seven surfaces captured and read as PNGs. **The prior three audits had zero fresh mobile pixels; this is the independent visual contribution.**

### Journey 1 — Cold launch → Today
- **Screens:** Sloe splash (cream + plum serif wordmark) → Today.
- **Observations:** Today renders "Evening, Grace · Monday 22 June", a week strip (M–S, 22 selected), a "Fresh start" eyebrow, the **v3 tick-dial calorie ring** showing "1,231 KCAL LEFT", GOAL/EATEN/BONUS (1,231/0/0), a "Fresh start — what's for dinner?" prompt (the north-star "what to eat next" moment), a "Hide macros" toggle, and the 4-tab + center-FAB bar.
- **Trust/visual:** premium, calm, on-brand. **The v3 ring renders with no Skia crash** (ENG-1207 does not reproduce — LIVE-VERIFIED). No layout/overflow/contrast issues at default size.
- **Bugs/friction:** none observed on render. (The data-integrity risk on this surface — saved-meal re-log micros — is code-path, not visible here.)

### Journey 2 — Progress
- **Screens:** Progress (D/W/M/6M/Y, W selected).
- **Observations:** "New week, fresh story" with a **progressive unlock** ("Log 3 days this week to unlock… 0/3 days logged"), weight 54.4 kg (START 51.9 / CURRENT 54.4 / GOAL — / RATE —) with a Trend/Scale toggle, a "+ Log weight" filled CTA, and "EST. TDEE 1,647 ADAPTIVE" in sage. Story-driven, not a dashboard — matches the agreed Progress direction.
- **Trust/visual:** the adaptive-TDEE surfacing is a real differentiator rendered honestly. Clean.
- **Friction:** AVG INTAKE / DEFICIT show "—" for the current week while EST TDEE shows a number (different windows) — defensible but a curious first-glance inconsistency.

### Journey 3 — Recipes (empty library)
- **Screens:** Recipes → Library (empty).
- **Observations:** Library/Discover tabs, category chips (All/Breakfast/Lunch/Dinner/Desser…), and a strong empty state: "No saved recipes yet — Import from a Reel or TikTok, create your own, or browse Discover" with **one filled CTA (Import a recipe) + two outline** (Create your own, Explore Discover) — correct hierarchy.
- **Friction/visual:** the import wedge is front-and-centre (good). Minor: the category chip row truncates "Dessert" at the edge (scrolls). **The collections gap (P1-5) is latent here** — a populated library would have no folders.

### Journey 4 — Unified Import (the launch wedge)
- **Screens:** Recipes → "Import a recipe" → Import sheet.
- **Observations:** "Paste a recipe link — From Instagram, TikTok, or any recipe site. If you just shared to Sloe, the link may already be on your clipboard — tap below." URL input + filled "Import" CTA + "Use clipboard" + "Import from photo" + a "WORKS WITH TT/IG/YT/W" row.
- **Trust/visual:** excellent — the "Use clipboard / shared to Sloe" copy nails the share-sheet flow; "Import from photo" covers screenshots.
- **Friction:** framed **recipe-link-first** though the classifier also routes CSV (MFP export) and meal-plan paste — an MFP-refugee looking for CSV import has no obvious entry here (see Open Questions). And per P1-4, **this routing exists only on mobile** — the web equivalent is display-only.

### Journey 5 — Log a meal (core daily loop)
- **Screens:** Log sheet (via `?openLog=1`).
- **Observations:** meal-type tabs (Breakfast/Lunch/Dinner/Snacks), a search+scan bar, four quick actions (Scan/Voice/Photo/Quick add), a prominent "Scan barcode" with the line **"Barcode scan is free — always. No paywall. No asterisk."**, a "Describe what you ate" → "Parse meal" AI card with honest "AI estimates from verified nutrition data. Review every item before logging.", and Favourites/Recent/My recipes/Saved meals tabs (a "Sourdough 272 kcal" favourite).
- **Trust/visual:** the strongest surface — multi-modal input at or above the MFP/Cal-AI bar, honest AI framing, and a sharp anti-MFP positioning line (MFP paywalled barcode scanning — the exodus trigger).
- **Bugs:** none visible — but this is the entry to the **P1-1/P1-2 micros-loss** re-log paths (Saved meals / Recent), which are silent at the data layer.

### Journey 6 — Plan (meal planning)
- **Screens:** Plan → This week.
- **Observations:** "Plan your week — Generate fills all 7 days around your targets", a filled "Generate ▾" + "Adjust constraints", "7 days · Today / All meals" filters, and day cards with per-slot macro aims (Mon: BREAKFAST ~310 / LUNCH ~370 / DINNER ~430 / SNACKS, summing to the ~1,231 budget).
- **Trust/visual:** clean, macro-aware, one-tap generation. Good.
- **Friction:** the **web** version of this loop is broken (P1-3); on mobile the loop is correct.

### Cross-journey verdict
Across all seven surfaces the iOS app is **premium, coherent, calm, on-message, and crash-free** — it would not look out of place next to MacroFactor or Cal AI, and its anti-MFP positioning is sharper than either. The visible product is *ahead* of where the prior pixel-blind audit feared. The risks are **not on the surface** — they are in the data layer (silent micros loss), the parity gaps (web unified-import, web planner date), the dark ops/security tripwires, and the founder-gated launch cluster. A user would trust this app on sight; the audit's job is to make sure that trust is earned beneath the pixels before the viral push points a TikTok hose at it.

---

*Prepared autonomously (read-only) for Grace's review. No code, migrations, flags, or production state were modified during this audit. Left untracked. Mobile captures (Today/Progress/Recipes/Import/Log/Plan/splash) live under `/tmp/sim_*.png` for this session.*
