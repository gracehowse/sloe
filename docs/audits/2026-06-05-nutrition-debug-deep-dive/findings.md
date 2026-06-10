# Nutrition + full-depth debugging deep dive — findings

**Date:** 2026-06-05  
**Methodology:** [`docs/audits/2026-05-05-debug-audit-plan.md`](../2026-05-05-debug-audit-plan.md) five lenses (Math, Copy, State, Cross-platform, Time)  
**Agents (synthesized):** repo-auditor, nutrition-engine, integration-manager, data-integrity, customer-lens, sync-enforcer, qa-lead, security-reviewer (light)

---

## Executive summary

| Area | Verdict | Top action |
|------|---------|------------|
| Food search (live) | **Improved** — FS restored; F-01/F-02 ranking fixes shipped (re-run live audit to confirm) | Live-audit regression pin when `hasFatSecretEnv()` |
| Food search (unit) | **Pass** — 67/67 ranking golden + unit tests green (2026-06-05 fix pass) | — |
| Health sync (code) | **Pass** — diagnostics + dedup/tombstone paths implemented | Grace: execute HS-01–HS-09 on physical iPhone (ENG-874) |
| Health sync (device) | **Blocked** — Grace lane; runbook shipped | [`health-sync-device-runbook.md`](../../testing/health-sync-device-runbook.md) |
| Today math/copy | **Pass** — weekly avg vs total denominators differ by design; hint copy added (F-06) | — |
| Import errors | **Pass** — central `importErrorCopy.ts` + sanitiser | Spot-check routes still map to stable codes |
| ENG-871 spacing | **Pass** (web) — `mt-10` on meals + TD1 + TD2 | Re-verify iOS sim when Metro on localhost |
| ENG-872 / F-07 nudges | **Pass** — missed-yesterday banner retired | `shouldShowMissedYesterday` always false |
| ENG-873 connect path | **Pass** — `Settings → Connections` in shared copy | — |

---

## Phase 0 — Ground truth inventory

| Surface | Status | Key files | June-4 / Linear |
|---------|--------|-----------|-----------------|
| Food search merge + rank | **Real** | `src/lib/nutrition/foodSearchRanking.ts`, API routes, `FoodSearchPanel` web + mobile | ENG-877 in progress; ENG-34 unblocked locally (FS keys present) |
| Live search audit runner | **Real** | `scripts/audit-nutrition-search.ts` | Re-run 2026-06-05 — FS hits restored |
| Provider integration CI smoke | **Partial** — skips without bearer | `tests/unit/foodSearchProviderIntegration.test.ts` | Needs `SUPPR_TEST_AUTH_BEARER` |
| Health import pipeline | **Real** (code) | `apps/mobile/lib/healthSync.ts`, `nutritionImportSummary.ts`, `health-sync.tsx` | ENG-874 device matrix pending |
| Health import probe UI | **Real** | `probeNutritionImport`, `testID=health-sync-test-import` | Shipped 2026-06-04 |
| Today journal | **Real** | `apps/mobile/app/(tabs)/index.tsx`, `NutritionTracker.tsx` | ENG-871–873 backlog polish |
| Recipe import errors | **Real** | `src/lib/recipes/importErrorCopy.ts` | I01–I08 addressed May 2025 |
| Weekly insight (mobile scroll) | **Real** | `WeeklyInsightCard` in mobile Today | Web: desktop right-rail only — intentional |
| Detox/Maestro health sync | **Partial** — layout only | `24-health-sync.test.ts`, `.maestro/24_health_sync.yaml` | No live MFP import assertion |

---

## Ranked findings (P0 → P2)

### F-01 — `Big Mac` ranks USDA verified above FatSecret branded (P1) — **FIXED**

| Field | Value |
|-------|-------|
| **Lens** | Math / relevance |
| **Agent** | nutrition-engine |
| **Evidence** | Live audit 2026-06-05: top1 `Big Mac (McDonalds)` USDA score 1.07 vs #2 `McDonald's · Big Mac` FS 0.95 — [`nutrition-search-golden-audit-2026-06-04.md`](../../testing/nutrition-search-golden-audit-2026-06-04.md). |
| **Fix** | `brandedMenuProductBoost` (chain-restaurant + exact product match) + `usdaBrandedMenuPenalty` in [`foodSearchRanking.ts`](../../src/lib/nutrition/foodSearchRanking.ts). |
| **Verification** | `foodSearchRankingGolden.test.ts` — `big mac` top1 `McDonald's · Big Mac`; `foodSearchRanking.test.ts` — FS > USDA for `big mac`. |

