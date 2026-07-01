# Independent Product, Engineering & Launch-Readiness Audit — Suppr / Sloe

**Date:** 2026-07-01 (the viral-push target date)
**Reviewer:** External due-diligence audit (autonomous, founder-commissioned, ultracode fan-out)
**Production DB reviewed:** project `fnfgxsignmuepshbebrl` (live, read-only SELECT + Supabase security advisors)
**Code baseline:** branch `agent/claude/eng-1246-editorial-profile-block` @ `1767e921` (`main` + the ENG-1246 editorial-profile wave). HEAD moves during agent sessions, so file/branch claims are stamped to this run; the load-bearing findings are anchored to the **production database**, which does not move with git state.
**Supersedes / extends:** `docs/ux/reviews/2026-06-22-launch-readiness-audit.md` and its predecessors (06-11/12/14/21). This is an **independent re-audit**: it re-verifies the entire 06-22 P0/P1 set against current code **and live production**, audits the **236 net-new commits since the 06-22 baseline** (ENG-1246 editorial profile, ENG-953 expenditure card, ENG-969 paywall trajectory chart, ENG-713 trend-only mode, ENG-855/854 make-it-fit, ENG-981 multi-link import, ENG-1283 import honesty, ENG-1262 delete-account rework, ENG-955 weigh-in reminders, GROW-61 parse-rate instrument), and refreshes the **iOS-primary pixels** on the current branch. Written to today's date, left **untracked** for Grace's review; it does not overwrite the dated prior files.

## Method (evidence-first; ultracode)

- **Inline verification by me (the lead):** repo structure; all five prior audits + the 2026-06-10 nutrition-calculations audit; the 236-commit range; and — the load-bearing part — **live production**: the Supabase org plan, the full security-advisor lint set, the RLS state + grants + CHECK constraints on the net-new claim/report tables, and row counts on `recipes` / `recipe_ingredients` / `recipe_claims` / `recipe_reports` / `user_favorite_foods`.
- **11 parallel specialist deep-dives** (food-logging, parity, production-readiness, security, nutrition-engine, recipe-import, meal-planning, architecture/code-quality, design/UX, vendor, competitive) — each read actual code at HEAD — followed by **adversarial re-verification of all 23 P0/P1 candidates** (each independently re-checked: real? reachable? already-fixed since 06-22? correct severity?). Fan-out totals: **34 agents, 3.4M tokens, 1,126 tool calls, ~81 min.** The adversarial pass overturned finder errors in both directions — it **refuted 1** finding, **down-corrected 8** from P1→P2/P3 and 2 from P0→P1, and confirmed the data-loss, ops, and wedge-measurement blockers.
- **Live iOS pixels by me** — booted the dev client (`com.supprclub.supprapp`) against Metro on the `Sloe-Verify` sim and drove Today, Progress, and the two net-new Progress surfaces (Expenditure card, Projected-weight card), reading every PNG.

> **Evidence discipline.** Items I queried against prod are **DB-VERIFIED**; items I rendered on the sim are **LIVE-VERIFIED**; items confirmed by reading code at HEAD are **CODE-VERIFIED**; anything I could not exercise is **UNVERIFIED** with the exact check named. Two standing limits: **(1)** authed **web** surfaces redirect to `/login` (the e2e auth state is expired), so web UX was audited by component render + mobile-web parity + the fresh mobile pixels, not driven live; **(2)** two runtime-only facts — whether `AI_BUDGET_ENFORCEMENT_ENABLED=true` and `SUPABASE_PAT` are set in Vercel prod — cannot be confirmed from a read-only checkout and are marked UNVERIFIED with the exact `vercel env ls production` check.

---

## 1. Executive Summary

Suppr/Sloe is a genuinely ambitious **eight-pillar** product (nutrition tracker, food logger, recipe manager, recipe importer, recipe discovery, meal planner, grocery planner, health-insights surface), and on this pass it is **materially safer and more finished than nine days ago**. **The single most important finding is good news: the headline P0 the 06-22 audit named — `recipe_claims` shipped RLS-disabled and anon-writable, with the fix stranded in an already-applied migration — is now RESOLVED in production, fixed exactly as recommended.** I verified three ways against live prod: `recipe_claims` now has `relrowsecurity=true`, `anon`/`authenticated` grants **revoked** (empty grant set), and the `recipes_claimed_requires_verified_claim` CHECK constraint present on `public.recipes` — landed via a **new forward-only migration** (`20260702120300`), not by editing the stranded one. The Supabase security advisor no longer reports `rls_disabled_in_public` at ERROR anywhere; the whole security floor is now WARN/INFO (the carried-safe deny-all tables + the known SECURITY-DEFINER set). The **net-new security surface** (account-deletion rework, recipe-report auth-gate, household export, the 20260702* migrations) is **clean — PASS, no P0/P1** — verified by probing prod as `anon`. Security moves from 6 → **8/10**.

The product *substance* remains strong. The **nutrition math is trustworthy** (the 06-10 cluster stays fixed with tests; the net-new make-it-fit solvers, slot distribution, and expenditure copy are property-tested and honest). **Monetisation is genuinely built, not stubbed** — RevenueCat IAP + Stripe with real signature-verified webhooks, idempotency, tier-lockdown, and a **UK-CMA-compliant paywall with no dark patterns** (a real differentiator now that Cal AI was pulled from the App Store for deceptive paywalls). The **iOS app renders premium, calm, crash-free, and trust-first** — I drove the net-new Progress surfaces live and the Expenditure card ("~2,120 kcal/day, High confidence") and Projected-weight card ("70.7 kg in ~5 weeks… an estimate, not a promise", with the 7,700 kcal ≈ 1 kg basis shown) are internally coherent and honestly framed.

**But it is still NOT READY to open the 2026-07-01 viral public push today**, for a cluster that is now mostly **operational, measurement, and data-loss**, not security:

1. **One true P0 remains — backups.** The Supabase org is still on the **free plan** (DB-VERIFIED): 24h RPO, no PITR, restore never rehearsed — the exact posture the team's own `pitr-posture` decision doc forbids entering Phase 1 on, and its Decision block is still blank. Strangers' food diaries about to enter a database with no point-in-time recovery.
2. **The import wedge's one quantitative launch gate has never been measured.** The GROW-61 parse-rate harness is real and honest, but it has **never been run against a real Reel battery** — the fixture is still 10 placeholder URLs and `livePassRatePct` is `null`. The entire push is bet on "watch this messy Reel become a macro-aware recipe," and whether that works for 9 of 10 users is **unknown on launch day**. Compounded by a correct-but-limiting legal posture: TikTok/IG import is **caption-text-only** (the server may not fetch the video body), so Reels whose recipe lives in on-screen text or voiceover return empty.
3. **Production alarms are still dark.** 4 of 6 minimum alarms are unwired and the alerting chain **dead-ends at an unwired Sentry rule** — a Stripe-webhook failure (entitlement leak) or a viral 5xx storm pages nobody. The advisor cron that should catch RLS regressions is still missing its prereqs from the env gate (and the recipe_claims ERROR was caught by a human, not the alarm).
4. **Silent nutrition data-loss on the highest-frequency re-log paths persists** (unchanged since 06-22): mobile saved-meal re-log and both platforms' food-search "Recent"/Favourites strip **drop sugar/sodium/all micros** — a cross-platform parity break where iOS (the primary surface) is the worse-behaved one.
5. **The plan→shopping loop silently under-buys**: adding a recipe to an empty plan slot never syncs it onto the shopping list (web + mobile, live default-ON), and the live PlanV3 surface has no per-meal remove.

