# Independent Product, Engineering & Launch-Readiness Audit — Suppr / Sloe

**Date:** 2026-06-11 (revision pass, same day)  
**Reviewer:** External due-diligence audit (autonomous)  
**Branch reviewed:** `main` (HEAD `e3ac41c7` — `fix(mobile): stop dev-client crashes and harden meal logging on Today`)  
**Prior pass:** same file, branch `claude/skia-ring-2026-06-10` at `a39e0d88`  
**Method:** Ground-truth codebase reconstruction + parallel specialist reviews (architecture/security, nutrition/vendors, recipe/planning, Linear backlog), adversarial re-verification of P0/P1 claims against current files, nutrition-audit cross-check (`docs/ux/research/2026-06-10-nutrition-calculations-audit.md`), live Gate0 partial DB verify (`scripts/verify-gate0-db.mts`), iOS simulator visual attempt (screenshots in `apps/mobile/screenshots/agent/audit-2026-06-11-*.png`). Web authed surfaces not exercised (`tests/e2e/.auth/user.json` expired; no local Next dev server).

> **Evidence discipline.** Every finding cites files read or runtime checks run. Items fixed in code since the morning pass are marked **SHIPPED (repo)** vs **LIVE (prod verified)**. Where production state is unknown, mark **UNVERIFIED**.

---

## Revision summary (e3ac41c7 vs morning audit)

Between the first audit pass (`a39e0d88`) and this revision (`e3ac41c7`), a **Gate-0 security + parity batch** landed on `main`:

| Audit ID | Issue | Status in repo @ e3ac41c7 |
|---|---|---|
| P0-1 | Tier escalation DELETE+INSERT | **SHIPPED** — `20260611120000_profiles_insert_lockdown_eng1035.sql`, `tests/unit/profilesInsertLockdown.test.ts` |
| P0-2 / P1-7 | Verbatim import description + disclaimer | **SHIPPED** — `description: null` in `app/api/recipe-import/route.ts`; `importSourceDisclaimer` on web + mobile recipe detail |
| P1-1 | SECURITY DEFINER recipe view | **SHIPPED** — `20260611120100_recipes_implausible_macros_rls_lockdown_eng1036.sql`; live anon probe **PASS** (401) |
| P1-2 | Recipe-import SSRF | **SHIPPED** — caption fallback uses `followWithSsrfGuard` at `route.ts:274-279` |
| P1-3 | Vendor search cache | **SHIPPED** — `src/lib/server/vendorSearchCache.ts` wired in USDA/Edamam/FatSecret search routes |
| P1-4 | `calcGoalTimeline` raw two-point delta | **SHIPPED** — smoothed rate via `weightTrendSmoothing.ts`; `tests/unit/calcGoalTimelineSmoothing.test.ts` |
| P1-5 | Mobile shopping portion multiplier | **SHIPPED** — ENG-1040 shared generator in `planner.tsx:1893+` |
| P1-6 | Mobile `fiber_g` NULL / CSV | **SHIPPED** — `foodSelectionToMealMacros` + `fiberG` on mobile Today |
| P1-8 | Promo vs lockdown trigger | **SHIPPED** — ENG-1043 GUC bypass in `20260611120200_redeem_promo_lifetime_pro_eng1043.sql` |
| P1-9 | Tab order / glyph collision | **SHIPPED** — `src/lib/navigation/primaryNav.ts` + `tests/unit/primaryNavParity.test.ts` |
| P2 dead SoT | `foodSelectionToMeal.ts` unused | **SHIPPED** — wired in `NutritionTracker.tsx` + `apps/mobile/app/(tabs)/index.tsx:2122` |
| Plan 7/7 over-budget headline | Trust contradiction | **SHIPPED (logic)** — ENG-1049 `planWeekSummary.ts`; **UNVERIFIED** on rendered UI after data refresh |

**Still open at P0:** ENG-859 (DMCA designated agent — legal/ops, not code). **Re-verify before cohort:** Gate0 exploit tests (ENG-1035 INSERT, ENG-1043 promo) — doc claims 5/5 pass; this revision got **1/3** without `GATE0_VERIFY_PASSWORD`.

**New since morning (mobile stability @ e3ac41c7):** Dev-client tunnel/Metro reload crashes (SIGSEGV in Expo DevLauncher — **not production**); meal-logging hardening (`foodSelectionToMealMacros`, `upsert` on `nutrition_entries`, debounced adaptive TDEE, HealthKit write dedupe). **TestFlight build 57** (1.0.7) submitted — production binary avoids DevLauncher path.

---

## 1. Executive Summary

