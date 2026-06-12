# Independent Launch-Readiness Audit — Cursor backlog verification (Suppr / Sloe)

**Date:** 2026-06-12
**Reviewer:** External due-diligence audit (autonomous, founder-commissioned)
**Branch reviewed:** `main` @ `c7749988` (`docs: Gate A sweep audit/tracker updates`)
**Range under audit:** `e3ac41c7..c7749988` — the launch-backlog wave Cursor implemented (PRs #387–#399)
**Supersedes/extends:** `docs/ux/reviews/2026-06-11-launch-readiness-audit.md` (prior full sweep). This pass re-verifies the prior P0/P1 set against HEAD and audits the *new* Cursor work both for **what** it did and **how** it did it.

**Method (evidence-first):**
- Ground-truth reconstruction of the 62-file / +2386 −602 range via `git diff` per file.
- **Seven parallel specialist deep-dives** (security, nutrition-correctness, code-craft, vendor-integration, parity, QA/fixtures, data-integrity) — each read the actual code, none took intent on trust.
- **Live iOS simulator walkthrough** (iPhone 17 Pro, real Metro bundle — no tunnel redbox this pass): cold-open → log search → preview micros → edit-meal time field → Plan → Progress → Recipes/Discover/Library → import → verify fixture. Screenshots in `apps/mobile/screenshots/agent/audit-2026-06-12-*.png`.
- **Live web walkthrough** (authed, regenerated `tests/e2e/.auth/user.json`): Today dashboard, LogSheet search → preview with `editable_eaten_at` forced, at desktop 1440px + mobile-web 390px + tall 440×2400.
- **Live production DB verification** via Supabase MCP (read-only `select` on `nutrition_entries`) — confirmed an `eaten_at` edit persisted and survived the debounced backstop.
- **Live deep-link probes**: LogSheet dismissal on in-tab `?date=` change; dev/verify fixture reachability.
- **Migration apply-state** cross-checked (data-integrity agent ran `supabase migration list --linked`).

> **Evidence discipline.** Items I verified at runtime are marked **LIVE-VERIFIED**. Items confirmed only in code are **CODE-VERIFIED**. Carried-over claims I could not re-prove are **UNVERIFIED**. One near-miss is called out explicitly: I almost filed a false "web Time-eaten missing" P-bug from a desktop capture; a tall-viewport recapture proved it present (sticky-footer fold). SEE-don't-orchestrate held.

---

## 1. Executive Summary

The backlog wave Cursor shipped between `e3ac41c7` and HEAD is **genuinely high-quality launch work — the best-disciplined batch in the recent history of this repo.** Eleven Gate-A items landed (ENG-772, 877, 1059, 1061, 1062, 1063, 1066, 808, full-nutrient-panel sort, plus the two LogSheet-dismissal PRs), and across all seven independent review lenses the verdict is consistent: **shared-library consolidation instead of copy-paste, real behaviour tests for the new pure logic, correct feature-flag discipline, a clean nullable migration applied to prod without drift, and security surfaces that fail safe.** The OFF-search scale risk the 2026-06-11 audit flagged as P1-3 is now **proxied through the vendor cache on both platforms** (ENG-1059) — the single biggest launch-scale hole is closed.

The work is not flawless, but every flaw I found is **P2 or below, or latent (not reachable in the shipped UI).** There is **no new P0 and no reachable P1 regression** in this range. The headline risks that remain are the *same operational ones the prior audit named* — they are not things Cursor broke:

1. **DMCA designated agent (ENG-859)** still unregistered — the one true code-adjacent P0, and it is ops/legal, not engineering.
2. **Monetisation chain (Stripe Tax, RC IAP, offerings)** is Gate B — correctly *not* a July free-cohort blocker, but real before any paid sub.
3. **Client monoliths keep growing** — `(tabs)/index.tsx` is now **6,706 lines** (+88 this range). Feature-wiring through legacy files, but the wrong direction.
4. **`eaten_at` persistence is real but has zero behavioural test**, and the debounced backstop (`useNutritionEntriesSync`) omits `eaten_at` and hard-codes `date_key` — latent corruption if cross-day editing is ever enabled (the UI clamps to same-day today, so not currently reachable; I LIVE-VERIFIED `eaten_at` survives the backstop).
5. **Dev/fixture screens ship in the binary** (`suppr:///dev/edit-meal-states`, `suppr:///recipe/verify?fixture=1`) with no `__DEV__` route guard — I opened the verify fixture live; it can't write, so contained, but it is shippable QA scaffolding.

**Bottom line:** Cursor's work **clears the bar for the closed founding-cohort beta.** The product *feels finished* when it renders — and this pass it rendered, end to end, on a real Metro bundle. **Conditional-go for the founding cohort** once ENG-859 is in motion and Gate0 is re-proven 5/5; **the Cursor backlog is not what's holding launch back.**

---

## 2. Overall Product Score — **7 / 10** (held)

Differentiated wedge (Reel/social import + macro-fit) is real, tested, and now scale-safe on search. Held back by the same structural gaps the prior audit named (no recipe collections, thin web plan, no pantry) — none of which this range was meant to address.

## 3. Overall Engineering Score — **7.5 / 10** (was 7)

Up half a point: this range is net code-health-positive (duplication *deleted*, shared libs, honest tests, clean migration). Server remains mature (7.5); the client-monolith debt is the only thing keeping it off an 8, and it grew this range.

## 4. Overall UX Score — **7 / 10** (was 6.5)

Up: this is the first pass in weeks where the **full mobile loop rendered live** without a Metro redbox, and it looks premium (Sloe palette, calm copy, confident search tiers). The desktop LogSheet sticky-footer hiding the Time-eaten field below the fold is a minor discoverability note.

## 5. Overall Security Score — **7.5 / 10** (held)

Gate-0 fixes intact and unmodified at HEAD (CODE-VERIFIED: `20260611120000_profiles_insert_lockdown_eng1035.sql` untouched, SSRF guard + `description:null` present). New OFF proxy is auth-gated, rate-limited, SSRF-proof (fixed host). −2.5 for: dev-fixture routes shippable (P2), `getUserTier` fail-open (carried), HIBP off (carried), Gate0 live re-proof outstanding.

## 6. Overall Nutrition Accuracy Score — **8 / 10** (held)

ENG-1062 micro scaling and PR #397 deficiency sort are **mathematically correct** (per-100g→grams once, per-serving×servingFraction once, no double-scaling; target-ascending/limit-descending with null-safe ordering). ENG-772 chronology math sound (UTC store, local edit, day-clamped). Residual P2/P3: no per-micro confidence gate, US-only DVs, stale "descending" comments.

## 7. Overall Recipe Platform Score — **6.5 / 10** (held)

ENG-1066 Swap pill restored on verify rows (LIVE-VERIFIED via fixture); import infra strong. ENG-859 still open; generic titles, empty thumbnails, no collections unchanged.

## 8. Overall Meal Planning Score — **6.5 / 10** (held)

ENG-808 leftover icon fixed on mobile; Plan renders clean (LIVE-VERIFIED). Web leftover badge diverges (icon + colour — see §21). No pantry, weak aisles, thin web parity unchanged.

---

## 9. Launch Readiness Assessment

**Verdict: the Cursor backlog range is GO. The product-level gate is CONDITIONAL-GO for the closed founding cohort**, unchanged from the prior audit's operational blockers.

| Gate | Requirement | Status @ c7749988 |
|---|---|---|
| Cursor range quality | PRs #387–#399 correct + tested + parity | **PASS** (this audit) |
| Gate 0 code | ENG-1035/1036/1043, SSRF, vendor cache, **OFF proxy** | **SHIPPED** (OFF proxy = ENG-1059 new) |
| Gate 0 prod | `verify-gate0-db.mts` 5/5 | **UNVERIFIED** (needs `GATE0_VERIFY_PASSWORD`) |
| Legal P0 | ENG-859 DMCA agent | **OPEN** (ops) |
| Monetisation | Tax + RC IAP + offerings | **Gate B** (not a July blocker — correct) |
| Device proof | ENG-874 health matrix | **IN PROGRESS** |
| eaten_at backstop | fix before cross-day editing ramps | **LATENT** (not reachable today) |

- **What breaks first at scale:** no longer OFF search (proxied). Now: Edamam 1k/day account-wide ceiling on cold queries; weekly-recap cron row cap.
- **First support tickets:** generic "Imported recipe" titles; empty recipe thumbnails (ENG-1015); on Progress, "102% · over" reads as *good* adherence (P1-8, still open — LIVE-VERIFIED on sim).
- **TDD/investor flags:** 6,706-line Today monolith; `eaten_at` write path untested; dev fixtures in binary.

**Recommended gate:** Gate0 5/5 → ENG-859 in motion → TF57 smoke on release binary → 20–50 founding cohort via `lifetime_pro` comp.

---

## 10. P0 Findings (must fix before onboarding any user)

### P0-1 — DMCA designated agent not registered (ENG-859) · legal · OPEN · ops
Carried unchanged from the prior audit; **not in Cursor's range**. §512(c) safe harbour for the import wedge requires Copyright Office registration. In-app form + API route exist (`app/dmca/page.tsx`, `app/api/dmca-takedown/route.ts`). **Recommendation:** register, publish agent in Terms/footer, link from import disclaimer. No automated test; manual legal checklist.

### P0-2 — Gate0 entitlement exploit must be live-verified, not assumed · security · UNVERIFIED
Carried. Tier-INSERT lockdown (ENG-1035) and promo GUC (ENG-1043) are **CODE-VERIFIED intact** at HEAD, but production closure needs `node --import tsx scripts/verify-gate0-db.mts` → 5/5 with `GATE0_VERIFY_PASSWORD`. **Not introduced by this range.**

> **No new P0 in the Cursor range.** Both standing P0s are operational, pre-existing, and outside the code Cursor touched.

---

## 11. P1 Findings (fix before broader beta)

### P1-1 — `eaten_at` persistence has zero behavioural test coverage · qa/data-integrity · CONFIRMED
- **Category:** Test honesty / data integrity.
- **Description:** The `eaten_at` write path is correct in code and **LIVE-VERIFIED working** (I edited a meal's time on the sim, queried prod: `eaten_at = 2026-06-12 14:05:00+00`, `date_key` unchanged). But the only test claiming to guard it — `apps/mobile/tests/unit/journalSupabasePersistence.test.ts` — is a **source-grep** that asserts the string `persistMealUpdateImmediate(` exists; it never asserts `eaten_at`/`date_key` are in the `.update()` payload. A refactor dropping `eaten_at` from the write would pass every test.
- **Evidence:** `journalSupabasePersistence.test.ts:54–60`; correct write at `apps/mobile/app/(tabs)/index.tsx:576–599`.
- **Impact:** This is the exact class of bug that previously cost Grace 25 days of journal data — left unguarded.
- **Recommendation:** Add a mock-Supabase test asserting `persistMealUpdateImmediate` sends `eaten_at` + correct `date_key`, including the same-day clamp.
- **Suggested issue:** *ENG: behavioural test for eaten_at write payload (mock-Supabase, cross-day clamp).*

### P1-2 — Debounced backstop omits `eaten_at` + hard-codes `date_key` (latent corruption) · data-integrity · CONFIRMED (not currently reachable)
- **Category:** Data integrity (latent).
- **Description:** `useNutritionEntriesSync` re-upserts the selected day's meals 600ms after any mutation, building rows **without `eaten_at`** and with `date_key: dk` (selected day) hard-coded (`useNutritionEntriesSync.ts:69–86`). For a *cross-day* time edit this would reset `date_key` back to the selected day and (version-dependent) wipe `eaten_at`.
- **Why it is P1-latent, not P1-active:** the UI clamps time edits to the anchor day (`nutritionEntryDateKeyAndEatenAt` rebuilds `date_key` from `anchorDay`), so a time-only edit never crosses days, and I **LIVE-VERIFIED `eaten_at` survives the backstop** (still `14:05` in prod after the 600ms window). The corruption only becomes reachable if cross-day editing ships.
- **Evidence:** `apps/mobile/hooks/useNutritionEntriesSync.ts:69–89`; mounted at `index.tsx:4286`.
- **Recommendation:** Route the backstop through the same row-builder the immediate-persist paths use so the column set can never diverge — add `eaten_at` + eaten-derived `date_key`. Fix **before** the `editable_eaten_at` flag ramps past internal.
- **Suggested issue:** *ENG: unify nutrition_entries upsert row-builder across immediate + backstop sync paths.*

### P1-3 — Adherence headline reads backwards when over target · nutrition · CONFIRMED (carried, still open)
- **Description:** `progressRangeStats.ts:161` computes `Math.round((avg/target)*100)` **uncapped**. LIVE-VERIFIED on sim Progress: "Carbs 102% · over" sits next to "88% Average Adherence" — overeating presents as *higher* adherence.
- **Evidence:** `src/lib/nutrition/progressRangeStats.ts:161,237`; sim screenshot `audit-2026-06-12-progress.png`.
- **Impact:** Trust erosion on the Progress tab. **Not in Cursor's range — pre-existing P1.**
- **Recommendation:** Cap display at 100%, or rename to "intake vs target", or invert the over-band copy.

> **Carried operational P1s (not in this range, unchanged):** monetisation chain Gate B; `getUserTier` fail-open on missing service role; ENG-874 health sync device proof; web plan feature-thinness.

> **Resolved since prior audit (Cursor range):** OFF text-search proxy (P1-3 of 2026-06-11) → **CLOSED** by ENG-1059 on both platforms; LogSheet deep-link dismissal → **LIVE-VERIFIED** (firing `?date=` while the sheet was open dismissed it and switched to the prior day).

---

## 12. P2 Findings (important improvements)

- **P2 — Dev/fixture screens reachable in the production binary.** `apps/mobile/app/dev/edit-meal-states.tsx` and `apps/mobile/app/recipe/verify.tsx` (`?fixture=1`) have **no runtime `__DEV__` guard** (the `__DEV__` reference in `edit-meal-states.tsx:8` is a comment). expo-router ships every `app/` route. **LIVE-VERIFIED:** `suppr:///recipe/verify?fixture=1` opened the "DEV FIXTURE — Greek salad" screen on the running app. Contained (verify-fixture Save is hard-blocked at `verify.tsx:617–620`; edit-meal handlers are no-ops → no Supabase write), but it is shippable QA scaffolding. **Fix:** add `apps/mobile/app/dev/_layout.tsx` rendering `<Redirect href="/" />` when `!__DEV__`, and a `__DEV__` gate on the verify fixture branch, mirroring `DevFlagOverrides.tsx:90`.
- **P2 — Two silent web/mobile parity drifts** (see §21): verify ingredient affordance labelled **"Swap" (mobile) vs "Change match" (web)**; leftover badge **Package icon + amber (mobile) vs text-only + green (web)**. Both undocumented; both small web fixes.
- **P2 — Theatrical LogSheet-dismissal tests.** `logSheetEntryPointConsolidation.test.ts` / `logSheetSlotHonoured.test.ts` (dismissal pins) `readFileSync` the screen and regex-match — they catch line-deletion only, not logic regressions. The behaviour is correct (LIVE-VERIFIED), but the guard is not. **Fix:** mounted blur/param test (RNTL + mocked `useFocusEffect`).
- **P2 — Client monoliths grew.** `(tabs)/index.tsx` +88 → **6,706 lines**; web `FoodSearchPanel` +70; mobile +68; `NutritionTracker` +32. Feature-wiring through legacy files — the 400-line rule is moving the wrong way (offset partly by `verifyRecipe.ts` net −43 from OFF-proxy consolidation).
- **P2 — Token residue in new UI (inherited, not fresh divergence).** `TodayEditMealModal.tsx:206–208` (`fontSize:14, fontWeight:"500"`); verify Swap pill `paddingVertical:6` (off the 4/8/12 scale) + `fontSize:12` at `verify.tsx:696–703`. Each *matches its local sibling* but should have used `Type`/`Spacing` tokens at write time. **Fix:** batch token swap (route to `executor`).
- **P2 — OFF route returns a 502 on hard failure instead of the degraded envelope** (`app/api/off/search/route.ts:57–62`) — search degrades *silently* (client shows fewer results, no "showing saved results" notice) rather than honestly. Cosmetic, not data.
- Carried P2s unchanged: web single-meal optimistic insert/delete no rollback; FatSecret v1/v2 micro guard; dual meal-slot tables; US-only DVs; CI `VERIFY_STRICT=0`; ~246 hex literals.

---

## 13. P3 Findings (future / polish)

- Mobile OFF **barcode** lookup (`verifyRecipe.ts:1752`) calls `world.openfoodfacts.org` direct with **no timeout/AbortController** (pre-existing; not text search, so outside ENG-1059 scope) — a slow OFF blocks the scan screen.
- Web `searchOff()` (and the other three web vendor fetches) have **no per-call AbortSignal** — bounded only by the server's 12s timeout (`FoodSearchPanel.tsx:435`).
- No `eaten_at` plausibility CHECK constraint (year-1900/far-future accepted at the DB; UI clamps today) — self-scoped, add a loose bound in a follow-up migration.
- Stale "%DV descending" comments in `fullNutrientPanel.ts:181` + both panel test headers (sort is actually target-asc/limit-desc).
- Misleading test name `mealEatenAt.test.ts:53` ("cross-day edit" proves the *absence* of a cross-day move).
- Decimal-rounding heuristic differs between `scaleMicrosForGrams` (key-suffix) and `scaleMicrosPerServing` (`endsWith("G")`) — cosmetic sub-mg divergence.
- `audit-nutrition-search.ts` has no `CI`-exit guard (inert today; would burn Edamam/USDA quota if CI-wired).
- Carried: weekly-recap cron 5000-row cap; widen `calories` smallint; HIBP password protection; empty thumbnails (ENG-1015); collections; store integration.

---

## 14. Architecture Findings (7.5/10)

Two-app npm monorepo (Next.js 15 / Vercel + Expo iOS / EAS) sharing `@suppr/shared` → `src/lib/`. **The range's best architectural move:** OFF search consolidated into one server endpoint (`app/api/off/search/route.ts`) consumed by both platforms, *deleting* ~80 lines of mobile↔web client-side OFF fetch/reconcile that had to be kept in lockstep. `mealEatenAt.ts` and `foodSearchPreviewNutrition.ts` are single-source, imported by web (`@/lib`) and mobile (`@suppr/shared`). Vendor cache + 90% quota breaker now covers OFF. **Weakness unchanged:** client state monoliths will make AI-coach / wearables expensive until decomposition (ENG-703); no Turborepo; duplicated `database.types.ts`.

---

## 15. Code Quality Findings (6.5/10)

**The range is exemplary on duplication and deferral hygiene** (code-craft lens): zero silent deferrals in added lines (every TRACK carries an ENG- ref); eaten_at/micros/OFF-search all consolidated into shared lib; generated types not hand-edited; idempotent nullable migration. **New pure-logic tests are real behaviour tests** (`mealEatenAt`, `foodSearchPreviewNutrition`, `foodSearchRanking`, `vendorSearchCacheRoutes` — each fails if the feature breaks). The two craft debts: monolith growth (§12) and inherited token residue (§12). Source-string-pin tests exist but are honestly labelled — **do not count them as behavioural coverage** (§17/§27).

---

## 16. Security Findings (7.5/10)

**Reviewed forensically; PASS for launch — no P0/P1.** Flag-force fails safe: web `flagForceOverride` hard-returns null when `NODE_ENV==="production"` (statically DCE'd); mobile force layers are `__DEV__`-gated + Hermes-tree-shaken; **no server route gates entitlements via `isFeatureEnabled`** (grep of `app/api` = 0 hits — all Pro gates use `getUserTier` service-role read), so a forced flag unlocks nothing server-side. `editable_eaten_at` is **UI-only** (the write always sends `eaten_at`). OFF proxy: auth-gated (401 without `userId`), per-user 60/60s rate limit, params validated, SSRF-proof (hardcoded `world.openfoodfacts.org`), cache keyed `{vendor}:{locale}:p{page}:{query}` with success-only writes + no PII → no cross-user poisoning. Residual: dev fixtures shippable (P2, §12); OFF 502 leaks raw `e.message` (P3); Gate-0 migrations intact + unmodified at HEAD.

---

## 17. Food Logging Findings (7/10)

**LIVE-VERIFIED end to end on sim:** LogSheet opens from FAB; "banana" search returns confidence-tiered results (Verified/Estimated badges, per-serving grams, "= 118 g"); preview shows full macros + extended micros (Calcium/Iron/Magnesium/Potassium/Folate/vitamins) + "IF YOU LOG THIS" projection; edit-meal long-press → context sheet (Edit/Copy/Share/Delete) → edit modal with **Time eaten field** (`11:17 → 09:05`), which **persisted to prod and survived the backstop** (LIVE-VERIFIED via DB). Web parity verified: same preview with Time-eaten + micros + fit hint at tall viewport. **Gaps:** offline durable queue (deferred v1.1); persistence test (P1-1); web rollback on persist failure; multi-add basket (ENG-929 backlog).

---

## 18. Nutrition Engine Findings (8/10) — mission-critical

**All four claims CODE-VERIFIED correct** (nutrition lens): ENG-1062 micro scaling (per-100g→grams once via `scaleMicrosForGrams`, per-serving×`servingFraction` once, no double-scale; OFF micros enter pre-reconciled; core keys fibre/sugar/sodium excluded from extra rows so no duplication); PR #397 deficiency sort (target ascending, limit descending {sodium, satfat, cholesterol}, null-DV sinks last, no NaN ordering — pinned both platforms); ENG-877 UK-retailer ranking (boosts fire **only** when a retailer token *leads* the query, so verified generics still win plain queries — confirmed against the 33-case golden battery); ENG-772 chronology (UTC store, local edit, day-clamped, HealthKit dedupe on `created_at`+`health_sample_id` untouched, null-safe coalesce). Prior 06-10 audit fixes (adaptive slope, `GAIN_SURPLUS_PACE_FACTOR`, `calcGoalTimeline` smoothing) **intact at HEAD**. Residual P3: no per-micro confidence gate (vendor micros shown at face value); stale comments; rounding heuristic divergence.

---

## 19. Vendor Integration Findings (7.5/10, was 7)

**ENG-1059 verified — audit P1-3 PARTIALLY→substantially CLOSED.** OFF **text search** now proxied on **both** web (`FoodSearchPanel.tsx:435 → /api/off/search`) and mobile (`verifyRecipe.ts:616 → ${apiBase()}/api/off/search`), with vendor cache (24h TTL, key `off:{locale}:p{page}:{query}`), 90% quota breaker (`VENDOR_QUOTAS.off` cap 50k, trip 45k), 12s server `AbortSignal`, and a visible degraded notice on quota exhaustion (web + mobile). Tests pin cache-hit / quota-exhausted / failure-not-cached. **Remaining (P3, pre-existing, NOT regressions):** mobile OFF *barcode* still direct (no timeout); web `searchOff` has no client AbortController; OFF route 502 vs degraded envelope on hard failure. **Economics:** Edamam 1k/day account-wide still caps cold-query viral scale (cache helps repeats only).

---

## 20. Recipe Platform Findings (6.5/10)

ENG-1066 Swap pill **LIVE-VERIFIED** on the verify fixture (`suppr:///recipe/verify?fixture=1` → per-ingredient "Swap" pills on Cheese feta / Cucumber / Olive oil rows). Import sheet renders premium ("Paste a recipe link", Use clipboard, Import from photo, works-with TT/IG/YT/W). Legal code posture (null description + disclaimer) intact. **Gaps unchanged:** ENG-859; generic titles; empty thumbnails; no collections; web verify affordance label drift (§21).

---

## 21. Meal Planning Findings (6.5/10)

Plan renders clean on sim (This week / Shopping list tabs, Generate + Adjust constraints, per-day slots). ENG-808 leftover icon → Lucide `Package` on mobile. **Silent web drift (P2):** web `MealPlanner.tsx:1380–1394` renders the leftover badge as **text-only in `success` green, no icon**, vs mobile's **`Package` icon in `Accent.warning` amber** — same concept, different colour *semantics* (amber "caution" vs green "good") and no icon. Also web verify affordance is **"Change match"** (`RecipeUpload.tsx:1696,1970`) vs mobile **"Swap"** — same action, different copy, on the import critical path. Both undocumented; both → `executor`. No pantry, keyword aisles, thin web parity unchanged.

---

## 22. Design System & UX Findings (6.5/10)

Sloe palette + calm copy render premium across all seven sim surfaces and authed web Today (LIVE-VERIFIED). **Trust UX still open:** "102% · over" adherence (P1-3); price not on paywall hero; empty thumbnails. **Token enforcement weak at write time** — the range added 3 off-ramp type literals + one off-scale `paddingVertical:6` (each matching a legacy sibling, so consistent-but-untokenised). **Discoverability note:** desktop LogSheet's fixed-height modal pushes the Time-eaten field + fit hint below the sticky "Use this" footer (present, but not visible without scroll).

---

## 23. Competitive Analysis Findings

**Nutrition:** OFF-proxy + cache closes the scale gap vs MFP/Cronometer at viral load; micro breadth (LIVE-VERIFIED: ~14 nutrients on a banana preview) is ahead of MFP free; adaptive TDEE ahead of Lose It. Behind on DB breadth at cold-query scale (Edamam ceiling).
**Recipes:** macro-fit + social import ahead of Paprika/Crouton; behind on organisation (no collections); legal posture pending ENG-859.
**Meal planning:** macro-aware auto-plan ahead; behind on pantry (Plan To Eat / AnyList), web parity, store APIs.
**Health:** partial Apple Health; ENG-874 device proof pending; no Oura/Garmin/Whoop.
**Moat:** attributed Reel-import + make-anything-fit — defensible once legal + monetisation gates close.

---

## 24. Linear Backlog Assessment

**Verified against live Linear:** ENG-772 (Urgent, Done, PRs #388/#395), ENG-1059 (High, Done, launch-blocker, PR #387), ENG-877 (Done, PR #392), ENG-1062 (High, Done, PR #390), ENG-1066 (Done, PRs #394/#396) — all **correctly marked Done with PR evidence and accurate `launch-blocker`/`parity`/`platform` labels.** The launch queue doc (`docs/planning/launch-queue-2026-07-01.md`) is **accurate and current** — Gate A vs Gate B split is correct, shipped items struck through with commit links, TF57 smoke checklist honest about what's evidenced vs not. **Hygiene gaps (carried):** ~24 Duplicate-state audit captures; category-leading tranche (ENG-927+) correctly parked as beta-window, not launch-blockers. **Recommend:** file the §11/§12 new issues (eaten_at test, backstop unify, dev-fixture guard, two web parity drifts).

---

## 25. Recommended New Issues

1. **P1** — Behavioural test for `eaten_at` write payload (mock-Supabase, same-day clamp). *AC:* test fails if `eaten_at`/`date_key` dropped from `.update()`.
2. **P1** — Unify `nutrition_entries` upsert row-builder across immediate + backstop sync (`useNutritionEntriesSync` must send `eaten_at` + eaten-derived `date_key`). *AC:* backstop preserves an edited time; grep-test pins every upsert row includes `eaten_at`.
3. **P2** — `apps/mobile/app/dev/_layout.tsx` `<Redirect>` when `!__DEV__` + `__DEV__` gate on verify fixture branch. *AC:* `suppr:///dev/*` and `?fixture=1` resolve to `/` in a release build.
4. **P2** — Web parity: rename "Change match" → "Swap" (`RecipeUpload.tsx`); add `Package` icon + warning colour to web leftover badge (`MealPlanner.tsx`).
5. **P2** — Replace theatrical LogSheet-dismissal source-grep pins with a mounted blur/param test.
6. **P2** — OFF route: return degraded envelope (not 502) on hard failure; static error message (no raw `e.message`).
7. **P3** — `eaten_at` plausibility CHECK; mobile OFF barcode timeout; web vendor-fetch AbortControllers; fix stale "descending" comments + misleading test name.

---

## 26. Recommended Implementation Order

**Gate 0 (before any cohort):** ENG-859 path documented → `verify-gate0-db.mts` 5/5 → Supabase advisor zero ERROR → TF57 smoke on release binary.
**Gate 1 (before broader beta):** P1-1 (eaten_at test) + P1-2 (backstop unify) **before** ramping `editable_eaten_at` past internal → P1-3 adherence copy → dev-fixture guard (P2 #3) → two web parity drifts (P2 #4) → ENG-874 device matrix → monetisation unblock (Gate B).
**Gate 2 (during beta):** Today decomposition (ENG-703), token lint, theatrical-test replacement, pantry, visual-regression golden set.

---

## 27. Recommended Test Strategy

- **Highest-value missing tests (per shipped item):** eaten_at write-payload (P1-1); LogSheet dismissal mounted blur/param test; ENG-1066 tap-wiring render test (`verify-ingredient-swap-0` `onPress` opens `FoodSearchModal`); ENG-1063 focus-revalidate behaviour test; ENG-1062 servingFraction=0 divide-by-zero guard.
- **Keep (real behaviour tests):** `mealEatenAt`, `foodSearchPreviewNutrition`, `foodSearchRanking`, `vendorSearchCacheRoutes`, `fullNutrientPanelSheet*`.
- **Targeted suites green at HEAD (QA lens ran them):** web `mealEatenAt + foodSearchPreviewNutrition + vendorSearchCacheRoutes` = **28/28**; mobile `offMicrosPullThroughParity + logSheetEntryPointConsolidation + verifyRecipeFixture` = **38/38**. No flakes.
- **Do NOT count source-grep pins as behavioural coverage** — pair them with Maestro flows (which render the real components with fixture data — fixture honesty CONFIRMED).
- **Gate0 + import-legal + SSRF + parity suites** as prior audit §27.

---

## 28. Biggest Long-Term Risks

1. **Client monoliths** (6,706-line Today) obstruct AI coach, wearables, family accounts — and grew this range.
2. **Untested durable-write paths** — `eaten_at` works but is unguarded; the backstop/immediate column-set can silently diverge (P1-1/P1-2). The data-loss class that already burned Grace once.
3. **Vendor economics** — Edamam free-tier ceiling vs viral cold queries (OFF now safe).
4. **Legal surface scales with import volume** — ENG-859 + takedown process.
5. **Solo-founder ops dependency** — Tax, DMCA, incorporation, Gate0 password.
6. **Fixture/dev scaffolding in the shipped binary** — contained today, but a professionalism/trust surface as the app spreads via deep links.

---

## 29. Open Questions

- Gate0 5/5 on prod with `GATE0_VERIFY_PASSWORD` — **UNVERIFIED** this pass.
- Will `editable_eaten_at` ever allow cross-day edits? If yes, P1-2 becomes active and must land first.
- Is the desktop LogSheet sticky-footer fold (Time-eaten below the line) acceptable, or should the modal grow / the field move above the nutrition grid?
- ENG-874 device matrix completion on physical iPhone.
- TF58 re-verify of F-161/F-162 (OFF/FatSecret micros) and F-173 (Swap) on the release binary.

---

## 30. Final Recommendation

**The Cursor backlog wave (`e3ac41c7..c7749988`, PRs #387–#399) is a PASS — approve it.** Across seven independent review lenses plus a live end-to-end sim + web + DB walkthrough, the work is correct, tested where it matters, parity-consistent (two small web drifts excepted), and net-positive for code health. It **closed the single biggest launch-scale hole** (OFF search) and introduced **no reachable P0/P1 regression.** The flaws are a short, bounded punch-list — one P1 test gap, one latent P1 (not reachable in the shipped UI), and a handful of P2/P3 polish items — none of which block the closed founding cohort.

**The product's launch blockers are unchanged and operational** — ENG-859 (DMCA), Gate0 live re-proof, and the Gate-B monetisation chain. **Cursor's engineering is not the bottleneck; Grace's ops/legal critical path is.** Onboard the founding cohort on the **release binary** (not the dev client) once Gate0 is 5/5 and ENG-859 is in motion, and land the two `eaten_at` test/backstop tickets before ramping that flag.

**Confidence: 8.5/10.** Strong — every shipped item was code-read by a specialist and the headline paths were LIVE-VERIFIED on a real bundle (sim + web + prod DB). −1.5 for: Gate0 prod re-proof not run (no password), ENG-874 device matrix pending, and release-binary deep-link reachability of dev fixtures inferred from expo-router behaviour rather than a built IPA.

---

## Real User Walkthrough Findings

### Coverage

| Surface | Status | Evidence |
|---|---|---|
| iOS sim — Today cold-open | **PASS** | `audit-2026-06-12-cold-open.png`, `-today.png` |
| iOS sim — Log search → preview micros | **PASS** | `-logsheet.png`, `-search-banana.png`, `-preview-top/mid/micros.png` |
| iOS sim — Edit-meal Time field + **live DB persist** | **PASS** | `-edit-entry.png`, `-time-edited.png` + prod `select` (eaten_at=14:05, survived backstop) |
| iOS sim — Plan / Progress / Recipes / Discover / Library / Import | **PASS** | `-plan.png`, `-progress.png`, `-recipes.png`, `-library5.png` |
| iOS sim — Verify fixture (ENG-1066 Swap) | **PASS** | `-verify-fixture.png` |
| iOS sim — Dev-flag override panel + reload | **PASS** | `-settings-scroll.png`, `-flag-on.png`, `-after-reload.png` |
| iOS sim — Deep-link LogSheet dismissal | **PASS** | sheet open → `?date=` → dismissed to prior day (`-deeplink-dismiss2.png`) |
| Web — authed Today | **PASS** | `screenshots/web-drive/audit-today-authed2.png` |
| Web — LogSheet preview (Time-eaten + micros + fit hint) | **PASS** (tall viewport) | `/tmp/audit-tall-preview.png`; flag confirmed via `eval` |

### Journey 1 — Today (cold open) · PASS
Sloe wordmark splash → Today hero (ring "1,047 LEFT", Goal/Eaten/Bonus, macro tiles, week strip, "Plan your day — no rush"). Premium, calm, on-brand. Real Metro bundle, **no tunnel redbox** (the 2026-06-11 blocker is gone this pass).

### Journey 2 — Food logging · PASS
FAB → "Log a meal" sheet (Breakfast/Lunch/Dinner/Snacks, search + scan/voice/camera, Recent/Library/Saved). Search "banana" → confidence-tiered results (Verified Banana 105 kcal, per-serving + per-100g). Preview: serving-size chips, servings stepper ("= 118 g"), full macros + **~14 micros** (Calcium/Iron/Magnesium/Phosphorus/Potassium/Selenium/Niacin/Folate/Vit C/K/A), "IF YOU LOG THIS" projection. Best-in-class vs MFP. **Edit-meal:** long-press → context sheet → modal with **Time eaten** field; changed 11:17→09:05, saved, **verified persisted to prod** (`eaten_at 2026-06-12 14:05:00+00`, `date_key` unchanged, survived the 600ms backstop). *Trust: high.*

### Journey 3 — Recipes (Discover + Library) · PASS
Discover renders premium (real food imagery, macro chips "380 kcal · 13g P · 18g C · 28g F · 5g", import banner "Import from TikTok, Instagram & YouTube"). Library/import sheet: "Paste a recipe link", Use clipboard, Import from photo, works-with chips. *Concerns unchanged: generic titles, empty thumbnails on imported items.*

### Journey 4 — Meal Plan · PASS
This week / Shopping list tabs, Generate + Adjust constraints, 7-day slots with per-day kcal. Clean. *Web leftover-badge drift noted (§21).*

### Journey 5 — Progress · PASS with trust flag
Maintenance narrative ("held steady · medium confidence"), Average Adherence 88%, macro bars (**Carbs 102% · over** — the backwards-adherence P1-3 still live), Weight 55 kg Trend/Scale toggle.

### Journey 6 — Verify fixture (agent QA scaffolding) · PASS (with §12 caveat)
`suppr:///recipe/verify?fixture=1` opened the real verify screen with injected Greek-salad data and visible **Swap** pills per ingredient (ENG-1066). Save hard-blocked ("Fixture mode"). Confirms the fixture is honest (real component + injected data) — but also confirms the dev route is **reachable in the binary** (P2 #3).

### Journey 7 — Web parity · PASS
Authed web Today dashboard renders premium (sidebar nav, ring, weekly bars, daily breakdown). LogSheet "banana" preview at tall viewport shows **Time eaten (03:12 pm) + full extended micros + fit hint** — web↔mobile parity confirmed. *Desktop fixed-height modal hides the field below the sticky footer (discoverability note, not a bug — verified by re-capture).*

### Cross-journey notes
- The product **feels finished and renders end-to-end** this pass — the strongest live state in weeks.
- The near-miss (false "web Time-eaten missing" from a truncated desktop capture) is logged as a verification gotcha: **scroll/tall-viewport modals before claiming a field absent.**
- Launch QA must still run on the **TestFlight release binary**, not the dev client — but the dev client itself was stable this pass.

---

*End of audit. Read-only throughout: one `eaten_at` value was edited via the app's own UI to verify persistence; no code, schema, flags, or external state were modified by the audit itself.*

---

## Addendum — punch-list ACTIONED (same day, branch `claude/audit-backlog-fixes-2026-06-12`)

All §25 engineering items were implemented the same day (5 parallel implementation lanes + 3 adversarial reviews + live sim/web/DB verification). Status:

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 (P1) | `eaten_at` behavioural write tests | **SHIPPED** | `nutritionEntryRowPersistence.test.ts` — mock-Supabase backstop test (eatenAt preserved verbatim, uniform column set), update-payload + same-day clamp tests |
| 2 (P1) | Unify upsert row-builder | **SHIPPED+** | `apps/mobile/lib/nutritionEntryRow.ts` single source; backstop + immediate paths + **5 further insert sites** (copy/duplicate, planned-log, planner row-menu log, recipe-detail, barcode ×2) routed through it; repo-walk wiring pin (insert+upsert) with healthSync as the one documented bypass. **Found & fixed a deeper copy-path bug:** clones kept the source-day `eatenAt`, so any copied flag-on meal would re-bucket to its source day — new shared `reanchorEatenAtToDay` re-anchors wall-clock time onto the target day in every copy flow (mobile + web pattern verified). LIVE: edit persisted (`09:05`) across relaunch + rebundle |
| 3 (P2) | Dev-route guard | **SHIPPED** | `apps/mobile/app/dev/_layout.tsx` `<Redirect>` when `!__DEV__`; `verify.tsx` fixture gate now ANDs `__DEV__` (source-pinned against the real expression); dev-build fixture LIVE-verified still working |
| 4 (P2) | Web parity drifts | **SHIPPED** | "Change match"→"Swap" (both sites + aria parity); leftover badge Package icon + warning amber (#C9892C both platforms); aria-label now recipe-specific (parity review 2c) |
| 5 (P2) | Theatrical dismissal tests | **SHIPPED** | Logic extracted to `useLogSheetDeepLinks` hook + renderHook behaviour tests (open/dismiss/blur/param-precedence); LIVE-verified via `?openLog=1` → sheet, `?date=` → dismissed |
| 6 (P2) | OFF degraded envelope | **SHIPPED** | Hard failure now returns `{ok:true, hits:[], degraded:true, degradedReason:"off_unavailable"}` (no raw `e.message`); failure still never cached; tests updated |
| 7 (P3) | Hygiene batch | **SHIPPED** | `eaten_at` CHECK constraint **applied to prod** (`20260612200000`, version-parity verified); barcode OFF timeout 8s; web vendor fetches AbortSignal 13s; stale "descending" comments fixed; misleading test renamed |
| P1-3 | Adherence over-display | **SHIPPED (flag 0%)** | `formatAdherenceHeadline` shared formatter, band-inverted ">110% → N% over" in amber, per product-lead decision (`docs/decisions/2026-06-12-adherence-over-display.md`); flag `adherence_over_display` created in PostHog at 0%. **Pixel proof:** `docs/audit/captures/2026-06-12-fixes/progress-adherence-{before,after}.png` ("112% · over" → "12% over") |

Full CI chain green (`npm run ci` exit 0: typechecks, 2,731 mobile + 7,431 web tests, next build). Remaining open from this audit: ENG-859 (ops), Gate0 5/5 re-proof, Gate B monetisation, ENG-874 — all Grace-owned, unchanged.
