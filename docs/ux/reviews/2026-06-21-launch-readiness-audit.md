# Independent Product, Engineering & Launch-Readiness Audit — Suppr / Sloe

**Date:** 2026-06-21
**Reviewer:** External due-diligence audit (autonomous, founder-commissioned, ultracode fan-out)
**Production DB reviewed:** project `fnfgxsignmuepshbebrl` (live, read-only SELECT + Supabase advisors)
**Code baseline:** the working tree churned branches *during* this run (other agents are actively committing) — it began at `8770f52e` (`cursor/critical-bug-investigation-c984`, main+2) and was at `75ab6816` (`agent/claude/sloe-v3-phase0-tokens`, main+2) by the time the fan-out read it. `main` = `e79ae804`. **Because of this churn, all file/branch claims below are time-sensitive; the load-bearing findings are anchored to the production database, which does not move with local git state.**
**Supersedes / extends:** `docs/ux/reviews/2026-06-14-launch-readiness-audit.md` (baseline `efe80c49`) and its two predecessors (06-11, 06-12). This pass re-verifies their P0/P1 set at HEAD, audits the **152-commit net-new surface** since 06-14 (cook-mode wave, recipe claim/ownership, fal.ai image generation, per-ingredient snapshots, the nutrition-core boundary), and goes deeper on the live production state than any prior pass. It does **not** overwrite the dated prior files. Left **untracked** for Grace's review.

> **Why this date, not the brief's `2026-06-11`.** That file exists, is committed, and is the documented origin of the Gate-0 program. Overwriting a historical artifact I did not create would destroy lineage, so per the operational brief this is written to today's date and explicitly supersedes the prior passes.

## Method (evidence-first; ultracode)

- **Inline scouting** by me of repo structure, all three prior audits, the 2026-06-10 nutrition-calculations audit, the SPOF/PITR/alerting runbooks, and the net-new commit range.
- **13 parallel specialist deep-dives** (architecture, security, data-integrity, nutrition-engine, vendor, food-logging, recipe-platform, meal-planning, code-quality, design/UX, competitive, prior-audit re-verification, production-readiness) — each read actual code at HEAD, none took intent on trust — followed by **adversarial re-verification of all 29 P0/P1 candidates** (each independently re-checked: true? reachable? already-fixed? correct severity?). Fan-out totals: **42 agents, 4.1M tokens, 1,269 tool calls, ~25 min.** 103 findings; the adversarial pass overturned several finder errors in both directions (it caught a fabricated "mobile single-timer" parity gap → REFUTED, and an "AI budget never enforces" claim → ALREADY-FIXED, while confirming the data-loss and ops blockers).
- **Live production database verification by me** via Supabase MCP (SELECT-only): row counts, RLS state on every net-new table, grant inventory, live RLS-policy definitions, applied-migration ledger, and the full **security + the live advisor lint set**. This is where the headline finding came from — and it is the exact gap a code-only review cannot close.
- **Live web pixels by me** of the unauthenticated front door (landing desktop + mobile, pricing mobile) via `scripts/web-drive.mjs` — the surface the 2026-07-01 viral push actually lands on.

> **Evidence discipline.** Items I queried against prod are **DB-VERIFIED**; items I rendered are **LIVE-VERIFIED**; items confirmed by reading code at HEAD are **CODE-VERIFIED**; anything I could not exercise is **UNVERIFIED**. Two environmental limits this session, stated plainly so nothing reads as more-proven than it is: **(1) the iOS simulator could not run** — no iOS runtime is installed (`xcrun simctl list runtimes` is empty; the target device reports "runtime profile not found"), so there are **no fresh mobile pixels** this pass; mobile UX rests on the 06-14 LIVE-VERIFIED captures + code + the design lens. **(2) Web authed surfaces** redirect to `/login` (the e2e auth state is expired), so authed web was audited by component render + the prior pass, not driven live.

---

## 1. Executive Summary

Suppr/Sloe is a genuinely ambitious **eight-pillar** product (nutrition tracker, food logger, recipe manager, recipe importer, recipe discovery, meal planner, grocery planner, health-insights surface) whose **server/data tier and core nutrition math are materially ahead of a typical solo pre-launch build**, and whose **wedge — attributed Reel/TikTok import + make-it-fit-your-macros + adaptive TDEE on free — is real, well-architected, and occupies genuine category white-space.** Since the 06-14 audit the team has **closed most of the nutrition-data-trust cluster**: the `genericFoodMicros` bake errors are re-baked from correct USDA ids (grapes now 2 mg sodium, was 2,853), the FatSecret %DV guard and OAuth-cache scope shipped, USDA search now retries+degrades, the adherence-headline-backwards and macro-chip WCAG failures are fixed on both platforms, cook-mode gained an explicit servings-eaten confirmation, and a `nutrition_micros` column landed on saved-meal items. **The core daily loop and the nutrition formulas are trustworthy at the macro level, and the engineering discipline on the net-new range is real.**

**But this pass found one net-new code/data P0 the team does not know it has, because their own tests say it is fixed.** The "Harden recipe claim migration security" work (a hardening commit + a passing unit test) edited an **already-applied, future-dated migration in place**. I verified against **production**: `public.recipe_claims` is live with **RLS disabled, zero policies, and full `anon` + `authenticated` INSERT/UPDATE/DELETE/SELECT grants** (the Supabase linter flags it **ERROR — `rls_disabled_in_public`, EXTERNAL-facing**); the `recipes` table's claim-guard policies are the **old, un-hardened** versions and the protective CHECK constraint is **absent**; and the applied-migration ledger shows `20260702120000` already recorded — so **`supabase db push` will skip the hardening forever** unless a *new* migration version is cut. The data-integrity lens flagged the table but explicitly wrote *"live RLS bit not confirmable from code (could have been toggled in the dashboard)"* and the verifier called it ALREADY-FIXED; the security lens assumed merging `main` would fix it. **Both are wrong against production reality.** This is exactly the file-vs-database trap the whole audit exists to catch.

Alongside it, the **three operational launch blockers the prior audits named are all still open and now overdue**: the DMCA designated agent is unregistered (the viral hook is import, and import is the legal exposure); **four of six minimum production alarms are still "Not yet wired"** ten days before the planned Phase-1 push, and the one code-wired alert (Upstash-failure → Sentry) dead-ends on an unwired rule; and the **PITR backup decision is still OPEN with production on the Supabase free plan (24h RPO, restore never rehearsed, storage bytes unrecoverable), 20 days past its own deadline** (DB-VERIFIED: the org is on `free` today). Below that sits a P1 band that is **mostly trust-and-parity failures, not correctness catastrophes** — but several silently corrupt or under-count user data: re-logging a saved meal on **iOS** (the primary surface) and re-logging from the food-search Recent rows on both platforms still drop sugar/sodium/all micros; the web planner's "Log today" writes every planned meal to the current day (the mobile mis-dating fix was never ported); and the weekly check-in still ignores measured Apple Health burn despite its launch-blocker ticket being marked Done.

**Bottom line: CONDITIONAL-GO for a small, closed, comped founding cohort on the production TestFlight binary** — but **only after the `recipe_claims`/`recipes` lockdown is actually applied to production via a new migration** (not the existing skipped one), and with the DMCA agent in motion. **NOT READY for the 2026-07-01 viral free push** until the recipe-claim lockdown is live, the three ops blockers are closed (alarms wired, PITR decided + rehearsed, DMCA registered), the data-loss P1 cluster is fixed (mobile saved-meal + Recents micros, web planner date), the measured-burn check-in gap is closed or re-opened, and the import parse-rate floor (ENG-670) is actually measured. **Confidence: 8.5/10** — the headline P0 is DB-VERIFIED three ways (RLS bit, grants, advisor ERROR) plus the applied-migration ledger; the ops blockers were code- and DB-verified; the data-loss P1s carry exact file:line. −1.5 for: no fresh mobile pixels (sim runtime missing), authed web not driven live, and the live git churn meaning branch-level claims are a moving target.

## 2. Overall Product Score — **6.5 / 10**

Differentiated, defensible wedge no shipping competitor combines; the daily loop and import hero render premium and on-message (LIVE-VERIFIED on the web front door). The nutrition-trust cluster that dragged the prior score is largely repaired. Held back by: web↔mobile parity gaps on load-bearing flows (planner date, mobile saved-meal micros), no recipe collections (the Paprika gap that a successful viral import spike *creates*), no true pantry, the recipe-claim creator primitive being schema-only, pricing above the validated band, and the fact that the launch is gated by **founder-owned ops/legal items**, not features.