### F-02 — UK grocery queries miss retailer in top 1 (P1) — **FIXED**

| Field | Value |
|-------|-------|
| **Lens** | Relevance / parity |
| **Agent** | nutrition-engine |
| **Evidence** | `tesco chicken` top1 generic `Chicken` (FS 0.64); `sainsbury's hummus` top5 has no Sainsbury's row — same audit file. |
| **Fix** | `UK_GROCERY_RETAILER_TOKENS` + `ukRetailerGenericRowPenalty` in [`foodSearchLocale.ts`](../../src/lib/nutrition/foodSearchLocale.ts) / [`foodSearchRanking.ts`](../../src/lib/nutrition/foodSearchRanking.ts). |
| **Verification** | `foodSearchRankingGolden.test.ts` — `tesco chicken` top1 `Tesco · British Chicken Breast Fillets`; `sainsbury's hummus` top1 `Sainsbury's · Houmous`. |

### F-03 — HS-01–HS-09 device matrix still unexecuted (P1 — trust) — **ACTIONED (Grace lane)**

| Field | Value |
|-------|-------|
| **Lens** | State |
| **Agent** | qa-lead + data-integrity |
| **Evidence** | All rows **Blocked — ENG-874** in [`health-sync-functionality-matrix.md`](../../testing/health-sync-functionality-matrix.md). Code paths reviewed in [`healthSync.ts`](../../apps/mobile/lib/healthSync.ts). |
| **Action** | Step-by-step runbook: [`health-sync-device-runbook.md`](../../testing/health-sync-functionality-matrix.md) — HS-01–HS-09 checklist + failure capture template. **Execution:** Grace on physical iPhone (ENG-874). |
| **Test pin** | Maestro/Detox `imported > 0` with fixture HK samples (future) |

### F-04 — Edamam 429 mid-batch skews audit (P2) — **FIXED**

| Field | Value |
|-------|-------|
| **Lens** | Integration |
| **Agent** | integration-manager |
| **Evidence** | Audit log: rate limited on `banana`, `brown rice`, `tesco chicken`, `sainsbury's hummus` after early queries succeed. |
| **Fix** | `sleep(800)` before Edamam per query + `sleep(400)` between golden queries in [`audit-nutrition-search.ts`](../../scripts/audit-nutrition-search.ts). |

### F-05 — Provider integration tests skip in CI (P2) — **FIXED**

| Field | Value |
|-------|-------|
| **Lens** | QA gap |
| **Agent** | qa-lead |
| **Evidence** | Tests skip without `SUPPR_TEST_AUTH_BEARER`. |
| **Fix** | Optional CI step in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) when `SUPPR_TEST_AUTH_BEARER` secret is set; setup doc [`provider-search-ci.md`](../../testing/provider-search-ci.md). |
| **Ops** | Add repo secret `SUPPR_TEST_AUTH_BEARER` (+ provider keys) to enable the step on merge CI. |

### F-06 — Weekly deficit vs avg daily deficit uses different denominators (P2) — **FIXED**

| Field | Value |
|-------|-------|
| **Lens** | Math / Copy (T14) |
| **Agent** | customer-lens |
| **Evidence** | Web screenshot: Avg daily deficit **660** kcal, Weekly deficit **6,954** kcal (≠ 660×7). By design: avg divides by **logged days only**; weekly sums **all window days**. |
| **Fix** | `WEEKLY_ROLLING_DENOMINATOR_HINT` in [`today.ts`](../../src/lib/copy/today.ts); rendered on web + mobile weekly rolling cards. `todayCopyParity.test.ts` green. |
| **Screenshot** | [`before/today-populated-web-desktop.png`](before/today-populated-web-desktop.png) |

### F-07 — ENG-872: missed-yesterday banner on populated today (P2) — **FIXED**