Suppr remains a genuinely ambitious multi-pillar product — nutrition tracker, food logger, recipe manager/importer, discovery, meal planner, grocery planner, and emerging health-insights surface — with **server-side engineering materially ahead of most solo pre-launch builds** (signature-verified webhooks, fail-closed rate limits, AI cost circuit-breaker, comprehensive RLS, vendor correctness guards). The **nutrition engine is the standout**: Mifflin–St Jeor, Atwater, FDA DVs, adaptive TDEE architecture, and ~214+ nutrition unit tests are industry-standard; the June 10 nutrition audit's P0 and P1 math/display fixes **landed with regression tests**.

**Launch posture shifted today:** the morning audit's two code P0s (DB tier escalation; verbatim recipe prose on import) and most of the P1 security/parity cluster are **fixed in `main`**. `docs/decisions/2026-06-11-gate0-db-security.md` records production apply + 5/5 Gate0 verify on 2026-06-11. This revision partially re-confirmed ENG-1036 live (anon 401 on the view).

**Remaining launch blockers are operational and scale-shaped, not "the core math is wrong":**

1. **ENG-859** — DMCA designated agent not registered (§512(c) safe harbour incomplete for the recipe-import wedge).
2. **Gate0 re-proof** — run `node --import tsx scripts/verify-gate0-db.mts` with `GATE0_VERIFY_PASSWORD` → **5/5** before any paid or viral cohort.
3. **Monetization chain blocked** — Stripe Tax (ENG-33), RevenueCat IAP (ENG-101 Blocked), offerings (ENG-198 Todo) — incompatible with a Pro launch on 2026-07-01 without Grace-owned ops work.
4. **Vendor economics** — USDA/Edamam/FatSecret now cached server-side; **Open Food Facts text search is still client-direct** with no shared cache — first viral spike can still degrade search.
5. **Client monoliths** — Today tab **6,618 lines** (`apps/mobile/app/(tabs)/index.tsx`) — regression risk on every logging change.

**Bottom line:** **Conditional-go for a small, closed iOS beta on the production TestFlight binary** after Gate0 5/5 + ENG-859 path documented. **Not ready** for the planned 2026-07-01 free viral push at scale until monetization, vendor OFF proxy, device-proven health sync (ENG-874), and offline durability are addressed.

---

## 2. Overall Product Score — **7 / 10** (was 6.5)

Differentiated wedge (import + macro fit) is real and tested; Gate-0 fixes removed the worst trust/monetisation holes. Score held back by blocked billing, thin recipe organisation (no collections), web plan parity, pantry gap, and adherence copy that still reads backwards when over target.

## 3. Overall Engineering Score — **7 / 10** (was 6.5)

Server: **7.5** (mature). Client: **5.5** (monoliths, ~191 files >400 lines). Today's commit improves mobile logging/sync without fixing architecture debt.

## 4. Overall UX Score — **6.5 / 10** (unchanged)

Premium Sloe palette and calm copy when the app renders. Token enforcement still weak (246 hex literals cited in prior pass). Simulator re-validation **blocked by Metro tunnel redbox** this evening — prior same-day walkthrough still the primary pixel evidence for happy path.

## 5. Overall Security Score — **7.5 / 10** (was 6.5)

Gate-0 migrations + SSRF + view lockdown materially improve posture. Residual: `getUserTier()` fails open to `free` if service role missing (`serverAnonClient.ts:85-91`); middleware auth round-trip on public pages; HIBP password protection off (advisor WARN).

## 6. Overall Nutrition Accuracy Score — **8 / 10** (unchanged)

June 10 audit P0/P1 fixes verified in code. Residual P2: nutrient panel sort direction, dual meal-slot tables, UK/EU DVs, adaptive slope cap understating fast loss (0.35 kg/wk cap), activity-bonus protein dilution on scaled targets.

## 7. Overall Recipe Platform Score — **6.5 / 10** (was 5)

Legal **code** posture improved (null description + disclaimer). ENG-859 still open. Import infrastructure strong; organisation (collections/folders) and generic "Imported recipe" titles weak for power users.

## 8. Overall Meal Planning Score — **6.5 / 10** (was 6)

Mobile spine end-to-end; shopping generator unified (ENG-1040). No pantry, weak aisles, web plan feature-thin vs mobile, no store integration.

---

## 9. Launch Readiness Assessment

**Verdict: CONDITIONAL-GO for small closed iOS beta on production binary. NOT READY for broad free viral launch.**

| Gate | Requirement | Status |
|---|---|---|
| Gate 0 code | ENG-1035/1036/1043, ENG-857/858, SSRF, vendor cache | **SHIPPED** in `main` |
| Gate 0 prod | `verify-gate0-db.mts` 5/5 | **UNVERIFIED** (1/3 this pass; needs password) |
| Legal P0 | ENG-859 DMCA agent | **OPEN** (ops) |
| Monetization | Stripe Tax + RC IAP + offerings | **BLOCKED / TODO** |
| Device proof | ENG-874 health sync matrix | **IN PROGRESS** |
| Scale | OFF client search + quotas | **PARTIAL** |