## 3. Overall Engineering Score — **6.5 / 10**

Server/data tier remains **strong (~8)**: fail-closed rate limiting, a now-*enforcing* AI cost breaker (ENG-1158 flipped it on in prod 2026-06-17), signature-verified webhooks with dedup, deterministic-first AI (the LLM never invents nutrition), a provider-agnostic health schema, and disciplined new-schema provenance work (ENG-751 immutable per-ingredient snapshot, content_origin). Pulled down to 6.5 by: **the migration-drift P0** (a hardening that exists in the file and the test but not the database); the **client-state monoliths that grew, not shrank** (the mobile Today monolith is now **7,003 lines** after ENG-619 "extracted" it — it was 6,613 at baseline; the web god-context grew 2,235→2,418; four web screens exceed 3,000 lines); the **screen-budget ratchet defeated 30× by upward re-pinning** (the "may only shrink" rule is convention-only in the script); and **ENG-620's nutrition-core "boundary" being 149 re-export shims** that nothing lint-enforces (bypassed 45×). The roadmap (AI coach, wearables, household) is gated by exactly the client architecture two refactors claimed to address.

## 4. Overall UX Score — **5.5 / 10**

Premium, calm, on-brand when it renders (Sloe palette, flat-card cohesion, confident import hero — LIVE-VERIFIED on web landing/pricing). The prior pass's worst UX gaps are **fixed**: macro-chip WCAG contrast, the backwards "108% · over" adherence headline, and raw-Pressable on the Today meal rows. **But the net-new cook-mode wave reintroduced the same craft debt it was told to avoid**: the CookIngredientChecklist amount label and CookMiseEnPlace eyebrow fail AA contrast (2.49:1 light), Discover recipe cards and the cook timer Stop button are raw Pressable (haptic-silent), and there are ~20 off-scale spacing/radius/fontSize literals across `cook.tsx`, `targets.tsx`, and the Discover surfaces. The design *system* is right; the write-discipline contract is not being enforced at write time on new surfaces. (Scored harsher than 06-14 because the audit can no longer credit "premium when it renders" sight-unseen — the iOS sim was down, and the forensic token census of the new code is unflattering.)

## 5. Overall Security Score — **6.5 / 10**

Posture is **fundamentally strong** — Gate-0 lockdown triggers intact (DB-VERIFIED present in prod), webhooks verified + idempotent, SSRF guard with DNS re-resolution, export/delete user-scoped, `getUserTier` fails to `free`, the ~13 anon-executable SECURITY DEFINER functions are still WARN-flagged but enforce `auth.uid()` + membership (carried-safe from the prior pass). **Knocked from the lens's 8 to 6.5 by the live `recipe_claims` exposure (P0):** an RLS-disabled, anon-writable public table the linter flags **ERROR**, plus the un-applied `recipes` claim guards, both because the hardening can't reach prod through `db push`. Residual: SUPPR_TEST_PREMIUM promo (now a P3 — still guessable, harmless during a free window), HIBP off, two mutable `search_path` functions, raw voice-transcript prompt interpolation (P3, bounded by deterministic-first arch).

## 6. Overall Nutrition Accuracy Score — **8 / 10**

