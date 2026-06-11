# Independent Product, Engineering & Launch-Readiness Audit — Suppr / Sloe

**Date:** 2026-06-11
**Reviewer:** External due-diligence audit (autonomous, scheduled)
**Branch reviewed:** `claude/skia-ring-2026-06-10` (HEAD `a39e0d88`)
**Method:** Ground-truth codebase reconstruction + 10 parallel specialist code reviews, each finding cited to `file:line`, followed by an adversarial skeptic pass on every P0/P1 finding; plus a live iOS-simulator visual walkthrough of the core journeys. Web visual coverage was limited (no dev server running; `tests/e2e/.auth/user.json` expired) — authed web surfaces are assessed from component/code render and the design/parity specialist; the live marketing site (`getsloe.com`) returns 200.

> **Evidence discipline.** Every finding below cites the exact files read. P0/P1 findings were independently re-verified by a second agent that opened the cited files and defaulted to refuting; the verdict is recorded. Four P1 findings were *downgraded to P2* by that pass and are filed accordingly. Two P0 findings survived verification with full exploit chains intact.

---

## 1. Executive Summary

Suppr is a genuinely ambitious multi-pillar product — nutrition tracker, food logger, recipe manager, recipe importer, recipe discovery, meal planner, grocery planner, and health-insights surface — and the build quality is materially higher than a solo pre-launch product usually is. The nutrition engine is the standout: the mission-critical math (Mifflin-St Jeor, Atwater, FDA daily values, count-to-weight, adaptive-TDEE least-squares slope) is correct, parity-wired across web and mobile, and pinned by ~214 nutrition tests. The server-side architecture (signature-verified idempotent webhooks, fail-closed rate limiting, a two-layer AI cost circuit-breaker, comprehensive self-only RLS) is the product of real prior hardening, not box-ticking. The micronutrient panel is Cronometer-tier (~37 fields). The recipe-import-from-Reel wedge — the entire basis of the 2026-07-01 viral push — is real and architecturally sound.

**But the product is not safe to onboard real users today.** Two confirmed P0s block launch:

1. **Entitlement-escalation via the database.** The tier-lockdown trigger that protects `user_tier`/`stripe_customer_id` is `BEFORE UPDATE` only; the INSERT RLS policy has no column guard and users can delete their own profile row. Any authenticated user can `DELETE` then `INSERT` a fresh profile with `user_tier='pro'` straight from the client anon key — granting themselves Pro for free and defeating the entire paywall the lockdown exists to enforce.

2. **A live copyright-reproduction exposure on the recipe-import path.** The decision doc and roadmap both treat "stop persisting the creator's verbatim headnote prose on the web/blog import path" (ENG-857) as a P0 that is **"LIVE / shipping in prod now."** It is not implemented. The verbatim creator `description` is still persisted and rendered on both platforms, the legally-required source-card disclaimer (ENG-858) does not exist anywhere in the codebase, and the DMCA designated agent (ENG-859) is unregistered — so there is no §512(c) safe harbour. This sits on the exact surface the viral launch is built to drive traffic to.

Beneath the P0s sit 14 P1s (downgraded count: 10 after verification) that are real beta-window risks: a SECURITY DEFINER view that bypasses recipe RLS and is readable by the public anon key; a recipe-import SSRF hole (`redirect: "follow"` on an attacker-controllable URL, reintroducing the exact ENG-682 metadata-SSRF bug); no cross-request vendor cache (Edamam's 1,000/day *account-wide* free tier and USDA's ~1,000/hr key both exhaust within minutes of any viral spike, silently degrading search for everyone); a goal-date/projection input (`calcGoalTimeline`) still on a raw two-point weigh-in delta — the same noise bug ENG-1026 just fixed elsewhere — driving wrong goal dates on both platforms; and a cluster of web↔mobile parity breaks (shopping-list quantities, grocery aisles, fibre export, tab order) that violate the project's own non-negotiable "web and mobile must stay in sync."

The most strategically important finding: **the product's headline differentiator (recipe-import-from-Reel) and its single biggest launch risk (the copyright-replay P0) are the same surface.** Lean the launch on the social/caption import path (already compliant, documented as stronger than ReciMe), close ENG-857/858/859, and the wedge is defensible.

**Bottom line:** ~3–4 focused engineering days clears the two P0s and the highest-value P1s. Do not onboard users before the two P0s close. The foundation is strong enough that this is a finishing problem, not a rebuild.

---

## 2. Overall Product Score — **6.5 / 10**

Strong, differentiated product vision executed to a higher bar than most pre-launch solo builds, undercut by (a) two launch-blocking defects, (b) a large slate of "category-leading" features specced-but-unbuilt (ENG-927→979, the whole launch-blocker tranche), and (c) parity drift that breaks the "one product" promise on grocery and navigation. The core loops work and feel premium; the product is closer to "finish and harden" than "still figuring out what it is."

## 3. Overall Engineering Score — **6.5 / 10**

Server-side: 7.5 (mature, hardened, well-tested). Client-side: 5 (a 2,195-line web "god context" with ~254 fields, a 6,624-line mobile Today screen with 261 hooks, ~101 files over the 400-line non-negotiable, and a freshly-extracted shared helper that no host actually imports). Test breadth is genuinely good (935 test files, zero `@ts-ignore`). The gap between server discipline and client monoliths is the defining engineering risk — it directly obstructs adding the planned AI-coaching and health-integration surfaces cleanly.

## 4. Overall UX Score — **6.5 / 10**