- **What breaks first at viral scale:** vendor search degradation (OFF unbounded + shared Edamam 1k/day ceiling) → silent empty results.
- **Support tickets:** dev-client tunnel users (not TestFlight); wrong goal dates if old weigh-in data; generic import titles; empty recipe thumbnails (ENG-1015).
- **Trust risks:** "111% adherence · over" headline (`progressRangeStats.ts:161`); paywall "AI coach" vs shipped `mealCoach.ts` scope.
- **Investor/TDD flags:** client monoliths; 309 open Linear issues / 129 Urgent+High; category-leading tranche mostly unbuilt.

**Recommended gate:** Gate0 5/5 → TestFlight 57 smoke (log food, import Reel, plan → shop) → 20–50 founding cohort with `lifetime_pro` comp path → parallel Gate 1 (OFF proxy, adherence copy, ENG-874).

---

## 10. P0 Findings (must fix before onboarding any user)

### P0-1 — DMCA designated agent not registered (ENG-859) · `legal` · OPEN · ops
- **Category:** Legal / compliance.
- **Description:** In-app DMCA form and API route exist, but §512(c) safe harbour requires Copyright Office designated agent registration. Recipe-import wedge increases exposure as volume grows.
- **Evidence:** `docs/product-roadmap.md` ENG-859 Urgent; `app/dmca/page.tsx`, `app/api/dmca-takedown/route.ts`.
- **Impact:** Import-driven growth without safe harbour = takedown/replay risk beyond code fixes already shipped.
- **Recommendation:** Complete registration; publish agent in Terms/footer; link from import disclaimer surfaces.
- **Suggested issue:** *ENG-859: Register DMCA designated agent and wire public listing*
- **AC:** Agent listed on Copyright Office site; app legal pages reference it.
- **Tests:** Manual legal checklist; no automated test.

### P0-2 — Gate0 entitlement exploit must be live-verified, not assumed · `security` · UNVERIFIED
- **Category:** Security / entitlement integrity.
- **Description:** Morning audit P0-1 (DELETE+INSERT tier escalation) is **fixed in repo** (`20260611120000_profiles_insert_lockdown_eng1035.sql`). Production exploit closure requires applied migration + live test.
- **Evidence:** Migration + `tests/unit/profilesInsertLockdown.test.ts`; `docs/decisions/2026-06-11-gate0-db-security.md` claims applied 5/5; this revision: ENG-1036 live **PASS**, ENG-1035/1043 **skipped** (no `GATE0_VERIFY_PASSWORD`).
- **Impact:** If migration not on prod, free-Pro escalation remains possible.
- **Recommendation:** Set `GATE0_VERIFY_PASSWORD` for throwaway account; run `node --import tsx scripts/verify-gate0-db.mts` → 5/5 before any cohort.
- **Suggested issue:** *Gate0 live verification gate — automate in CI against staging*
- **AC:** Delete+insert escalation returns 42501; promo redemption succeeds for existing profile.
- **Tests:** `scripts/verify-gate0-db.mts`; RLS integration suite in §27.

> **Resolved P0s (do not re-file):** verbatim import description (ENG-857 **SHIPPED**); tier INSERT bypass (**SHIPPED** ENG-1035 pending live verify).

---

## 11. P1 Findings (fix before broader beta)

### P1-1 — Expo dev client crashes on tunnel/Metro reload (physical + sim) · `mobile` · CONFIRMED · dev-only
- **Category:** Stability (development).
- **Description:** Device crash logs (`Suppr-2026-06-11-183604.ips`) show SIGSEGV in `DevLauncherAppController.fetchUpdate` / `RemoteAppLoader` during remote bundle fetch — not meal-logging JS. Simulator evening pass: redbox "Could not connect to development server" on tunnel URL `hpdpjmm-gracehowse-8081.exp.direct` (screenshot: `apps/mobile/screenshots/agent/audit-2026-06-11-today.png`).
- **Evidence:** `docs/debug/Suppr-2026-06-11-183604-device.ips`; `e3ac41c7` mitigations: Sentry off in `__DEV__`, `EXPO_NO_FAST_REFRESH=1`, meal-log hardening.
- **Impact:** Blocks founder/device QA on dev client; **TestFlight production binary does not use DevLauncher**.
- **Recommendation:** QA launch readiness on **build 57**; keep tunnel script mitigations; document dev-client as non-ship surface.
- **Suggested issue:** *Document dev-client vs TestFlight QA matrix; Maestro on release binary*
- **AC:** TestFlight log-food path passes without native crash.