**The strongest pillar after the import wedge, and genuinely improved.** The 2026-06-10 P0 (adaptive-TDEE slope bias) and the 06-14 nutrition P1s are **CODE/DB-VERIFIED fixed**: `genericFoodMicros` re-baked (grapes `fdc 174683` sodium 2 mg; apple `fdc 171688`), FatSecret %DV guard (ENG-1118) and OAuth-cache scope shipped, USDA retry+degrade shipped, the confidence-policy doc reconciled to the shipped 0.55. Residual is small and mostly precision/labeling: the **`verified_food_canonical` store is still empty (DB-VERIFIED 0 rows)** so the green "Verified" badge is a vendor-source label not consensus (downgraded to P3-semantics by the adversarial pass — defensible, but the copy still over-promises); the offline `allocateIngredientMacrosFromLines` reconciles **calories** to the recipe total but lets per-line macro sums drift (no largest-remainder residual); the ENG-751 snapshot's `parts == stored entry total` invariant is **not pinned by a test**; and OFF's Atwater filter drops alcoholic beverages (omits alcohol's 7 kcal/g).

## 7. Overall Recipe Platform Score — **6.5 / 10**

Import is the **strongest, most production-grade pillar** (multi-source verify cascade with confidence floors, strict structured extraction, SSRF-guarded fetch, disciplined legal posture). The **cook-mode wave shipped and is at/above the ReciMe/Paprika cook bar** (multi-timer stack — the adversarial pass REFUTED a finder's claim that mobile was single-timer; mobile DID get the concurrent stack via ENG-948). **Gaps:** DMCA agent (P0); a failed-verification import persists **0 kcal** rather than an honest "not estimated" (DOWNGRADED P3 but trust-relevant on the viral path); the entire cook wave ships **dark behind default-OFF flags** (so none of it is exercised by real users yet); ENG-870 recipe-claim is **schema + read-only display only — no claim flow exists**, and its server-owned lockdown isn't in prod (the P0); no collections (Paprika gap); cook done-card shows batch-scale calories while logging servings-eaten.

## 8. Overall Meal Planning Score — **6 / 10**

Solid shared macro-aware generator (one behaviourally-pinned algorithm, leftovers/templates, trust-correct empty slots). **But the end-to-end loop is still broken on web:** "Log today" writes every planned meal to **today**, ignoring the plan day's date — the mobile mis-dating fix (ENG-1132) was never ported (CONFIRMED P1), so there is no working planned-vs-consumed loop on web. Deleting a named plan slot **orphans its relational `meal_plan_days`/`meal_plan_meals` rows** (the tombstone suppresses metadata only — net-new). Still no pantry (re-buys staples weekly), and the shopping list lacks a non-ingredient skip filter.

---

## 9. Launch Readiness Assessment

**Verdict: CONDITIONAL-GO for a small closed comped founding cohort on the production binary, once the recipe-claim lockdown is actually applied to prod and DMCA is in motion. NOT READY for the 2026-07-01 viral free push.**

| Gate | Requirement | Status (this pass) |
|---|---|---|
| **Recipe-claim lockdown** | `recipe_claims` RLS on + `recipes` claim guards + CHECK constraint **in production** | **OPEN — P0.** DB-VERIFIED un-hardened in prod; advisor ERROR; the hardening migration version is already applied so `db push` skips it. **Net-new this pass.** |
| Gate-0 code | ENG-1035/1036/1043 lockdowns | **INTACT** (DB-VERIFIED triggers present). Behavioural 5/5 re-proof = P3 residual. |
| Legal | DMCA designated agent (ENG-859) | **OPEN — P0** for viral; bounded for a tiny cohort. Blocked on incorporation. |
| Ops — alerting | 6 minimum production alarms wired | **OPEN — P0.** 4 of 6 "Not yet wired"; the lone code-wired alert dead-ends on unwired Alarm 1. |
| Ops — backups | PITR decision + one rehearsed restore | **OPEN — P0.** Prod on **free plan** (DB-VERIFIED), RPO 24h, never rehearsed, storage unrecoverable, 20 days overdue. |
| Data trust | mobile saved-meal + Recents micros; web planner date | **OPEN — P1 cluster.** |
| Health safety | weekly check-in consumes measured burn | **OPEN — P1.** ENG-1111 marked Done; the named surface still ignores measured burn. |
| Viral hook quality | ENG-670 parse-rate floor measured | **NOT MEASURED.** |
| Device proof | TestFlight release-binary smoke + device matrix | **UNVERIFIED** (sim runtime missing this session). |

- **What breaks first at viral scale:** the **weekly-recap cron silently drops every opted-in user past row 5,000** (no `ORDER BY`, single `.range(0,4999)`, no pagination) — a retention lottery on the growth path. Then Edamam's account-wide cold-query ceiling, then the single shared Upstash producing a mixed-signal incident with no alarm routed to a human.
- **First support tickets / churn:** a logged saved meal on iOS reporting different micros than on web; the web planner silently logging tomorrow's dinner onto today; imported recipes showing "0 kcal" when ingredients don't resolve; a large imported library with no way to organise it.
- **Investor / TDD flags:** a hardening commit + passing test that never reached the database; the 7,003-line Today monolith and a ratchet that only ratchets up; production on a free-tier DB with no rehearsed restore 10 days before a viral launch.

**Recommended gate:** cut a **new** forward-only migration that applies the recipe-claim lockdown to prod and verify the live RLS bit → DMCA in motion → wire the 4 alarms + set `SUPABASE_PAT` → decide PITR + run one rehearsed restore → fix the data-loss P1 cluster → measure ENG-670 → 20–50 comped founding cohort on the **release binary** (not the dev client).

---

## 10. P0 Findings (must fix before onboarding users / before the viral launch)

### P0-1 — `recipe_claims` is RLS-disabled + anon-writable in production, and the `recipes` claim-guards never landed, because the security hardening edited an already-applied migration (NET-NEW) · security/data-integrity · **DB-VERIFIED**
- **Evidence (production, project `fnfgxsignmuepshbebrl`):** `pg_class.relrowsecurity = false` and **0 policies** on `public.recipe_claims`; `information_schema.role_table_grants` shows **`anon` and `authenticated` both hold SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER**; **Supabase advisor returns `rls_disabled_in_public` at level ERROR, facing EXTERNAL** ("Table `public.recipe_claims` is public, but RLS has not been enabled"). On `recipes`: the live `recipes_insert_own`/`recipes_update_own` `WITH CHECK` clauses contain **none** of the claim guards (`content_origin <> 'claimed'`, `claimed_by IS NULL`, …); the CHECK constraint `recipes_claimed_requires_verified_claim` **does not exist** (`pg_get_constraintdef` = null). The applied-migration ledger shows `max(version) = 20260702120000` — the recipe-claim migration is **already recorded as applied**. The hardening (RLS enable, `revoke all`, the CHECK constraint, and the `recipes` policy rewrites) was added by commit `8770f52e` *to that same already-applied migration file*, so `supabase db push --linked` (which applies only versions absent from `schema_migrations`) will **skip it permanently**.
- **Impact:** Today: any unauthenticated internet client can read, insert, forge, update, delete, or TRUNCATE `recipe_claims` rows via PostgREST (the table is empty now, so the immediate data blast radius is bounded — but it is a storage/abuse vector and, once the post-launch claim flow populates it, a direct leak of claimant UUIDs + verification evidence and a forgeable audit trail). Separately, because the `recipes` claim guards and constraint are absent, **any base/Pro user can directly `UPDATE` their own recipe to set `content_origin='claimed'` + `claimed_by`=self + an arbitrary `claim_verification` JSON with zero proof** — self-asserting "official/claimed" creator status, which is read into the mobile recipe model (`apps/mobile/lib/recipes.ts:156,592`). For a viral creator platform whose trust signal is verified ownership, that is an impersonation hole. The deeper problem is that **the team's own unit test (`tests/unit/recipeClaimMigrationSecurity.test.ts`) and hardening commit assert this is fixed**, so it would ship believed-closed.
- **Recommendation:** Do **not** edit `20260702120000` again (it will never re-run). Cut a **new** forward-only migration (e.g. `20260703…`) that: `alter table public.recipe_claims enable row level security; revoke all … from anon, authenticated;` adds owner-scoped policies (SELECT/INSERT where `claimant_id = auth.uid()`, status→`verified` only via service-role/SECURITY DEFINER), re-adds the `recipes_claimed_requires_verified_claim` CHECK, and re-applies the hardened `recipes_insert_own`/`recipes_update_own` policies. Stage it for `supabase db push --linked` (per CLAUDE.md, ask Grace to run it). Then **verify the live RLS bit + advisor clear** before any cohort. Add a CI grep-gate to `check:migrations` that fails if any `public` table lacks RLS, and a rule banning in-place edits to migrations already present in `schema_migrations`.
- **Issue:** *Apply recipe-claim lockdown to production via a NEW migration + verify live RLS (the hardening in 20260702120000 is skipped by db push).* **AC:** `relrowsecurity=true` + owner-scoped policies on `recipe_claims`; `recipes_claimed_requires_verified_claim` present; `recipes` policies block client-set `claimed`/`claimed_by`/`claim_verification`; advisor `rls_disabled_in_public` clears. **Tests:** keep the file test; add an integration test that an `authenticated` PostgREST UPDATE setting `content_origin='claimed'` is rejected, and a migration-static RLS-coverage gate.

### P0-2 — DMCA designated agent still unregistered; the live web/blog import path has no §512(c) shield (ENG-859) · legal · **CONFIRMED (CODE-VERIFIED)**
- **Evidence:** `app/api/recipe-import/route.ts:149-152` (auth-gated POST, `kill_recipe_import` flag defaults OFF), `:289,:611` (honest `SupprBot/1.0` UA on live web/blog server-fetch); takedown receiver exists (`app/api/dmca-takedown/route.ts:54-163`, `/dmca` + `/licences` public) but the **agent registration is the missing piece**; `docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md` ("safe harbour requires a filed designated agent + incorporation"). No DMCA/859 commit in `efe80c49..HEAD`.
- **Impact:** Without a registered agent there is no §512(c) safe harbour for user-imported third-party recipe content; exposure scales directly with the viral import volume that is the launch hook. A notice-and-action form is necessary but not sufficient.
- **Recommendation:** Founder-owned — register at copyright.gov ($6) once the incorporating entity + postal address exist; publish in Terms/footer + the import disclaimer. **Hard gate on the viral push; bounded for a tiny comped cohort.**
- **Issue:** *Register DMCA designated agent before the viral import launch (ENG-859).* **AC:** agent listed on the Copyright Office directory; legal pages + import disclaimer reference it. **Tests:** manual legal checklist.

### P0-3 — Four of six minimum production alarms still "Not yet wired" 10 days before Phase 1; the one code-wired alert dead-ends · production-readiness · **CONFIRMED (CODE-VERIFIED)**
- **Evidence:** `docs/operations/alerting.md` (unchanged since baseline — `git log efe80c49..HEAD` empty) lists Alarm 1 (Sentry new-issue/spike `:40`), Alarm 2 (Sentry quota `:52`), Alarm 4 (Stripe webhook delivery-failure `:81`), Alarm 5 (Vercel error-rate `:93`) all "Status: Not yet wired"; only Alarm 3 (PostHog cap, wired 2026-05-16) and Alarm 6 (Supabase advisor cron — but its `SUPABASE_PAT` is "to be set on Vercel by Grace") are wired. The only code-wired alert — `recordUpstashFailure()` (`src/lib/server/upstashMonitoring.ts:44-55`) firing on every rate-limit/AI-budget/vendor-cache failure (a documented cross-subsystem SPOF) — emits a `Sentry.captureMessage` that **reaches a human only if Sentry Alarm 1 exists, and it does not**. Alarm 7 (heartbeat — the exact alarm that would have caught the April→May 3-week silent PostHog outage) is unimplementable as written: `grep app_heartbeat` across `src` + `apps/mobile` = 0 hits.
- **Impact:** During the highest-risk window (a viral spike), the founder is blind to error spikes, Sentry/Stripe/Vercel failures, and Upstash SPOF events. The one real alerting signal goes nowhere.
- **Recommendation:** Run the runbook's own "test all 6 alarms in one afternoon" script (90 min–3 h, all Grace-only dashboard work): wire Alarms 1/2/4/5, set `SUPABASE_PAT` on Vercel prod (completes Alarm 6), add a once-per-session `app_heartbeat` PostHog event + a 30-min-absence alert (Alarm 7). Flip each `alerting.md` row to "Wired <date>" only after a canary email lands. **Deadline: before any Phase-1 onboarding.**
- **Issue:** *Wire the 4 unwired production alarms + heartbeat before Phase 1.* **AC:** all 6 show "Wired <date>" with a recorded canary test; `SUPABASE_PAT` set; `app_heartbeat` firing with its 0-count alert; launch-checklist rows 22 + 25b flip to Verified. **Tests:** each alarm's documented procedure emails `gracehowse@outlook.com` within the stated window.

### P0-4 — PITR backup decision still OPEN; production DB on the Supabase free plan (24h RPO), restore never rehearsed, storage bytes unrecoverable, 20 days overdue · production-readiness · **CONFIRMED (DB-VERIFIED + CODE-VERIFIED)**
- **Evidence:** `docs/decisions/2026-06-01-pitr-posture.md:4` ("Status: OPEN — awaiting Grace's call on spend", Blocks "Phase 1 public traffic"), `:57-59` (Decision section a blank placeholder); `git log efe80c49..HEAD` on the decision + DR runbook is empty (last touched 2026-06-02). **Live org plan = `free` today (DB-VERIFIED via Supabase `get_organization`).** DR runbook `disaster-recovery.md:41` (free plan, RPO 24h, "never rehearsed"), `:359-361` (three unchecked load-bearing boxes — rehearse PITR restore [BLOCKED on free plan], record rehearsal, decide upgrade), `:43,:167-181` (Supabase Storage has **no native backup** — if an object is deleted the bytes are gone; the ~£2/mo B2/R2 mirror is unbuilt). The runbook's own rule: "A restore that has never been rehearsed is a restore that doesn't exist."
- **Impact:** Entering a viral launch with a 24h RPO, a never-timed restore, and zero storage-byte recovery is the irreversible-user-data-loss class. A bad migration, a bad delete, or a Storage incident is unrecoverable beyond a day-old logical dump.
- **Recommendation:** Founder-owned spend decision: Option A (Pro + PITR, RPO ≤5 min) or at minimum Option C (Pro, makes restore rehearsable via branches) — Option B (accept 24h RPO) is explicitly not acceptable for Phase 1. Immediately after upgrade: run one timed restore rehearsal, record it in the DR log, stand up the storage mirror (or formally accept the gap in a dated decision), record the chosen option. **Deadline: the Phase-0→Phase-1 cutover.**
- **Issue:** *Record PITR decision, upgrade off free plan, rehearse + log one restore + storage mirror before Phase 1.* **AC:** decision recorded; project on Pro(+PITR); one timed restore logged with measured RTO; storage mirror live or gap accepted. **Tests:** timed restore-to-scratch with restored row counts diffed against live.

> **Carried P0 that is now P3, not dropped:** the prior **P0-2 Gate-0 production 5/5 re-proof** verifies down to **P3** this pass — the lockdown triggers are DB-VERIFIED present in prod (`profiles_tier_column_*_lockdown_trg`, `profiles_insert_lockdown_trigger`), ENG-1154 pinned their `search_path`, and the residual is only the behavioural 5/5 run (no `GATE0_VERIFY_PASSWORD` this session). Run it before a cohort, but it is no longer a blocker.

## 11. P1 Findings (fix before broader beta / the viral push)

Each carries its post-verification severity. Where a finding conflicts with an adversarial verdict I say so.

### P1-1 — Re-logging a saved meal on iOS (the primary surface) silently drops sugar/sodium/all micros; web carries them · food-logging/parity · **CONFIRMED**
- **Evidence:** `apps/mobile/app/(tabs)/_today/TodayScreen.tsx:1609-1623` and `:1708-1722` (the JournalMeal re-maps omit `e.micros`); contrast web `NutritionTracker.tsx:935-944` (`logSavedMeal` spreads `...payload` incl. micros). Capture-at-save and the `nutrition_micros` column (ENG-1106) both landed — so the data exists; the **mobile re-log path strips it.** `JournalMeal.micros` already type-checks.
- **Impact:** Silent, cumulative under-counting of sodium/sugar/vitamins on a core "usual meals" convenience flow, **specifically on the iOS primary surface**, while web is correct — a CLAUDE.md parity non-negotiable and a direct hit on the micro-breadth + sodium/sugar adherence differentiators.
- **Recommendation:** Add `if (e.micros && Object.keys(e.micros).length) jm.micros = e.micros;` to both mobile re-maps (~`:1623`, ~`:1722`). **Issue:** *Mobile saved-meal re-log must carry nutrition_micros (parity with web).* **AC:** a saved meal logged on iOS persists micros identical to web + to the source food. **Tests:** mobile behavioural + cross-platform parity assertion in `savedMealsLogic.test.ts`.

### P1-2 — Re-logging from the food-search "Recent"/"Past logged" rows drops sugar/sodium/all micros (both platforms) · food-logging · **CONFIRMED**
- **Evidence:** mobile `components/food-search/FoodSearchPanel.tsx:1305-1336` (`onSelectHistoryItem`: macros-only, hardcoded `sugarG:0/sodiumMg:0`, no micros) + `TodayScreen.tsx:2274-2283` (`recentFoodsForSearch` `.map` drops `micros`); web `FoodSearchPanel.tsx:1308-1336` (same). Contrast the fresh-search commit at `:1156-1157` which carries `microsPer100g/microsPerServing`.
- **Impact:** Narrower than the original 06-14 P1-3 (the QuickAdd + LogSheet recents paths and the `foodHistory.micros` type **are** fixed — verified) but still reachable and data-lossy on a primary daily re-log surface; both platforms affected. **Reconciliation:** the prior-audit re-verify lens marked P1-3/P1-4 "fixed" from the `foodHistory.ts` type, but the focused food-logging lens found these *specific* surfaces still strip — both are true; the data layer landed, two UI paths didn't, and (per the food-logging lens) **ENG-1105/1106/1107 shipped without the behavioural/parity tests that would have caught it.**
- **Recommendation:** Thread `microsPerServing: item.micros` through `onSelectHistoryItem` on both platforms, stop stripping `micros` in `recentFoodsForSearch`, remove the `sugarG:0/sodiumMg:0` literals (the `scaleMicrosPerServing` plumbing already exists). **AC:** re-logging a micro-rich food from Recent/Past-logged persists micros identical to fresh search. **Tests:** web + mobile behavioural + parity.

### P1-3 — Web planner "Log today" always logs to today, ignoring the plan day's date (the mobile ENG-1132 fix was never ported) · meal-planning/parity · **CONFIRMED**
- **Evidence:** `src/app/components/MealPlanner.tsx:617-653` (`handleLogToday` uses `addLoggedMeal`, no date, toast "to today") + `:2025-2029`; mobile `planner.tsx:4312-4360` uses `planDayCalendarDateKey` + label "Log as planned"; `AppDataContext.tsx:252-256` (`addLoggedMealForDate` exists, unused on web); `tests/unit/planDayCalendarDateKey.test.ts` (helper tested).
- **Impact:** On web there is **no working planned-vs-consumed loop** — a user who plans the week and logs from the Plan tab writes every entry to the current day, corrupting both the adherence story and the day's totals. The "Log today" label reads as deliberate, masking the bug.
- **Recommendation:** Port the mobile fix verbatim — compute `planDayCalendarDateKey(...)` and call `addLoggedMealForDate(dateKey, meal)`; rename to "Log as planned"; toast the target day. **AC:** the logged `nutrition_entries.date_key` = the plan day's calendar date, verified by test. **Tests:** web test mirroring `planDayCalendarDateKey.test.ts` + a parity test.

### P1-4 — Weekly check-in still ignores measured Apple Health burn, while its launch-blocker ticket (ENG-1111) is marked Done · nutrition/health-safety · **CONFIRMED real; adversarial pass severity P2, I hold at P1 on health-safety grounds**
- **Evidence:** `apps/mobile/app/weekly-recap.tsx` has 0 `measured` refs, no import of `resolveMaintenance`/`measuredTdee`; `:195` SELECT omits `measured_tdee*`; `:463-490` `currentTdeeKcal` = adaptive (confident) else `calculateTDEE()`; `:539` `buildWeeklyCheckin({currentTdeeKcal})`. The measured branch exists for *display* (`resolveMaintenance.ts:62-66`, `measuredTdee.ts`) but the check-in/goal-pace recompute doesn't consume it. Linear ENG-1111 = Done, `launch-blocker`. Prod: `profiles_has_measured_tdee = yes` (DB-VERIFIED).
- **Impact:** For an **under-logger with a high real burn**, the weekly check-in can surface a **dangerously low calorie target** — the exact health-safety regression class ENG-793/1111 exist to prevent. A closed launch-blocker masks a live gap (the silent-deferral pattern CLAUDE.md bans).
- **Why P1 not P2:** the adversarial verifier downgraded to P2 because it needs a specific scenario. On a nutrition product the founder's own framework rates health-safety/accuracy the highest-stakes class, and "Done-but-unfixed on its named surface" is precisely the rot to surface — so I hold P1.
- **Recommendation:** Route `weekly-recap.tsx`'s `currentTdeeKcal` through `resolveMaintenance` (add `measured_tdee*` to the SELECT; keep the double-count + below-formula guards), **or** re-open ENG-1111 / file a follow-up scoped to the check-in + goal-pace recompute and drop the "Done". **AC:** the check-in suggestion accounts for measured burn with no double-count. **Tests:** unit test over the burn-aware estimate.

### P1-5 — Discover recipe cards (mobile) are raw `Pressable` — no scale animation, no haptic · design/UX · **CONFIRMED**
- **Evidence:** `apps/mobile/components/discover/DiscoverClusterCarousels.tsx:46` (`Pressable`, no `PressableScale`, no haptic). Recipe browsing — a primary surface on the viral hook — feels dead on real hardware vs the PressableScale Today tab.
- **Recommendation:** Wrap in `PressableScale haptic='selection'`; sweep other raw Discover card Pressables. **AC:** tapping a Discover card shows the 0.96 scale + selection haptic. **Tests:** Maestro tap (also guards against double-navigate).

### P1-6 — Import parse-rate has no measured floor in code (ENG-670) — the moat's named weak spot is unmeasured at the wedge the launch leans on · competitive/quality · **adversarial pass REFUTED→P3; I hold at P1 for the viral gate**
- **Evidence:** per-stage telemetry exists (`src/lib/analytics/recipeImportPipelineTrace.ts:28-54`), but `grep ENG-670` across `app/api` = 0 (no gate in code); `docs/growth/tiktok-instagram-viral-plan.md:157,675` is a manual checklist; the category's loudest complaint (ReciMe/Julienne) is reliability.
- **Why I hold P1:** the verifier REFUTED on the grounds that telemetry exists and it's "strategy". But the launch *narrative* is import reliability, there is no measured floor and no release gate proving Suppr beats the baseline, and a bad parse rate on viral-Reel content is invisible until churn. For a launch gate that is P1.
- **Recommendation:** Convert ENG-670 from a checklist line to a measured gate: a 100-Reel fixture run computing per-platform success rate, a PostHog funnel off `recipe_import_pipeline_stage`, and a release-blocking ≥90% floor. **AC:** a watched per-platform parse-rate number + a blocking floor before the push.

> **Reconciliation of prior P1s (all re-checked at HEAD):** **FIXED** — genericFoodMicros grapes/apple re-bake, recents/QuickAdd micros (data layer), saved-meal micros *column*, adherence-headline-backwards, macro-chip WCAG, Today raw-Pressable, FatSecret %DV guard + OAuth cache, USDA retry/degrade, AI-budget enforcement (ENG-1158 ON in prod 2026-06-17). **STILL OPEN (re-graded):** verified_food_canonical empty → **P3 semantics** (DB-VERIFIED 0 rows; relabel the badge or populate); SUPPR_TEST_PREMIUM promo → **P3** (still guessable, harmless in a free window); web copy/duplicate `eaten_at` re-anchor + web non-atomic recompute → still open (P2/P3, see §12). MFP/Cal-AI intel → **P3** (refresh the SSOT doc).

## 12. P2 Findings (important improvements)

*Architecture / scale*
- **Weekly-recap cron silently drops users past an unordered 5,000-row cap** (`app/api/push/weekly-recap/route.ts:101,282-290` — `.range(0,4999)`, no `.order()`, no pagination). Adversarial pass DOWNGRADED P1→P2; **borderline P1 on the viral retention path** — fix before 5k opted-in users. Add `.order('id')` + cursor loop + a `selected vs total` metric.
- **ENG-619 "Today extraction" is cosmetic** — the monolith moved to `_today/TodayScreen.tsx` and **grew to 7,003 lines** (118 useState / 33 useEffect / 5 inline supabase calls); `useToday()` is a 40-line passthrough. No `useTodayData()` data layer. Do the real extraction before AI-coach/wearables (ENG-703/621).
- **Screen-budget ratchet defeated 30× by upward re-pinning** (`check-screen-line-budget.mjs:111-141` has no monotonic guard) — make `--write` refuse to raise an existing pin without an explicit flag + Linear ref; open shrink tickets for the worst (TodayScreen 7003, planner 4736, NutritionTracker 4198).
- **ENG-620 nutrition-core boundary is 149 re-export shims, not lint-enforced, bypassed 45×** (root `eslint.config.mjs:86` ignores `apps/mobile/**`). The one real win is the tested purity contract; add a `no-restricted-imports` rule so the boundary actually binds.
- **New fal image-budget subsystem multiplies the single-Upstash SPOF and is off the monitoring set** — `falBudget.ts` `incrBy/setIfAbsent` lack the `try/catch + recordUpstashFailure` the other subsystems have; `UpstashSubsystem` omits `fal_budget`. Caps are **global, not per-user** (£10/day, £150/mo) — bounded spend (good) but one viral spike or abuser exhausts the shared daily cap → image-gen off for everyone. Add per-user throttle + wire monitoring.
- **Single-region / single-Upstash SPOF still holds** — no `vercel.json` EU region; one Upstash carries 5 subsystems with divergent fail modes (one outage = a confusing mixed-signal incident). Set an EU region + add Upstash to monitoring before EU growth.
- **Viral/AI runtime deps ungated by `verify-production-env`** (`SUPADATA_KEY`, `FAL_KEY`, `ANTHROPIC/OPENAI`) — can run degraded in prod with no signal. **And the env gate itself is advisory-only / not in the Vercel build** (adversarial DOWNGRADE P1→P2): wire `verify:production-env` as a Vercel prebuild so a missing Upstash/Stripe/VAPID secret fails the deploy (runtime fail-closed in `rateLimit.ts:183-202` is the real backstop, so no unmitigated high-severity path).

*Data integrity (net-new)*
- **`recipe_steps` public SELECT is `using (true)`** — leaks the method of **unpublished/private** recipes to anyone. Scope it to published-or-author. (Verify the live policy; potential P1 if private recipe bodies are readable.)
- **`recipes_image_source_check` constraint mismatch** — the live constraint allows `'user_uploaded'` but the app writes `'user_upload'`; reconcile or inserts can fail.
- **`nutrition_entry_ingredients` has no `UNIQUE(entry_id,…)`** — a re-invocation duplicates snapshot rows; add the constraint + upsert.

*Nutrition / vendor*
- **OFF Atwater filter drops alcoholic beverages** (omits alcohol's 7 kcal/g) — beer/wine searches silently filtered.
- **ENG-751 snapshot `parts == stored entry total` invariant is not test-pinned** — add a property test; also add a regression asserting 0.5 kg/wk ≈ ~550 kcal/day on the adaptive-TDEE path.
- **FatSecret `/food` detail + USDA `/food` detail** — FatSecret detail still lacks quota guard + cache; USDA detail returns raw 502 on transient with no retry (search was fixed, detail wasn't).
- **Anthropic API version header `2023-06-01`** is two majors behind — pin to current and review tool-use/response-shape deltas.

*Food logging / parity (carried)*
- **Favourited-food re-logs drop micros** (`user_favorite_foods` has no micros column) — extend the ENG-1106 fix to favourites.
- **Web copy/duplicate/copy-yesterday don't re-anchor `eaten_at`** and **web recipe recompute is non-atomic** (no `save_verified_ingredients` RPC) — carried P2s from 06-14; reachable today via cross-platform rows, full corruption once `editable_eaten_at` ramps.

*Recipe / meal planning*
- **Entire cook-mode wave ships dark behind default-OFF flags** (ENG-946/947/948/949) — none of it is exercised by real users; ramp deliberately with before/after captures.
- **ENG-870 recipe-claim is schema + read-only display only — no claim flow exists** — the creator-claim primitive (a genuine differentiator) is unbuilt and unexploited in the narrative.
- **Deleting a named plan slot orphans its `meal_plan_days`/`meal_plan_meals` rows** — the tombstone suppresses metadata only, never the plan body.
- **Shopping list lacks a non-ingredient skip filter** (prep-state/serving phrases leak as grocery rows); **no pantry/staples**; categoriser still thin.
- **Concurrent cook-timer reducer (ENG-948) is shared on mobile but re-implemented inline on web** — same rule, two implementations; consolidate.
- **No recipe collections/folders** (Paprika/Plan-To-Eat gap) — ship a minimal user-collections primitive **before** broad beta, because the viral spike creates the large libraries that expose it. (Competitive lens DOWNGRADE P1→P2.)

*Design / UX (net-new craft debt)*
- **AA contrast fails on net-new cook surfaces** — `CookIngredientChecklist` amount label 2.49:1 (light), `CookMiseEnPlace` eyebrow 2.49:1 (light) — switch `textTertiary`→`textSecondary` (both pass). (Adversarial DOWNGRADE P1→P2; still ship-blocking craft on a safety surface.)
- **Web focus-visible HOLDS** on `DiscoverFeed.tsx:802` recipe slab cards — add `focus-visible:ring-2`.
- **~20 off-token literals on net-new surfaces** — `cook.tsx` (spacing 6/14/2, fontSize 16/12/15, `borderRadius:999`, alpha-hex concatenation), `targets.tsx` (radius 3/999/14, fontSize 12, 4 raw Pressable), web `DiscoverFeed`/`CookIngredientChecklist` (`py-3.5`, `gap-2.5`, `rounded-2xl`/`rounded-xl`), `DiscoverClusterCarousels` local `RECIPE_CARD_RADIUS=24` duplicating `CARD_RADIUS`. Token-swap pass + enforce the write-discipline contract on cook/Discover.

*Security (carried)*
- **HIBP leaked-password protection off** (live advisor WARN) — dashboard toggle; web uses password auth.

## 13. P3 Findings (future / polish)

- **`verified_food_canonical` empty (DB-VERIFIED 0 rows)** — relabel the "Verified" tier copy to "structured vendor source" or populate the consensus store; the badge over-promises.
- **SUPPR_TEST_PREMIUM promo** still guessable via an un-throttled RPC — deactivate in prod + add a DB-side throttle before paid GA (harmless during a free window).
- **Failed-verification import persists 0 kcal** (`recipe-import/route.ts:360-366,505-511` `?? 0`) — persist `null`/"not estimated" and block/warn logging from a 0-kcal recipe (trust-relevant on the viral path).
- **Two mutable `search_path` functions** (`save_verified_ingredients`, `ingredient_images_touch_updated_at`) — live advisor WARN; pin in a forward-only migration.
- **Voice-log transcript interpolated raw into the LLM parse prompt** — bounded by deterministic-first arch; add input fencing.
- **ENG-793/1111 silent deferral** beyond P1-4: weekly-checkin weight-delta permanently nulled with a "for now / see PR body" comment and no Linear ref — file it.
- **`recipes.content_origin` can drift from `claimed_by` on claimant deletion** (no guard); `nutrition_entry_ingredients` duplicate risk (see §12).
- **schema.md / nutritionEntryIngredients.ts** claim types "not yet regenerated" but they are — delete the stale note.
- **3 INFO advisors** (`rls_enabled_no_policy` on `promo_redeem_throttle`, `revenuecat_events`, `stripe_webhook_events`) — correct fail-closed for service-role writes; acceptable.
- **Cook done-state copy mismatch** ("Recipe done." mobile vs "Enjoy your meal!" web); cook timer Stop button raw Pressable (haptic-silent).
- **Anthropic version header, vendor error-envelope inconsistency, ingredient-image route global-budget-only cost control** (see §19).

## 14. Architecture Findings (6.5/10)

Two-app monorepo (Next.js 15/Vercel + Expo iOS/EAS) sharing `@suppr/shared`. **Server/data tier is genuinely mature** — fail-closed rate limiting, an AI cost breaker that now *enforces* in prod (ENG-1158), signature-verified + idempotent webhooks, a deterministic-first AI provider abstraction (single vendor-selection point — roadmap-ready for AI coaching), a provider-agnostic health schema (Oura/Garmin/Fitbit don't need a rewrite), and disciplined new-schema provenance (ENG-751 immutable snapshot with RLS-via-parent, content_origin). The net-new fal.ai image system is well-built at the route layer (atomic insert-on-conflict, shared cache, graceful 200-skip, reserve/settle budget on every failure path, enforcement ON). **The deduction is concentrated where it always is: client-state monoliths that *grew* (ENG-619 "extraction" → 7,003-line Today; web context 2,418; four web screens >3,000) plus the illusory ratchet, the shim-only nutrition-core boundary, the single-region/single-Upstash SPOF, and the weekly-recap 5k cap.** The schema supports the roadmap; the client architecture is what makes it expensive.

## 15. Code Quality Findings (6.5/10)

The net-new range carries **real discipline** in places — shared cross-platform business logic (cook-timer reducer, mealSlotAim, attribution), clean dead-code removal, a tested nutrition-core purity contract. But the structural debt **compounded**: 152 files over the 400-line cap with the ratchet **defeated 30× by upward re-pinning**; ENG-619/620 booked tickets for "extraction"/"boundary" that **moved code without decoupling it** (and grew the giant); web + mobile `FoodSearchPanel` both grew ~370 lines in parallel as near-duplicate 2,900-line shells; the cook-timer reducer is shared on mobile but re-implemented on web; and an untracked silent deferral ("for now / see PR body", no Linear ref) sits in the weekly-checkin path. Tests skew toward source-grep string-pins; **load-bearing data fixes (ENG-1105/1106/1107) shipped without the behavioural/parity tests that would have caught the micros-drop P1s.**

## 16. Security Findings (6.5/10)

**Strong posture with one live hole.** Gate-0 lockdown triggers DB-VERIFIED present + `search_path`-pinned; webhooks verified/idempotent; SSRF with DNS re-resolution; export/delete user-scoped; `getUserTier` fails to `free`; the ~13 anon SECURITY DEFINER functions are advisor-WARN but each enforces `auth.uid()` + membership (carried-safe). **The live hole is P0-1** — `recipe_claims` RLS-off + anon-writable (advisor ERROR) and the un-applied `recipes` claim guards, both stranded by an in-place edit to an applied migration. Residual: SUPPR_TEST_PREMIUM (P3), HIBP off (P3), two mutable `search_path` functions (P3), raw voice-transcript prompt interpolation (P3). Live advisors: **1 ERROR (recipe_claims), ~26 WARN (the SECURITY DEFINER set + HIBP + search_path), 3 INFO** (fail-closed service tables).

## 17. Food Logging Findings (7/10)

The **core write path is strong** — shared row-builder, `eaten_at`/`date_key` derived once, the per-serving 0-kcal class closed, optimistic rollback on web. The 06-14 micros data-layer fixes **landed** (foodHistory type, QuickAdd/LogSheet recents, the saved-meal column). **But two specific re-log surfaces still strip micros** — mobile saved-meal re-log (iOS, P1-1) and the food-search Recent/Past-logged rows on both platforms (P1-2) — and they shipped **without the parity tests** that would have caught them. Plus favourites drop micros (P2), web has no logged-meal edit + no `eaten_at` re-anchor on clone (P2), and there's no durable offline write queue.

## 18. Nutrition Engine Findings (8/10) — mission-critical

**The best it has been.** The adaptive-TDEE P0 and the 06-14 nutrition P1 cluster are CODE/DB-VERIFIED fixed (re-baked micros, FatSecret %DV guard, USDA resilience, confidence-policy reconciled to 0.55). The deterministic-first architecture means the LLM never computes nutrition. Residual is precision/labeling: empty canonical store behind a "Verified" badge (P3 semantics, DB-VERIFIED 0 rows); offline `allocateIngredientMacrosFromLines` reconciles calories but lets per-line macro sums drift (no largest-remainder residual); the ENG-751 `parts == total` invariant isn't test-pinned; OFF Atwater drops alcoholic beverages.

## 19. Vendor Integration Findings (7/10)

Quota guard + degraded envelope + per-100g reconciliation + AbortSignal timeouts + FatSecret ToS scrub are well-designed, and the 06-14 vendor P1/P2s are **RESOLVED** (genericFoodMicros, FatSecret %DV + OAuth-cache scope, USDA search retry/degrade). Residual: FatSecret `/food` detail lacks quota guard + cache; USDA `/food` detail returns raw 502 with no retry; the fal image budget is **global, not per-user** (one user can drain the shared daily cap → feature off for all); ingredient-image route is non-Pro-gated with only the global budget as cost control; vendor error-envelope shapes diverge; Anthropic version header is two majors stale. Edamam's account-wide cold-query ceiling remains the first economic wall at viral load.

## 20. Recipe Platform Findings (6.5/10)

Import is production-grade and the differentiator. The **cook-mode wave is real and at/above the ReciMe/Paprika bar** — and the adversarial pass corrected a finder who claimed mobile was single-timer (it got the concurrent stack via ENG-948). **Gaps:** DMCA (P0); failed-verification import persists 0 kcal (P3, trust-relevant); the whole cook wave is **dark behind default-OFF flags**; ENG-870 recipe-claim is **schema + read-only only, with its server-owned lockdown not in prod** (P0-1); no collections (P2); cook done-card shows batch-scale calories. Library search remains filter-only.

## 21. Meal Planning Findings (6/10)

Good shared generator. **The web planned-vs-consumed loop is broken** — "Log today" dates to today (P1-3). Named-slot delete orphans relational rows (P2). No pantry; shopping list lacks a non-ingredient skip filter. A serious Plan-To-Eat/AnyList user would not yet adopt this for the weekly loop on web.

## 22. Design System & UX Findings (5.5/10)

Token architecture is sound and the **06-14 P1s are fixed** (macro-chip contrast, adherence headline, Today haptics). **But the net-new cook + Discover surfaces reintroduced the exact craft debt the write-discipline contract bans** — AA contrast failures on the cook checklist/mise-en-place labels, raw Pressables (no haptic) on Discover cards + the timer Stop, web focus-visible gaps, and ~20 off-token spacing/radius/fontSize literals. The system is right; enforcement at write-time on new surfaces is not happening. (No fresh mobile pixels this pass — sim runtime missing — so this rests on the forensic token census + 06-14 captures.)

## 23. Competitive Analysis Findings

**Suppr occupies the single largest white-space in the category** — verified-multi-source nutrition + attributed Reel import + adaptive TDEE + meal planning + a viral loop, with import on the **free** tier. That integration is the moat.
- **Nutrition:** adaptive TDEE shipped free is ahead of MacroFactor (paid-only); micro panel beats MFP free but won't beat Cronometer's clinical breadth — keep micros a supporting strength.
- **Recipes:** macro-fit + attributed social import is ahead of Paprika/Crouton/ReciMe; **cook mode is now at/above the ReciMe/Paprika bar** (lean into it). Behind on organisation (no collections) and Discover depth.
- **Meal planning:** macro-aware auto-plan is ahead; behind Plan To Eat/AnyList on pantry, web parity, store APIs.
- **Health:** partial Apple Health; no Oura/Whoop/Garmin yet (schema supports them).
- **Strategic:** the SSOT competitor doc is **stale (pre-MFP/Cal-AI)** — refresh and re-test the refugee thesis (P3); **import reliability (ENG-670) is the moat's unmeasured soft spot** (P1-6); **the ENG-870 verified-claim primitive is a creator-plane differentiator no competitor ships — but it's unbuilt and invisible in the narrative**; Pro £7.99/mo · £59.99/yr is defensible against the all-in-one comparator (MFP Premium+ ~$99.99/yr) but above single-purpose trackers — name the right comparator.

## 24. Linear Backlog Assessment

Closure hygiene on the net-new range is good (the cook wave, ENG-751, ENG-1158, the nutrition re-bakes all shipped with referenced issues). **The backlog's failure mode is "Done masks a live gap":** ENG-1111 (measured-burn check-in) is Done while its named surface still ignores measured burn (P1-4); the recipe-claim hardening has a passing test + commit while production is un-hardened (P0-1); ENG-859 (DMCA) is the open launch-blocker; the three ops blockers (alarms, PITR, the Gate-0 re-proof) live partly in audit prose / runbook checkboxes rather than tracked, actionable issues with owners and deadlines. The screen-budget ratchet being defeated 30× means "CI green" no longer implies "the giants didn't grow."

## 25. Recommended New Issues

1. **P0** — Apply recipe-claim lockdown to prod via a **new** migration (the existing one is skipped by `db push`) + verify live RLS + advisor clear + add an RLS-coverage CI gate + ban in-place edits to applied migrations.
2. **P0** — Register DMCA designated agent (ENG-859).
3. **P0** — Wire the 4 unwired production alarms + heartbeat + set `SUPABASE_PAT` (track as `launch-blocker`).
4. **P0** — Record PITR decision, upgrade off free plan, rehearse + log one restore, stand up storage mirror.
5. **P1** — Mobile saved-meal re-log must carry `nutrition_micros` (parity) + favourites micros.
6. **P1** — Food-search Recent/Past-logged re-log must carry micros (both platforms) + the missing behavioural/parity tests for ENG-1105/1106/1107.
7. **P1** — Web planner "Log today" must date to the plan day (port ENG-1132) + rename "Log as planned".
8. **P1** — Weekly check-in must consume measured Apple Health TDEE (or re-open ENG-1111 and drop the "Done").
9. **P1** — Discover recipe cards → PressableScale + haptic.
10. **P1** — Convert ENG-670 into a measured, release-blocking import parse-rate floor + PostHog funnel.
11. **P2** — Weekly-recap cron deterministic pagination past 5k; make the screen-budget ratchet monotonic; lint-enforce the nutrition-core boundary; per-user fal cap + fal Upstash monitoring; wire `verify:production-env` into the Vercel build.
12. **P2** — `recipe_steps` SELECT scope to published-or-author; reconcile `recipes_image_source_check`; `nutrition_entry_ingredients` UNIQUE.
13. **P2** — Minimal recipe collections primitive before broad beta; web logged-meal edit + `eaten_at` re-anchor; named-slot delete must cascade plan-body rows.
14. **P2** — Cook/Discover token-swap + contrast/haptic fixes; ENG-751 invariant test; FatSecret/USDA detail-route resilience.
15. **P3** — Relabel "Verified" tier or populate canonical store; deactivate SUPPR_TEST_PREMIUM + throttle; failed-verify import → null not 0; pin `search_path`; refresh competitor SSOT.

## 26. Recommended Implementation Order

**Gate 0 (before any cohort):** P0-1 recipe-claim lockdown applied to prod + live-verified → P0-2 DMCA in motion → Supabase advisors zero ERROR → Gate-0 behavioural 5/5 → TestFlight smoke on the **release binary** (re-establish a working sim runtime first).

**Gate 1 (before the viral push):** P0-3 alarms wired + P0-4 PITR decided/rehearsed → data-loss P1 cluster (mobile saved-meal + Recents micros, web planner date) → P1-4 measured-burn check-in → P1-6 parse-rate floor measured → P1-5 Discover haptics + cook contrast → "Verified"-tier semantics → MFP/Cal-AI intel refresh → monetisation unblock (parallel, founder).

**Gate 2 (during beta):** real mobile data-layer extraction (ENG-703/621) before AI-coach/wearables; monotonic ratchet + giant-shrink tickets; collections; pantry + web Plan parity; vendor detail-route resilience; fal per-user cap; backlog "Done-masks-gap" sweep.

## 27. Recommended Test Strategy

- **Highest-value missing tests:** mobile saved-meal + Recents micros parity (web↔mobile); web planner `date_key`==plan-day; an **integration test that an `authenticated` PostgREST UPDATE setting `content_origin='claimed'` is rejected**, plus a **migration-static RLS-coverage gate** (no public table without RLS) and a gate banning in-place edits to applied migrations; ENG-751 `parts==total` invariant; measured-burn-aware check-in; a contrast census over the new cook tokens (model `tests/e2e/verify/contrast-audit.spec.ts`); import parse-rate fixture run.
- **Keep (real behaviour):** `adaptiveTdee`, `mealEatenAt`, `planDayCalendarDateKey`, `nutritionEntryRowPersistence`, the meal-plan algo battery, `recipeClaimMigrationSecurity` (but pair it with the live-RLS integration test above — the file test passing while prod is open is the precise failure this audit caught).
- **Do NOT count** source-grep string-pins as behavioural coverage; the micros-drop P1s prove the gap.
- **Gate suites in CI:** `verify-gate0-db.mts` (5/5), the RLS-coverage + applied-migration-edit gates, import-legal, SSRF, parity (`primaryNavParity`, shopping portion, a web/mobile `database.types.ts` diff), and a Vercel-prebuild `verify:production-env`.

## 28. Biggest Long-Term Risks

1. **Migration drift you can't see** — the recipe-claim P0 is the canary: a hardening that passes its test and ships believed-closed while production stays open. Without an RLS-coverage gate + a live-DB check in CI, the next one is invisible too.
2. **Client monoliths that grow under "extraction" tickets** — the 7,003-line Today + the defeated ratchet obstruct AI coach/wearables/family and make every feature more expensive.
3. **Food-data + parity trust** — the data layer is fixed but specific re-log surfaces still under-count micros, and the web planner mis-dates; for a trust product these are the corrosive class.
4. **Solo-founder ops critical path** — DMCA/incorporation, alarms, PITR on a free-tier DB with no rehearsed restore, single-region SPOF, no recovery vault. The launch is gated by founder-owned items, not code.
5. **Vendor economics** — Edamam's account-wide ceiling and the global (not per-user) fal cap at viral cold-query load.
6. **Scale is unproven** — production holds **1,002 entries across 7 loggers, 20 recipes (0 published), 17 profiles** (DB-VERIFIED) = founder + synthetic personas. No real load has touched the rate limiter, vendor quotas, or crons.

## 29. Open Questions

- **Will Grace apply the recipe-claim lockdown via a new migration (the existing version is skipped)?** And confirm the live RLS bit + advisor clear after?
- Gate-0 behavioural 5/5 with `GATE0_VERIFY_PASSWORD` — **UNVERIFIED** this session.
- Is `verified_food_canonical` meant to be populated (consensus pipeline) or is "Verified" permanently a vendor-source label? The trust copy depends on the answer.
- PITR: Option A or C — and when is the rehearsed restore?
- ENG-670 measured parse-rate vs the ReciMe/Julienne baseline?
- A working iOS sim runtime + a TestFlight release-binary smoke (cold open, import→save, plan→shop, promo→Pro, Health sync) — **none runnable this session.**
- Pricing: hold £59.99 with the all-in-one justification, or re-anchor?

## 30. Final Recommendation

**CONDITIONAL-GO for a small, closed, comped founding cohort on the production TestFlight binary — but the condition is now sharper than at 06-14:** the **`recipe_claims`/`recipes` lockdown must actually be applied to production via a new migration** (the committed hardening will never deploy through `db push`), the DMCA agent must be in motion, and the live RLS bit + advisors must be re-verified clean. The daily loop renders end-to-end, the nutrition math is trustworthy, and the data-trust cluster that dragged the prior score is largely repaired — so the founding-cohort exposure on the residual P1s is bounded because the cohort is tiny and comped.

**DO NOT execute the 2026-07-01 viral free push** until: the recipe-claim lockdown is **live in prod**, the **three ops blockers** are closed (alarms wired, PITR decided + one restore rehearsed off the free plan, DMCA registered), the **data-loss P1 cluster** is fixed (mobile saved-meal + Recents micros, web planner date), the **measured-burn check-in** gap is closed or re-opened, and the **import parse-rate floor (ENG-670)** is measured. The viral push *is* import-driven and creator-trust-driven, and the recipe-claim hole sits exactly on the creator-trust surface the launch narrative leans on.

**The engineering is not the bottleneck; a single DB-state P0 the team believes is fixed, the founder's ops/legal critical path, and a bounded data-trust + parity punch-list are.** Lean the narrative on the genuinely unique, defensible wedge — attributed Reel import + make-it-fit-your-macros + adaptive TDEE on free, now with a cook mode at the category bar — and re-sharpen it against an MFP that owns Cal AI.

**Confidence: 8.5/10.** The headline P0 is DB-VERIFIED three independent ways (the `relrowsecurity` bit, the anon grant inventory, and the Supabase advisor ERROR) plus the applied-migration ledger that proves `db push` can't fix it; the three ops blockers were code- and DB-verified (the free-plan state queried live); the data-loss P1s carry exact file:line and survived adversarial re-verification. −1.5 for: no fresh mobile pixels (the iOS sim runtime is not installed), authed web not driven live (expired auth), and the working tree churning branches mid-audit (so file/branch claims are a moving target — which is why every load-bearing finding is anchored to the production database, not local git).

---

## Real User Walkthrough Findings

**Environment reality this session, stated up front:** the **iOS simulator could not be driven** — no iOS runtime is installed (`xcrun simctl list runtimes` returns empty; the target device `C348952F-…` reports "unavailable, runtime profile not found"). So there are **no fresh mobile pixels** this pass; mobile UX findings rest on the 06-14 LIVE-VERIFIED captures, the code, and the forensic design-token census. **Authed web surfaces** redirect to `/login` (expired e2e auth), so they were audited by component render, not driven. **What I could drive live: the unauthenticated web front door** — the exact surface the 2026-07-01 viral push lands on — captured fresh via `scripts/web-drive.mjs` to `/tmp/audit-0621/`.

### Coverage

| Surface | Status | Evidence |
|---|---|---|
| Web landing — desktop | **PASS** | `/tmp/audit-0621/01-landing-desktop.png` (LIVE-VERIFIED) |
| Web landing — mobile | **PASS** | `02-landing-mobile.png` (LIVE-VERIFIED) |
| Web pricing — mobile | **PASS** | `03-pricing-mobile.png` (LIVE-VERIFIED) |
| Web `/signup` route | **PASS** (serves 200, no redirect — earlier capture anomaly was an artifact, not a bug) | curl + `app/signup/page.tsx` |
| iOS app (all surfaces) | **BLOCKED** | no sim runtime installed |
| Authed web (Today/Plan/Progress/Log) | **BLOCKED** | expired auth → `/login` |

### Journey 1 — Web landing (cold open, unauth) · PASS · LIVE-VERIFIED
Clean, premium, on-message: "Sloe" wordmark; nav (Recipes / How it works / Pricing / Log in / **Get started**); hero **"Cook what you love. *Still* reach your goals."**; subcopy **"Save any recipe from Instagram, TikTok or the web. Sloe works out the nutrition and helps it fit your day — no foods off-limits."**; CTAs "Get the app" (filled) + "Browse recipes" (ghost); a "Trending this week" carousel with real food photography. **The viral wedge (import from Instagram/TikTok + make-it-fit) is the hero — correctly placed.** *Trust: high. First impression is genuinely premium.*

### Journey 2 — Web pricing (mobile, unauth) · PASS · LIVE-VERIFIED
"SLOE PRO" hero reusing the brand line; a 2×2 value grid (**Unlimited imports / Macro fitting / AI coach / Cloud sync**); a Free/Pro comparison table (Log meals & macros, Browse community recipes, Barcode scanning all ✓/✓). Clean, legible, premium. *Note: the headline price sits below the first viewport; the £59.99/yr above-band concern is a positioning call (§23), not a render bug.*

### Journey 3 — `/signup` (good-discipline check) · PASS
An early web-drive capture *appeared* to redirect `/signup`→`/` (byte-identical PNG). I did **not** report it: `curl` confirms `/signup` serves **200 with zero redirects**, and `middleware.ts` keeps it public (`PUBLIC_ROUTES` includes `/signup` with the 307→`/onboarding` comment). It's a dedicated `LoginClient initialMode="signup"` surface. The screenshot was a pre-hydration capture artifact — **not a bug.** (Recorded as a deliberately-avoided phantom finding.)

### Journey 4 — iOS app · BLOCKED (documented, not skipped)
The primary surface could not be exercised — the sim has no runtime. This matters because **three of the most consequential findings live on the primary surface and could not be confirmed against fresh pixels**: the mobile saved-meal micros-drop (P1-1), the dark cook-mode wave behind OFF flags (P2), and the cook-surface contrast/haptic gaps (§22). They are CODE-VERIFIED with exact file:line, but a launch pass **must** re-run on a working sim + the TestFlight release binary before onboarding. **Action for next session: restore an iOS runtime (`xcodebuild -downloadPlatform iOS`) so the mobile walkthrough can run.**

### Cross-journey notes
- The **web front door is launch-ready and premium** — the part a stranger sees first is in good shape.
- The headline risks are **not "does it render"** — they are **what the database is doing** (an anon-writable claim table the team believes is locked), **what the data tells the user** (iOS saved-meal micros, web planner dating to the wrong day), and **what the founder hasn't wired yet** (alarms, backups, DMCA). A trust product cannot ship these blind, and two of them are invisible precisely because a passing test or a closed ticket says they're done.

---

*End of audit. Read-only throughout: no code, schema, flags, commits, or external state were modified by me. Production DB was read via SELECT + advisors only. A web dev server was started locally to capture unauth pixels and left running; no app data was written. This file is intentionally left untracked for Grace's review.*