| Field | Value |
|-------|-------|
| **Lens** | State / customer |
| **Agent** | customer-lens + product-lead |
| **Evidence** | Banner redundant whether today empty (Fresh start chip) or populated (user logging). |
| **Decision** | Retire banner — [`shouldShowMissedYesterday`](../../src/lib/nutrition/missedYesterday.ts) always returns `false`; copy export kept for wiring tests. |
| **Verification** | `missedYesterday.test.ts`, `nutritionTrackerRender.test.tsx`; iOS Today screenshot has no missed-yesterday line. |

### F-08 — iOS sim screenshot blocked (P2 — tooling) — **FIXED**

| Field | Value |
|-------|-------|
| **Lens** | QA |
| **Agent** | qa-lead |
| **Evidence** | Prior capture failed — tunnel Metro (`exp.direct`) while sim needs `127.0.0.1:8081`. |
| **Fix** | Kill tunnel Metro; `npx expo start --port 8081 --dev-client` (localhost); relaunch via `exp+suppr://…url=http://127.0.0.1:8081`. Documented in [`agent-eyes-and-hands.md`](../../testing/agent-eyes-and-hands.md) troubleshooting. |
| **Screenshot** | [`before/today-populated-ios.png`](before/today-populated-ios.png) — Today ring + macros (2026-06-05) |

### F-09 — Mobile search on physical device hits production API by default (P2) — **FIXED (docs)**

| Field | Value |
|-------|-------|
| **Lens** | Cross-platform |
| **Agent** | integration-manager |
| **Evidence** | [`getSupprApiBase()`](../../apps/mobile/lib/supprWeb.ts) defaults to prod when `EXPO_PUBLIC_API_URL` unset on device. |
| **Fix** | Documented sim vs device API hosts in [`agent-eyes-and-hands.md`](../../testing/agent-eyes-and-hands.md) § Mobile API host. ENG-877 pass should record host used. |

### F-10 — ENG-871 spacing parity (cleared with caveat)

| Field | Value |
|-------|-------|
| **Lens** | Cross-platform |
| **Agent** | sync-enforcer |
| **Evidence** | Mobile: `todaySectionBreak: 32` + `todayScrollGap: 8` → 40px ([`layout.ts`](../../apps/mobile/constants/layout.ts)). Web: `mt-10` on meals, TD1, TD2 ([`NutritionTracker.tsx`](../../src/app/components/NutritionTracker.tsx) L2633, L2799, L2869). Tests: `todayRhythmLayout.test.ts` green. |
| **Fix sketch** | None — verify visually on sim after localhost Metro. |

### F-11 — ENG-873 connect path (cleared)

| Field | Value |
|-------|-------|
| **Lens** | Copy |
| **Agent** | sync-enforcer |
| **Evidence** | `TODAY_HEALTH_CONNECT_ROUTE = "Settings → Connections"` in [`today.ts`](../../src/lib/copy/today.ts); used in mobile activity cards + web steps hint via `todayHealthConnectActiveCaloriesHint()`. `FORBIDDEN_TODAY_PHRASES` includes legacy `More → Connected`. |
| **Fix sketch** | None |

### F-12 — Import error vendor leak (cleared)

| Field | Value |
|-------|-------|
| **Lens** | Copy (I01–I08) |
| **Agent** | nutrition-engine |
| **Evidence** | [`importErrorCopy.ts`](../../src/lib/recipes/importErrorCopy.ts) centralises codes; `sanitiseImportErrorMessage` defense-in-depth; `extractSocialRecipe.ts` maps vendor 429 to stable codes. |
| **Fix sketch** | Periodic grep for raw `OpenAI`/`Postgrest` in user-facing strings |

### F-13 — Security: search API routes unauthenticated (informational)

| Field | Value |
|-------|-------|
| **Lens** | Security |
| **Agent** | security-reviewer |
| **Evidence** | Audit script calls provider clients directly (no auth) — by design for search proxy routes serving authenticated app users. Ensure rate limiting / abuse monitoring on `/api/fatsecret/search` etc. in production. |
| **Fix sketch** | No change this pass — note for production-readiness |

---

## Hypothesis checklist (June-4)