### P1-2 — Monetization chain blocked — cannot sell Pro at launch · `monetisation` · CONFIRMED
- **Category:** Monetisation / launch.
- **Description:** Stripe Tax (ENG-33 Blocked), RevenueCat IAP (ENG-101 Blocked), offerings (ENG-198 Todo), VAT inclusive pricing (ENG-667 Urgent). Paywall UI is strong but payment path is not live.
- **Evidence:** Linear live query 2026-06-11: 309 open ENG issues; monetization items in Blocked/Todo; `TODO.md` ship gate unchecked.
- **Impact:** 2026-07-01 launch plan assumes Free+Pro; cannot collect or enforce Pro without this chain.
- **Recommendation:** Treat as founder critical path parallel to Gate0; do not onboard paid users until live checkout smoke passes.
- **Suggested issue:** *Launch monetization unblock — Tax → checkout → RC offerings → IAP*
- **AC:** UK checkout shows inclusive VAT; RC entitlement syncs to `profiles.user_tier`.

### P1-3 — OFF text search bypasses server cache and rate limits · `vendor` · CONFIRMED
- **Category:** Vendor / scale.
- **Description:** USDA/Edamam/FatSecret searches use `vendorSearchCache.ts` (ENG-1038). OFF text search still goes **client-direct** to `world.openfoodfacts.org` — no cross-request cache, no account quota guard.
- **Evidence:** `FoodSearchPanel.tsx` OFF fetch path; nutrition specialist review; four parallel vendor calls per debounced keystroke still include OFF from client.
- **Impact:** Viral traffic burns OFF client bandwidth and leaves 3-server-vendor merge fragile.
- **Recommendation:** Proxy OFF text search through API route with same cache/TTL pattern as other vendors.
- **Suggested issue:** *Proxy OFF search through vendor cache layer (parity with ENG-1038)*
- **AC:** Repeated query hits cache; rate limit per user; degraded envelope when OFF down.

### P1-4 — No persistent offline journal queue · `reliability` · CONFIRMED (known deferral)
- **Category:** Data integrity.
- **Description:** Offline banner implies sync; writes are optimistic in-memory. Force-quit mid-offline loses logs. Explicitly deferred to v1.1.
- **Evidence:** `docs/decisions/2026-04-25-offline-queue-deferred.md`.
- **Impact:** Real users on flaky mobile networks lose food logs — high churn for MFP refugees.
- **Recommendation:** Ship minimal durable queue before broad beta, or gate offline UX to "read-only until connected."
- **Suggested issue:** *P1: Persistent offline nutrition_entries queue*
- **AC:** Log survives force-quit + reconnect; idempotent upsert.

### P1-5 — Apple Health sync not device-proven (ENG-874) · `health` · IN PROGRESS
- **Category:** Product / parity.
- **Description:** Health sync code paths exist; Linear ENG-874 In Progress for HS-01–HS-09 device matrix. Audits mark "pass in code, blocked on device."
- **Evidence:** `apps/mobile/hooks/useHealthSyncOnFocus.ts`; `e3ac41c7` limits dietary import on Today focus, extends workout lookback.
- **Impact:** Launch claims health-adjacent positioning without proven sync on physical iPhone.
- **Recommendation:** Complete ENG-874 on iPhone 17 Pro before marketing health features.
- **Suggested issue:** *ENG-874: Close HS device matrix on physical iPhone*
- **AC:** Maestro/device checklist green for import + Today bonus card.

### P1-6 — `getUserTier()` fails open to `free` when service role missing · `security` · CONFIRMED
- **Evidence:** `src/lib/supabase/serverAnonClient.ts:85-91`.
- **Impact:** Misconfigured preview env silently strips Pro from AI/import routes.
- **Fix:** Fail closed in production (500 + alert) if service role unset.

### P1-7 — Web plan feature-thin vs mobile · `parity` · CONFIRMED
- **Evidence:** `MealPlanner.tsx` cut list (no move/templates/leftovers); mobile `planner.tsx` ~4.3k lines full feature set.
- **Impact:** Web users get second-class planning; docs/journeys overstate web drag-drop.

### P1-8 — Adherence headline semantics when over target · `nutrition` · CONFIRMED
- **Evidence:** `progressRangeStats.ts:161` — `(avg/target)*100` uncapped → "111% adherence · over".
- **Impact:** Overeating reads as *higher* adherence; trust erosion on Progress.
- **Fix:** Cap display, rename metric ("intake vs target"), or invert over-band copy.

### P1-9 — Paywall advertises "AI coach" — confirm shipped scope · `product` · UNVERIFIED
- **Evidence:** Paywall walkthrough; `mealCoach.ts` ("what to eat next") exists; full coaching loop unclear.
- **Impact:** App Store / billing scrutiny if Pro feature is aspirational.

> **Resolved P1s (shipped @ e3ac41c7):** SECURITY DEFINER view (ENG-1036); SSRF caption fallback (P1-2); vendor cache trio (P1-3 partial); calcGoalTimeline smoothing (P1-4); shopping portion parity (P1-5); mobile fiber_g (P1-6); import disclaimer (P1-7); promo GUC (P1-8); tab order (P1-9 / ENG-1044); foodSelectionToMeal wiring (P2→done).