**Bottom line: CONDITIONAL-GO for a small, closed, comped founding cohort on the production TestFlight binary — now a cleaner call than 06-22, because the security P0 is resolved.** **NOT READY for the 2026-07-01 viral free push** until: backups are decided + rehearsed (Supabase Pro), the alarms are wired, the import parse-rate gate is actually measured (GROW-61/62), the micros data-loss cluster is fixed, the plan→shopping add-sync gap is closed, AI-budget enforcement is confirmed live, and the founder legal path (DMCA agent, incorporation, Apple SBP) is confirmed.

**Confidence: 9/10.** The P0-1 resolution is DB-VERIFIED three ways plus the migration ledger; the backup P0 and the empty `recipe_ingredients`/favourites-micros facts are DB-VERIFIED; the data-loss and plan-sync P1s carry exact file:line and survived adversarial verification; the mobile verdict rests on fresh live pixels. −1 for: authed web not driven live, and the two Vercel-env enforcement facts that need a one-line `vercel env ls`.

## 2. Overall Product Score — **7 / 10**

Up from 6.5. A differentiated, defensible wedge no shipping competitor combines; a daily loop + import hero + honest monetisation that are built and render premium; and the security P0 that gated the founding cohort is closed. Held back by: the wedge's parse-rate being **unmeasured on launch day**, no persistent recipe collections (the Paprika gap a successful import spike *creates*), a free-tier **10-save cap** that collides with "organise your imported recipes," the plan→shopping add-sync gap, and a launch still gated by **founder-owned ops/legal**, not features.

## 3. Overall Engineering Score — **7 / 10**

Up from 6.5. The server/data tier is **strong (~8)**: fail-closed rate limiting, signature-verified + idempotent webhooks, SSRF guard, deterministic-first AI, and — the headline — the recipe_claims class was fixed **the right way** (a new forward-only migration + a live-verified CHECK constraint), proving the team can execute the migration discipline under pressure. Pulled to 7 by: the **root-cause guardrail still absent** — the migration-drift check compares timestamp+name only, with **zero content hashing** (`grep createHash|sha256|checksum` = 0), so the *class* that produced P0-1 is not structurally closed even though the instance is; the **screen-budget ratchet is launderable** (`--write` re-pins upward with no monotonic guard; TodayScreen grew 6,985→6,991 and can be re-pinned green); and the **client monoliths grew, not shrank** — TodayScreen 6,991 lines / 118 `useState`, web AppDataContext 2,468 lines / ~95-field single context value, six files > 3,000 lines, 38 > 1,000.

## 4. Overall UX Score — **7.5 / 10**