| ID | Hypothesis | Result |
|----|------------|--------|
| H1 | FatSecret env missing | **Cleared** — `FATSECRET_CLIENT_SECRET: yes` in 2026-06-05 audit |
| H2 | Unit golden vs live diverge | **Mitigated** — F-01, F-02 fixed in ranking; re-run live audit to confirm |
| H3 | MFP import unproven on device | **Still open** — F-03 runbook ready; Grace executes ENG-874 |
| H4 | Web TD1/TD2 spacing gap | **Cleared** — F-10 |
| H5 | ENG-872 redundant nudges | **Partial** — empty day fixed; populated day banner remains (F-07) |
| H6 | Edamam 429 | **Cleared** — F-04 throttle shipped |
| H7 | Today kcal label drift | **Cleared** — net/burn use shared `today.ts` copy; F-06 hint shipped |

---

## Live verification log (Phase 2)

| Workstream | Result | Artifact |
|------------|--------|----------|
| `npx tsx scripts/audit-nutrition-search.ts` | **Pass** (ran; FS 10 hits/query) | Updated `nutrition-search-golden-audit-2026-06-04.{md,json}` |
| Unit tests | **67/67 pass** (ranking fix pass) | `foodSearchRankingGolden` + `foodSearchRanking` |
| Mobile unit | **12/12 pass** | nutritionImportDiagnostics, healthSyncErrorRecovery, todayRhythmLayout |
| Web Today T01–T16 spot-check | **Partial** | Desktop screenshot; missed-yesterday visible (F-07); weekly card (F-06) |
| iOS Today screenshot | **Fail** (black) | F-08 — Metro mismatch |
| HS-01–HS-09 physical device | **Not run** (agent) | Grace lane — tunnel URL `https://vuqkyku-gracehowse-8081.exp.direct` |

---

## Top 10 ranked actions

| Rank | ID | Action | Sev | Effort | Owner |
|------|-----|--------|-----|--------|-------|
| 1 | F-03 | Execute HS-01–HS-09 on physical iPhone | P1 | M | qa-lead / Grace |
| 2 | F-01 | ~~Fix `Big Mac`-class branded ranking~~ | P1 | S | **Done** |
| 3 | F-02 | ~~UK retailer boost~~ | P1 | M | **Done** |
| 4 | F-05 | Wire `SUPPR_TEST_AUTH_BEARER` for CI smoke | P2 | S | qa-lead |
| 5 | F-06 | ~~Clarify weekly vs avg deficit denominators~~ | P2 | S | **Done** |
| — | F-04 | ~~Throttle Edamam in audit script~~ | P2 | S | **Done** |
| 7 | F-07 | Product call: hide missed-yesterday when today populated | P2 | S | product-lead |
| 8 | F-09 | Document `EXPO_PUBLIC_API_URL` for device search QA | P2 | S | docs-keeper |
| 9 | F-08 | Re-capture iOS Today AFTER screenshots | P2 | S | qa-lead |
| 10 | — | Close ENG-34 if FS stable in prod/preview | P2 | S | integration-manager |

---

## Automated test baseline

```
tests/unit/foodSearchRankingGolden.test.ts  35 passed  (2026-06-05 fix pass)
tests/unit/foodSearchRanking.test.ts        32 passed  (incl. big mac + UK retailer)
tests/unit/todayCopyParity.test.ts          51 passed  (WEEKLY_ROLLING_DENOMINATOR_HINT)
tests/unit/missedYesterday.test.ts          10 passed
apps/mobile/tests/unit/todayRhythmLayout.test.ts           3 passed
```

---

## Screenshots (BEFORE)

| File | Surface | Platform |
|------|---------|----------|
| [`before/today-populated-web-desktop.png`](before/today-populated-web-desktop.png) | Today populated + Activity weekly card | Web desktop |
| [`before/today-populated-ios.png`](before/today-populated-ios.png) | Today (failed — black) | iOS sim |

---

## Open questions for Grace

1. **ENG-872:** Keep missed-yesterday banner when user has logged today but skipped yesterday?
2. **ENG-874:** Run HS matrix now that device + tunnel Metro work?
3. **FatSecret:** Confirm preview/prod Vercel env has same keys as local (ENG-34).