---

## 12. P2 Findings (important improvements)

- **Client monoliths:** `index.tsx` 6618 lines; `AppDataContext.tsx` ~2200; `NutritionTracker.tsx` ~3674; `planner.tsx` ~4272; ~191 files >400 lines.
- **Web coverage ~57% lines** with large UI untested (`docs/testing/overview.md`); mobile coverage **not gated** in CI.
- **Middleware `getUser()` before `isPublic`** — latency on marketing pages (`middleware.ts`).
- **Generic "Imported recipe" titles** — library clutter (`saveImportedRecipe.ts`).
- **Cook-mode step/nutrition desync** for count nouns outside hardcoded list (`recipeScale.ts`).
- **No pantry/staples model** — replans salt/oil weekly.
- **Weak grocery categorisation** — large "Other" bucket (`category.ts`).
- **fal.ai outside AI cost circuit-breaker** (`falImageGenerator.ts`).
- **FatSecret v1/v2 micro guard missing** (nutrition audit #27).
- **Nutrient panel sorts %DV descending** while comment says deficiencies first — **SHIPPED** (target ascending / limit descending in `fullNutrientPanel.ts`; launch audit P2 #9).
- **Dual meal-slot share tables** (`mealBudget.ts` vs `northStarSuggestion.ts`).
- **US FDA DVs only** — UK/EU market (`dailyValues.ts`).
- **OFF fetch no timeout** on client path.
- **Web single-meal optimistic insert/delete no rollback** on persist failure.
- **CI `VERIFY_STRICT=0`** — production env misconfig can slip through.
- **246 hex literals** off token system (ENG-1014 baseline drift).
- **Functional emoji in planner leftover badge** — **SHIPPED** (PR #398 — Lucide `Package`; ENG-808 Done).
- **Deep link does not dismiss open Log sheet** — **PARTIAL** (tab navigation dismiss **PASS** [PR #389](https://github.com/gracehowse/Suppr/pull/389); in-tab deep link UNVERIFIED).

---

## 13. P3 Findings (future / polish)

- Weekly-recap cron 5000-row cap unordered; widen `calories` smallint; validate `nutrition_entries.source` CHECK; HIBP password protection; `save_verified_ingredients` search_path; discover collections carousel unwired (ENG-907); empty recipe thumbnails (ENG-1015); store integration; collaborative collections; visual-regression golden set (ENG-827).

---

## 14. Architecture Findings (score 7/10)

Two-app npm monorepo: Next.js 15 on Vercel + Expo iOS on EAS; shared logic via `@suppr/shared` → `src/lib/`. **40** API routes under `app/api/` with per-route JWT auth (middleware excludes `/api/*`). Clients write `nutrition_entries` directly via Supabase RLS. Upstash Redis for rate limits + vendor cache. Crons: weekly push, Supabase advisor check (`vercel.json`). **Strengths:** webhook idempotency, AI budget reserve/commit, vendor normalization pipeline. **Weaknesses:** client state monoliths, no Turborepo, duplicated `database.types.ts`, informal monorepo tooling. **Future capabilities:** data model supports tiers, barcode, image import, household; **client architecture** will make AI coach / wearables expensive until decomposition (ENG-703).

---

## 15. Code Quality Findings (score 6.5/10)

**935+** test files; strong `src/lib/**` coverage; zero `@ts-ignore` cited in prior pass. **Today tab 6,618 lines / 261 hooks** — violates 400-line cap by ~16×. **foodSelectionToMeal** now wired (morning dead-code smell resolved). Duplication: `FoodSearchPanel` web ~2749 + mobile ~2625 lines. Recommendation: resume `useTrackerScreen()` extraction; pre-commit warn on >400-line files; gate mobile coverage.

---

## 16. Security Findings (score 7.5/10)

**Fixed today:** tier INSERT lockdown, recipe view lockdown, promo GUC, SSRF guard on import, import legal nulling. **Strengths:** RLS on personal tables, household consent gate, Stripe/RC webhook verification, CSRF on state-changers. **Gaps:** Gate0 live re-verify; ENG-859; tier fails-open on missing service role; leaked-password protection off; mutable `search_path` on legacy functions (advisor WARN). Run Supabase security advisor → target zero ERROR post-Gate0.

---

## 17. Food Logging Findings (score 7/10)

**e3ac41c7 improvements:** `foodSelectionToMealMacros` on mobile commit path; try/catch on food search select; `upsert` on `nutrition_entries`; memoized recent lists for VirtualizedList perf. Search UX **best-in-class** when Metro connected (confidence tiers, per-serving grams, past-logged). **Gaps:** offline queue; deep-link vs modal; web rollback; OFF client path; multi-add basket partially wired. Edit `eaten_at` (ENG-772) — **SHIPPED**; iOS sim **PASS** via PR #396 fixture; web food-search preview **PASS** 2026-06-12 (`?__force_flags=editable_eaten_at`); web per-meal edit modal **N/A** (mobile-only).

---

## 18. Nutrition Engine Findings (score 8/10) — mission-critical

June 10 audit: **P0 adaptive slope bias FIXED** (`adaptiveTdee.ts` + `dailyInterpolatedWeightEntries`). **P1 gain 2× mismatch FIXED** (`GAIN_SURPLUS_PACE_FACTOR`, `whyThisNumber.ts`). **On-track tile FIXED** (ENG-1026). **Safety floor ack FIXED** (ENG-1027). **Goal timeline smoothing FIXED** (ENG-1039). **Nutrient panel sort FIXED** (PR #397 — target ascending / limit descending). Core math STANDARD per audit §1 table (~75 formulas). **Residual:** slope cap 0.35 kg/wk may under-credit fast losers (P2); activity-bonus scales protein down (P2); UK/EU DVs (P2). **Recommended tests:** keep `adaptiveTdee.test.ts`, `foodSelectionToMeal.test.ts`, `calcGoalTimelineSmoothing.test.ts`; add property test sum(meals)=day total.

---

## 19. Vendor Integration Findings (score 7/10)

**Correctness:** per-100g reconciliation, Atwater guards, FatSecret stub rejection, confidence accept-floor — strong. **ENG-1038:** 24h cross-request cache + 90% quota circuit breaker on USDA/Edamam/FatSecret. **Gap:** OFF text search client-direct (P1-3). FatSecret Basic-tier cache scrub correct per ToS. **Economics:** Edamam 1000/day account-wide still caps viral scale; cache helps repeats not cold queries. **Trust:** committed nutrition trustworthy; outage resilience improved but not complete.

---

## 20. Recipe Platform Findings (score 6.5/10)

**Import:** URL, social (Supadata), image (Pro), share sheet — tested (`recipeImportPipeline.test.ts`, Maestro 25). **Legal code:** `description: null` + `importSourceDisclaimer` on web/mobile recipe detail. **Nutrition on recipes:** verify pipeline, count-to-weight, coercion flags. **Gaps:** ENG-859; generic titles; empty thumbnails; cook-mode scaler desync; idempotent re-import stale nutrition; no collections/folders; barcode is ingredient not recipe import. **Power users:** Paprika-level organisation not yet.

---

## 21. Meal Planning Findings (score 6.5/10)

Mobile: smart plan, joint-fit scaler, leftovers, templates, move-meal, ENG-1040 shopping parity, household shopping scope. **ENG-1049:** over-budget days excluded from "hits targets" count in `planWeekSummary.ts` — re-verify UI with fresh plan data. Web: thin `MealPlanner.tsx`. No pantry; keyword aisles; no store APIs. Serious meal planners (Plan To Eat) would miss pantry + aisle polish.

---

## 22. Design System & UX Findings (score 6.5/10)

Sloe token system well-documented; enforcement weak (hex/spacing census). **ENG-1044** canonical Plan-first nav + glyph map in `primaryNav.ts`. **When app renders:** premium feel (prior walkthrough). **Trust UX:** 111% adherence; paywall price not on hero; empty thumbnails. **Accessibility:** deep-link/modal bug; dark-mode gaps on some CTAs (prior pass). **Simulator 2026-06-11 evening:** Metro tunnel redbox — dev ergonomics issue, not production UI verdict.

---

## 23. Competitive Analysis Findings

**Nutrition:** Ahead on micros + honest search + adaptive TDEE; behind on DB breadth at scale and image logging; **MFP refugee wedge:** free barcode (GROW-19) — ship with vendor cache + OFF proxy.

**Recipes:** Ahead on macro-fit + social import; behind Paprika on organisation; legal posture improved in code pending ENG-859.

**Meal planning:** Ahead on macro-aware auto-plan; behind on pantry, stores, web parity.

**Health:** Partial Apple Health; ENG-874 device proof pending; no Oura/Garmin.

**Moat:** import Reel + fit macros — still defensible when legal + scale gates close.

---

## 24. Linear Backlog Assessment

**Live GraphQL 2026-06-11:** **309 open** ENG issues (240 Backlog, 24 Todo, 9 Triage, 4 In Progress, 4 In Review, 4 Blocked, 24 Duplicate). **129 Urgent+High open.** **649 completed in 30 days** — high velocity.

**Problems:**
1. **Launch-shaped vs backlog-shaped** — most Urgent/High still in Backlog, not Todo.
2. **Monetization blocked chain** — ENG-33, 101, 198, 667 — blocks paid launch.
3. **24 Duplicate** audit captures — hygiene debt.
4. **Category-leading tranche (ENG-927+)** — growth features mis-tagged as launch-blockers.

**Correctly tracked:** ENG-703, 699, 771, 772, 784, 874, 1035–1043 closed recently. **Update backlog:** close/mark shipped ENG-857, 858, 1035, 1036, 1038, 1039, 1040, 1041, 1044; re-prioritise ENG-859 + monetization chain + ENG-874 + OFF proxy.

---

## 25. Recommended New Issues

1. **P0:** ENG-859 — DMCA agent registration (ops).
2. **P0:** Gate0 CI job — `verify-gate0-db.mts` 5/5 on staging with throwaway creds.
3. **P1:** Proxy OFF text search through vendor cache (extend ENG-1038).
4. **P1:** Offline persistent journal queue (re-scope from v1.1 deferral).
5. **P1:** Adherence headline grammar / cap when over target.
6. **P1:** `getUserTier` fail-closed in production without service role.
7. **P1:** Web `MealPlanner` parity bundle (move, templates, leftovers) or correct journey docs.
8. **P2:** Pantry/staples model for shopping generator.
9. **P2:** Dev-client QA matrix doc + Maestro on release binary.
10. **P2:** UK/EU DV picker.

---

## 26. Recommended Implementation Order

**Gate 0 (before any cohort):** ENG-859 path documented → `verify-gate0-db.mts` 5/5 → Supabase advisor zero ERROR → TestFlight 57 smoke.

**Gate 1 (before broader beta):** Monetization unblock → ENG-874 device matrix → OFF proxy → offline queue or honest offline UX → adherence copy → web plan parity or doc correction.

**Gate 2 (during beta):** Today decomposition, token lint, pantry, category-leading selective, visual regression ENG-827.

---

## 27. Recommended Test Strategy

- **Gate0 suite:** `scripts/verify-gate0-db.mts` (5 checks); `profilesInsertLockdown.test.ts`.
- **Import legal:** `recipeImportDescriptionNull.test.ts`, `importSourceDisclaimer.test.ts`.
- **SSRF:** integration tests on `followWithSsrfGuard`; CI grep ban `redirect: "follow"` in import route.
- **Parity:** `primaryNavParity.test.ts`, `shoppingListPortionParity.test.ts`, `foodSelectionToMealWiring.test.ts`, `offMicrosPullThroughParity.test.ts`.
- **Nutrition:** `adaptiveTdee.test.ts`, `calcGoalTimelineSmoothing.test.ts`, `planWeekSummary.test.ts` (ENG-1049).
- **Vendor:** `vendorSearchCacheRoutes.test.ts`; load test cache hit rate; **add OFF proxy tests**.
- **Mobile stability:** `foodSelectionToMeal.test.ts`, `useNutritionEntriesSync.test.ts`, `useHealthSyncOnFocus.test.ts`; TestFlight manual log-food on build 57.
- **E2E:** Maestro Today, import-shared, meal-plan, shopping, cook-mode; Playwright cook-mode (web).

---

## 28. Biggest Long-Term Risks

1. **Client monoliths** obstruct AI coach, wearables, family accounts.
2. **Vendor economics** — shared free-tier ceilings vs viral plan; OFF still unbounded.
3. **Legal surface grows with import volume** — ENG-859 + ongoing takedown process.
4. **Parity drift class** — mitigated by shared modules (foodSelectionToMeal, primaryNav, shopping generator) but FoodSearchPanel still duplicated.
5. **Monetization / ops dependency on solo founder** — Tax, DMCA, incorporation blockers.
6. **Roadmap truth** — tie "Shipped" to passing tests + Gate0 verify, not manual flags.

---

## 29. Open Questions

- Gate0 5/5 on production with password — **UNVERIFIED** this pass.
- ENG-1049 plan headline on Grace's live plan data after fix — **UNVERIFIED** (logic tested; UI not re-captured).
- `redeem_promo_code` on live DB for existing users — doc says fixed via ENG-1043; needs live redemption.
- `saves(user_id, recipe_id)` unique constraint — confirm live schema.
- AI coach paywall vs `mealCoach.ts` product scope.
- Authed web visual parity — expired E2E auth; component-level tests only.
- TestFlight build 57 processing time / availability.

---

## 30. Final Recommendation

**Conditional-go for a small closed iOS beta on the production TestFlight binary (build 57, 1.0.7)** after **Gate0 5/5** and **ENG-859** path is in motion. The morning "do not onboard" verdict was correct for **unpatched** `main`; **today's Gate-0 batch materially changes the security and parity picture**. Do **not** execute the 2026-07-01 viral free launch until **monetization is unblocked**, **ENG-874** device-proves health sync, **OFF search is proxied**, and **offline logging** is honest or durable.

Lean narrative on **social-caption import + macro fit** — code now supports disclaimer + null description on web/blog paths. QA on **release binary**, not tunnel dev client.

**Confidence: 7.5/10.** Strong code-grounding for shipped fixes; −2.5 for incomplete live Gate0 verify, blocked sim redbox this evening, unauthenticated web pass, and open monetization/legal ops.

---

## Real User Walkthrough Findings

### Coverage note

| Surface | Status | Evidence |
|---|---|---|
| iOS sim (prior pass, Metro 8082) | **PASS** — Today, log search, Library, Plan, Progress, Paywall | Narrative below (morning session) |
| iOS sim (revision pass, Metro 8081 tunnel) | **BLOCKED** — redbox | `apps/mobile/screenshots/agent/audit-2026-06-11-today.png` |
| iOS sim (revision pass, localhost URL) | **BLOCKED** — still tunnel URL in error | `audit-2026-06-11-today-localhost.png` |
| Physical iPhone dev client | **CRASH** on tunnel reload | `docs/debug/Suppr-2026-06-11-183604-device.ips` |
| TestFlight build 57 | **PARTIAL** — ASC pull 2026-06-12: 22 screenshot threads (F-158..F-179); 0 crashes; functional smoke checklist incomplete | `docs/testflight-feedback/tracker.md` + `feedback-2026-06-12.json` (gitignored) |
| Web authed | **NOT RUN** | expired `tests/e2e/.auth/user.json` |

### Journey 1 — Today (cold open) · prior pass PASS
- **Screens:** Today hero, week strip, macro tiles.
- **Observations:** Premium — Sloe wordmark, calm copy, ring "1,231 LEFT," Plan-first tab bar.
- **Trust:** High at cold open.
- **Revision:** `e3ac41c7` perf memoization + sync hardening not visually re-tested (Metro down).

### Journey 2 — Food logging · prior pass PASS
- **Screens:** Log sheet → search "chicken breast."
- **Observations:** Verified/Estimated badges, per-serving macros + grams, past-logged section, barcode/voice/camera — best-in-class vs MFP.
- **Bug (F-161/F-162):** OFF/FatSecret micros missing in search preview — **PARTIAL** (merged [PR #390](https://github.com/gracehowse/Suppr/pull/390); TF58 device verify pending).
- **Bug:** Deep link while Log sheet open does not dismiss modal — **PARTIAL** (tab-blur dismiss **PASS** via [PR #389](https://github.com/gracehowse/Suppr/pull/389); in-tab `?date=` / `?editMealId=` dismiss **PASS** pending PR).
- **Revision:** `foodSelectionToMealMacros` + try/catch on select — code fix; UI path **PARTIAL** (logic tested; live select not re-captured on TF57).
- **ENG-1066 / F-173:** Swap pill on verify rows — **PARTIAL** (merged PR #394; iOS sim **PASS** via PR #396 fixture `suppr:///recipe/verify?fixture=1`; TF58+ physical confirm pending).
- **ENG-772:** Editable `eaten_at` — **PASS** (shipped behind flag; iOS sim **PASS** via PR #396 `suppr:///dev/edit-meal-states`; web food-search preview **PASS** 2026-06-12 at desktop + mobile-web with `?__force_flags=editable_eaten_at`; web edit-meal modal **N/A**; live TestFlight flag path still ENG-840).

### Journey 3 — Recipes (Library + Discover) · prior pass PASS
- **Observations:** Import CTA prominent; macro chips on cards.
- **Concerns:** Generic "Imported recipe" title; empty grey thumbnails (ENG-1015); high kcal on some cards — plausibility spot-check.

### Journey 4 — Meal Plan · prior pass PASS with trust flag
- **Observations:** Strong plan UI; Generate/Adjust, macro chips.
- **Trust (morning):** "7/7 hits" above over-budget Thursday — **ENG-1049 shipped in code**; re-verify on device when Metro works.

### Journey 5 — Progress · prior pass PASS with trust flag
- **Observations:** Maintenance narrative, weight trend toggle.
- **Trust:** "111% adherence · over" — still open P1-8.

### Journey 6 — Paywall · prior pass PASS
- **Observations:** Strong hero, feature matrix, restore purchases.
- **Concerns:** No price on screen; AI coach scope; morning P0-1 — **fixed in code**, re-verify live.

### Journey 7 — Dev client stability · revision pass FAIL
- **Observations:** Metro tunnel redbox; native crash on device during remote load.
- **Recommendation:** All launch QA on TestFlight 57; treat dev client as non-ship.

### Cross-journey notes
- Product **feels** finished when it renders; dev tooling currently **unreliable** for session QA.
- Production path (no DevLauncher) is the correct launch-readiness surface.
- Prior unfinished tells: thumbnails, import titles, adherence copy — still apply on release binary until verified fixed.

---

*End of audit (revision pass). Report intentionally left untracked for Grace's review. No code, schema, flags, or external state were modified during this audit pass.*