Defensible with fresh pixels. Across Today + Progress + the two net-new Progress cards the iOS app is **premium, calm, coherent, on-brand, and crash-free**, and the net-new surfaces are notably **trust-first**: the Expenditure card carries an honest "High confidence" chip; the Projected-weight card literally says "an estimate, not a promise" and shows the 7,700 kcal ≈ 1 kg basis. Held below 8 by: a forensic census that found **8 off-scale web spacing literals + 3 cross-platform radius/size mismatches** on the ENG-1246 profile block (web `rounded-xl`=10px vs mobile 8px; monogram 52 vs 48; `gap-1.5`/`px-2.5`/`mt-0.5`), a **missing hover/focus-visible ring on the web profile avatar button** (a11y), off-ramp fontSizes pre-pinned on the ENG-969/953 trajectory + expenditure cards, and two functional UX gaps on the live Plan surface (no per-meal remove; add-to-empty-slot doesn't sync the list). The design *system* is right; web-side write-time enforcement (which no CI gate covers) is the leak.

## 5. Overall Security Score — **8 / 10**

Up materially from 6. The live `recipe_claims` ERROR is **gone** (DB-VERIFIED: RLS on, grants revoked, CHECK present) and the whole advisor set is now WARN/INFO only. The net-new surface is genuinely well-built: account-deletion is export-first → error-gated → cascade-complete (every user-owned table verified to cascade to `auth.users`), the recipe-report endpoint is auth-gated (401 verified) with a real second abuse factor (per-user + trusted IP), household export is `user_id`-scoped, and all four spot-checked SECURITY-DEFINER functions enforce `auth.uid()` internally. Residual (all WARN/INFO, none launch-blocking): **HIBP leaked-password protection still OFF**; the **RevenueCat webhook uses a static bearer secret, not HMAC-V1 signature** (billing-state-manipulation risk if the secret leaks); `dmca_takedowns` lacks the belt-and-suspenders `REVOKE` its twin `recipe_reports` has (RLS still blocks all rows); the last mutable-`search_path` function; `/api` self-enforces auth with no middleware defence-in-depth.

## 6. Overall Nutrition Accuracy Score — **8.5 / 10**

Held — the strongest pillar after monetisation-honesty. The 06-10 cluster stays fixed with tests; the net-new make-it-fit solvers (`solvePortionToFit`, `distributeAroundAnchor`) are closed-form, divide-by-zero-guarded, floored non-negative, and property-tested; ENG-1177 slot distribution sums to the day budget; the ENG-1283 import path correctly **excludes** flagged/unmatched rows from recipe totals. Residual (both P2, both fail-safe — they drop data rather than show a wrong number): the **OFF Atwater plausibility filter still ignores alcohol's 7 kcal/g** and silently drops wine/beer/liqueurs from search (the exact 06-22 residual, still present); and **two divergent canonical slot-weight tables** mean the same empty day shows a different Dinner/Snacks aim on Today (.30/.15) vs Plan (.35/.10) — day totals stay correct, but a docstring falsely claims the tables are identical. Plus a P1 engine-*output*-integrity issue that lives in the food-logging section: the saved-meal/Recents micros loss.

## 7. Overall Recipe Platform Score — **6.5 / 10**

Import is the most production-grade pillar and is now **more honest** than most launch wedges: `/api/recipe-import` returns typed error codes (never a silent 0-kcal success), the ENG-1283 flagged-ingredient surfacing is real shared freeze-aware logic, and the cook-mode wave is now **default-ON** (no longer dark). **Two material gaps for the push:** (1) the **GROW-61/62 parse-rate gate has never produced a real number** (the moat's one quantitative bar, unmeasured on launch day) and TikTok/IG import is caption-text-only by legal posture; (2) still **no persistent cross-platform collections/folders** (localStorage stub only), and the free tier caps saves at **10** — so a viral power-user can neither save 50 imported recipes nor organise them.

## 8. Overall Meal Planning Score — **6 / 10**

The plan→shopping engine is genuinely good — a shared, well-tested pure delta-persist (add/merge/decrement) that preserves checked rows and is symmetric, reused verbatim web+mobile, and the 06-22 "orphan relational rows" residual is **RESOLVED** (DB-VERIFIED `ON DELETE CASCADE`). Leftovers are **not** a double-count (÷servings scaling verified). **But two live default-ON gaps remain:** adding a recipe to an empty plan slot **never syncs its ingredients to the list** on either platform (modelled as a swap whose outgoing placeholder resolves to null), so the list silently under-buys until a full regenerate; and the live PlanV3 surface exposes only swap/add/open — **no per-meal remove** — so the (well-built, tested) remove→decrement path is dead on the reachable surface. The 06-22 non-ingredient skip-filter residual is **still open** ("to taste" / "For the sauce:" / "Water" become purchasable rows). Web planner "Log today" still writes to the viewed tracker date, not the plan day's date (down-corrected to P2 this pass — see §11/§21).

---

## 9. Launch Readiness Assessment

**Verdict: CONDITIONAL-GO for a small closed comped founding cohort on the production TestFlight binary — cleaner than 06-22 now the security P0 is resolved. NOT READY for the 2026-07-01 viral free push.**

| Gate | Requirement | Status (this pass) |
|---|---|---|
| **Recipe-claim lockdown** | `recipe_claims` RLS on + grants revoked + `recipes` claim-guard CHECK in prod | **CLOSED — RESOLVED.** DB-VERIFIED three ways; forward migration `20260702120300`. |
| **Backups / DR** | PITR decided + one rehearsed restore | **OPEN — P0.** Org on free plan (DB-VERIFIED), 24h RPO, restore never rehearsed; decision block blank. |
| **Import wedge gate** | GROW-62 ≥90% usable imports on 100 real Reels, measured | **OPEN — P1.** Harness real but never run; `livePassRatePct` null; caption-only ceiling unmeasured. On launch day. |
| Production alarms | 6 minimum alarms wired + tested | **OPEN — P1** (was P0). 4 of 6 unwired; chain dead-ends at an unwired Sentry rule; advisor prereqs not in env gate. |
| Data-loss micros cluster | mobile saved-meal + Recents/Favourites micros | **OPEN — P1.** CONFIRMED with file:line, both platforms; iOS worse. |
| Plan→shopping loop | add-to-slot syncs list; per-meal remove reachable | **OPEN — P1.** Add-to-empty-slot doesn't sync (default-ON); no remove on live PlanV3. |
| AI cost enforcement | `AI_BUDGET_ENFORCEMENT_ENABLED=true` in prod | **OPEN — P1 UNVERIFIED.** Code default OFF; per-user rate limits cap blast radius; needs `vercel env ls`. |
| Compute headroom | Pro + ≥Small before Phase 1 | **OPEN — P2** (bounded). Micro/Free (`max_connections 60` DB-VERIFIED); "borderline at 1,000 concurrent". |
| Legal | DMCA agent, incorporation, Apple SBP, GDPR reps, DPAs | **OPEN — P1/founder-gated.** Code ready; the USCO filing + entity + SBP are external, UNVERIFIED from repo. |
| Migration-drift class guard | Drift check detects edited-applied migrations by content | **OPEN — P2.** Instance fixed; content-hash guard still absent. |
| Nutrition math | 06-10 cluster + net-new solvers correct | **CLOSED.** CODE-VERIFIED + tests. |
| iOS render/crash | Hero + net-new surfaces render, no crash | **CLOSED.** LIVE-VERIFIED (Today, Progress, Expenditure, Projected-weight). |

**First things real users will hit:** (1) an unmeasured import demo that could fail on a cold-traffic user's first attempt (the exact moment the TikTok push is paying to create); (2) a viral 5xx/pool-exhaustion spike at single-region Micro compute with no alarm to lead it; (3) iOS users silently under-counting sodium/sugar/micros on the common re-log paths; (4) planners whose shopping list under-buys after adding a meal; (5) a data-loss incident with no point-in-time recovery.

---

## 10. P0 Findings (must fix before onboarding any users)

> Every item adversarially verified. After verification, **one** true P0 remains — the recipe_claims P0 from 06-22 is resolved, and the alarms + parse-rate finders were down-corrected P0→P1.

### P0-1 — Production DB on the Supabase free plan: 24h RPO, no PITR, restore never rehearsed — the posture the decision doc forbids for Phase 1 · production-readiness · **CONFIRMED (DB-VERIFIED)**
- **Evidence:** `get_organization("pyeqbxhowqljzkzfmhsm")` → `plan: "free"` (DB-VERIFIED). `docs/decisions/2026-06-01-pitr-posture.md` Status "OPEN — awaiting Grace's call," Decision block empty, `:53` "Do not enter Phase 1 on … un-rehearsed + 24h-RPO." `docs/runbooks/disaster-recovery.md:41` RPO 24h; `:161` restore "never rehearsed end-to-end"; the Pre-Phase-1 checklist still shows "Rehearse one PITR restore" BLOCKED on free plan. Deadline was 2026-06-01; today is 2026-07-01.
- **Impact:** A single-region incident or a bad write loses up to 24h of real users' logs/recipes/plans, with a restore process that has never been timed. Telling early adopters "your food diary is gone and we don't know the recovery time" is a trust-ending event. On free, even *rehearsing* the restore is impossible (branches are a Pro feature). This one plan change also unblocks the compute-headroom item (§12).
- **Recommendation:** Execute Option A (Pro + PITR, RPO ≤5min) — or Option C (Pro-only) as the floor — before any non-founder traffic; then run one timed restore-to-scratch and record RTO + a row-count diff. Record the decision in the empty Decision block.
- **Suggested Linear:** "P0: Supabase Pro + PITR + one timed restore rehearsal before Phase 1 (ENG-510)."
- **AC:** Project on Pro (+PITR); PITR window ≤5min in the dashboard; one timed restore logged with RTO + diff. **Tests:** `supabase branches create dr-rehearsal-<date>`; run DR runbook S2 with a stopwatch; append RTO to the rehearsal log.

---

## 11. P1 Findings (fix before the viral push / broader beta)

> All CONFIRMED at HEAD with file:line and adversarially verified. Two were down-corrected from finder-P0.

### P1-1 — Mobile saved-meal re-log silently drops all micros; web preserves them (parity break) · food-logging / nutrition / parity · **CONFIRMED**
`apps/mobile/app/(tabs)/_today/TodayScreen.tsx:1594-1609` (`logSavedMealFromPanel`) and `:1693-1708` (`logSavedMealFromSlotHeader`) build the `JournalMeal` by enumerating only id/name/recipeTitle/time/macros/fiberG/waterMl/source — `micros` is never copied, even though `buildMealEntriesFromSavedMeal` emits it (`src/lib/nutrition/savedMealsLogic.ts:293-296`) and the persist path would write it (`apps/mobile/lib/nutritionEntryRow.ts:99`). Web keeps micros (`NutritionTracker.tsx:938-945` spreads the full payload). **Impact:** silent, cumulative, irreversible micro under-counting on the highest-frequency re-log surface, on the primary platform; a cross-platform user sees different totals for the identical action. **Fix:** copy `e.micros` when non-empty in both re-maps (mirror `logHistoryItemToSlot:2055-2070`). **Test:** persistence + web=mobile parity assertion on `nutrition_micros`.

### P1-2 — Food-search "Recent"/Favourites strip re-log zeroes sugar/sodium/fiber/micros on BOTH platforms · food-logging · **CONFIRMED**
The `recentFoods` prop is built by stripping micros (mobile `TodayScreen.tsx:2255-2270`; web `NutritionTracker.tsx:3445-3456`) even though `computeRecentMeals` carries them (`src/lib/nutrition/foodHistory.ts:322-348`); `onSelectHistoryItem` then hard-codes `sugarG:0, sodiumMg:0` (mobile `FoodSearchPanel.tsx:1318-1348`; web `:1310-1338`). Favourites render through the same handler, so starred-food re-logs lose micros too. The LogSheet "Recent" path is correct (re-resolves the full item), so the drop is specific to the inline panel strip. **Fix:** thread `item.micros`/`microsPerServing` through the prop + handler, or re-log via the full-item handler. **Test:** unit + parity assertion.

### P1-3 — Import wedge's parse-rate gate (GROW-61/62) has never been measured — the moat's one quantitative bar is unverified on launch day · growth / launch-blocker · **CONFIRMED (finder P0 → P1)**
The harness is real and honest (`scripts/audit-tiktok-reels.ts:103-127` fires each URL at the live `/api/recipe-import`, gates on ≥90% over 100 URLs; `check-reel-audit-streak.mjs` requires 3 green days), **but it has never run against a real battery**: `scripts/fixtures/reel-urls.sample.json` is 10 placeholder URLs; the only recorded run (`docs/testflight-feedback/tiktok-import-benchmark-2026-05-29.json`) has `livePassRatePct: null` and blockers "Live LLM parse rate not measured." **Impact:** the entire push is bet on the one-tap Reel-import demo; whether it works for 9 of 10 users is unknown, so the headline acquisition moment could fail on a cold user's first attempt. **Fix:** curate the 100-Reel battery, run 3 consecutive days, confirm the streak check passes; if <90%, the top failure mode is the worklist. **Do not treat "harness merged" as "gate passed."**

### P1-4 — TikTok/IG import is caption-text-only by legal posture; Reels with the recipe in on-screen text/voiceover return empty · recipe / import robustness · **CONFIRMED** *(the "server never fetches URL universally" framing was REFUTED — see note)*
`docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md` blocks server-side fetch of IG/TT bodies; the shipped social path consumes caption + title text only unless `IG_TT_IMPORT_ENABLED` is on (`app/api/recipe-import/route.ts:219-261`), with tiered fallbacks to IG comments + a caption-embedded-URL scrape. `docs/growth/reel-import-gate.md:154-171`: the achievable rate is "bounded by the caption-present rate." **Impact:** a large share of real food Reels put the recipe in on-screen captions/voiceover, not the post caption — those yield a zero-macro shell. This is a *correct* legal constraint, not a parser bug, but it directly caps the GROW-62 number and is precisely why the live run is non-negotiable. **Fix:** keep the posture; (1) measure caption-present rate in the gate run; (2) make the empty/partial case a graceful honest fallback ("this Reel's caption didn't include the full recipe — paste it or add manually"); (3) scope viral marketing to caption-carrying creators. **Adversarial note:** the *competitive* finder's phrasing that "the server NEVER fetches the URL" was **refuted** as over-broad (the main import route does attempt Supadata transcript acquisition, gated by policy); the underlying caption-ceiling for TT/IG is confirmed.

### P1-5 — 4 of 6 production alarms unwired; the alerting chain dead-ends at an unwired Sentry rule · production-readiness / observability · **CONFIRMED (finder P0 → P1)**
`docs/operations/alerting.md`: Alarm 1 (Sentry new-issue, `:40`), 2 (Sentry quota, `:52`), 4 (Stripe webhook fail, `:81`), 5 (Vercel 5xx, `:93`) all "Not yet wired." Alarm 6 (advisor cron) routes "via the existing Alarm 1 route" (`:99`) — which is unwired; the sole code-wired alert (`upstashMonitoring.ts:45`) also only pages if Alarm 1 exists. Sentry error *capture* is live; the *notify* layer on top is not. **Impact:** a Stripe-webhook failure (entitlement leak), a viral 5xx storm, and the RLS-regression tripwire all fire no notification — the recipe_claims ERROR was caught by a human, not by the alarm built for it. Down-corrected P0→P1 because capture works and the founding cohort is small; a hard blocker for the *viral* push. **Fix:** wire Alarm 1 first (everything routes through it), then 4 + 5; test each per the runbook.

### P1-6 — AI cost circuit-breaker ships enforcement-OFF by default; prod value UNVERIFIED · production-readiness / cost · **CONFIRMED (enforcement UNVERIFIED)**
`src/lib/server/aiBudget.ts:197-199` gates the 503 path on `AI_BUDGET_ENFORCEMENT_ENABLED === "true"` (default false); in shadow mode both per-user and global cap branches `return { ok: true }`. **Mitigant (verified strength):** every LLM route also carries auth + a per-user `rateLimit()` (9/9 confirmed) and fails *closed* after 5min of Upstash outage — so per-user abuse is capped even in shadow mode; only the aggregate £ ceiling is non-binding. **Impact:** if unset in prod, a viral photo-log spike has no hard global £ ceiling ("four-figure overnight bill" per the decision doc). **Fix:** `vercel env ls production | grep AI_BUDGET_ENFORCEMENT` — if unset, set `=true` and add hard monthly caps on the Anthropic + OpenAI dashboards as the real backstop.

### P1-7 — Cron auth-contract mismatch: routes are POST + custom `X-Cron-Secret`, but native Vercel crons send GET + `Authorization: Bearer` · production-readiness / background jobs · **CONFIRMED (runtime UNVERIFIED)**
`vercel.json:3-16` declares 3 native crons; all three routes are POST-gated on `x-cron-secret` (weekly-recap `:244`, weigh-in `:114`, advisor `GET` is a 405 stub). The two push routes export **zero GET handlers**. Native Vercel crons invoke via GET + `Authorization: Bearer` and cannot set custom headers → a native cron 405s and the fan-out never runs, silently. **Impact:** if wired as native crons (the only wiring in-repo), weekly recap + weigh-in reminders are never sent; if they "work," it's because Grace triggers them by hand (doesn't survive her being offline). **Fix:** add a GET handler validating `Authorization: Bearer` against Vercel's `CRON_SECRET`, or drive from an external POST scheduler and drop the native crons. **Verify** by reading a real cron invocation in Vercel logs (expect 200, not 405).

### P1-8 — Advisor-cron prereqs (`SUPABASE_PAT`, `SUPPR_CRON_SECRET`) absent from the production env gate — misconfig fails silently · production-readiness / observability · **CONFIRMED**
`scripts/verify-production-env.ts` does not check `SUPABASE_PAT` or `SUPPR_CRON_SECRET`; `src/lib/server/supabaseAdvisorCheck.ts:151-157` returns a silent 503 (no Sentry capture) when the PAT is unset. **Impact:** the one automated tripwire for RLS/privilege regressions (the class that produced the recipe_claims P0) can be dark with nobody told. **Fix:** add both vars to the strict env gate (fail the prod build if unset) and `Sentry.captureMessage` on the misconfig 503; confirm `SUPABASE_PAT` is set in prod.

### P1-9 — Adding a recipe to an empty plan slot never syncs it onto the shopping list (web + mobile, live default-ON) · meal-planning / grocery · **CONFIRMED**
`buildPlanSwapEdit` guards `if (!outgoing?.recipeId …) return null` (`src/lib/planning/planShoppingSyncHost.ts:166`); filling an empty slot is modelled as a swap whose *outgoing* placeholder has no recipeId → edit null → no sync (web `MealPlanner.tsx:939,1024-1028`; mobile `usePlanV3MealActions.ts:41-59` → `planner.tsx:1339`). `plan_shopping_sync_v1` is default-ON, so this is live. **Impact:** the headline "edit the plan, the list keeps up" silently fails for the single most common edit; the list under-buys until a full regenerate. **Fix:** emit a `kind:"add"` edit (already supported by `runPlanShoppingSync`) when the slot is a placeholder, on both platforms. **Test:** add-to-empty-slot appends the recipe's ingredients.

### P1-10 — `TodayScreen.tsx` is a 6,991-line monolith (118 `useState` / 33 `useEffect` / 69 `useCallback`) behind a 40-line `useToday` shim · architecture / code-quality · **CONFIRMED**
DB-independent, verified at HEAD. `useToday.ts` extracts only routing/auth; all 118 state slots + 33 effects live in the render function. **Impact:** the highest shotgun-surgery risk in the repo, on the primary retention surface, is exactly where the roadmap (AI coach, wearables ring, household day-switching) must land — and it **grew** since the 06-22 baseline. **Fix:** move real state into co-located domain hooks (`useTodayHydration/Activity/Meals/Nudges`); get the host's own `useState` count < ~20 in two passes; do it **before** landing roadmap cards. **Test:** behavioural co-located tests per extracted hook.

### P1-11 — Founder legal critical path (DMCA designated agent, incorporation, Apple SBP, DPAs) — code ready, external filings UNVERIFIED · legal / production-readiness · **CONFIRMED (founder-gated, UNVERIFIED from repo)**
The takedown machinery is built (`app/api/dmca-takedown`, `app/dmca/page.tsx`, `recipe_reports` queue live), but `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md:31` names USCO DMCA-agent registration as a **hard blocker for any third-party import flow**, and incorporation/Apple SBP are external founder actions not recorded in the repo. **Impact:** shipping IG/TT-branded import marketing before the DMCA agent is registered removes the §512(c) safe-harbour exactly as user-imported (potentially infringing) content scales; no incorporation → no Stripe Live; no SBP before the first paid sub locks 30% for 12 months. **Fix:** confirm each externally; record the DMCA registration number in `docs/legal/`.

*(Down-corrected to P2 this pass — see §12: web planner "Log today" date; both push crons' 5,000-row cap; recovery vault + trusted contact; Supabase compute; recipe collections; migration-drift content hash; PlanV3 per-meal remove.)*

---

## 12. P2 Findings (important improvements)

- **Web planner "Log today" writes to the viewed tracker date, not the plan day's calendar date** (`MealPlanner.tsx:672` → `addLoggedMeal` → `selectedDateKey`; mobile uses `planDayCalendarDateKey`). A real correctness bug (Thursday's planned dinner logs onto today), **down-corrected P1→P2** by the adversarial pass on reachability/blast-radius grounds — still worth fixing before broad web use. Port the mobile fix + "Log as planned" copy.
- **Both push crons truncate at 5,000 unordered rows** (`weekly-recap:287`, `weigh-in-reminder:142`, no `.order()`/cursor); the new ENG-955 weigh-in cron **copied** the defect. Bounded today (few opt-ins) → P2; guaranteed to silently drop users past row 5,000 at viral scale. Keyset-paginate + log a cap-hit.
- **Live PlanV3 has no per-meal remove**; the built+tested `removeRecipeFromShoppingList` decrement is wired only to the unreachable legacy row menu. Add a remove affordance to `PlanMealCardV3` / `PlanV3Connected`.
- **No persistent recipe collections/folders** (`src/lib/discover/collections.ts` localStorage stub; no `recipe_collections` table — DB-confirmed). The Paprika gap a viral import spike creates; **down-corrected P1→P2** (competitive gap, not a defect). Ship a DB-backed table + owner-scoped RLS + parity UI, or delete the stub.
- **Free tier caps saves at 10** (`persistImportedRecipe.ts:220`); collides with "import + organise your recipes." Product decision for the launch window; ensure the cap traces to `FREE_SAVE_LIMIT`, not a literal `10`.
- **Migration-drift check has no content hash** (`scripts/check-migration-drift.ts`; `grep createHash|sha256|checksum` = 0). The recipe_claims *instance* is fixed but the *class* (edit-an-applied-migration) is not structurally closed. **Down-corrected P1→P2** (no live exposure remains) but it is the single highest-leverage governance fix. Hash applied-migration content and fail CI on drift.
- **Screen-budget ratchet `--write` re-pins upward** (no monotonic guard; `check-screen-line-budget.mjs:151-156`). The "only-shrink" ratchet is defeatable in one command. Take `Math.min(oldPin, current)` in `--write`; mirror to the spacing/token/type-scale writers.
- **OFF Atwater filter drops alcoholic products** (wine/beer/liqueurs) — no 7 kcal/g alcohol term (`searchProducts.ts:146-153`, `macroPlausibility.ts:56`). Add the alcohol term; fixture-test wine/beer/liqueur pass + egg-poison row still rejects.
- **Two divergent slot-weight tables** — Today `.30/.15` vs Plan/`distributeAroundAnchor` `.35/.10` for Dinner/Snacks; a docstring falsely claims parity. Unify to one table + a parity test.
- **RevenueCat webhook uses a static bearer, not HMAC-V1 signature** (`revenuecat/webhook/route.ts:62-98`) + silently accepts events with no `event_timestamp_ms`. Migrate to HMAC-V1 (body integrity + replay protection).
- **Stripe webhook doesn't handle `charge.refunded` / `charge.dispute.created`** — a dashboard refund leaves Pro active for the period. Add a refund handler + a dispute-flag-for-review; document intentional no-ops.
- **USDA quota guard counts 1 unit for a 2-HTTP-call page-1 fetch** (`fdcClient.ts:148-176`, `usda/search/route.ts:107`) — real call volume hits the cap at half the reported usage. **Down-corrected P1→P2.** Count 2 units on the two-stage path.
- **FatSecret + Edamam clients have no retry on transient 5xx** (single hiccup drops the source; USDA got a retry in ENG-1119, they didn't). **Down-corrected P1→P2.** Add the same bounded single-retry at the route.
- **`recipe_ingredients` is empty in prod (0 rows across 36 recipes; 0 published — DB-VERIFIED)** while the import persist path *does* write it (`persistImportedRecipe.ts:201`) — so real imports get lists, but the current 36 DB recipes produce empty shopping lists. Smoke-test before launch: plan a Discover/seed recipe → Generate list → assert non-empty; confirm the seed pack actually populated `recipe_ingredients`.
- **`user_favorite_foods` has no micros column (DB-VERIFIED)** — favourites are macro-only by construction (custom foods got sugar/sat-fat/sodium; favourites never did). Add `nutrition_micros`.
- **HIBP leaked-password protection OFF** (Supabase Auth) — one dashboard toggle; close before launch (web email/password cohort).
- **15-step onboarding** for cold viral traffic, with the import hook deferred to post-setup. Don't bloat it; instrument per-step drop-off and consider surfacing the import demo in-flow for users who pick a recipe source.
- **£59.99/yr Pro is at the top of the validated single-tracker WTP band** with no launch-cohort anchor. Hold the clean Free+Pro structure; A/B a launch anchor via the existing paywall funnel, not a list-price change.
- **Web design-system census (no CI gate covers web spacing):** 8 off-scale literals + 3 cross-platform radius/size mismatches on the ENG-1246 profile block; missing hover/focus-visible ring on the web profile avatar button; off-ramp fontSizes pre-pinned on the ENG-969/953 cards. Individually minor; together a write-time-discipline leak on the web side.

## 13. P3 Findings (future / polish)

- Web `AppDataContext` is a single ~95-field context value → every `useAppData()` consumer re-renders on any mutation (`AppDataContext.tsx:2266-2361`). Down-corrected P1→P3; split by domain or adopt a selector store.
- Web `CookMode.tsx` reimplements the shared `cookRunningTimers` reducer inline (mobile consumes the shared module) — cross-platform drift on ~60 lines of timer runtime. Down-corrected P1→P2/P3; consume the shared module.
- 257 `as any` casts (non-test), concentrated in `progress.tsx` (41) + `TodayScreen` (36) — invisible to a suppression audit (0 `@ts-ignore` repo-wide). Ratchet the count.
- `dmca_takedowns` lacks the belt-and-suspenders `REVOKE` its twin `recipe_reports` has (RLS still blocks all rows) — add it in a new forward migration.
- Account-delete cascade-ledger comment omits 4 tables that *do* cascade (documentation gap, not a data gap) — add them + a cascade integration test.
- Measured (Apple Health) expenditure always renders a "high" confidence chip regardless of the engine's medium/high verdict (`expenditureTrend.ts:120-130`) — thread the real confidence tier.
- Import recipe confidence stats (min/avg) computed over a wider row set than the totals — intended (feeds the review nudge); add a one-line comment so a future reader doesn't "fix" it into a bug.
- Last mutable-`search_path` function (`ingredient_images_touch_updated_at`); ~20 anon SECURITY-DEFINER funcs (carried-safe).
- `fal.ai` CDN image download has no explicit fetch timeout (`falImageGenerator.ts:471`) — a hung CDN holds a Vercel slot; add `AbortSignal.timeout(30_000)`.
- Vendor responses have no runtime schema validation — a field rename propagates as `undefined`/0 nutrition; add typeof/`Array.isArray` guards at the boundary.
- No grocery-delivery integration (the grocery pillar stops at the list).
- The viral-plan doc still describes a 3-tier price (Free+Base+Pro) and Notion mirroring — both retired; correct the operating doc.

## 14. Architecture Findings

**Score 6.5/10** (up from 6). The server tier is strong and extensible; the recipe_claims fix proves the migration discipline works under pressure. The ceiling remains the **client-state monoliths** (TodayScreen 6,991 / AppDataContext 2,468 / six files > 3,000 / 38 > 1,000), which the whole roadmap must land on, plus **two ratchets that don't ratchet the thing they claim** — the migration-drift check (no content hash) and the screen-budget writer (upward-launderable). The shared `@suppr/shared` business-logic spine is genuinely healthy (0 `@ts-ignore`, 0 raw TODO/FIXME in non-test src+mobile) — the leaf level is clean; the spine is structurally fragile.

## 15. Code Quality Findings

**Score 6/10** (up from 5). Write-time discipline holds (strict TS, no suppressions, no silent-deferral comments). Dragged by the monolith cluster, the launderable ratchet, the web CookMode timer-reducer duplication, and 257 `as any` concentrated in the biggest screens. Highest-risk fragile file, unambiguously: `TodayScreen.tsx` — touch it for any feature and you risk regressions across unrelated state.

## 16. Security Findings

**Score 8/10** (up from 6). The live P0 is resolved (RLS on + grants revoked + CHECK present, DB-VERIFIED); the advisor set is WARN/INFO only; the net-new surface (delete/report/household/migrations) is PASS, probed as anon in prod. Residual, all non-blocking: HIBP off; RC webhook static bearer (migrate to HMAC-V1); `dmca_takedowns` missing REVOKE; `/api` self-enforced auth with no middleware DiD; last mutable-`search_path`; the carried-safe anon SECURITY-DEFINER set. Precision note: the 4 `rls_enabled_no_policy` INFO tables (incl. `recipe_claims`) are **deny-all** and therefore safe — which is exactly why the linter rates them INFO now, not ERROR.

## 17. Food Logging Findings

**Score 6.5/10.** The core write path is strong (shared row builder, `eaten_at`-derived `date_key`, optimistic rollback, multi-modal input). The defects are **micro-retention on the re-log paths** (P1-1, P1-2) and the favourites table lacking a micros column — silent under-counting concentrated on the highest-frequency surfaces, worst on iOS. Scoping note: manual entry, custom foods, barcode, fresh search results, edit-log, and copy-yesterday all **correctly preserve** micros (finder-verified) — the fix surface is exactly the three re-log-from-history/saved paths.

## 18. Nutrition Engine Findings

**Score 8.5/10.** Net-new math is clean and property-tested; the import path excludes poisoned rows from totals honestly. Residual: the saved-meal micros loss (an engine-output integrity issue, §17), the OFF alcohol filter, the divergent slot tables, and the measured-confidence chip always reading "high." **Recommended tests:** a property test that recipe per-line macros sum to the total after scaling; a Today-vs-Plan slot-weight parity test; the OFF alcohol fixtures; a saved-meal/Recents micros parity test; a FatSecret v1→v2 %DV migration guard.

## 19. Vendor Integration Findings

**Score 7/10** (up from ~6). The most dangerous 06-22 gaps (no cross-request cache, no account-wide quota guard, no search degradation) are **closed** (`vendorSearchCache.ts`, USDA retry ENG-1119). Stripe is clean (signature + dedup + idempotent); `fal.ai` is clean (budget default-on, typed errors, never throws); OFF search is now cache-guarded. Four addressable gaps before the push: AI-budget enforcement UNVERIFIED (§11-6), USDA quota 2× under-count, FatSecret/Edamam no-retry, RC webhook static-bearer. UK-first data gap: **FatSecret Premier Free is US-only** — skip its quota for en-GB/AU/IE and elevate OFF text-search. No automatic Anthropic→OpenAI failover on a sustained outage (key-at-startup selection only).

## 20. Recipe Platform Findings

**Score 6.5/10.** Import is the most production-grade pillar and now honest (typed errors, flagged-ingredient surfacing, 0-kcal suppressed in the Library, cook-mode default-ON). The launch risks: the parse-rate gate is unmeasured (P1-3) and caption-bound (P1-4); there are still no collections (P2) and a 10-save free cap (P2). The ENG-1246 editorial profile block + streak/milestone logic is **real shared freeze-aware data**, not a stub (finder-verified).

## 21. Meal Planning Findings

**Score 6/10.** Capable macro-aware generator; the plan→shopping delta engine is well-built and symmetric; the 06-22 orphan-rows and leftover-double-count residuals are both **RESOLVED** (DB-VERIFIED). The live gaps: add-to-empty-slot doesn't sync (P1-9), no per-meal remove on PlanV3 (P2), non-ingredient rows become purchasable (P2), web "Log today" date (P2), and the empty `recipe_ingredients` in prod (P2 smoke-test). A serious Plan-To-Eat/Mealime user would adopt the swap loop but trip on the add-doesn't-sync gap.

## 22. Design System Findings

The system is right — Sloe palette, flat-card cohesion, type ramp, and (LIVE-VERIFIED) premium calm on the net-new Progress surfaces with honest trust framing. All four mobile ratchets (`check:spacing/token/type-scale/type-scale-mobile`) pass at HEAD with no new file adding a fresh mobile violation — the **mobile** EditorialProfileBlock is exemplary (all tokens, PressableScale throughout). The leak is **web**, which no CI gate covers: 8 off-scale spacing literals + 3 cross-platform radius/size mismatches on ENG-1246, a missing focus-visible ring on the profile avatar button, and off-ramp fontSizes pre-pinned at creation on the ENG-969/953 cards. The fix is process (a web spacing/type gate + a zero-new-pin norm), not redesign. The legacy pin totals (566 spacing / 729 token / 469 type-scale) did not shrink this pass — the ratchets hold the line but aren't being driven to zero.

## 23. Competitive Analysis Findings

**8/10 concept, 7/10 shipped-and-exploited** (up from 6.5). The wedge (attributed Reel/TikTok import → make-it-fit-your-macros, on free) is real white-space no single competitor combines, and monetisation-honesty is now a genuine differentiator (Cal AI was App-Store-pulled for deceptive paywalls; Suppr's is UK-CMA-clean). The retention loop (Today north-star + streaks/freeze-credits + weekly recap) is the daily reason-to-return that recipe-savers structurally lack.

| Category | vs best-in-class | Verdict |
|---|---|---|
| Recipe import / wedge | ReciMe, Pestle, Paprika, Crouton | **Ahead** on attributed-import-into-macros; caption-only ceiling + unmeasured parse-rate are the caveats. Copy ReciMe's frictionless share-sheet; avoid Julienne's paywalled data durability. |
| Nutrition tracking | MFP, Cronometer, MacroFactor | **At bar / ahead on free** (adaptive TDEE + micros + barcode free); behind Cronometer on micro depth, MacroFactor on algorithm credibility. Copy MacroFactor's expenditure-trend viz (now shipped). |
| Food logging | MFP, Cal AI | **At/above bar** for input breadth + honest AI framing; free-barcode line is a sharp anti-MFP wedge. |
| Recipe management | Paprika, Crouton, Mela | **Behind** — no collections/folders. The signature gap. |
| Meal planning | Mealime, Plan To Eat | **At bar** on generation; behind on the plan→shopping add-sync + no per-meal remove. |
| Health insights | Oura, Whoop, Zoe | **Behind by design**; Apple Health bridge on free is the right scope — not the pillar to fight. |
| Monetisation | (Cal AI cautionary tale) | **Ahead on honesty**; top-of-band on price. |

**Top differentiation opportunity:** "beautiful AND numerate, imported AND honest" — the attributed-import → make-it-fit loop is uncopyable without a competitor becoming Suppr. Double down there plus the visible confidence-meter / "why this number" trust story. **Avoid** chasing Cronometer micro-depth or Oura/Whoop insights (wrong pillar), and **avoid** re-adding a third price tier (the Julienne ladder mistake).

## 24. Linear Backlog Assessment

The backlog is well-structured and the `launch-blocker` cluster is correctly identified, but **live audit reality outruns some ticket states** — worth reconciling:

- The **recipe_claims P0** the 06-22 audit said had "no dedicated ticket capturing the migration-drift root cause" is now **resolved in prod** (forward migration `20260702120300`) — but the **root-cause guard (content-hash drift check) is still open** and needs its own ticket so a passing unit test can't re-close the class.
- **ENG-1233** (onboarding conversion funnel — in-flow trial/paywall + projected-weight chart + guided first-log) is **`launch-blocker` + Todo**, delegate Cursor. Parts shipped separately (ENG-969 chart), but the funnel itself isn't built — decide whether it's truly launch-blocking or a fast-follow.
- **ENG-1241** (optional skippable upgrade step) + **ENG-1235** (owner claim→official toggle) are Todo — the claim toggle is the *flow* the (now-secure) `recipe_claims` table exists for.
- The monetisation wiring (RevenueCat/Stripe) and the parse-rate gate (GROW-61/62) are correctly open and on the critical path; the **parse-rate gate must move from "instrumented" to "measured"** before the push.

Open-PR hygiene is clean (1 open — a dependabot bump — well under the cap of 3).

## 25. Recommended New Issues

1. **P0** — Supabase Pro + PITR + one timed restore rehearsal before Phase 1 (ENG-510). *(AC/tests in §10.)*
2. **P1** — Run + record the live GROW-62 100-Reel import gate; publish Definition-A/B + caption-present rates before the push.
3. **P1** — Wire the 4 unwired production alarms (Sentry new-issue+quota, Stripe webhook fail, Vercel 5xx); Alarm 1 first.
4. **P1** — Fix mobile saved-meal re-log to persist `nutrition_micros` (+ behavioural web=mobile parity test).
5. **P1** — Fix food-search Recents/Favourites re-log to carry micros on both platforms (+ parity test).
6. **P1** — Plan: emit a `kind:"add"` shopping-sync edit when filling an empty slot (web + mobile).
7. **P1** — Confirm `AI_BUDGET_ENFORCEMENT_ENABLED=true` in prod + add hard provider-dashboard spend caps.
8. **P1** — Fix the cron auth contract (native GET/Bearer vs POST/X-Cron-Secret) + add `SUPABASE_PAT`/`SUPPR_CRON_SECRET` to the strict env gate + Sentry-capture advisor misconfig.
9. **P1** — Decompose `TodayScreen.tsx` to < ~800 lines / < ~20 host `useState` before roadmap features land.
10. **P1** — Confirm the founder legal path (USCO DMCA agent, incorporation, Apple SBP); record IDs in `docs/legal/`.
11. **P2** — Migration-drift CI: hash applied-migration content, fail on drift (root-cause guard for the recipe_claims class).
12. **P2** — Make the screen-budget (+ sibling) `--write` monotonic-down.
13. **P2** — Port the web planner date fix ("Log as planned", plan-day `date_key`).
14. **P2** — PlanV3 per-meal remove affordance (wire the existing decrement path).
15. **P2** — Keyset-paginate weekly-recap + weigh-in crons; log a cap-hit.
16. **P2** — OFF Atwater alcohol term (+ fixtures); unify the two slot-weight tables (+ parity test).
17. **P2** — DB-backed recipe collections (table + join + owner-scoped RLS + web/mobile parity), or delete the localStorage stub.
18. **P2** — Add `nutrition_micros` to `user_favorite_foods`; smoke-test `recipe_ingredients` population (prod has 0 rows / 36 recipes).
19. **P2** — RevenueCat HMAC-V1 webhook signature; Stripe `charge.refunded`/`dispute` handling; USDA 2× quota; FatSecret/Edamam retry.
20. **P2** — Enable Supabase HIBP; web spacing/type CI gate + clear the ENG-1246/969/953 web census.

## 26. Recommended Implementation Order

**Gate A — before ANY users (founding cohort):** #1 (backups) is the only true P0. Then #4/#5 (micros data-loss) + #3 (Alarm 1 + Stripe/Vercel) + #8 (cron contract + env gate) so the founding cohort's data and billing are observable. *Days, not weeks.*
**Gate B — before the viral push (the 2026-07-01 date):** #2 (measure the parse-rate gate — do not launch the import campaign on an unmeasured moat), #6 (plan add-sync), #7 (AI budget), #10 (legal), #16/#18 (nutrition/grocery correctness the acquisition cohort will hit first).
**Gate C — beta hardening:** #9 (TodayScreen decomposition), #11/#12 (the two ratchets that don't ratchet), #17 (collections before the import spike), #19/#20 (vendor + web design census).

## 27. Recommended Test Strategy

- **Live-DB security regression** (new): anon REST INSERT/SELECT/DELETE on every public table must 401/403; assert RLS-on + policy/deny-all per table. This is the test that would have caught the original P0-1 and that code-only CI cannot.
- **Migration-drift content gate** (new): editing an already-applied-version migration fails CI.
- **Cross-platform parity behavioural tests** (new): saved-meal + Recents/Favourites re-log preserve `nutrition_micros` identically web=mobile; add-to-empty-slot appends ingredients on both; planner logs to the plan day's date.
- **Nutrition property tests** (new): recipe per-line macros sum to the total after scaling; Today-vs-Plan slot-weight parity; OFF alcohol fixtures.
- **Cron drain test** (new): >5,000 eligible profiles → weekly-recap + weigh-in drop none.
- **Live parse-rate gate** (the wedge's real test): the GROW-61 harness against 100 real Reels × 3 days, `livePassRatePct` non-null and ≥90% (or the marketing scoped to what passes).
- **Keep + extend** the strong existing nutrition suite (141 nutrition tests across web+mobile); replace the saved-meal source-grep string-pins with behavioural assertions; add a web spacing/type CI lane.

## 28. Biggest Long-Term Risks

1. **The wedge's defensibility is still unmeasured on launch day.** The import moat is replicable; its durable edge is parse quality + attribution, and the parse rate is a `null`. Measure it or the differentiation is a slogan — and the caption-only legal ceiling caps the achievable number.
2. **Migration *process*, not any single migration.** P0-1 was fixed correctly, but the content-hash drift guard is still absent, so any future RLS/constraint hardening can silently no-op against prod with green CI. Highest-leverage governance fix.
3. **The client monoliths are the roadmap ceiling.** AI coach, wearables, household all land on TodayScreen (6,991) + AppDataContext (2,468); both grew, not shrank.
4. **Solo-founder SPOF on free-tier ops.** No PITR, dark alarms, recovery vault unset, single-region Micro compute — the base is sized for N=1 while the whole thesis is a sudden N=10,000.
5. **Trust erosion from silent data loss.** Micros under-counting is invisible until a user cross-checks against Cronometer; nutrition trust, once lost, doesn't come back.

## 29. Open Questions

- Is `AI_BUDGET_ENFORCEMENT_ENABLED=true` and is `SUPABASE_PAT` set in Vercel prod? (One `vercel env ls production` settles both — the only two enforcement facts unverifiable read-only.)
- Do the native Vercel crons actually execute (200, not 405)? Read one real cron invocation in the Vercel logs.
- Is the USCO DMCA designated-agent registration filed + active, and is Apple SBP enrolled, before the first paid sub / import-branded marketing?
- What is the real, measured TikTok/IG-Reel parse rate today (Definition-A/B + caption-present)?
- Why does prod have 36 recipes but 0 `recipe_ingredients` rows and 0 published — is the seed pack populating ingredients, and will a viral cohort's first shopping list be non-empty?

## 30. Final Recommendation

**The product is materially safer and more finished than nine days ago — the headline security P0 is genuinely resolved, fixed the right way, and DB-verified — but do not open the 2026-07-01 viral public push today.** A **small closed comped founding cohort on the TestFlight binary is a reasonable CONDITIONAL-GO** once backups are decided (Supabase Pro) and Alarm 1 + Stripe/Vercel are wired (Gate A — days). The public push is gated by a cluster that is now **ops + measurement + data-loss**, not security: the free-tier backup posture (the one true P0), the **unmeasured import parse-rate on launch day**, the dark alarms, the silent micros data-loss on the primary re-log paths, the plan→shopping add-sync gap, the unconfirmed AI-budget enforcement, and the founder-gated legal path. **The single most important sentence in this audit: the 06-22 headline P0 is fixed and verified, so the founding-cohort gate is clean — but you are about to point a TikTok hose at an import wedge whose success rate you have never measured, backed by a database with no point-in-time recovery. Measure the wedge and buy the recovery before the hose turns on.**

---

## Real User Walkthrough Findings

Driven live on the iOS simulator (dev client `com.supprclub.supprapp` against Metro 8082; device `Sloe-Verify` `25D9EF51`). Surfaces captured and read as PNGs on the current branch (`agent/claude/eng-1246-editorial-profile-block`). Screenshots for this session live under the scratchpad (`sim-today.png`, `sim-current.png`/Progress, `sim-progress-scroll2.png`).

### Journey 1 — Today (core daily loop)
- **Screens:** `sloe` wordmark header (bell + profile avatar "G") → Today.
- **Observations:** "TODAY · Wednesday · 1 July", a week strip (M–S, 1 selected), the **v3 tick-dial calorie ring** showing "1,900 KCAL LEFT" as an **empty gradient dial** (matches the agreed empty=gradient mapping), GOAL/EATEN/BONUS (1,900/0/0), a "Fresh start — what's for lunch?" north-star prompt, a "Hide macros" toggle, and the 4-tab + center-FAB bar.
- **Trust/visual:** premium, calm, on-brand; the ring renders with **no Skia crash**. No layout/overflow/contrast issues.
- **Bugs/friction:** none on render. (The data-integrity risk here — saved-meal re-log micros, P1-1 — is code-path, not visible.)

### Journey 2 — Progress (weight + household)
- **Screens:** Progress (D/W/M/6M/Y, W selected; household selector All 3 / Data-Rich / Sam / Mia).
- **Observations:** "New week, fresh story" with a **progressive unlock** ("Log 3 days this week to unlock… 0/3 days logged · 3 needed"), a Weight card (73.2 kg, Trend/Scale toggle, a trend line), and a "+ Log weight" filled CTA.
- **Trust/visual:** story-driven, not a dashboard — matches the agreed direction. Household switcher renders cleanly at the top.
- **Friction:** minor — the deep-link re-navigation resets scroll to the top (an audit-tooling nuance, not a user bug).

### Journey 3 — Progress net-new surfaces (Expenditure + Projected weight) — **not in the 06-22 audit**
- **Screens:** Progress, scrolled: Expenditure card (ENG-953), Projected Weight card, Week Digest.
- **Observations:** **Expenditure** — "~2,120 kcal/day, **High confidence** … Based on the last week or so of logging" (a MacroFactor-style adaptive expenditure surface). **Projected Weight** — "70.7 kg **in ~5 weeks** — if you keep your current pace — last 7 days averaged **1,556 kcal/day** vs 1,900 target. Based on 7,700 kcal ≈ 1 kg. **An estimate, not a promise.**" **Week Digest (Jun 22–28)** — "CLOSEST TO TARGET · Mon · 1,941 kcal / 1,900 target · 146g protein."
- **Trust/visual:** the standout of this pass. The numbers are **internally coherent** (2,120 burn − 1,556 intake ≈ 564/day deficit → ~2.5kg over 5 weeks → 70.7kg), the confidence is labelled honestly, and the projection literally shows its arithmetic and disclaims certainty. This is best-in-class trust framing for a category built on over-promising.
- **Bugs/friction:** none on render. Minor copy nuance — the projection references intake vs *target* (1,556 vs 1,900) while the projection math uses intake vs *expenditure*; defensible, slightly two-anchored at a glance.

### Cross-journey verdict
On the current branch the iOS app is **premium, coherent, calm, on-message, and crash-free**, and the net-new Progress surfaces raise the trust bar rather than lower it — this would not look out of place next to MacroFactor, and the honesty framing is sharper. Consistent with 06-22, **the risks are not on the surface** — they are in the data layer (silent micros loss), the live Plan gaps (add-sync, no remove), the unmeasured import wedge, and the dark ops/legal cluster. A user would trust this app on sight; the audit's job is to make sure that trust is earned beneath the pixels before the viral hose turns on.

---

*Prepared autonomously (read-only) for Grace's review. No code, migrations, feature flags, or production state were modified during this audit. Left untracked. Load-bearing findings are anchored to the live production database (`fnfgxsignmuepshbebrl`), which does not move with git state. Where a fact could not be verified read-only (Vercel prod env, native-cron runtime, external legal filings, the live Reel parse rate), it is marked UNVERIFIED with the exact check to close it.*