The rendered product is visibly premium — warm Sloe palette, calm copy, confident typography, real confidence-tiered food search, a polished paywall. The token *system* is excellent. The drag is enforcement and consistency: a 2-way tab-order swap with a glyph collision (BookOpen = "Plan" on native, "Recipes" on web), 246 raw hex literals (14 genuinely off-palette), empty grey recipe thumbnails, and two surfaced data-trust contradictions (Plan says "hits targets 7/7" on a day that's over budget; Progress shows "111% adherence · over"). Best-in-class look, beta-grade consistency.

## 5. Overall Security Score — **6.5 / 10**

Auth, RLS scoping, secrets handling, webhook verification, and rate-limiting are mature (7.5 on their own). The score is pulled down by the P0 entitlement-escalation path (which is a *security* failure as much as a data one), the public-readable SECURITY DEFINER recipe view, and the reintroduced SSRF hole. None are exploited at N=1, but two of three are live in the production schema/route surface and must close before any real cohort.

## 6. Overall Nutrition Accuracy Score — **8 / 10**

The strongest pillar. The 2026-06-10 audit's P0 and all five P1 fixes genuinely landed in code with regression tests; core math is correct and parity-wired. One consequential miss — `calcGoalTimeline` still uses a raw two-point weigh-in delta to drive goal dates and to *override* the projection on both platforms — keeps this from a 9. Trustworthy engine; one input bug escaped the fix batch.

## 7. Overall Recipe Platform Score — **5 / 10**

Recipe *nutrition* can largely be trusted (curated staple table, confidence accept-floor, count-to-weight, density refusal). The score is dragged down hard by the legal P0 (verbatim prose persisted + no disclaimer + no DMCA agent) and real correctness gaps (cook-mode scaler silently desyncs step text from nutrition for countable items outside a hardcoded noun list; idempotent re-import returns stale nutrition). The import infrastructure is good; the *posture* around it is unfinished.

## 8. Overall Meal Planning Score — **6 / 10**

The planning spine works end-to-end (smart plan, joint-fit scaler, leftovers, templates, copy-meal, household shopping). But the shopping-list generator is implemented *twice* and the two disagree on portion scaling, non-numeric amounts, and aisle categorisation — same plan, different quantities and aisles on web vs mobile. No pantry/staples model, weak keyword categorisation (large "Other" bucket), no store integration. Adoptable as "a list from my plan," not yet as a primary grocery planner that would win a Plan To Eat / AnyList user.

---

## 9. Launch-Readiness Assessment

**Verdict: NOT READY to onboard real users. Conditional-go after the two P0s close + a focused P1 pass.**

- **What blocks launch (P0):** (1) DB entitlement-escalation; (2) recipe-import verbatim-prose copyright exposure (+ ENG-858 disclaimer, + ENG-859 DMCA agent as a paired legal dependency).
- **What will break first under real use:** vendor search (Edamam/USDA quota exhaustion the first time a TikTok lands traffic) → "search is broken" with no error shown. This is the most likely day-one support fire.
- **What will generate support tickets:** wrong shopping-list quantities on iOS (portion multiplier ignored); blank fibre in CSV export for mobile-logged foods; promo-code redemption possibly failing with 42501 for existing users (incl. Grace's own test-premium path).
- **What reduces trust:** Plan claiming "hits your targets 7/7" on a day that's over budget; "111% adherence · over"; goal dates that jump from a single water-weight weigh-in.
- **What a TDD/investor review flags:** the two P0s, the god-context/monolith client architecture, the unbuilt launch-blocker backlog, and the roadmap marking an unimplemented P0 as "LIVE."

**Recommended gate:** close the two P0s + the SSRF + the RLS view + add a vendor search cache, re-verify on-device, then onboard a small beta. The remaining P1/P2 work can run during beta.

---

## 10. P0 Findings (must fix before onboarding any user)

### P0-1 — Tier escalation via profile DELETE+INSERT (lockdown trigger is UPDATE-only) · `dataintegrity` · CONFIRMED (conf 8)
- **Category:** Security / entitlement integrity.
- **Description:** `profiles_tier_column_lockdown` is attached `BEFORE UPDATE ON public.profiles` only. `profiles_insert_own` checks identity with **no column restriction** (`WITH CHECK auth.uid()=id`), and `profiles_delete_own` lets a user delete their own row. So an authenticated user can `DELETE` their profile then `INSERT` a new one with `user_tier='pro'` (or an arbitrary `stripe_customer_id`) directly via `/rest/v1` using the client anon key — fully bypassing the lockdown.
- **Evidence:** `supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql:87-90` (`before update` only); `20260516150000_perf_rls_initplan_wrap_auth_calls.sql:221-222` (insert policy, no column guard); `20260419100001_profiles_delete_own.sql:2-4`; `docs/decisions/2026-05-25-onboarding-tier-lockdown-write-failure.md:58` ("the BEFORE-UPDATE trigger does not fire on INSERT"). Verifier confirmed the only trigger on `profiles` is the UPDATE one.
- **Impact:** Any user grants themselves Pro for free, defeating monetisation; also re-opens the `stripe_customer_id` association / Customer-Portal-hijack vector the trigger comment was written to close.
- **Recommendation:** Add a `BEFORE INSERT` branch (or separate trigger) that rejects any non-`service_role` INSERT where `new.user_tier` is distinct from `'free'` or `new.stripe_customer_id` is non-null. Run the forward-compat jsonb loop on INSERT too. Live-verify the delete+insert exploit is refused before launch.
- **Suggested issue:** *P0: profiles tier-lockdown bypass — `user_tier='pro'` via DELETE-then-INSERT (no BEFORE INSERT guard)*
- **AC:** A non-service-role INSERT setting `user_tier != 'free'` or non-null `stripe_customer_id` is rejected with `42501`; brand-new signups (defaults) still succeed; promo/webhook service-role writers unaffected.
- **Tests:** RLS integration test performing the delete+insert escalation and asserting rejection; pgTAP assertion that a `BEFORE INSERT` trigger exists on `public.profiles`.

### P0-2 — ENG-857 not shipped: verbatim creator prose still persisted + rendered (roadmap claims LIVE) · `recipe` · CONFIRMED (conf 9)
- **Category:** Legal / compliance (copyright).
- **Description:** `docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md` makes "set `recipes.description` null on import (keep parsing only for the macro-sanity check)" a P0 launch-blocker, naming the exact chain. The roadmap (`docs/product-roadmap.md:45`) marks it **"Open — P0 LIVE / shipping in prod now."** The code does **not** null the description: the web-scrape import branch returns the raw JSON-LD `description` verbatim, the persist layer inserts it unchanged, and both platforms render it. The only transform (`sanitizeRecipeDescription`) merely strips a legacy `[TEMP SEED]` admin prefix — no paraphrase.
- **Evidence:** `app/api/recipe-import/route.ts:614-744` (web-scrape branch returns `...parsed` with only `title` overridden; description not nulled); `parseRecipeFromHtml.ts:451-453` (decodes verbatim headnote); `apps/mobile/lib/saveImportedRecipe.ts:163` (`description: recipe.description ?? null`); `src/app/components/RecipeDetail.tsx:680,1748-1750` (renders it); `apps/mobile/app/recipe/[id].tsx:1598`; `src/lib/recipes/sanitizeRecipeDescription.ts:13-24` (only strips `[TEMP SEED]`). Verifier confirmed the full chain in current code.
- **Impact:** Copyright reproduction of creative headnote prose (Publications Int'l v. Meredith, 7th Cir. 1996; UK CDPA) on the live server-fetching web path, with DMCA safe harbour not yet effective (ENG-859 open). The false "LIVE" roadmap status means this could be ticked off the launch gate without anyone implementing it.
- **Recommendation:** At the import-route boundary set web/blog `description: null` (keep `parsed.description` only as input to `extractCaptionNutrition` for the macro sanity check — that call already exists at `route.ts:739`). Mirror on the social website-fallback branch (`route.ts:326`). Confirm both persist layers cannot receive prose. Correct the roadmap row to "Open." Pair with P1-RECIPE-2 (disclaimer) and ENG-859 (DMCA agent).
- **Suggested issue:** *ENG-857 regression: web/blog import still persists + renders verbatim creator description (P0 launch-blocker not actually shipped)*
- **Tests:** Integration test asserting a web URL with a JSON-LD `description` returns `recipe.description === null`; persist-path unit test; render test asserting no headnote for imported (non-first-party) recipes.

---

## 11. P1 Findings (fix before broader beta)

> Verification adjusted four originally-P1 items to P2 (see §12): middleware auth round-trip, dead-code `foodSelectionToMeal.ts`, grocery-category divergence, off-palette hex literals. The eight that held at P1:

### P1-1 — SECURITY DEFINER view `recipes_implausible_macros` bypasses RLS, readable by anon+authenticated · `security` · CONFIRMED (conf 9)
- The live DB has `public.recipes_implausible_macros` defined `SECURITY DEFINER` (Supabase advisor lint 0010 = **ERROR**), selecting `id, title, author_id, macros …` from `recipes` with **no** `published=true`/`author_id=auth.uid()` filter. `relrowsecurity=false`; `information_schema` grants show `SELECT` for both `anon` and `authenticated`; PostgREST exposes it at `/rest/v1/recipes_implausible_macros`. Any signed-in user — or anyone with the bundled anon key — can read every user's matching recipes including private unpublished drafts. **0 rows today**, but a single import-parsed draft with implausible macros (routine) makes that draft world-readable.
- **Evidence:** Live security advisor (project `fnfgxsignmuepshbebrl`), `pg_get_viewdef`, `information_schema.role_table_grants`, `pg_class.relrowsecurity=false`; intended boundary `20260516150000_perf_rls_initplan_wrap_auth_calls.sql:286-287`.
- **Fix:** Drop the view (if maintenance-only — no app path SELECTs it) or recreate `WITH (security_invoker = true)` AND `REVOKE SELECT FROM anon, authenticated`. Re-run advisor to clear the 0010 ERROR. Stage SQL; Grace runs `supabase db push --linked`.

### P1-2 — Recipe-import caption fallback uses `fetch(redirect:"follow")` — reintroduces ENG-682 metadata-SSRF · `security` · CONFIRMED (conf 8)
- The route has a hardened SSRF helper (`followWithSsrfGuard`, per-hop DNS re-validation) but two sites bypass it. Worst: the Tier-4 caption-link fallback at `app/api/recipe-import/route.ts:271-279` does `fetch(linkUrl, { redirect: "follow" })` after only an *initial* `isAllowedUrl(linkUrl)` string check. `linkUrl` comes from the caption of a user-pasted social post, so an attacker page can 302-redirect to `http://169.254.169.254/latest/meta-data/` (IMDS) or an internal host, and the body is fetched + parsed with no per-hop recheck. Separately the main hop loop at `:590-606` re-checks `isAllowedUrl` but never calls `resolveDnsAndValidate`, leaving DNS-rebinding (ENG-730 TOCTOU) unmitigated.
- **Fix:** Replace the `:272` fetch with `followWithSsrfGuard`; never use `redirect:"follow"` on user-supplied URLs; add `resolveDnsAndValidate` to the `:591` loop. Add a CI grep guard failing on `redirect: "follow"` in that route.

### P1-3 — No cross-request vendor cache: Edamam (1,000/day account-wide) + USDA (~1,000/hr) exhaust in minutes at viral scale · `vendor` · CONFIRMED (conf 8)
- Every debounced food-search keystroke fans out **four** live vendor calls per user with no server-side cross-request cache (`apps/mobile/lib/verifyRecipe.ts:964-967`; grep for `unstable_cache|revalidate|lru|redis` across all four vendor dirs/routes returns nothing). Route limits are **per-user only**. Edamam free tier is 1,000 req/day *account-wide* (`src/lib/edamam/client.ts:6`); USDA standard key ~1,000/hr. A few hundred concurrent searchers burn the shared quota in minutes, after which Edamam/USDA silently return `[]` and search degrades for everyone, invisibly.
- **Fix:** Short-TTL server-side cache (24h, per-vendor, normalised query) in front of all four search routes — food queries are highly repetitive (high hit rate). Add an account-level circuit-breaker/daily budget that degrades gracefully and emits one ops alert. Confirm USDA prod key tier; budget Edamam Pro spend explicitly (uncapped 4-calls-per-keystroke = unbounded cost line).

### P1-4 — `calcGoalTimeline` weekly rate is a raw two-point delta — drives goal DATES and OVERRIDES projection, both platforms · `nutrition` · CONFIRMED (conf 8)
- `calcGoalTimeline` computes `weeklyRateKg` from raw first-vs-last weigh-in in a 28-day window (no smoothing), then (a) sets the days-to-goal date and (b) feeds `projectWeight()`'s `observedKgPerWeek`, which **overrides** the formula projection when `|rate| >= 0.05`. Raw scale weight swings 1–2 kg/day; one noisy endpoint distorts the goal date and trajectory. This is the identical class ENG-1026 just smoothed for the on-track tile — and the ENG-1026 doc *incorrectly* claims mobile has "no parallel bug." `daySpan` floored at 1 means two weigh-ins a day apart with a 0.8 kg swing yield a 5.6 kg/week rate.
- **Evidence:** `src/lib/weightProjection.ts:557-574` (raw two-point), `:568` (daySpan floor), `:278-283`/`:368-376`/`:184-205` (override path); callers on web ProgressDashboard/Targets/trajectory-card + mobile progress/TrajectoryCard; contrast the fixed `weightTrendTile.ts:115-159` EMA. ENG-1026 doc claim at `docs/decisions/2026-06-11-nutrition-audit-p1-fixes.md:54-58`.
- **Fix:** Reuse the ENG-1026 interpolate-to-daily + EMA (or least-squares like `adaptiveTdee.ts`); require ≥3 weigh-ins and a ≥7-day span before trusting the rate; correct the ENG-1026 doc.

### P1-5 — Mobile shopping list ignores portion multiplier; web scales by it · `mealplan` · CONFIRMED (conf 9)
- Shopping generation is implemented twice. Web multiplies ingredient amounts by `effectivePortionMultiplier(m.portionMultiplier)`; mobile counts plain recipe occurrences only and never reads `portionMultiplier`. A planned meal at 2× buys 2× on web, 1× on mobile — under-buying on the primary (iOS) surface.
- **Evidence:** `apps/mobile/app/(tabs)/planner.tsx:1939-1978` (recipe counts only); `src/context/AppDataContext.tsx:1241-1244` + `src/lib/planning/generateShoppingList.ts:20-28` (portion-scaled).
- **Fix:** Delete the inline mobile generator; route mobile through the shared `generateShoppingListFromRecipeEntries`/`mergeRows` (already async-capable). Parity by construction.

### P1-6 — Mobile food-search logs persist `fiber_g = NULL` → blank fibre in CSV export (web differs) · `foodlogging` · CONFIRMED (conf 9)
- Web sets top-level `mealFiberG` and persists `fiber_g`; mobile never sets a top-level `fiberG` (fibre lives only in the micros map) so `persistMealsImmediate` writes `fiber_g: null`. Daily totals stay correct via `mealContributedFiberG`'s micros fallback, **but the web CSV export reads `fiber_g` directly** (`Settings.tsx:658`) with no fallback — so the same food exports real fibre when logged on web and blank fibre when logged on mobile. MFP-refugees (the launch cohort) value data portability; iOS is the primary surface.
- **Evidence:** `apps/mobile/app/(tabs)/index.tsx:2172,2183,517`; `src/app/components/NutritionTracker.tsx:1672,1699`; `src/context/appData/useNutritionJournalState.ts:155`; `src/app/components/Settings.tsx:658`; fallback only at `src/lib/nutrition/microNutrientDisplay.ts:15-19`.
- **Fix:** Mobile sets top-level `fiberG` on food-search meals (mirror web); standardise in the shared helper; make CSV export use `mealContributedFiberG` defensively so historical rows backfill.

### P1-7 — Required import source-card disclaimer (ENG-858) does not exist anywhere · `recipe` · CONFIRMED (conf 8)
- ENG-858 (launch-blocker) requires a verbatim disclaimer on every imported recipe with a `source_url` ("Recipe imported for your personal cookbook. Ingredients and nutrition are estimated by Suppr and may differ from the original. Not affiliated with or endorsed by {source_name}."). A full-codebase search for any fragment returns **zero** matches. Compounds P0-2: the recipe shows creator prose AND a Suppr-calculated nutrition panel with no estimate/non-endorsement notice.
- **Fix:** Add the exact decision-doc string to the SOURCE card on both `RecipeDetail` surfaces, gated on `source_url`, as a shared constant. Render test for presence/absence.

### P1-8 — `redeem_promo_code` ON CONFLICT DO UPDATE of `user_tier` likely rejected by the lockdown trigger for existing users · `dataintegrity` · CONFIRMED (conf 5)
- `redeem_promo_code` (SECURITY DEFINER) does `INSERT … ON CONFLICT (id) DO UPDATE SET user_tier`. For any user who already has a profile (everyone, post-signup), the ON CONFLICT path runs an UPDATE that fires the `BEFORE UPDATE` lockdown trigger. The lockdown header *claims* SECURITY DEFINER makes `auth.role()` return `service_role`, but `auth.role()` is JWT-derived (proven by the 2026-05-25 doc), and the function never does `set local role`. If correct, **every promo redemption against an existing profile fails with 42501** — including Grace's `SUPPR_TEST_PREMIUM` path and any launch promo.
- **Evidence:** `20260407220000_redeem_promo_idempotent.sql:37-45`; `20260503100000_profiles_tier_column_lockdown.sql:25-27` vs `60-69`; `docs/decisions/2026-05-25-…:27-30`; `apps/mobile/hooks/usePromoCode.ts:116-121`. (conf 5 — needs a live-DB redemption test to confirm.)
- **Fix:** Make `redeem_promo_code` bypass the trigger explicitly (service-role-scoped write, or a GUC the trigger detects). Live-verify redemption against an existing profile. Reconcile the lockdown header comment with real `auth.role()` behaviour.

### P1-9 — Primary tab order diverges 2 ways + a glyph collision across native vs web · `designux` · CONFIRMED (conf 9)
- Native iOS = Today·**Plan·Recipes**·Progress; both web surfaces = Today·**Recipes·Plan**·Progress. Plus an icon mismatch: native Calendar/BookOpen/Utensils vs mobile-web Sun/CalendarDays/BookOpen — so **BookOpen means "Plan" on native but "Recipes" on web.** Violates "web and mobile must stay in sync." Native's own comment defends Plan-first, so this is a stale unreconciled decision never propagated to web.
- **Evidence:** `apps/mobile/app/(tabs)/_layout.tsx:148-202`; `src/app/components/suppr/desktop-sidebar.tsx:112-133`; `src/app/App.tsx:676-679`; flagged in `docs/ux/reviews/2026-06-10-fresh-eyes/design-director-review.md:102,113`.
- **Fix:** Pick one canonical order (adopt native Plan-first — it has a documented test rationale) + one glyph set; apply to both web surfaces in one flag-gated change; parity test on the three nav definitions.

### P1-10 — COMPETITIVE: the recipe-import-from-Reel wedge is real but its web path carries the live legal P0 · `designux` · CONFIRMED (conf 8)
- Suppr's defensible position vs both nutrition apps (no recipe layer) and recipe apps (no goals/health layer) is "import the Reel recipe AND fit it to your macros." The infrastructure is genuinely built and the **social** path is documented as compliant and stronger than ReciMe. The **web/blog** path is the P0-2 exposure. Launching the viral push while the web path replays verbatim prose with no DMCA safe harbour is the single biggest non-engineering launch risk.
- **Fix:** Lean the launch on the social import path; close ENG-857/858/859 before turning on growth. Legal-lane dependency that gates the headline feature.

---

## 12. P2 Findings (important improvements)

**Downgraded from P1 by verification:**
- **Middleware runs `supabase.auth.getUser()` (network round-trip) on every request before the `isPublic` short-circuit** (`middleware.ts:101-111`), including all `/api/*` and public marketing pages — couples all traffic (incl. cold TikTok landing) to Supabase Auth latency/availability. Move the call after `isPublic`; drop `/api/*` from the matcher (routes self-authenticate).
- **`foodSelectionToMeal.ts` is dead code** — the new "single source of truth" helper is imported by zero hosts; both mobile and web still run inline copies that have already drifted (per-serving `fiberG` differs). Wire both hosts to it or don't commit it.
- **Grocery categories diverge web vs mobile** — `guessGroceryCategory` {Protein,Dairy,Grains,…} vs mobile inline {Meat & Fish, Dairy & Eggs,…}; same egg → different aisle; households see two structures. Route mobile through the shared categoriser.
- **14 off-palette hex literals (Tailwind slate/red/amber) in live render paths** incl. the AI-log confidence chip (core logging flow), `NutritionSourceBadge`, `RootErrorBoundary` — won't shift if Sloe hues re-tune; won't dark-mode correctly. Add semantic tokens + a no-raw-hex lint.

**Native P2s:**
- **Web AppDataContext god context** — 2,195 lines, ~254 fields in one memoized value consumed by 20 components; every field change re-renders all. Split into domain contexts or a selector store.
- **Mobile Today = 6,624-line component, 261 hooks** — worse than the ENG-703 baseline; effectively untestable. Continue the `useTrackerScreen()` extraction.
- **fal.ai image-gen sits outside the AI cost circuit-breaker** — no global spend cap (`src/lib/server/falImageGenerator.ts`). Route through the reserve/commit budget or add a fal daily £ counter.
- **FatSecret %DV→absolute micros has no runtime plausibility guard** — a v1→v2 API format change would silently inflate ~13×; vitamin-A unit basis (mcg RAE) is not guaranteed per food. Add a per-micro plausibility ceiling; prefer USDA/OFF micros.
- **FatSecret per-100g reconstruction defaults to 100 g serving mass when grams unknown** (`verifyIngredients.ts:876`) — mislabels per-serving as per-100g. Skip the candidate or carry as per-serving instead.
- **OFF text-search fetch has no timeout** (`searchProducts.ts:65-73`) — an OFF outage stalls the whole 4-vendor merge. Add `AbortSignal.timeout(5000)`.
- **Conflicting vendor macros are never reconciled** — both panels shown side by side with no agreement check. Keep per-source rows but warn when same-named rows disagree beyond tolerance.
- **Web single-meal log & delete don't roll back the optimistic UI on persist failure** (`useNutritionJournalState.ts:196-205`) — phantom row / overstated totals; the bulk path and mobile both roll back. Mirror the rollback.
- **Multi-add basket (ENG-1042) wired into FoodSearchPanel but no host commits it** — feature has no working path. Don't enable `onAddToBasket` until the batch-commit exists.
- **Cook-mode scaler desyncs step text from scaled nutrition** for countable items outside a hardcoded noun list (`recipeScale.ts:254-274` omits shallot, mushroom, courgette, prawn, leek…). Drive count-noun recognition from the estimator's vocabulary.
- **`split_recipe_total` offline fallback fabricates a fixed 15/55/30 macro split with no `isCoerced` guard** (`allocateIngredientMacrosFromLines.ts:78-91`) — could be journaled as real. Add a `fabricated` flag and audit consumers.
- **Weak keyword-only grocery categorisation** dumps most ingredients into "Other" (`category.ts` ~30 keywords). Expand the lexicon; measure "Other" rate.
- **No pantry/staples model** — planner re-buys salt/oil/spices weekly. Add a per-user/household pantry the generator subtracts.
- **Mobile fabricates quantity "1" for non-numeric amounts; web preserves the raw token** — resolved by routing mobile through the shared generator.
- **Move-meal is mobile-only** (ENG-699) — web Plan has only same-slot Swap; `moveMealInPlan` is already shared/tested. Wire it into web.
- **No visible unique constraint on `saves(user_id, recipe_id)`** — duplicate-row + free-tier-count risk; inserts use plain `.insert` with no `onConflict`. Confirm live schema; add `unique index concurrently` if absent.
- **Dark-mode parity gaps** on Weekly Recap / Log-a-meal CTA + Shopping badge — fixed accent instead of dark token. Audit `useAccent()`/`useThemeColors()` call sites.

---

## 13. P3 Findings (future / polish)

- Weekly-recap cron caps at 5,000 **unordered** rows with no pagination (`weekly-recap/route.ts:99`) — silently drops users past the cap; add `.order("id")` + cursor pagination.
- 40 API routes share auth/rate-limit/budget by copy-paste with no `withRoute` wrapper — inconsistency risk as routes grow.
- `save_verified_ingredients` exists live with mutable `search_path` (contradicts the ENG-557 migration that declared it non-existent) and filters by `id` only (no `author_id` predicate) — set `search_path` + add an author check.
- Supabase Auth **leaked-password protection (HIBP) is disabled** (advisor WARN) — one dashboard toggle (founder action).
- `getUserIdFromRequest` does a network JWT verify on every call — fine now; add a short-TTL token→userId cache at scale.
- Nutrient panel sorts %DV **descending** while its comment claims deficiencies bubble to the top (`fullNutrientPanel.ts:17-19` vs `:214-224`) — code/comment contradiction.
- Stale `measureToGrams` docstring contradicts the shipped ENG-701 reorder.
- Activity-bonus macro scaling inflates **protein** along with carbs/fat, diluting the body-weight protein anchor (`scaleMacroTargetsForCalorieBudget.ts:21-26`).
- FatSecret macro-cache scrub is hardcoded ON regardless of `FATSECRET_TIER=premier` — zeroes cacheable Premier data, forcing redundant re-fetches.
- Imported-recipe idempotency keyed on `source_url` returns a stale prior import with possibly worse nutrition — distinguish "already imported" from "newly saved."
- Same ingredient in different units never consolidates in persisted rows (display-only grouping exists).
- ~101 files exceed the 400-line non-negotiable; `planner.tsx` 4,455 / `SettingsBundleContent.tsx` 3,828 / `NutritionTracker.tsx` 2,671. Add a pre-commit warn on net-new lines to >400 files.
- Token hex-literal debt is **246** in mobile vs ENG-1014's cited 188 — re-baseline + lint.
- `weekly_recap_push_delivered` analytics event defined but never emitted, with a dangling "see TODO" (violates the no-silent-deferrals rule).
- `AppDataContext` (2,195 lines, core shared state) has **no direct test**; 11 `as any` casts.
- `nutrition_entries.source` CHECK is `NOT VALID` — historical rows unverified; validate after an audit query.
- `nutrition_entries.calories` / `meal_plan_meals.calories` are **smallint** — overflow risk on malformed/high-portion imports; widen to integer.
- Wholesale DELETE of curated recipes (`20260514100000`) destroys user saves/cook-history/plan links with no remap — document an update-in-place rule before real users.
- Redundant duplicate user-leading indexes on `nutrition_entries`.
- Stranded duplicate `EmptyState` migration — two diverging primitives in parallel use.

---

## 14. Architecture Findings (score 6/10)

Server-side is mature: signature-verified idempotent webhooks; constant-time cron-secret auth; a per-user+IP rate limiter that **fails closed in prod**; a two-layer AI cost circuit-breaker (reserve/commit/release with a documented fail-open→fail-closed window); server-side PostHog kill-switches with a fail-safe; Sentry wired via `src/instrumentation.ts` `onRequestError`. The weak axis is the **client/state layer**: a 2,195-line web god context (no mobile equivalent — the two state architectures have structurally diverged), a 6,624-line mobile Today screen, ~101 files over the 400-line rule. Cross-cutting scaling assumptions to fix: the middleware auth round-trip (§12), the 5,000-row unordered cron cap (§13), and fal image-gen outside the budget guard (§12). None block N=1, but the god-context + monoliths directly obstruct adding AI coaching / Apple Health / Oura cleanly. **Future-capability readiness:** the data model and server boundaries support subscription tiers, barcode, image recognition, and health integrations; the client architecture is what will make each addition expensive.

## 15. Code-Quality Findings (score 6/10)

Strong test breadth (935 test files; all critical nutrition libs have named tests) and type discipline (zero `@ts-ignore`/`@ts-expect-error`). Maintainability is the weak axis: the 400-line non-negotiable is violated ~101 times; the worst offender (`(tabs)/index.tsx`, 6,624 lines, one 6,217-line function, 261 hooks) is effectively untestable. The most telling smell: a freshly-extracted, fully-tested shared helper (`foodSelectionToMeal.ts`) that **no host imports** — both platforms still run inline copies, so the "single source of truth" is dead code and the real source of truth is two drift-prone duplicates. Token-hex debt (246) is worse than the cited 188. One analytics event is defined-but-never-emitted with a stale TODO cross-ref. **Recommendation:** wire-or-delete the helper this week; add a pre-commit line-budget warn; land a no-raw-hex lint so the count can only fall.

## 16. Security Findings (score 6.5/10)

See §10 (P0-1), §11 (P1-1, P1-2, P1-8), §13. **Strengths:** consistent `getUserIdFromRequest` (bearer/cookie), `assertOrigin` CSRF on state-changers, service-role always scoped to a verified `userId`, comprehensive self-only RLS, household reads correctly mediated through service-role + a `share_targets` consent gate, both webhooks verifying signatures + replay/dedup. **Gaps:** the entitlement-escalation P0, the public SECURITY DEFINER recipe view, the reintroduced SSRF, plus WARN-level advisor items (leaked-password protection off, mutable `search_path` on 2 functions, `save_verified_ingredients` author-check drift). The hardening trail is real; the open items are latent-but-live and must close before a real cohort.

## 17. Food-Logging Findings (score 6/10)

Core logging math is solid and well-guarded (shared per-serving/per-100g predicate; centralised caffeine/alcohol/micros scaling; portion-edit rescaling of fibre/micros consistent with the four macros). The walkthrough confirmed a genuinely premium search experience (Verified/Estimated confidence tiers, per-serving macros with grams, Past-logged section, copy-yesterday, barcode/voice/camera affordances). Issues: the dead-code SoT helper (§12), the mobile `fiber_g=NULL` export divergence (P1-6), the no-rollback web single-insert/delete (§12), and the wired-but-uncommittable multi-add basket (§12). No P0 — none corrupt stored math — but the fibre-export divergence and dead SoT should clear before beta. **Edit/delete flows** (eaten_at editing ENG-772, portion-edit micros ENG-784) are tracked but partially open.

## 18. Nutrition-Engine Findings (score 8/10) — mission-critical

The 2026-06-10 audit and 2026-06-11 P1-fixes doc are accurate and their fixes **landed**: the P0 adaptive-TDEE slope bias is gone (least-squares slope + ±0.35 kg/wk cap + completeness gate + plausibility clamp, 23 tests incl. the "0.5 kg/wk recovers ~550 not ~130" regression); all five P1s (ENG-1025→1029) are present, parity-wired, and tested. Core math (Mifflin-St Jeor, Atwater 4/4/9, FDA DVs, largest-remainder macro %, count-to-weight, net carbs, the 7700 kcal/kg projection horizon guard) is correct. **The one consequential new finding** is P1-4 (`calcGoalTimeline` raw two-point delta driving dates + overriding projection). Remaining items are the P3 panel-sort contradiction, FatSecret %DV guard (§12), activity-bonus protein dilution (§13), and a stale docstring. **Recommended new tests:** the §11 P1-4 water-spike fixtures; a property test that daily/meal/recipe totals equal the sum of parts under arbitrary portion multipliers; a cross-surface test that web and mobile produce byte-identical macros+micros for the same `SelectedFood`.

## 19. Vendor-Integration Findings (score 7/10)

Unusually well-engineered for correctness: per-100g basis reconciliation for OFF serving-basis rows; post-scale Atwater + plausibility guards on every commit; zero-macro FatSecret stub rejection; an honest confidence/accept-floor model that excludes sub-threshold rows from totals. Source precedence is trust-weighted (verified USDA > branded/commercial) and deliberately de-dupes per-source so the user can pick between conflicting panels — sound UX, but it means conflicting macros are never *reconciled*, just shown (§12). The launch-relevant gaps are **economic, not arithmetic**: no cross-request cache (P1-3) and no OFF timeout (§12). **Trust verdict:** the resulting nutrition data is trustworthy; the integration's weak points are outage resilience and cost/quota scalability at the explicitly-targeted viral scale.

## 20. Recipe-Platform Findings (score 5/10) — core pillar

Recipe *nutrition* can largely be trusted (curated staple table, confidence accept-floor, count-to-weight, raw/cooked + unparseable flags, density-refusal returning 0 g rather than guessing ml→g). Scaling is bounded and clamps pathological input. Import is robust to malformed input (typed errors, SSRF guard, title-caption-leak sanitiser, JSON-LD defensiveness). The pillar is dragged to 5 by the **legal P0** (P0-2 + P1-7 disclaimer + ENG-859 DMCA), the cook-mode scaler step/nutrition desync (§12), the fabricated-split journaling risk (§12), and the stale-nutrition idempotent re-import (§13). The walkthrough also surfaced the **generic "Imported recipe" fallback title** (`saveImportedRecipe.ts:107`, `create-recipe.tsx:458`, `import-shared.tsx:411`) — power users importing many recipes get collisions/clutter — and empty grey thumbnails on library rows (ENG-1015). **Power-user scalability:** organisation is thin (8-recipe library tested; no collections/folders surfaced in the walkthrough beyond category chips).

## 21. Meal-Planning Findings (score 6/10)

The spine works end-to-end and the walkthrough confirmed a polished Plan surface ("Hits your targets 7 of 7 days," per-day macro chips, Generate/Adjust constraints, 7-day strip). Core problems: the **double-implemented shopping generator** (P1-5 portion multiplier + §12 categories + §12 non-numeric amounts), no pantry model, weak categorisation, move-meal web gap, no cross-unit consolidation, no store integration. **A serious meal planner (Plan To Eat / AnyList) would not yet switch** — they'd hit the pantry gap and the aisle inconsistency immediately. **Walkthrough trust flag:** the Plan headline "Hits your targets 7 of 7 days / All 7 days land on target" rendered above a Thursday at **1,301 / 1,231 kcal (over by 70)** with all macros "On track" — a visible self-contradiction (tolerance bands exist but the headline overstates).

## 22. Design-System & UX Findings (score 7/10)

The Sloe token system is genuinely well-architected: a 6-hue semantic palette with documented per-hue AA contrast math, a 4px scale (+12px dense step), a tight radius ladder, a typed Type ramp, and disciplined mobile↔web token mirroring. **The problem is enforcement, not design** — the team's own 2026-06-10 census found 875 off-scale spacing literals, 246 hex literals, 30+ radius violations, all breaching "Tokens only." Plus the tab-order/glyph divergence (P1-9), the stranded duplicate `EmptyState` (§13), and dark-mode CTA parity gaps (§12). **Surfaced data-trust UX issues from the walkthrough:** "111% adherence · over" (uncapped `(avg/target)*100` at `progressRangeStats.ts:161` — overconsumption produces a *bigger* "adherence" number, semantically backwards as a headline); the Plan 7/7 contradiction; deep links don't dismiss an open Log-sheet modal (navigation happens underneath). **Where Suppr is genuinely ahead:** the ~37-field micronutrient panel (Cronometer-tier), the adaptive-TDEE + meal-coach insights layer, and the recipe-import wedge.

---

## 23. Competitive-Analysis Findings

**Nutrition (MFP, Cronometer, MacroFactor, Lose It, Lifesum, Yazio, MyNetDiary, Foodvisor, Zoe):**
- *Ahead/at-par:* micronutrient depth (~37 fields, Cronometer-tier); confidence-tiered honest search (most apps hide uncertainty); adaptive-TDEE (MacroFactor's signature feature — Suppr has a credible version). **Free barcode + free custom macros** are MFP-switch wins (GROW-19) MFP recently paywalled.
- *Behind:* food DB breadth at scale is quota-bound (P1-3); no image-recognition logging (Foodvisor/Cal AI) yet; restaurant logging thin.
- *Highest-leverage:* ship the vendor cache + merchandise "barcode free forever" (ENG-973) — directly converts MFP refugees.

**Recipes (Paprika, Crouton, ReciMe, Pestle, Mela, NYT Cooking, SideChef):**
- *Ahead:* recipes carry **macro fit to your day** — Paprika/Crouton/ReciMe have no goals layer. Social-caption import is documented as legally stronger than ReciMe.
- *Behind:* organisation (collections/folders/tags), cooking-mode polish, and the legal posture (P0-2). Generic "Imported recipe" titles read worse than Paprika's parsing.
- *Highest-leverage:* close the legal P0 and lean on social import; add collections for power users.

**Meal Planning (Plan To Eat, AnyList, Mealime, Samsung Food, Cooklist, Tandoor):**
- *Ahead:* macro-fit auto-planning + leftovers distribution is more goal-aware than AnyList/Plan To Eat.
- *Behind:* pantry/staples, aisle customisation, cross-unit consolidation, store integration, web move-meal — table stakes for this category.
- *Highest-leverage:* pantry model + the shared-generator unification (P1-5).

**Health & Insights (Oura, Whoop, Levels, Zoe, Lifesum):**
- *Ahead for a nutrition app:* the "what to eat next" meal-coach + maintenance/adaptive-TDEE narrative is a real insights layer recipe apps lack.
- *Behind:* no wearable integration yet (Apple Health partial; Oura/Garmin/Fitbit aspirational).
- *Highest-leverage:* Apple Health energy reconciliation (already partially built; ENG-793 flags the check-in burn ignoring measured energy).

**The uncopyable wedge:** import the Reel recipe AND fit it to your goals — Cal AI can't (no recipe layer), MacroFactor won't (no import), Paprika/ReciMe have no goals layer. This is the moat; it is gated by the legal P0.

---

## 24. Linear Backlog Assessment

250 open issues. The backlog is well-structured (initiatives, `launch-blocker` label, parity labels) but has three problems this audit surfaces:

1. **Priority inversion on the legal P0.** ENG-857 is filed as **P1** and the roadmap marks it **"LIVE."** It is an unimplemented **P0**. ENG-858 (disclaimer) and ENG-859 (DMCA agent) are paired launch dependencies. → Re-prioritise ENG-857 to P0; correct the roadmap row to "Open."
2. **No issue for the entitlement-escalation P0** (P0-1) — it is net-new and the single highest-severity finding. → File immediately.
3. **The "category-leading" tranche (ENG-927→979) is large, launch-blocker-labelled, and mostly Backlog/unbuilt** — multi-add, NL text logging, paywall comparison matrix, "what to eat next" Today block, per-meal lock, forecast line, trend-weight hero, attributed-creator credit, shareable import card. These are growth-quality features, not launch blockers. → Re-classify: launch-blockers = the two P0s + ENG-859 + the SSRF/RLS/cache items; everything else is beta-window.

**Obsolete/duplicate signals:** ENG-814/815 are near-identical (food-search redesign duplicated); ENG-883 flags stale tests from an old over-budget-ring rule. **Correctly tracked and real:** ENG-703 (Today decomposition), ENG-699 (web move-meal), ENG-771/772/784 (logging-loop parity), ENG-828/1013/1014 (token debt) — all corroborated by this audit.

## 25. Recommended New Issues

1. **P0:** profiles tier-lockdown bypass — `BEFORE INSERT` guard + column check (P0-1).
2. **P0:** ENG-857 regression — null persisted web/blog `description`; correct roadmap (P0-2). *(re-prioritise existing)*
3. **P1:** Drop/`security_invoker` `recipes_implausible_macros` + revoke anon/auth SELECT (P1-1).
4. **P1:** Route all recipe-import fetches through `followWithSsrfGuard`; ban `redirect:"follow"` (P1-2).
5. **P1:** Cross-request vendor search cache + account-level quota guards (P1-3).
6. **P1:** `calcGoalTimeline` — smooth the weekly rate; gate on ≥3 weigh-ins; fix the ENG-1026 doc (P1-4).
7. **P1:** Route mobile shopping list through the shared generator (portion multiplier + categories + amounts) (P1-5).
8. **P1:** Mobile food-search logs persist `fiber_g`; CSV export uses micros fallback (P1-6).
9. **P1:** Add the ENG-858 import source-card disclaimer, both platforms (P1-7).
10. **P1:** Fix `redeem_promo_code` vs lockdown trigger; live-verify redemption (P1-8).
11. **P1:** Lock tab order + glyphs across all three nav surfaces (P1-9 / ENG-1017).
12. **P2:** Move middleware `getUser()` after `isPublic`; drop `/api/*` from matcher.
13. **P2:** Wire `foodSelectionToMeal.ts` into both hosts or delete it.
14. **P2:** Generic "Imported recipe" title — derive a better fallback from source domain/first ingredient.
15. **P2:** Web single-insert/delete optimistic rollback on persist failure.
16. **P2:** "Average adherence" / "hits targets 7/7" headline grammar — don't read >100% / over-budget as success.
17. **P2:** fal image-gen under the AI cost budget guard.
18. **P2:** Pantry/staples model for the planner.
19. **P3:** Widen `calories` smallint → integer; validate `nutrition_entries.source` CHECK; `save_verified_ingredients` search_path + author check; enable HIBP password protection.

## 26. Recommended Implementation Order

**Gate 0 — launch blockers (do not onboard until done, ~2–3 days):**
P0-1 (tier lockdown) → P0-2 + P1-7 + ENG-859 (recipe legal bundle) → P1-1 (RLS view) → P1-2 (SSRF). All are small, bounded DB/route changes. Re-verify on-device + re-run the Supabase security advisor (target: zero ERROR lints).

**Gate 1 — before broader beta (~3–4 days):**
P1-3 (vendor cache) → P1-5 + P1-6 (parity: shopping + fibre) → P1-4 (goal-timeline smoothing) → P1-8 (promo verify) → P1-9 (tab order). Then the §12 P2 cluster that touches trust (rollback, adherence grammar, Plan 7/7 copy).

**Gate 2 — during beta (ongoing):**
Client-architecture paydown (god context, Today monolith), token-drift lint, pantry model, move-meal web parity, the category-leading growth tranche selectively.

## 27. Recommended Test Strategy

- **Entitlement RLS suite (new, highest priority):** the delete+insert escalation must be refused; promo redemption against an existing profile must succeed; pgTAP assertion that `BEFORE INSERT` + `BEFORE UPDATE` triggers both exist on `profiles`.
- **Recipe-import legal suite:** web/blog import persists `description=null`; social import unchanged; disclaimer renders iff `source_url`; no headnote rendered for imported recipes.
- **SSRF suite:** a caption-link 302 → `169.254.169.254` is refused (no body fetched); DNS-rebinding second-hop private IP rejected; CI grep guard on `redirect:"follow"`.
- **Cross-platform parity suite (the recurring failure class):** byte-identical macros+micros for the same `SelectedFood` (web vs mobile vs the shared helper); identical shopping rows (name/amount/unit/category) for the same plan incl. portion-scaled meals; identical `fiber_g` and CSV fibre column; identical tab `[id,label,icon]` tuples across the three nav definitions.
- **Nutrition projection suite:** P1-4 water-spike fixtures (clean 0.5 kg/wk loss + a last-day +1.5 kg spike must keep `trendDirection='losing'` and `daysToGoal` within ~10%); two weigh-ins one day apart with a 0.8 kg swing must not yield `|weeklyRateKg| > ~1.5`.
- **Vendor resilience suite:** cache returns repeats without a second fetch; Edamam 429 still returns merged USDA/OFF/FatSecret; warm cache stays under account daily quota under simulated concurrency.
- **Golden visual-regression (ENG-827):** lock Today/Recipes/Plan/Progress on web + mobile, light + dark, before the launch ramp.

## 28. Biggest Long-Term Risks

1. **Client architecture debt (god context + 6,624-line Today).** Every planned surface (AI coach, Apple Health, Oura, family accounts) lands on top of an untestable monolith. This compounds; pay it down before the feature surface doubles.
2. **Vendor economics at viral scale.** 4 uncached calls per keystroke per user against free/shared quotas is both a reliability and an unbounded-cost risk. The growth plan and the integration are in direct tension until the cache + budget guards exist.
3. **Recipe-import legal posture.** The wedge and the liability are the same surface. As import volume grows, takedown/right-of-publicity exposure grows with it unless the social-path-first + disclaimer + DMCA posture is enforced in code, not docs.
4. **Parity drift as a recurring class.** Shopping, fibre, tab order, food-logging math all drifted because the same logic is implemented twice. Without shared-source enforcement (and parity tests), this regenerates every sprint.
5. **Roadmap/code truth drift.** A P0 marked "LIVE" that isn't implemented is a process failure that a launch gate should have caught. Tie roadmap status to a passing test, not a manual flag.

## 29. Open Questions

- **P1-8 (conf 5):** does `redeem_promo_code` actually fail with 42501 for existing profiles on the live DB? Needs a live redemption test before it can be confirmed or closed.
- **`saves(user_id,recipe_id)` uniqueness:** the constraint may exist in pre-migrations dashboard DDL not visible in-repo — confirm via `list_tables`.
- **`handle_new_user` / profiles defaults / saves table** originate in dashboard DDL; several data-integrity items are marked lower confidence pending a live-schema read.
- **AI coach on the paywall:** advertised as a Pro feature ("personalised, guilt-free nudges"). `mealCoach.ts` exists ("what to eat next") — confirm the paywalled "AI coach" maps to a shipped capability, not an aspiration, before charging for it.
- **Web visual coverage:** authed web was not exercised (expired auth, no dev server). A full authed-web pass is needed to confirm the parity findings render as predicted.

## 30. Final Recommendation

**Do not onboard real users yet. Conditional-go after Gate 0.** This is a strong, differentiated product with a correct nutrition core, a real moat, and a premium feel — closer to "finish and harden" than "rebuild." But two confirmed P0s (free-Pro via the database; live copyright replay on the import path) and a reintroduced SSRF are launch-stoppers, and the false "LIVE" roadmap status on the legal P0 means the gate cannot be trusted without this verification. Clear Gate 0 (~2–3 focused days), re-run the Supabase security advisor to zero ERRORs, land the entitlement + import-legal + parity tests, then onboard a small beta and work Gate 1 in parallel. Lean the launch narrative on the social-caption import path and "fit any recipe into your macros" — that is the defensible wedge, and it is the one thing none of the named competitors can copy.

**Confidence in this assessment: 8/10.** Code-grounded and adversarially verified; the two P0 exploit chains were independently re-confirmed. The −2 is the un-exercised authed-web surface and the handful of live-DB items (promo, saves uniqueness, dashboard-origin DDL) that need a confirmation query Grace can run.

---

## Real User Walkthrough Findings

Live iOS simulator (iPhone 17 Pro, iOS 26.5, dev client `com.supprclub.supprapp`, Metro 8082), real renders captured and read. Web authed surfaces not exercised (expired auth, no dev server) — documented as a coverage gap, not a pass.

### Journey 1 — Today (cold open)
- **Screens:** Today hero (calorie ring + macro tiles + week strip).
- **Observations:** Renders cleanly and premium. "Sloe" wordmark, "Morning, Grace · Thursday 11 June," week strip, calorie ring "1,231 LEFT," GOAL/EATEN/BONUS row, "Plan your day — about 1,231 kcal left. No rush." Protein 0/99g, Carbs 0/117g. Tab bar Today·Plan·(+)·Recipes·Progress.
- **Trust:** High. The calm, non-shaming copy matches the positioning. Ring + tiles are legible.
- **Concern:** none material at cold open.

### Journey 2 — Food logging (the core loop)
- **Screens:** Log sheet → live search "chicken breast" → results.
- **Observations:** Log sheet is excellent — Breakfast/Lunch/Dinner/Snacks, search with barcode/voice/camera, "Copy yesterday's meals · 6 meals," Recent/Library/Saved tabs, empty-recent state, "Or add manually." Search returned real results with **Verified/Estimated** confidence badges, per-serving macros + grams ("1 fillet (174g) · 120 kcal/100g"), and a Past-logged section. This is genuinely best-in-class search UX and more honest than MFP.
- **Bug:** Deep links (`suppr:///profile` etc.) **do not dismiss an open Log-sheet modal** — navigation happens underneath; the sheet stays on top. A user who deep-links (Siri/widget/notification) while the sheet is open lands on the wrong-looking screen.
- **Visual:** clean; confidence tiers are a standout.

### Journey 3 — Recipes (Library + Discover)
- **Screens:** Library (8 recipes, category chips), Discover (import CTA + recipe ideas).
- **Observations:** Both polished. Discover leads with "Import from TikTok, Instagram & YouTube" — the wedge front and centre — and recipe cards carry macro chips + "Sloe Kitchen" attribution.
- **Trust/visual concerns:** (1) A library card titled literally **"Imported recipe"** (generic fallback, confirmed in code) — power users get collisions. (2) **Empty grey thumbnails** on several rows (Homemade Cream Cheese/Labneh, Shrimp Rice Paper Rolls) — the painterly-imagery gap (ENG-1015) reads as unfinished. (3) "Shrimp Rice Paper Rolls 892 kcal" looks high — worth a plausibility spot-check.

### Journey 4 — Meal Plan
- **Screens:** Plan ("This week" + Shopping list tabs).
- **Observations:** Strong — "Hits your targets 7 of 7 days," per-day macro chips with "On track," Generate/Adjust-constraints CTAs, 7-day strip.
- **Trust concern (visible contradiction):** The headline "Hits your targets 7 of 7 days / All 7 days land on target" rendered above a Thursday at **1,301 / 1,231 kcal (over by 70)** with every macro "On track." Tolerance bands explain it internally, but the headline overstates and a user *will* notice the arithmetic.

### Journey 5 — Progress
- **Screens:** Progress (W range, This-week card, adherence, weight).
- **Observations:** Premium — "Maintenance held steady this week · 1,699 kcal · medium confidence," weight 55 kg with Trend/Scale toggle.
- **Trust concern:** **"AVERAGE ADHERENCE 111% · over"** with Carbs 133%, Fat 106%. The metric is uncapped `(avg/target)*100` (`progressRangeStats.ts:161`), so overconsumption produces a *bigger* "adherence" number — semantically backwards for a headline. The "· over" qualifier mitigates but doesn't fix the grammar.

### Journey 6 — Paywall
- **Screens:** Paywall ("Try Pro free for 7 days").
- **Observations:** Genuinely strong — appetising hero, "Full Pro for a week. Cancel anytime in iOS Settings," four feature cards (Unlimited imports, Macro fitting, AI coach, Cloud sync), a Free-vs-Pro matrix, Restore purchases.
- **Concerns:** (1) No price shown on this screen — region-aware pricing is a known intent gap; confirm the price/period surface. (2) "AI coach" is advertised — confirm it maps to a shipped capability (`mealCoach.ts` exists) before charging (open question §29). (3) Entitlement is undermined by **P0-1** — a user can grant themselves Pro via the DB and bypass this entirely.

### Cross-journey notes
- Navigation, transitions, and copy are consistently premium across every captured surface — the product *feels* finished.
- The recurring "unfinished" tells are: empty thumbnails, generic import titles, and two data-trust contradictions (Plan 7/7, Progress 111%).
- No crashes encountered. Deep-link-vs-modal is the one interaction bug observed live.

---

*End of audit. Report is intentionally left untracked for Grace's review. No code, schema, flags, or external state were modified during this audit.*
