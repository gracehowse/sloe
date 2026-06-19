# Independent Product, Engineering & Launch-Readiness Audit — Suppr / Sloe

**Date:** 2026-06-14
**Reviewer:** External due-diligence audit (autonomous, founder-commissioned, ultracode fan-out)
**Branch reviewed:** `main` @ `efe80c49` (code surface identical to `18595637`; the one delta is a docs-only commit, #445)
**Supersedes / extends:** `docs/ux/reviews/2026-06-11-launch-readiness-audit.md` and `docs/ux/reviews/2026-06-12-launch-readiness-audit.md`. Those two committed audits drove the Gate-0 / Gate-A work cluster; this pass **re-verifies their P0/P1 set held at HEAD, then audits the net-new 44-commit redesign/button-cohesion wave (`c7749988..HEAD`) and goes deeper where prior passes were thin** (accessibility, vendor data quality, food-history micros, web↔mobile parity, the food-data trust stack). I did **not** overwrite the prior dated files — this is a new dated artifact.

> **Why a new file, not the brief's `2026-06-11` path.** The brief named `2026-06-11-launch-readiness-audit.md` as the output. That file already exists, is committed, and is referenced across project memory as the origin of the Gate-0 program. Overwriting a committed historical artifact I did not create would destroy that lineage, so this audit is written to today's date and explicitly supersedes both prior passes.

## Method (evidence-first; ultracode)

- **Inline scouting** of repo structure, the two prior audits, the 2026-06-10 nutrition-calculations audit, the 2026-06-14 backlog triage, and the launch-queue doc.
- **11 parallel specialist deep-dives** (architecture, security, nutrition, vendor, food-logging, recipe, meal-planning, code-quality+net-new-range, design/UX/accessibility, competitive, Linear backlog) — each read actual code, none took intent on trust — followed by **adversarial re-verification of all 29 unique P0/P1 candidates** (each independently re-checked against code at HEAD: true? reachable? already-fixed? correct severity?). Fan-out totals: **40 agents, 3.9M tokens, 1,210 tool calls, ~48 min.**
- **Live iOS simulator walkthrough (fresh pixels, real founder data, Metro 8081 at HEAD):** Today cold-open → empty meal slots → macro tiles → Plan (generated) → Discover import hero → Progress (adherence + weight chart) → Log sheet → food search → preview. Screenshots in `/tmp/audit-0614/`.
- **Read-only production DB verification** via Supabase MCP (`verified_food_canonical`, `user_foods`, `nutrition_entries`, schema) and **live security + performance advisors**.
- **Live Linear** (REST) backlog snapshot; **live code-level verification** of the highest-stakes claims by me directly (the `redeem_promo_code` migration, the adherence flag gating, ENG-805 web parity, the `mealSlotAim` shared logic).

> **Evidence discipline.** Items I rendered live are **LIVE-VERIFIED**; items confirmed by reading code at HEAD are **CODE-VERIFIED**; production state I could not exercise is **UNVERIFIED**. Every P0/P1 below carries an adversarial verdict (CONFIRMED / DOWNGRADED / REFUTED). Two corrections the adversarial pass forced on the raw finder output are called out explicitly (a stale "untracked test" finding that was already shipped, and a fabricated "FatSecret micros zeroed in prod" impact chain) — included as a sign the verification layer worked, not as findings.

---

## 1. Executive Summary

Suppr/Sloe is a genuinely ambitious, **eight-pillar** product (nutrition tracker, food logger, recipe manager, recipe importer, recipe discovery, meal planner, grocery planner, health-insights surface) whose **server/data tier and core nutrition math are materially ahead of a typical solo pre-launch build**, and whose **differentiated wedge — attributed Reel/TikTok import + make-it-fit-your-macros — is real, well-architected, and occupies genuine category white-space.** The 2026-06-10 nutrition audit's P0 (adaptive-TDEE slope bias) and its P1 cluster are **verified fixed in code at HEAD**; the Gate-0 security migrations are **intact and unmodified**; the anon-executable SECURITY DEFINER cluster the brief flagged as the top concern is, on close reading of every defining migration, **not exploitable** (every sensitive function enforces `auth.uid()` + membership). The net-new redesign wave (empty-slot "Aim ~X kcal", Discover import hero, flat-card cohesion, SupprButton) **renders premium live and is the best-disciplined batch in the repo's recent history** (shared cross-platform logic, dead-code removal, no silent deferrals in added lines).

**There is no new code P0.** The launch blockers are the same operational/legal ones the prior audits named, plus a **cluster of P1s that are mostly trust-and-parity failures, not correctness catastrophes** — but several of them silently corrupt or under-count user nutrition data, which for a trust product is the most expensive class to ship. The recurring structural theme across seven independent lenses is **web↔mobile parity drift on load-bearing surfaces** (a CLAUDE.md non-negotiable): web has no logged-meal edit at all, web copy/duplicate doesn't re-anchor `eaten_at`, web Plan is a deliberate ~40% subset with orphaned dead code, named meal-plans never sync across devices, Library search diverges, and web recipe-nutrition recompute is non-atomic while mobile uses an atomic RPC. The second theme is **food-data trust**: the `verified_food_canonical` consensus store is **empty (0 rows)** so the green "Verified" badge is really a vendor-source label; `genericFoodMicros` baked at least two staples from the wrong USDA food (grapes from *canned grape leaves* → sodium 1,400× high); re-logging from Recents/Saved-meals silently drops sugar/sodium/all micros; and at least one nutritionally-impossible row ("3 kcal/oz" chicken breast) reaches the shipped search with no plausibility filter. The third is **accessibility**: every macro-chip value and several caption labels fail WCAG AA contrast at 11px on both platforms (the darker `-solid` tokens exist but aren't used), and the two highest-traffic mobile surfaces use raw `Pressable` (haptic-silent).

**Bottom line: CONDITIONAL-GO for a small, closed, comped founding cohort on the production TestFlight binary** once Gate-0 is re-proven 5/5 in production and the DMCA agent is in motion — the daily loop renders end-to-end and the math is trustworthy at the macro level. **NOT READY for the planned 2026-07-01 viral free push** until: the DMCA designated agent is registered (the viral hook is import, and import is the legal exposure), the adherence-trust display is ramped, the nutrition-data-loss P1s (recents/saved micros, web `eaten_at` re-anchor, genericFoodMicros bake errors) are fixed, the WCAG contrast failures are corrected, and the Reel parse-rate gate (ENG-670) is actually measured. **Confidence: 8.5/10** — every headline finding was code-read by a specialist, adversarially re-verified, and the core loop was rendered live on real founder data; −1.5 for Gate-0 production re-proof not run (no password) and ENG-874 device matrix still open.

---

## 2. Overall Product Score — **6.5 / 10**

Differentiated, defensible wedge (import + macro-fit) that no shipping competitor combines; strong daily loop. Held back by: web↔mobile parity gaps on load-bearing flows, no recipe collections (Paprika gap), no pantry (Plan To Eat / AnyList gap), the food-data-trust cluster, and pricing positioned above the validated competitor band. The product *is* a credible multi-category contender — but several "it works" surfaces are not yet "a serious refugee would trust and stay."

## 3. Overall Engineering Score — **7 / 10**

Server/data tier **7.5** (mature: fail-closed rate limiting, AI cost circuit-breaker, signature-verified webhooks, 140 RLS policies / 43 tables, vendor cache + quota breakers, deterministic-first AI). Client **5.5** (the 6,613-line mobile Today monolith with no shared data layer; web's symmetric 2,235-line god-context; `FoodSearchPanel` duplicated 5,539 lines; 152 files over the 400-line cap; the net-new range *grew* four of the giants). The data model is roadmap-ready (household, creator, AI, provider-agnostic health) — the client architecture, not the schema, is what makes the roadmap expensive.

## 4. Overall UX Score — **6 / 10**

Premium, calm, on-brand when it renders (Sloe palette, flat-card cohesion, confident import hero, "Purposeful empties"). Pulled down by: **WCAG AA contrast failures on every macro chip + several caption labels at 11px** (LIVE/CODE-VERIFIED), missing haptics on the two highest-traffic mobile surfaces, the **adherence headline that still reads backwards ("108% · over")** because the fix is flag-gated at 0%, missing web focus-visible rings, and sub-44pt tap targets. The design *system* is right; execution craft hasn't caught up to it.

## 5. Overall Security Score — **7.5 / 10**

Materially strong and improved. Gate-0 migrations intact at HEAD; the anon SECURITY DEFINER cluster is safe; webhooks verified + idempotent; SSRF guard re-resolves DNS (closes rebinding TOCTOU); export/delete strictly user-scoped; `getUserTier` fails to `free` (safe direction). −2.5 for: the guessable `SUPPR_TEST_PREMIUM` free-Pro promo via an un-rate-limited RPC (P1), HIBP leaked-password protection off (web uses password auth), mutable `search_path` on the Gate-0 trigger functions themselves, and **Gate-0 production 5/5 re-proof not run this session** (no `GATE0_VERIFY_PASSWORD`).

## 6. Overall Nutrition Accuracy Score — **7.5 / 10**

The **core math is now excellent** — the 2026-06-10 P0 (adaptive-TDEE slope bias) is genuinely fixed (least-squares slope over a daily-interpolated series + completeness gate + plausibility clamp, pinned by a regression test reproducing the founder's series), and all four P1s landed. Held off 8.5 by the **food-data layer, not the formulas**: `verified_food_canonical` empty so "Verified" ≠ consensus-verified; `genericFoodMicros` grapes/apple baked from wrong USDA foods; recents/saved-meals re-log drops micros; the flat ±0.35 kg/wk slope cap under-credits legitimate fast losers; FatSecret %DV→absolute has no v1/v2 version guard; the confidence-policy doc claims a 0.70 floor while the code ships 0.55.

## 7. Overall Recipe Platform Score — **6.5 / 10**

Import wedge is the strongest part of the product and production-grade (multi-source verify cascade with confidence floors, strict structured-extraction schema, SSRF-guarded fetch, disciplined legal posture). Held back by: **DMCA agent unregistered** (the one legal blocker), no user collections/folders (Paprika gap), Library search fragmented and web/mobile-divergent (ignores the richer shared matcher + 50 seeded tags), web recipe-recompute non-atomic, cook-mode "Log this meal" servings conflation, and verbatim web/blog instruction persistence vs the posture doc.

## 8. Overall Meal Planning Score — **5.5 / 10**

Genuinely good shared generator (one behaviourally-pinned algorithm, ENG-1040 shopping parity, leftovers/templates, ENG-1092 trust-correct empty slots). But it does **not** work end-to-end the way a serious planner needs: no pantry/staples (re-buys salt/oil weekly), named plans never sync across devices, web Plan is a ~40% subset (templates dialog is dead code, move-meal shared-fn unwired), "Log as planned" mis-dates to today and discards the plan day, grocery categoriser is ~12 keywords (most items dump to "Other"), and the list over-buys (full yield, not planned portions).

---

## 9. Launch Readiness Assessment

**Verdict: CONDITIONAL-GO for a small closed comped founding cohort on the production binary. NOT READY for the 2026-07-01 viral free push.**

| Gate | Requirement | Status @ `efe80c49` |
|---|---|---|
| Gate-0 code | ENG-1035/1036/1043 lockdowns, SSRF, vendor cache, OFF proxy | **INTACT** (re-read at HEAD) |
| Gate-0 production | `verify-gate0-db.mts` → 5/5 | **UNVERIFIED** (no `GATE0_VERIFY_PASSWORD` this session) |
| Legal | ENG-859 DMCA designated agent | **OPEN** (blocked on incorporation; P0 for viral, P1 for tiny closed cohort) |
| Viral hook quality | ENG-670 Reel parse-rate gate measured | **NOT MEASURED** (Urgent/Todo, launch-blocker) |
| Monetisation | Stripe Tax, RC IAP, offerings, VAT | **Gate B** — correctly NOT a July free-cohort blocker |
| Device proof | ENG-874 Apple Health matrix | **IN PROGRESS** |
| Trust display | `adherence_over_display` ramp (ENG-1073) | **FLAG AT 0%** — backwards "108% · over" still live (LIVE-VERIFIED) |

- **What breaks first at viral scale:** Edamam's **1,000/day account-wide** ceiling on cold queries (cache only helps repeats; the `/nutrients` detail route isn't even quota-counted). Then weekly-recap cron row caps. (Note: real load has never been exercised — production holds **990 entries across 6 loggers** = founder + synthetic personas.)
- **First support tickets / churn:** "108% adherence · over" reading as *good*; re-logged foods silently losing sodium/sugar/micros; a logged grapes entry adding ~2,600 mg phantom sodium to the day; generic-food search misses for ethnic/brand staples (the MFP-refugee first-90-seconds test); web users unable to edit a logged meal.
- **Investor / TDD flags:** 6,613-line Today monolith; web↔mobile parity drift on core flows; an empty "Verified" canonical store behind a trust badge; pricing above the validated band; competitor intel missing MFP's Cal AI acquisition.

**Recommended gate:** Gate-0 5/5 in prod → DMCA in motion → ENG-670 measured → fix the nutrition-data-loss P1s + WCAG contrast → ramp ENG-1073 → 20–50 founding cohort via `lifetime_pro` comp on the **release binary** (not the dev client).

---

## 10. P0 Findings (must fix before onboarding users / before the viral launch)

> No **new code P0** was found, and the adversarial pass confirmed the anon SECURITY DEFINER cluster is not exploitable. The two P0s are carried operational/legal items.

### P0-1 — DMCA designated agent not registered (ENG-859) · legal · CONFIRMED (verifier scoped: P0 for viral launch, P1 for a tiny closed comped cohort)
- **Evidence:** `app/api/recipe-import/route.ts:142-182` (auth-gated POST, only `kill_recipe_import` flag which defaults OFF), `:598-631` (live web/blog server-fetch, honest `SupprBot/1.0` UA, no flag); `app/dmca/page.tsx`, `app/api/dmca-takedown/route.ts`, `supabase/migrations/20260505010000_dmca_takedowns.sql` (takedown channel exists); `docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md` ("§512(c) safe harbour isn't effective until filed … depends on incorporation"). Linear ENG-859 Urgent/Todo, `launch-blocker`.
- **Impact:** The web/blog import path is live and reachable by any authenticated user; §512(c) safe harbour requires a registered designated agent, and exposure scales with import volume — which is the headline viral hook. A notice-and-action form is necessary but **not** sufficient.
- **Recommendation:** Register the agent at copyright.gov ($6) as soon as the incorporating entity + postal address exist; publish in Terms/footer; link from the import disclaimer. Founder-owned (ops/legal).
- **Issue:** *Register DMCA designated agent before the viral import launch (ENG-859).* **AC:** agent listed on the Copyright Office directory; legal pages + import disclaimer reference it. **Tests:** manual legal checklist (no automated test).

### P0-2 — Gate-0 entitlement exploit closure must be live-verified in production, not assumed · security · UNVERIFIED
- **Evidence:** Gate-0 migrations re-read intact at HEAD (`20260611120000_profiles_insert_lockdown_eng1035.sql`, `20260611120200_redeem_promo_lifetime_pro_eng1043.sql` lockdown triggers + GUC bypass). `docs/decisions/2026-06-11-gate0-db-security.md` claims a prior 5/5; not re-proven this session (no `GATE0_VERIFY_PASSWORD`).
- **Impact:** If any lockdown regressed in production (vs the repo), free→Pro escalation could be possible. Code is correct; production closure is the gap.
- **Recommendation:** Run `node --import tsx scripts/verify-gate0-db.mts` with `GATE0_VERIFY_PASSWORD` → require 5/5 before any cohort; automate in CI against staging. **Track it as a `launch-blocker` issue** — it currently lives only in audit prose.
- **Issue:** *Gate-0 live 5/5 re-proof against production + CI automation.* **AC:** delete+insert escalation → 42501; promo redemption succeeds for an existing profile; 5/5 green. **Tests:** `scripts/verify-gate0-db.mts`; RLS integration suite.

---

## 11. P1 Findings (fix before broader beta / the viral push)

Each carries its adversarial verdict. Severity shown is the **post-verification** value.

### P1-1 — Guessable `SUPPR_TEST_PREMIUM` promo grants Pro free via an un-rate-limited RPC · security · CONFIRMED
- **Evidence:** `supabase/migrations/20260416220000_promo_suppr_test_premium.sql:1-4` (seed `code='SUPPR_TEST_PREMIUM'`, `tier='pro'`, `max_uses=100000`); `redeem_promo_code` is SECURITY DEFINER gated **only** by `auth.uid()` non-null (re-read `20260611120200_…eng1043.sql:213-219` — no admin/role check); both clients call `supabase.rpc('redeem_promo_code', …)` directly (`apps/mobile/hooks/usePromoCode.ts`), so the Next.js rate limiter never sees it.
- **Impact:** Any signed-in user who knows the code gets free Pro; the entire promo namespace (including any future `FOUNDING100` `lifetime_pro` grant) is brute-forceable with no throttle. Harmless during a free-everyone window; a direct revenue leak the moment paid GA opens.
- **Recommendation:** (1) migration setting `active=false` on `SUPPR_TEST_PREMIUM` in prod (don't rely on a manual dashboard step); (2) a DB-side per-`auth.uid()` failed-attempt throttle inside `redeem_promo_code`.
- **Issue:** *Deactivate SUPPR_TEST_PREMIUM in prod + throttle redeem_promo_code.* **AC:** the code returns invalid in prod; N failed redemptions/min/user are rejected. **Tests:** RPC unit test for throttle + a CI grep banning live `tier='pro'` seed codes with high `max_uses`.

### P1-2 — `genericFoodMicros` "grapes" baked from canned grape leaves — sodium 2,853 mg/100g vs ~2 mg · nutrition/vendor · CONFIRMED
- **Evidence:** `src/lib/nutrition/genericFoodMicros.ts:44-45` (`// USDA fdc 169393 — Grape leaves, canned`; `sodiumMg:2853, fiberG:9.9`). The macro table (`genericFoods.ts`) carries correct grapes (sodium ~2 mg), so the hero shows 2 mg while the day-level micro aggregate gets ~2,625 mg from one cup — invisible to macro plausibility checks.
- **Impact:** Every grapes log inflates day sodium ~1,400×; the same bake pattern hit "apple" (from babyfood juice → vitamin C ~10× high, see P2). Directly undermines the nutrition-accuracy differentiator.
- **Recommendation:** Re-bake from correct Foundation Food fdcIds and **audit all ~50 rows** of `genericFoodMicros.ts` against their cited ids.
- **Issue:** *Re-bake genericFoodMicros from correct fdcIds (grapes/apple + full 50-row audit).* **AC:** grapes sodium < 10 mg/100g; a test asserting each row's sodium/vit-C within a physical band. **Tests:** plausibility unit test over the whole table.

### P1-3 — Re-logging from Recents / Eat-again silently drops sugar, sodium, and ALL micros (both platforms) · food-logging · CONFIRMED
- **Evidence:** `src/lib/nutrition/foodHistory.ts:64-96` — `FoodHistoryItem` carries only macros/fiber/caffeine/alcohol; it **structurally cannot** hold sugar/sodium/vitamins/minerals. `computeRecentMeals`/`computeFoodHistory` and the mobile commit (`FoodSearchPanel.tsx:1212-1229` hardcodes `sugarG:0, sodiumMg:0`) reconstruct only what the type holds. Fresh-search logs DO persist the full panel — so the same food re-logged from Recents loses its micros.
- **Impact:** Silent, cumulative under-counting of sodium/sugar/micros on a **primary daily flow**; erodes the micro-breadth differentiator and the sodium/sugar adherence signals.
- **Recommendation:** Carry the original row's `nutrition_micros` through the history bucket (store + re-attach on commit, as caffeine/alcohol already are).
- **Issue:** *Recents/Eat-again must carry nutrition_micros through food history.* **AC:** re-logging a micro-rich food preserves its sodium/sugar/vitamins. **Tests:** behavioural test asserting the re-logged row's micros == the original.

### P1-4 — Saved-meals re-log drops sugar/sodium/all micros (no micros column) · food-logging · CONFIRMED
- **Evidence:** `supabase/migrations/20260421120000_user_saved_meals.sql:34-57` — `user_saved_meal_items` has no `nutrition_micros` column; `savedMeals.ts:40-53`/`savedMealsLogic.ts:184-231` propagate only fiber/water/source; the save-builders strip `m.micros` on both platforms (web `NutritionTracker.tsx:1297-1311`, mobile `index.tsx:1398-1411`).
- **Impact:** Saved meals (a core MFP-refugee convenience) under-count micros vs the same food from search — silently and permanently.
- **Recommendation:** Add a `nutrition_micros` JSONB column to `user_saved_meal_items` (tracked migration via `supabase db push`), capture at save time, propagate on log.
- **Issue:** *Saved meals must persist + restore nutrition_micros.* **AC:** a saved meal logs identical micros to the source food. **Tests:** end-to-end save→log micros parity test.

### P1-5 — Web copy / duplicate / copy-yesterday never re-anchor `eaten_at` — clones bucket onto the source day · food-logging / parity · CONFIRMED
- **Evidence:** `src/lib/nutrition/mealEatenAt.ts:127-150` documents the re-anchor contract; web `useNutritionJournalState.ts:149-179` (`buildNutritionEntryRow`, no re-anchor) + `:382,413,449,483` (copy/duplicate callers) clone via `cloneMealWithoutId` preserving the **source-day** `eaten_at`, then derive `date_key` from it. Mobile re-anchors (`index.tsx:2192,4321-4323`); web does not.
- **Impact:** Same data-mis-attribution class the mobile audit fixed in June. Reachable today via cross-platform Apple Health rows; becomes full corruption the moment `editable_eaten_at` ramps.
- **Recommendation:** Run every web clone through `reanchorEatenAtToDay(targetDayKey)`; better, unify web+mobile onto one shared row-builder.
- **Issue:** *Web copy/duplicate must re-anchor eaten_at to the target day (parity with mobile).* **AC:** a copied meal persists onto the target day, not the source. **Tests:** web mock-Supabase test asserting `date_key`/`eaten_at` == target day.

### P1-6 — Web recipe-nutrition recompute is non-atomic (split-state risk) while mobile uses the atomic RPC · nutrition / parity · CONFIRMED
- **Evidence:** `src/app/components/RecipeDetail.tsx:884-919` — per-ingredient `recipe_ingredients.update` loop (`:898`) then a separate `recipes.update` (`:918`), no transaction. Mobile uses `supabase.rpc('save_verified_ingredients')` (`apps/mobile/lib/verifyRecipe.ts:2064`) — the atomic RPC built for exactly this (`20260527100000_save_verified_ingredients_rpc.sql`). Web has zero callers of it despite it being granted to `authenticated`.
- **Impact:** An interrupted web auto-verify (tab close/network blip) persists a recipe whose displayed per-serving calories no longer match its ingredient breakdown — the recipe shows one number, the sum of ingredients another. Trust failure on the import→verify loop.
- **Recommendation:** Route web through `save_verified_ingredients` (SECURITY INVOKER, RLS-preserving).
- **Issue:** *Web recipe recompute via save_verified_ingredients RPC (atomicity + parity).* **AC:** an interrupted web verify leaves recipe totals == sum of ingredient rows. **Tests:** integration test simulating mid-write failure.

### P1-7 — Adherence headline reads backwards ("108% · over") — the fix is built but flag-gated at 0% · nutrition / UX trust · LIVE-VERIFIED + CODE-CONFIRMED
- **Evidence:** LIVE on the sim Progress tab: **"AVERAGE ADHERENCE 108% · over"**, with Carbs/Fat bars at "114% · over". Code: `src/app/components/suppr/progress-average-adherence.tsx:100` + `progress-hero-metric.tsx:140` + mobile `ProgressHeroMetric.tsx` gate the corrected band-inverted formatter behind `isFeatureEnabled("adherence_over_display") && adherencePct > 110`; the flag is at 0% (ENG-1073 ramp pending), so the old backwards branch ships.
- **Impact:** Overeating presents as a *higher* adherence number — the exact trust inversion prior audits flagged, still reachable by real users on the retention-critical Progress tab.
- **Recommendation:** Ramp `adherence_over_display` (ENG-1073) after a visual eyeball, then remove the gate. The formatter is correct (`adherenceDisplay.ts`).
- **Issue:** *Ramp adherence_over_display + remove the legacy branch (ENG-1073).* **AC:** >110% renders "N% over" in amber, not "1NN%". **Tests:** the existing wiring test + a render assertion at 100/108/114%.

### P1-8 — Macro-chip values + caption labels fail WCAG AA contrast at 11px (both platforms) · accessibility · CONFIRMED
- **Evidence:** `SlotMacroChips` renders protein/carbs/fat/fiber gram values in **fill** hues (3:1 graphical tokens) at `Type.caption` (11px). Computed on white: protein `#7C8466` 3.93:1, carbs `#C8794E` 3.33:1, fat `#C9892C` 2.96:1, fiber `#4A7878` 4.37:1 — all FAIL the 4.5:1 bar (worse on the cream card, e.g. fat 2.63:1). The `-solid` darkened variants (`--macro-protein-solid` `#5F6650` 5.99:1) **exist for exactly this** but aren't used. Same failure on the mobile "Aim ~X kcal" line (`textTertiary` `#9B93A3` 2.96:1) and the slot "Log usual" pills (Breakfast `#C9892C` 2.71:1, Lunch 4.17:1, Snack 4.37:1). `apps/mobile/components/today/TodayMealsSection.tsx:259-269`, `src/app/components/suppr/today-meals-section.tsx:226-231`.
- **Impact:** Core nutrition values are below the legibility floor for low-vision users and in bright light — on the product's two most-viewed surfaces. A trust + accessibility-compliance gap on a health app.
- **Recommendation:** Swap macro/slot/aim text to the existing `-solid` variants (or a darker text token) for all `Text`/`span` usage; keep fill hues for bars/graphics only. Add a contrast unit test over the token pairs (model: `tests/e2e/verify/contrast-audit.spec.ts`).
- **Issue:** *Macro/slot/aim text must use AA-passing -solid tokens (web + mobile).* **AC:** every chip/label ≥ 4.5:1 on its real background. **Tests:** automated contrast census over token pairs + a Playwright getComputedStyle sweep.

### P1-9 — MFP acquired Cal AI (Mar 2026) — absent from internal competitor intel; the refugee thesis rests on a stale picture · competitive/strategy · CONFIRMED
- **Evidence:** WebSearch confirmed by 8+ sources (TechCrunch, GlobeNewswire, Fitt Insider). `docs/competitor-intelligence-report.md:39` still lists Cal AI as a standalone "Emerging AI-First Disruptor"; no internal doc mentions the acquisition.
- **Impact:** The launch's headline growth thesis (MFP refugees) assumes MFP = stale UI + crowdsourced DB *and* Cal AI = separate threat. MFP+Cal AI now combines fast AI-photo logging with the largest DB — weakening the "MFP is miserable, switch to us" pitch unless differentiation is re-sharpened onto the genuinely unique axis (attributed Reel import + macro-fit + adaptive TDEE on free).
- **Recommendation:** Refresh competitor intel; re-test the refugee thesis against an MFP that now has AI photo logging; sharpen the wedge messaging.
- **Issue:** *Refresh competitor intel for the MFP/Cal AI acquisition + re-test refugee thesis.* **AC:** competitor docs updated; differentiation statement revised. **Tests:** n/a (strategy).

### P1-10 — ENG-793 marked Done while its health-critical core stays open — a silent deferral · backlog/nutrition · CONFIRMED
- **Evidence:** ENG-793 is Done/High in Linear (completed 2026-06-13), but its own merge commit `72c54c61` (titled "ENG-793 (partial)") states "the core (TDEE estimate ignoring measured Apple Health burn) stays OPEN for Grace's design call." No follow-up issue exists.
- **Impact:** A health-critical correctness gap (weekly check-in suggesting calorie targets without consuming measured wearable burn → potential double-count / under-suggestion) is invisible in the tracker — the exact rot the no-silent-deferrals rule exists to prevent.
- **Recommendation:** Split out a new High issue for the measured-burn-aware maintenance estimate (with double-count avoidance + wear-completeness gating), link from ENG-793.
- **Issue:** *Weekly check-in must consume measured Apple Health TDEE (double-count avoidance + wear gating).* **AC:** check-in suggestion accounts for measured burn; no double-count. **Tests:** unit test over the burn-aware estimate.

> **`verified_food_canonical` is empty — the "Verified" badge is a vendor-source label, not consensus verification** (DB-VERIFIED, this session): `select count(*) from verified_food_canonical` = **0**. The whole consensus subsystem (consensus columns, `save_verified_ingredients`, RLS, the recompute-unification machinery) carries no data, yet food search shows a green "Verified" tier. A live "chicken breast" search returned a **Verified** entry at 120 kcal/100g, ~22.5 g protein/100g — materially below the canonical USDA raw breast (~165 kcal, ~31 g protein). Combined with the confidence-policy doc claiming a 0.70 accept floor while the code ships 0.55 (`verifyConfidencePolicy.ts:27` vs `verifyIngredients.ts:99`), the "Verified" trust signal over-promises. **Treat as P1 nutrition-trust:** either populate the canonical store, or relabel the tier to reflect "structured vendor source," and reconcile the confidence-policy doc to the shipped 0.55.

---

## 12. P2 Findings (important improvements)

*Architecture / scale*
- **Mobile has no shared domain-data layer; Today is a 6,613-line god-component** (110 `useState`, 26 inline Supabase calls) — *DOWNGRADED P1→P2 (velocity tax, not a correctness break, and the range was net-extractive: 6,706→6,613). The single biggest thing making the roadmap expensive.* `apps/mobile/app/(tabs)/index.tsx`. Extract `useTodayData()`/a nutrition store before AI-coach/wearables wiring (ENG-703/621).
- **Web `AppDataContext` god-context (2,235 lines) + `FoodSearchPanel` duplicated web/mobile (5,539 lines)** — extract `FoodSearchPanel` pure logic to `@suppr/shared` (the pattern that worked for OFF search); split the context by domain.
- **Single-region/single-instance SPOF topology** (one Supabase project, default-region Vercel/US-East serving UK/EU users, one Upstash carrying rate-limit + AI-budget + vendor-cache) — set a Vercel EU region + add Upstash to monitoring before EU growth.
- **`SUPADATA_KEY` (the viral import dependency) undocumented in `.env.example` and ungated by `verify-production-env.ts`** — fails safe (legacy fallback) but can run degraded in prod with no signal. Gate + document it; alarm on legacy-fallback.

*Nutrition / vendor*
- **Flat ±0.35 kg/wk adaptive-TDEE slope cap under-credits legitimate fast losers** — *DOWNGRADED P1→P2 (documented gating choice, conservative-by-design, but reintroduces the "TDEE biased low" class for anyone on steady/vigorous pace; the test bakes the capped 385 as "correct").* `adaptiveTdee.ts:78,263-266`. Make the cap window/confidence-aware (widen to ±1.0 at the high-confidence gate).
- **Edamam `/nutrients` detail calls aren't quota-counted** — *DOWNGRADED P1→P2; verifier added: same gap on USDA detail.* **RESOLVED 2026-06-18 (ENG-1117):** both `app/api/edamam/food/route.ts` and `app/api/usda/food/route.ts` now `checkQuota` before the vendor call, `consumeQuota` on a real (non-cached) call, and return the same `degraded`/`quota_exhausted` envelope when over. Added a per-`foodId` detail cache (`pm_vdc:{vendor}:{foodId}`, 24h TTL) so repeat on-tap fetches don't re-spend quota.
- **`genericFoodMicros` "apple" baked from babyfood juice (vit C ~10× high)** — `genericFoodMicros.ts:14-15`; folded into the P1-2 50-row re-bake.
- **FatSecret %DV→absolute has no v1/v2 version guard** (latent ~13–18× inflation if the endpoint migrates) — `fatsecretNormalize.ts:20-32,117-122`; add a plausibility guard before applying the multiplier.
- **Confidence-policy doc says 0.70, code ships 0.55** — `verifyConfidencePolicy.ts:27` vs `verifyIngredients.ts:99`; reconcile the doc + decide whether to surface a "lower-confidence match" flag (the 0.55 is defended per ENG-691).
- **No retry at any vendor call site; USDA search returns 502 (not the degraded envelope) on failure** — a 1–2s USDA hiccup breaks the whole merge pipeline. Add one bounded retry + return the degraded 200.
- **ENG-774: OFF serving-basis rows without `serving_quantity` keep inflated values with `per100gFactor=1`** — `reconcilePer100g.ts:69-82`; drop or require confirmation rather than serving wrong values with a warning. (Live search showed many "per 1 serving, 0 grams" rows — this is reachable.)
- **No plausibility filter on search results** — a live search surfaced "Great Value · Chicken Breasts, 3 kcal per 1 ounce" (nutritionally impossible, ~15× low) ranked among real results. Add an Atwater/per-100g sanity gate at the result-merge layer.
- **FatSecret OAuth token cached in module memory only** (lost on serverless cold start) — store in Redis with `expires_in − 60s` TTL.
- **`FatSecretBadge` missing from the search results panel** (attribution only in the LogSheet footer) — ToS requires attribution where data is displayed; add a per-result/panel badge.

*Food logging / parity*
- **Web has NO logged-meal edit; mobile has a full edit modal** — *DOWNGRADED P1→P2 (delete+re-log workaround, but it compounds the micros-loss).* `useNutritionJournalState.ts:505-516` has no `updateLoggedMeal`. Ship a web edit path mirroring mobile.
- **Mobile `deleteMeal` swallows persist failure (no rollback, no alert)** — web restores + toasts (`useNutritionJournalState.ts:340-350`); mobile only `console.error` (`index.tsx:4290-4297`), so a failed delete reappears on reload with no signal. iOS is the primary surface. Mirror the web ENG-1048 fix.
- **Web `nutrition_entries` write payload is untested + uses a second `buildNutritionEntryRow`** that can drift from mobile's — consolidate or add a web mock-Supabase payload test.
- **No offline/durable write queue** — a failed log is rolled back and lost; the 35-day load window can hide back-dated logs. Ship a small AsyncStorage/localStorage retry queue (idempotent on id).

*Recipe / meal planning*
- **No user collections/folders** — organisation is predicate filters only; a Paprika/Plan-To-Eat power-user gap. Plan collections post-launch; interim, fix Library search to cover the 50 seeded tags.
- **Library search fragmented + web/mobile-divergent** (mobile title-only, web title+creator, neither uses the shared `recipeSearchMatch` with tags) — unify on the shared matcher.
- **Web/blog import persists instruction steps verbatim** vs the posture doc's "paraphrase steps" must-do — `route.ts:347,491`; route web/blog steps through the structured extractor.
- **Cook-mode "Log this meal" conflates cook-scale with servings eaten** (logs `perServing × cook-scale`, no confirmation) — `cook.tsx:1611`→`recipe/[id].tsx`; clarify + confirm the servings logged.
- **Named plan slots device-local, never sync** — *DOWNGRADED P1→P2 (parity violation, but not corruption).* `namedSlots.ts:5-9`; sync the slots array to the cloud or surface a device-local warning.
- **Web Plan tab is a ~40% subset; `PlanTemplatesDialog` is dead code; `moveMealInPlan` shared fn unwired on web** — *DOWNGRADED P1→P2.* `MealPlanner.tsx:152-155`; ship move-meal + templates or document explicit carve-outs.
- **"Log as planned" always logs to today, discards the plan day's date** — *DOWNGRADED P1→P2.* `planner.tsx:4045`; log against the plan day's calendar date + add planned-vs-consumed.
- **No pantry/staples model** — *DOWNGRADED P1→P2.* `generateShoppingList.ts:85-89`; re-buys salt/oil weekly. Ship a minimal suppress-list.
- **Grocery categoriser is ~12 keywords → most items "Other"** — `category.ts:1-13`; expand the lexicon or reuse the verified ingredient's known category.
- **Shopping list over-buys (full recipe yield, not planned portions)** — `planner.tsx:1966-1969`; factor `planned_portions / recipe_servings`.
- **Shopping list has no "generated from plan of {date}"** — `ShoppingList.tsx:159` static string can point at last week's groceries; stamp the source plan's `start_date`.
- **Recipe-import parser leaks prep-states ("mixed with warm water", "to serve") as shopping items** — tracked only in a planning doc with no Linear id (silent deferral); file it + add parser skip-patterns.

*Security / web*
- **`assertOrigin` CSRF guard missing on several cookie-auth mutating routes** (`user-foods`, `nutrition/*`, `recipe-import`, `imports/mfp-csv`) — only 5 household/account routes have it. Apply uniformly or convert to Bearer-only.

*Design / accessibility (web)*
- **Web import-hero slab + meal-slot header are keyboard-focusable with no focus-visible ring** — `DiscoverFeed.tsx:423`, `today-meals-section.tsx:649`; add `focus-visible:ring-2`.
- **Raw `Pressable` (no haptics) on all meal rows + recipe cards** — *DOWNGRADED P1→P2.* `TodayMealsSection.tsx`, `discover.tsx`; swap to `PressableScale` (mechanical).
- **Today/Plan giants grew in the net-new range** (`today-meals-section.tsx`→1,255; `TodayMealsSection.tsx`→1,730; `planner.tsx`→4,407) — extract `EmptySlotCard`/section children before the next feature touch.
- **~40% of net-new tests are source-grep string-pins, not behavioural** — keep as anti-drift lockfiles but don't count as coverage; add render tests for load-bearing CTAs.
- **20+ off-scale spacing literals + 5 off-radius values** across `TodayMealsSection`/`discover`/`DiscoverFeed` (gap:6/10/2, borderRadius:10/11/14, `text-[9px]`/`[10px]`/`[11px]`, `gap-2.5`/`px-3.5`) — token-swap pass.
- **ENG-805 web weekly-checkin modal still renders** (`NutritionTracker.tsx:3011`) while mobile demoted it to a card — parity gap (reopened in triage). Demote web to a dismissible card.
- **Chromatic visual-regression set to auto-accept** (`c0a9c3f2`) right as the redesign waves land — re-arm review (or confirm Playwright covers the cohesion surfaces) before onboarding.
- **25 zombie "Duplicate"-state Linear issues** inflate the open count (22 = the defunct Premium-bar-audit project); bulk → Canceled + retire the shell.
- **ENG-34 ("FatSecret no results") sits Urgent/Blocked/P0 but is non-blocking** — food search is resilient without FatSecret (4th of 4 providers, catch→[]); downgrade to an ops credential refresh.

---

## 13. P3 Findings (future / polish)

- **`database.types.ts` web/mobile divergence** (mobile missing `eaten_at`) — *DOWNGRADED P1→P3 (compiles via a local cast in `nutritionEntryRow.ts:52`, not reachable).* Re-run `npm run db:types`; add a CI `diff` gate.
- **Mobile OFF barcode goes direct to `world.openfoodfacts.org`** — *DOWNGRADED P1→P3 (verifier: `reconcileOffPer100g` + `basisCorrected` ARE applied on mobile; only the curated-override table, per-user rate limit, and cache are missed).* Route through `/api/off/barcode`.
- **`FATSECRET_TIER` absent from CI/Vercel** — *DOWNGRADED P1→P3; the "micros zeroed in prod" impact chain was REFUTED (the cache-guard is a recipe-table ToS scrub, not a micros-display gate; live `food.get` returns micros regardless of tier).* CI/env hygiene only: add `FATSECRET_TIER=premier` to CI + Vercel; add a startup assertion.
- **Discover recipe cards (mobile) lack `accessibilityLabel`** — *DOWNGRADED P1→P3; evidence corrected: the cited `DiscoverHeroCard.tsx:38` is dead code; the REAL shipped cards `discover.tsx:436/560/483` are the ones missing labels.* Add `accessibilityRole='button'` + `accessibilityLabel={title}`.
- Web DiscoverFeed recipe `<button>`s lack `aria-label` (`DiscoverFeed.tsx:721,795`); `text-[9px]`/`[10px]` labels below the readable floor.
- Net-energy chip "Maintenance" band (±60) disagrees with the binary `isDeficit` subline in the dead-band (`netEnergyBalance.ts:9-15`).
- Stale "KNOWN APPROXIMATION" header in `measureToGrams.ts:1-10` (ENG-701 already fixed the ordering) — delete.
- Leftovers/move-meal total recompute omits `fiberG` (`leftoversPlanner.ts:146-154`).
- Mutable `search_path` on the Gate-0 trigger functions + `save_verified_ingredients` + `ingredient_images_touch_updated_at` (live advisor) — pin `search_path` in a forward-only migration.
- Sentry PII denylist omits health fields (weight/measurements/sex-at-birth) — extend `sentryRedaction.ts:27`.
- SSRF string-layer misses `0.0.0.0` + integer/octal/hex IP encodings (DNS-resolve layer backstops) — harden `ssrfAllowlist.ts`.
- `claim_web_push_subscription` deletes by endpoint with no owner check (defence-in-depth) — `20260503100600_*.sql:75-81`.
- HIBP leaked-password protection off (live advisor) — dashboard toggle; web uses password auth.
- 2 RLS policies re-evaluate `auth.<fn>()` per row (`referrals`, `referral_credits`); 12 overlapping permissive policies; ~30 unused indexes (expected at current load) — perf hygiene, not launch-blocking.
- Orphaned `src/lib/onboarding/finalStep.ts` (dead, banned "staged for follow-up" comment, references dropped `meal_plans`) — delete.
- Dead `meal_plans`/`meal_plans_legacy` DELETEs in account-deletion paths (tolerated via `isIgnorable()`) — prune.
- `AI_BUDGET_ENFORCEMENT_ENABLED` defaults OFF (cost breaker is monitoring-only) — decide before the viral push.
- 253 `as any` casts (type-safety erosion; 0 `@ts-ignore`) — ratchet down starting with Supabase client access (ENG-749).
- `edamamNutritionAnalysis()` dead code; `caption.slice(0,4000)` silent truncation on long/multi-recipe imports; food-search `source:'manual'` conflates vendor-search with manual entry in analytics.
- 7 live tech-debt issues orphaned under the dead "Premium P5 — Architecture enablers" project shell — re-home to Platform foundations.

---

## 14. Architecture Findings (7.5/10)

Two-app npm monorepo (Next.js 15 / Vercel + Expo iOS / EAS) sharing `@suppr/shared` → `src/lib/`. **Server/data tier is genuinely mature:** fail-closed Upstash rate limiting, a two-layer AI cost circuit-breaker (reserve/commit/release, 5-min fail-open→fail-closed window), constant-time cron-secret auth, signature-verified Stripe + RC webhooks with persisted-event-id dedup, 140 RLS policies across 43 tables, vendor cache + per-vendor quota breakers, and a **deterministic-first AI architecture where the LLM never invents foods or computes nutrition.** Critically for due-diligence, the **data model is roadmap-ready** — household/family (4 tables + API), creator/social (`author_follows`, `creator_publish_notifications`), AI (6 routes + budget gate), tiers (`free/base/pro/lifetime_pro`, dual-provider), and a **provider-agnostic health schema** (`health_snapshots.source` defaults `'healthkit'` with an explicit Health-Connect-coexistence comment) — so Oura/Garmin/Fitbit/family/AI-coach do **not** require a schema rewrite. The deduction is concentrated in **one layer: client-state monoliths** (the 6,613-line mobile Today with no shared data context; web's 2,235-line god-context; `FoodSearchPanel` duplicated 5,539 lines), the single-region SPOF topology, and the ungated `SUPADATA_KEY`. The net-new range is **net code-health-positive** (dead-query removal ENG-850, OFF consolidation). See §12.

## 15. Code Quality Findings (6.5/10)

The net-new range is **healthier than the codebase it sits on**: button-cohesion (A–F) and redesign waves landed disciplined cross-platform shared logic (every business rule — `mealSlotAim`, ENG-793 clamp, attribution, fallback titles — lives in one shared module), off-token introductions in the diff are ~zero, ENG-850 dead-code removal is clean, and there are no silent deferrals in added lines. Dragged down by: **152 files over the 400-line cap** (the range *grew* four giants), **~40% of net-new tests are source-grep string-pins** (anti-drift, not behavioural — do not count as coverage), 253 `as any`, the orphaned `finalStep.ts`, and the Chromatic auto-accept landing exactly as the most visual change ships. See §12/§13.

## 16. Security Findings (7.5/10)

**Reviewed forensically; PASS for the closed cohort — no new P0/P1 beyond SUPPR_TEST_PREMIUM.** The brief's headline concern — the **~13 anon-executable SECURITY DEFINER functions** (`redeem_promo_code`, `household_invite_*`, `household_join_by_invite_code`, `claim_web_push_subscription`, the public-count readers) — is **safe on close reading**: every write/sensitive function enforces `auth.uid()` + household/ownership membership; `redeem_promo_code` rejects anon immediately (`:219`) and writes only the caller's own profile with a valid code; the anon-granted ones are aggregate public-count reads. Gate-0 lockdowns intact at HEAD; the `app.tier_writer` GUC bypass is sound under PostgREST's one-statement-per-request model. **Residual:** SUPPR_TEST_PREMIUM (P1), CSRF guard gaps (P2), HIBP off (P3), mutable `search_path` on the lockdown triggers (P3), Sentry health-PII denylist (P3), and the **un-run Gate-0 production 5/5 (P0-2)**. Live advisors: 2 webhook tables RLS-enabled-no-policy (correct fail-closed for service-role writes — INFO, acceptable).

## 17. Food Logging Findings (6.5/10)

The **core write path is genuinely strong** (LIVE-VERIFIED end-to-end): immediate-persist + 600ms backstop now share one row-builder on mobile, `eaten_at`/`date_key` derive once, the per-serving 0-kcal bug class is closed by one shared predicate, barcode per-100g reconcile is shared, and single-meal add/delete has optimistic rollback (web). The log sheet renders premium (meal selector, barcode/mic/camera, copy-yesterday, confidence-tiered results, well-designed empty state). **But three not-previously-flagged data-integrity issues pull it down** (P1-3 recents micros-drop, P1-4 saved-meals micros-drop, P1-5 web copy not re-anchoring), plus the web no-edit gap (P2), mobile delete swallowing failure (P2), and no durable offline queue (P2). The food **data** beneath the loop is the bigger trust problem (see §18/§19).

## 18. Nutrition Engine Findings (7.5/10) — mission-critical

**The 2026-06-10 audit's fixes genuinely landed (CODE-VERIFIED at HEAD):** the P0 adaptive-TDEE slope bias is gone — replaced by a completeness gate + least-squares slope over a daily-interpolated series + plausibility clamp, pinned by a regression test reproducing the founder's exact series; the gain 2× display/math mismatch, per-day smoothing, on-track-tile-judges-trend, and acknowledge-to-proceed-below-floor all shipped. OFF per-serving reconciliation (the Chobani ×25 class) is robust; confidence aggregation honestly excludes sub-floor rows. **The residual risk is the food-data layer, not the formulas:** the empty `verified_food_canonical` behind a "Verified" badge (P1), `genericFoodMicros` bake errors (P1-2/P2), recents/saved micros-drop (P1-3/P1-4), the flat ±0.35 slope cap (P2), the FatSecret v1/v2 guard (P2), and the confidence-policy doc/code mismatch (P2). ENG-793's health-critical core is an untracked silent deferral (P1-10).

## 19. Vendor Integration Findings (6.5/10)

Quota guard + degraded-envelope + per-100g reconciliation + `AbortSignal` timeouts + FatSecret ToS scrub are well-designed. **But:** `genericFoodMicros` carries wrong-food bake errors (P1-2/P2); Edamam `/nutrients` (and USDA detail) bypass the quota guard (P2) and Edamam's **1,000/day account-wide** ceiling is the first thing to break at viral cold-query load; no retry at any call site + USDA 502-not-degraded breaks the merge pipeline on a transient (P2); ENG-774 serving-no-mass rows keep inflated values (P2); no plausibility filter lets impossible rows ("3 kcal/oz") reach search (P2); FatSecret token cached in-memory only (P2) + missing search-panel attribution (P2). The "Verified" tier is **vendor-confidence-driven, not consensus-verified** (canonical store empty). Economics: cache helps repeats, not the cold viral spike.

## 20. Recipe Platform Findings (6.5/10)

Import is the **strongest, most production-grade pillar** (multi-source verify cascade with confidence floors, strict structured-extraction schema + no-guessing rules, SSRF-guarded fetch with DNS re-resolution, vendor-name-scrubbing error mapper, disciplined legal posture: `description:null` + disclaimer on web/social paths, photo blocking, honest bot UA). Title sanitisation + fallback (ENG-1047) and attribution (ENG-1084, "Sloe Kitchen" — LIVE-VERIFIED) are robust. **Gaps:** DMCA agent (P0-1), no collections (P2), Library search divergent (P2), web recompute non-atomic (P1-6), cook-mode log semantics (P2), verbatim web/blog steps vs posture doc (P2), 4,000-char caption truncation (P3). **Reliability of the import itself (ENG-670) is unmeasured** — and it's the viral hook; measure it before the push.

## 21. Meal Planning Findings (5.5/10)

Solid macro-aware auto-planner (one shared behaviourally-pinned algorithm, ENG-1040 shopping parity, thoughtful leftovers, ENG-1092 trust-correct empty slots — LIVE-VERIFIED: honest "0 of 7 days" + per-macro chips + portion-scaler "0.5× portion" badge all rendering). **But the end-to-end model is incomplete for a serious planner:** no pantry (P2), named plans don't sync (P2), web is a ~40% subset with dead template code (P2), "Log as planned" mis-dates (P2) so there's no planned-vs-consumed loop, grocery categoriser dumps most items to "Other" (P2), and the list over-buys (P2). Move-meal is mobile-only (the shared fn exists, web unwired).

## 22. Design System & UX Findings (5.5/10)

The token architecture is well-designed and the net-new work is structurally sound (ENG-1086 ring, ENG-1092 slots, ENG-1081 flat-card, ENG-1079/1080 SupprButton — `SupprButton` itself correctly uses `PressableScale` + haptics + disabled/loading states). **The execution craft has not caught up to the system:** WCAG AA contrast failures on every macro chip + caption labels at 11px while the `-solid` fix tokens sit unused (P1-8); raw `Pressable` (haptic-silent) on the two highest-traffic mobile surfaces (P2); the backwards adherence headline (P1-7, LIVE); missing web focus-visible rings (P2); sub-44pt tap targets (P2); 20+ off-scale spacing + 5 off-radius literals (P2); two screens 16×/4× over the cap (P2). Premium when it renders; demonstrably below the stated craft bar on measurement.

---

## 23. Competitive Analysis Findings

**Verdict:** Suppr occupies the **single largest white-space in the category** — no shipping competitor combines verified-multi-source nutrition + attributed Reel import + adaptive TDEE + meal planning + a viral loop, all with import on the **free** tier. That integration *is* the moat.

- **Nutrition:** Adaptive TDEE done right and shipped free is ahead of MacroFactor (paid-only); ~37-nutrient panel beats MFP free, but Cronometer's 84 (lab-verified) wins the clinical persona — keep micros a supporting strength, don't pick that fight; **soften the "Cronometer parity" code comment**. Behind on DB coverage at the MFP-refugee first-90-seconds staple test.
- **Recipes:** Macro-fit + attributed social import is ahead of Paprika/Crouton/ReciMe (ReciMe gates imports; Suppr keeps them free). Behind on organisation (no collections) and Discover depth (flatter than Lifesum/Samsung Food).
- **Meal planning:** Macro-aware auto-plan is ahead; behind Plan To Eat / AnyList on pantry, web parity, and store APIs.
- **Health:** Partial Apple Health; no Oura/Whoop/Garmin yet (schema supports them).
- **Strategic risk (P1-9):** MFP acquired Cal AI (Mar 2026) — re-test the refugee thesis. **Pricing (P2):** Pro £59.99/yr sits above Cronometer (~$50), ReciMe ($40), Lose It ($40), Yazio (~$48) and contradicts Suppr's own "$30–50 sweet spot" research — re-anchor before paid GA or justify the premium with the all-in-one argument. **Reliability of the import wedge (ENG-670) is the moat's soft spot** — Julienne/ReciMe's complaint baseline is reliability; beat it with a measured parse-rate floor.

## 24. Linear Backlog Assessment

Live at HEAD: **272 open ENG issues — 247 genuinely active**, 25 stuck in "Duplicate" state (counted as open). The 2026-06-14 triage was real and largely correct; the backlog is **fresh** (only 9 of 247 >21 days stale), **WIP caps respected** (In Progress 4/4, Todo 7/12), and the net-new range has **exemplary closure hygiene** (26 of 27 referenced issues Done). `launch-blocker` = {ENG-1060, ENG-859, ENG-670}; `paid-ga-blocker` = {ENG-667, ENG-198}. **Problems:** ENG-793 marked Done with its health-critical core open (P1-10); 25 zombie Duplicates inflate the count (22 = defunct Premium-bar-audit project) (P2); ENG-34 sits Urgent/Blocked/P0 but is non-blocking (P2); the Gate-0 production re-proof exists only in audit prose, not as an issue (P0-2); 7 architecture issues orphaned under the dead Premium-P5 shell (P3); 5 Triage-state + 3 project-less issues (P3). The two triage reopens (ENG-805, ENG-915) verify as correctly still-open. **Correction (adversarial pass):** the audit P1-1/P1-2 "untracked eaten_at test" finding is **REFUTED** — both were shipped in `feb55901`/PR #400 alongside the 06-12 audit doc; do not re-file.

## 25. Recommended New Issues

1. **P0** — Gate-0 live 5/5 re-proof against prod + CI automation (currently only in audit prose). `launch-blocker`.
2. **P1** — Deactivate SUPPR_TEST_PREMIUM in prod + DB-side throttle on `redeem_promo_code`. `paid-ga-blocker`.
3. **P1** — Re-bake `genericFoodMicros` from correct fdcIds (grapes/apple) + audit all 50 rows.
4. **P1** — Carry `nutrition_micros` through Recents/Eat-again food history (both platforms).
5. **P1** — Add `nutrition_micros` to `user_saved_meal_items` + persist/restore on save→log.
6. **P1** — Web copy/duplicate must re-anchor `eaten_at` to the target day (parity).
7. **P1** — Web recipe recompute via `save_verified_ingredients` RPC (atomicity + parity).
8. **P1** — Ramp `adherence_over_display` + remove legacy branch (ENG-1073).
9. **P1** — Macro/slot/aim text → AA-passing `-solid` tokens (web + mobile) + a contrast unit test.
10. **P1** — Populate `verified_food_canonical` OR relabel the "Verified" tier; reconcile the 0.70/0.55 confidence-policy doc.
11. **P1** — Weekly check-in must consume measured Apple Health TDEE (split from ENG-793 core).
12. **P1** — Refresh competitor intel for MFP/Cal AI + re-test the refugee thesis.
13. **P2** — Web logged-meal edit modal (parity); mobile delete rollback+alert; web write-payload test.
14. **P2** — Pantry/staples suppress-list; grocery categoriser lexicon; shopping-list portion scaling + date stamp.
15. **P2** — Search-result plausibility filter (Atwater/per-100g sanity gate); Edamam/USDA detail-route quota counting; vendor retry + USDA degraded envelope.
16. **P2** — Re-anchor pricing to the validated band or document the premium; measure ENG-670 parse-rate floor.
17. **P2** — Sweep 25 Duplicate issues → Canceled; re-arm Chromatic/Playwright on cohesion surfaces; apply `assertOrigin` uniformly.

## 26. Recommended Implementation Order

**Gate 0 (before any cohort):** P0-2 Gate-0 5/5 in prod → P0-1 DMCA in motion → SUPPR_TEST_PREMIUM deactivated → Supabase advisors zero ERROR → TestFlight smoke on the release binary.

**Gate 1 (before the viral push):** the nutrition-data-loss P1 cluster (recents/saved micros, web `eaten_at` re-anchor, genericFoodMicros re-bake, web non-atomic recompute) → P1-7 adherence ramp → P1-8 WCAG contrast → ENG-670 parse-rate measured → ENG-874 device matrix → "Verified"-tier semantics fix → MFP/Cal AI intel refresh → monetisation unblock (Gate B, parallel).

**Gate 2 (during beta):** mobile data-layer extraction (ENG-703/621) before AI-coach/wearables; collections; pantry + web Plan parity; vendor resilience (retry, detail-route quotas, plausibility filter); backlog hygiene; visual-regression re-arm.

## 27. Recommended Test Strategy

- **Highest-value missing tests:** recents/saved-meals micros-preservation; web `eaten_at` re-anchor payload; web recipe-recompute atomicity (mid-write failure); adherence render at 100/108/114%; **automated WCAG contrast census over token pairs** (model `tests/e2e/verify/contrast-audit.spec.ts`) + a Playwright `getComputedStyle` sweep; `genericFoodMicros` plausibility test over all 50 rows; search-result plausibility (reject "3 kcal/oz"); `redeem_promo_code` throttle.
- **Keep (real behaviour tests):** `adaptiveTdee`, `nutritionEntryRowPersistence`, `mealEatenAt`, `foodSearchPreviewNutrition`, `vendorSearchCacheRoutes`, the meal-plan algo battery.
- **Do NOT count** the ~40% source-grep string-pins as behavioural coverage — pair them with render tests for load-bearing CTAs (paywall, log-commit, end-fast, build-first-week) and Maestro/Playwright golden flows.
- **Gate suites:** `verify-gate0-db.mts` (5/5, automate in CI), import-legal (`recipeImportDescriptionNull`, `importSourceDisclaimer`), SSRF integration + redirect-follow grep ban, parity (`primaryNavParity`, shopping portion, a new web/mobile `database.types.ts` diff gate).

## 28. Biggest Long-Term Risks

1. **Client monoliths** (6,613-line Today, no shared mobile data layer) obstruct AI coach, wearables, family — and the range grew the giants.
2. **Food-data trust** — empty canonical store behind a "Verified" badge, baked-from-wrong-food micros, recents/saved micros-loss, no result plausibility filter. For a trust product this is the most corrosive class.
3. **Web↔mobile parity drift** on load-bearing flows (edit, copy re-anchor, Plan subset, named-slot sync, recompute atomicity, Library search) — a standing CLAUDE.md non-negotiable eroding in practice.
4. **Vendor economics** — Edamam 1,000/day account-wide ceiling vs viral cold queries, with detail routes unguarded.
5. **Legal surface scales with import volume** — DMCA agent + ongoing takedown process; the viral hook is the legal exposure.
6. **Solo-founder ops dependency** — Gate-0 password, DMCA/incorporation, Tax/IAP, single-region SPOF, no recovery vault (ENG-514).
7. **Scale is unproven** — production holds 990 entries / 6 loggers (founder + personas); no real load has hit the rate limiter, vendor quotas, or crons.

## 29. Open Questions

- Gate-0 5/5 on production with `GATE0_VERIFY_PASSWORD` — **UNVERIFIED** this session.
- Will `editable_eaten_at` ever allow cross-day edits? If yes, P1-5 (web re-anchor) becomes active corruption and must land first.
- Is `verified_food_canonical` intended to be populated (consensus pipeline), or is "Verified" permanently a vendor-source label? The trust copy depends on the answer.
- ENG-793: what is the design decision for measured-burn-aware maintenance (double-count avoidance + wear-completeness gating)?
- ENG-670 measured parse-rate on real-world Reels vs the Julienne/ReciMe baseline?
- ENG-874 device matrix completion on a physical iPhone; TestFlight release-binary smoke (cold open, import→save, plan→shop, promo→Pro, Health sync).
- Pricing: hold £59.99 with the all-in-one justification, or re-anchor to £35–45?

## 30. Final Recommendation

**CONDITIONAL-GO for a small, closed, comped founding cohort on the production TestFlight binary** once **Gate-0 is re-proven 5/5 in production, the DMCA agent is in motion, and SUPPR_TEST_PREMIUM is deactivated.** The daily loop renders end-to-end on real data, the security posture is strong, and the core nutrition math is now trustworthy at the macro level — the founding-cohort exposure on the data-quality and parity P1s is bounded because the cohort is tiny and comped.

**DO NOT execute the 2026-07-01 viral free push** until the **legal blocker (DMCA registered), the nutrition-data-loss P1 cluster (recents/saved micros, web `eaten_at` re-anchor, genericFoodMicros re-bake, non-atomic web recompute), the trust display (adherence ramp), the WCAG contrast failures, the "Verified"-tier semantics, and the measured Reel parse-rate gate (ENG-670)** are addressed — because the viral push *is* import-driven and the first impression is a food-data-and-trust impression. Lean the narrative on the genuinely unique, defensible wedge — **attributed Reel import + make-it-fit-your-macros + adaptive TDEE on free** — and re-sharpen it against an MFP that now owns Cal AI.

**The engineering is not the bottleneck; the founder's ops/legal critical path and a bounded, well-scoped data-trust + parity punch-list are.**

**Confidence: 8.5/10.** Every headline finding was specialist-read, adversarially re-verified against code at HEAD, and the core loop + the sharpest data-trust findings were rendered/queried live on real founder data. −1.5 for: Gate-0 production re-proof not run (no password), ENG-874 device matrix open, and release-binary deep-link/smoke inferred rather than run on a built IPA.

---

## Real User Walkthrough Findings

Live iOS simulator (iPhone 17 Pro, dev client at HEAD, Metro 8081, **real founder data**), fresh pixels this session. Screenshots in `/tmp/audit-0614/`. Where a finding came from these pixels it is **LIVE-VERIFIED** above.

### Coverage

| Surface | Status | Evidence |
|---|---|---|
| Today — cold open (empty) | **PASS** | `02-today.png` |
| Today — macro tiles + empty meal slots | **PASS** | `03b.png` |
| Plan — generated week | **PASS** | `05-plan.png` |
| Recipes / Discover — import hero + cards | **PASS** | `06-recipes.png`, `07-discover-loaded.png` |
| Progress — adherence + weight chart | **PASS (with trust flag)** | `08-progress.png`, `09-progress-scroll.png` |
| Log sheet — search, tiers, empty state, preview | **PASS (with data-quality flags)** | `10`–`15` |

### Journey 1 — Today (cold open) · PASS
"Sloe" wordmark, "Morning, Grace · Sunday 14 June", week strip (14 highlighted), "Fresh start" chip, empty calorie ring "1,231 LEFT" (brand-gradient loop, ENG-1086), GOAL/EATEN/BONUS = 1,231/0/0 (consistent), calm copy "Plan your day — about 1,231 kcal left. No rush." The **ENG-805 weekly check-in did NOT block cold-open on mobile** (matches triage: mobile demoted, web still gapped). Premium, calm, on-brand. *Trust: high.*

### Journey 2 — Today meal slots + macro tiles · PASS
Macro tiles 2×2 (Protein 0/99g, Carbs 0/117g, Fat 0/41g, Fibre 0/27g — flat-white cards, equal width, ENG-1081/1093). **ENG-1092 "Aim ~X kcal" empty slots shipped and rendering:** Breakfast (~310), Lunch (~370), Dinner (~370), Snacks — distinct icons + "+" affordance; the splits sum to 1,231 (25/30/30/15). A suggested-recipes-to-log list ("Pick a few recipes…": Pico de Gallo, Beef Chili, Chicken Congee, Ceviche — real recipes). The "Purposeful empties" redesign looks genuinely premium. *Trust: high.* *Visual note: aim line contrast fails AA (P1-8).*

### Journey 3 — Plan · PASS
"Meal plan" / This week / Shopping list. **Honest "Hits your targets 0 of 7 days"** (ENG-1049 trust fix live) + "Generate ▾" + "Adjust constraints". Sun (Today) plan fully populated (Pico de Gallo **"0.5× portion"** badge — joint-fit scaler; Beef Chili; Chicken Congee; Ceviche) summing 1,290/1,231 kcal; per-macro chips P/C/F "On track" + **Fibre 20g "−7g"** (deficit honestly highlighted). The over-target honesty and portion scaler both work. *Trust: high.*

### Journey 4 — Recipes / Discover · PASS
Library/Discover tabs; filter chips (Following/All/Trending/Quick 30/Under 5…). **Import hero (ENG-1087/1094) is prominent and above the carousels (ENG-1089):** lavender-plum card, chain icon, "Import from TikTok, Instagram & YouTube · Paste a link or share from any app" + "Paste link" CTA — the viral wedge placed correctly. Discover cards render premium with **real food photography** ("Classic Greek Salad", **"Sloe Kitchen" byline** — ENG-1084 attribution working) and plausible macro chips (380 kcal · 13g P · 18g C · 28g F · 5g; Atwater checks out). *Trust: high.* *Note: shipped cards lack `accessibilityLabel` (P3); empty-thumbnail concern applies to imported Library items, not curated Discover.*

### Journey 5 — Progress · PASS with trust flag
Range tabs D/W/M/6M/Y (ENG-1031 paging), "8–14 Jun" nav. Adaptive narrative: "Maintenance held steady — estimate stayed at **1,606 kcal, medium confidence**." **TRUST FLAG (P1-7, LIVE): "AVERAGE ADHERENCE 108% · over"** as the headline (Carbs/Fat bars "114% · over" in amber) — overeating reads as *high* adherence; the fix is built but flag-gated at 0%. Weight section: "54.5 kg · ↘ 0.5 kg this week", Trend/Scale toggle, declining line chart with a shaded projection band (ENG-878), START 51.9 → CURRENT 54.5, GOAL/RATE em-dashed (maintenance). *Note: chart x-axis is weigh-in-days-only (Tue/Thu/Fri/Sat, skips Wed) — uneven spacing.*

### Journey 6 — Food logging (log → search → preview) · PASS with data-quality flags
Log sheet: meal selector, barcode/mic/camera, "Copy yesterday's meals · 7 meals", Recent/Library/Saved, real recents (Gin & tonic, Prosecco, Papa John's Chicken Poppers, Trader Joe's French Toast). **Search renders confidence tiers** (Verified blue / Estimated amber). A clean "chicken breast" query → "Chicken breast" (Verified) #1 — **ranking is fine on clean queries** (my earlier "chicken skin top result" was a query-pollution artifact, NOT a bug — held off asserting it). Preview: serving-size chips with unit conversions (1 fillet/g/oz/lb), servings stepper, full macros + Na/Chol, "Use this" CTA. The empty-state for a no-result query is well-designed ("Add as custom food" / "Tell us we're missing this" / "Create custom food").
**DATA-QUALITY FLAGS (LIVE + DB-VERIFIED):** the Verified "Chicken breast" = 120 kcal/100g, ~22.5 g protein/100g — ~27% below canonical USDA (~165 kcal/31 g) (P1 "Verified" semantics); `verified_food_canonical` is **empty (0 rows)** so the badge is a vendor-source label; the full result list contained **"Great Value · Chicken Breasts, 3 kcal per 1 ounce"** (nutritionally impossible, no plausibility filter — P2) and many **"per 1 serving, 0 grams"** rows (the ENG-774 serving-no-mass gap — P2). The canonical-correct entry ("Chicken Breast (Skin Not Eaten), 165 kcal/101g") ranked **last**.

### Cross-journey notes
- The product **feels finished and renders end-to-end** this pass — the net-new redesign is premium.
- The headline trust gaps are not "does it render" — they are **what the data and the adherence number tell the user** (108%·over; under-reporting "Verified" foods; re-logs losing micros) — exactly the surfaces a trust product cannot ship blind.
- Launch QA must still run on the **TestFlight release binary**, not the dev client.

---

*End of audit. Read-only throughout: no code, schema, flags, commits, or external state were modified. Production DB was read via SELECT only. This file is intentionally left untracked for Grace's review.*
