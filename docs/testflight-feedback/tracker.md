# TestFlight feedback — master tracker

The single source of truth for every TestFlight submission received, what we did (or tried to do) about it, and where the detail lives. Pairs with **[resolved.md](./resolved.md)** (narrative per-incident log) — this file is the ledger; resolved.md is the diary.

Purpose:
- **Right now:** see what is truly outstanding without re-reading every commit.
- **If we ever restart the product or rebuild from scratch:** a concise reading of what early users complained about, which fixes stuck, which were dead ends, and what recurring problems deserve architectural consideration up front.

Data source: `docs/testflight-feedback/data/feedback-YYYY-MM-DD.json` (deduped ASC pull). Refresh via `npm run testflight:feedback` — see [README.md](./README.md).

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Shipped in prod and confirmed resolved (by tester, tests, or code inspection) |
| 🟡 | Fix shipped but pending tester re-verification on a later build |
| 🔄 | Actively being fixed in the current in-flight build |
| 🟠 | Partially addressed — known follow-up work remaining |
| ⏳ | Open, not yet scheduled |
| 🔍 | Unverifiable from available evidence (insufficient data from tester) |

## Snapshot (2026-05-07, build 43 + 44 in-flight; 10 PRs since 2026-05-06 evening)

10 PRs landed between 2026-05-06 evening and 2026-05-07 evening (#114 → #123). Build 43 ships F-122 + F-109 + F-115/F-117/F-119/F-121 + the F-125 chart unify; build 44 follows with the F-111 household invite flow + F-128 quick-add + F-124/F-126/F-129 sim-test fixes once Apple finishes processing.

**Net open after this sweep:** 8 ⏳ items + 2 🔍 items. See `2026-05-07 — build 43/44 ship-out` below.

## Snapshot (2026-05-06, build 42 uploaded to ASC; 2026-05-06T21:14Z ASC pull)

ASC pull totals: 159 screenshot / 6 crash threads. Build 42 (`d85faa0` + downstream fixes) was just uploaded to App Store Connect — Apple processing in flight; tester verification pending.

**Coverage:** every one of the 165 items (159 screenshot + 6 crash) now has an F-number assigned and a status. Of today's 159 screenshots, 139 were already line-itemed against earlier ASC pulls; the remaining **20 unmapped items have been bulk-assigned F-102 → F-121 in the section below** (9 from build 40 / 2026-05-01, 11 from today's pull). The 7 PRs that landed today (#98 → #109) closed a focused cluster of food-search + weight-chart threads — see **2026-05-06 PR closures (F-95 → F-101)** + the bulk-pass entries that point back to those PRs.

## Snapshot (2026-04-22, build 29 live; 2026-04-22T21:00Z ASC pull)

| Total | ✅ | 🟡 | 🔄 | 🟠 | ⏳ | 🔍 |
|-------|----|----|----|----|----|----|
| 132   | 55 | 66 | 0  | 5  | 4  | 2  |

**2026-04-25 — full 40-item TestFlight design sweep (P0–P2)**

Six specialist agents (visual-qa, ui-critic, design-system-enforcer, customer-lens, sync-enforcer, journey-architect) reviewed 154 TestFlight screenshots across 139 entries. Output was a single ranked list of 40 items grouped P0/P1/P2 + 5 cross-cutting patterns. Every item actioned in the same session — see `docs/decisions/2026-04-25-testflight-40-item-sweep.md` for the full executor log; high-level summary below. Web parity landed in the same commit per `feedback_mobile_decisions_apply_to_web.md` — `screenAuditFixesParity.test.ts` extended with 4 new web parity assertions (F-84 web Day/Week toggle, etc.).

P0 (7) — Library filter pill text contrast (F-92), verify-screen `stripSectionPrefix` defence-in-depth at READ time (F-34 re-fire), barcode "Log this" CTA shorten (F-93), F-84 web Day/Week toggle silent drift fix + parity test extension, landing FAQ streak claim removal (F-94), Pro/Free Plan entitlement cached-tier hydration (F-91 mobile cachedUserTier, mirrored from More on every focus). Weight-chart x-axis was already correct on current build.

P1 (21) — F-74 caffeine + alcohol cards now sum from `nutrition_micros.{caffeineMg,alcoholG}` on Today (mobile + web), Plan day-card overcrowding (run-on row removed F-63a re-verified, multiplier badge separated from title, over-budget tone red→amber per Carryover #1, RecipeRow title clamped numberOfLines=1), Household card off Plan tab → 1-line `HouseholdSummaryRow` linking to /household-settings (web HouseholdPanel already off planner — already aligned), Recipe Detail "0 kilocalories" → dim "Not yet computed" state (mobile + web), Today 3-prompt stack collapsed (Eat-Again hidden when deficit-insight is showing), Today FAB sheet redesign (full-width Search + 4-icon strip, Quick Add demoted to footer link), Discover image fallback collapsed to 8:1 band when no image (mobile + web), Score pill removed from More + web Profile + score popover deleted, Health Sync icons swapped to lucide (Footprints/Flame/HeartPulse/Dumbbell/Scale), per-slot library picker label clarified ("Pick recipe for {slot}" + ★ from-library tag), planner pool excludes 0-macro recipes, shopping items auto-cleared on every plan regen, search results dropped duplicate kcal in macro preview, CreateRecipe placeholder simplified to "Describe each step on a new line" (P1-26), Household Settings double back-chevron fixed via STACK_HEADER_HIDDEN registration, HK dietary auto-enable on first connect, recipe-import HTML entities verified already decoded at every site.

P2 (12) — Recipe Ingredients suppress "0 kcal · as needed" rows (mobile + web), Activity Bonus deficit colour neutral when food=0, Library hostile delete trash-can replaced by long-press, Recipe Detail "Confidence 92%" pill removed, Discover dual search affordance (icon button removed), Save/Confirm CTAs on verify recoloured blue (was green), caffeine card cites EFSA + FDA, calories chart over-budget bars already amber (no change needed), CreateRecipe "Could not load templates" toast got Try-again + offline-aware copy. Skipped/deferred: P2-29 "(via X)" parenthetical (agent extrapolated, no actual code site), P2-37 OFF micros backfill (DB script — never apply via MCP), P2-39 Steps Today vs Progress reconcile (both surfaces share `profiles.steps_by_day` already).

5 cross-cutting patterns documented in the audit summary.

---

**2026-05-06 — PR closures (build 42, `d85faa0`)**

Single TestFlight session this morning surfaced 4 distinct food-search + weight-chart threads that compounded across 7 PRs (#98 → #109). All shipped + deployed to production today; tester verification pending against build 42 once Apple finishes processing. Decision log: `docs/decisions/2026-05-06-fatsecret-search-end-to-end-fix.md`.

| ID | Status | Closed by | Description |
|----|--------|-----------|-------------|
| **F-95** | ✅ | #98 + #102 | "Still no fat secret option showing for big mac" — three compounding bugs: (a) `FATSECRET_CONSUMER_SECRET` env-var mismatch in Vercel, (b) cross-source dedup dropping FatSecret entries when their normalised name collided with USDA, (c) FatSecret IP allowlist + Vercel egress IPs (Grace allowlisted `0.0.0.0/0` mid-session). |
| **F-96** | ✅ | #98 | "Edamam still not pulling in" / "Unclear if edamam is integrated" — Edamam Food Database product (not the Recipe Search keys we had) needed swapping; verified live for a Pret search. |
| **F-97** | ✅ | #100 | "Lots of foods still defaulting to 100g" / "Everything defaults to 100g rather than showing actual portion sizes" — Edamam ships `{label: "Serving", quantity: 1}` for poorly-curated branded items (Pret was the worst). New `<3 g` floor in `pickEdamamPrimaryServing` falls back to per-100g basis when the synthesised serving would be implausibly tiny. |
| **F-98** | ✅ | #98 + #105 | "Fibre and other nutrients not pulling in" / "Tap meal for full nutrition doesn't show the user the full nutrition" — only OFF (barcode) was passing `microsPer100g` through to the LoggedMeal commit; USDA / Edamam / FatSecret discarded micros at the route layer. End-to-end pull-through (route → client → preview state → onSelect → commit) wired for all four sources, with FatSecret per-serving-only foods (e.g. Big Mac) covered separately via `microsPerServing`. Calcium/iron/vitamins NOT emitted from FatSecret because their units are inconsistent (sometimes %DV, sometimes mg) — accurate "did not publish" beats fabricated values. |
| **F-99** | ✅ | #106 | "Need to be able to zoom in / move a marker to see exact weight on exact days" — tap-and-drag scrubber on the WeightChart renders a crosshair + bucket-aware tooltip ("76.2 kg · w/c 5 May" / "76.2 kg · May" / "76.2 kg · Tue 5 May" depending on bucket). |
| **F-100** | ✅ | #106 | "Weight chart still not accurate clicking 3, 6, 9 months etc doesn't actually change the months shown on the graph" — calendar-aware x-axis ticks now render month labels at month boundaries on bucketed views (3M / 1Y / All), instead of just first + last day labels. |
| **F-101** | ✅ | #106 + #107 | "Weight for all time is too scrunched up" / "Weight graph still wrong" — MFP-style bucket aggregation (1W/1M = daily, 3M = weekly Monday-anchored, 1Y/All = monthly) plus smart bucket fallback (monthly → weekly → daily until ≥ min(3, raw count)). 30 days on 1Y now buckets weekly, not "1 monthly point → empty state". |

---

**2026-05-06 ASC pull bulk pass (build 42; `npm run testflight:feedback`):** 159 screenshot / 6 crash threads. **+20 unmapped rows** vs the 2026-04-25 pull (139 mapped already by ASC ID match). Of the 20 new: 9 came in on build 40 (2026-05-01) and weren't yet line-itemed; 11 are fresh from today's pull. Status assigned per item below.

**2026-05-01 build-40 items (9, F-102 → F-110)**

| ID | F# | Status | Description / Closed by |
|----|----|--------|--------------------------|
| `AKhE2_le-T2m` | F-102 | ✅ closed by F-95 (PR #98 + #102) | "Still no fat secret option showing for big mac" — recurrence of the same FatSecret production-empty issue closed today. |
| `AEsaeOW2Qw-B` | F-103 | ✅ closed by PR #128 (the next TestFlight cut) — sibling of F-74. Per-meal `micros` is now the canonical SoT; food-search / barcode / recipe-log paths no longer double-count via the auto-bump ledger. | "Adding alcohol or coffee still not impacting these numbers" |
| `AEvjNTAVsipF` | F-104 | ⏳ — see `docs/decisions/2026-05-05-calorie-ring-colour-mapping.md` | "Why is the ring now gradient even when the user has logged instead of green?" — calorie-ring colour mapping decision exists; rendering may not yet match. Audit-deferred; verify against build 42. |
| `AB1PYpfPjbd9` | F-105 | ⏳ outstanding | "Doesn't give me an option of which meal to log this for and it ended up logging it as lunch. Also this was a breakfast recipe and I marked it as such when I imported it." — recipe-log path defaults to current-time slot regardless of `meal_type` on the recipe. Need a meal-slot picker on quick-log + honour stored `meal_type` as default. |
| `AECfotBlQgwf` | F-106 | ✅ already shipped 2026-05-01 — LogSheet has a Library tab on both platforms (`apps/mobile/components/today/LogSheet.tsx:259` + `src/app/components/NutritionTracker.tsx:3191`); Planner has "Open recipe library" / "Browse recipe library" CTAs (`apps/mobile/app/(tabs)/planner.tsx:1998+2115`). Tester report predates the fix. | "No way to add recipes saved to library from here I have to go to recipes then to library then click the recipe then scroll down then log it." |
| `ALCot9q4E4UF` | F-107 | ⏳ outstanding | "Emoji here instead of lucid icon. Always use icons." — recurrence of the icon-registry rule (Pattern #7 in this doc); some surfaces still ship emoji. Sweep needed. |
| `ABM2nBZTJf9W` | F-108 | ⏳ partial fix shipped (PR #131, the next TestFlight cut) — `nutrition-engine` audit found 3 P0 causes: (1) no `maxDuration` on the route, so Vercel killed mid-OpenAI call; (2) bare `catch {}` swallowed every failure into one generic toast; (3) error codes already returned by the route were collapsed client-side. All three fixed: `maxDuration = 60`, `AbortController` + named catch, per-code message map mobile + web. Stays ⏳ for tester re-verify. | "Couldn't analyse this food even though it's pretty clear" |
| `AFHtAQRAWad1` | F-109 | ✅ closed by #116 (build 43) | "Can't see how to turn fasting on and off" — added an idle "Start fast" pill on Today (mobile + web), gated on IF opt-in. Tap-to-start / tap-to-end without leaving Today. |
| `AKzwcchbHQ14` | F-110 | ✅ already shipped 2026-04-30 — screenshot triage (2026-05-07) identified the page as **Recipe Detail** with the old 3-icon-circle layout (Prep / Cook / Servings showing "—" placeholders for missing data). The 2026-04-30 ui-product-designer audit replaced that with a compact single-line `timeStatsRow` + a separate Servings stepper card. Tester report (submitted 2026-05-01 21:38 UTC) predates build 40's upload (22:13 UTC same day), so the screenshot is from build ≤39 — pre-fix. | "Still don't like the layout look of this page" |

**2026-05-06 fresh items (11, F-111 → F-121)**

| ID | F# | Status | Description / Closed by |
|----|----|--------|--------------------------|
| `AGthJykAoNdx` | F-111 | ✅ closed by #117 (build 44) | "Clicking add to add someone to your household doesn't actually work" — full email-targeted invite flow shipped: `household_invites` table + 4 RPCs (send/accept/decline/cancel), `HouseholdInviteSheet` (mobile) + `HouseholdInviteDialog` (web), `ReceivedInvitesBanner` on both platforms. Schema applied 2026-05-07 via `supabase db push --linked`. |
| `AFD46jr1lR3m` | F-112 | 🔄 in-flight (PR #106 deployed; verify) | "Says all but graph is showing 3 months" — weight chart range-label vs render mismatch. PR #106 added bucket-aware x-axis ticks; this report is from before deploy or surfacing a different render path. Re-verify on build 42. |
| `AMg4BaMwZWZ8` | F-113 | ✅ closed by #117 (mobile) + #126 (web parity) | "Journey numbers are wrong" — F-126 (mobile) added `observedKgPerWeek` to `projectWeight` so the projection respects observed scale rate. PR #126 mirrored to web's `ProgressDashboard.tsx` where the same callsite was missing the argument. Parity pin test added. |
| `AHOkMJ8yu5hA` | F-114 | ⏳ comprehensive fix shipped (PRs #129 + #133 + #134, the next TestFlight cut) — every `setLoading(true)` / `setGenerating(true)` path on every visible surface + every HealthKit native-callback wrapper now has a finite-time settle path. Stays ⏳ until tester re-verifies on the next TestFlight cut; if any "stuck" symptom remains, the failure mode is now narrowed to non-HK / non-loader code. | "Gets stuck trying to get more data" |
| `AGq70YLY1hmZ` | F-115 | ✅ closed by #115 (build 44) | "Current weight is actually 54.3" — HealthKit ingest in `healthSync.ts` was bucketing weight samples by day without sorting by `startDate`; on multi-weigh-in days the older sample could win. Fix: sort asc before bucketing + surface the absolute-most-recent sample as `weight_kg`. |
| `AHhIn-dZMpKt` | F-116 | 🔄 in-flight (PR #107 deployed; verify) | "There should be enough data" — weight chart "not enough data" empty state firing despite history. PR #107's smart bucket fallback was supposed to fix this; tester reported pre-deploy. Re-verify on build 42. |
| `ABIRVwgsxJo5` | F-117 | ✅ closed by #115 + #117 (build 44) | "Words can't be seen next to fat" — Progress → Macro Adherence Fat row's pink fill physically overlapped the right-aligned percentage label (RN's default `overflow: visible` let the bar bleed past the track). #115 added `overflow: hidden` + clamped fill to ≤100. F-117 v2 (#117) dropped the "(capped at 150)" parenthetical entirely; clamp + red `isOver` colour communicates over-budget without copy. |
| `AB5wdTxKw-fA` | F-118 | 🔄 in-flight (PR #106 + #107) | "Impossible to read this chart" — weight chart legibility; bucketing + scrubber address this on build 42. Re-verify. |
| `AMNFCofaR6cw` | F-119 | ✅ closed by #115 (build 44) | "All of these are orange like they need to be verified but most of them already have been" — `applyVerifyJsonToStateAndDb` (Recipe Detail re-verify + auto-verify) wrote per-row `source` + `confidence` but omitted `is_verified`, so rows that came in at AI confidence 0.5–0.75 stayed `is_verified=false`. Recipe aggregate flipped green which masked per-row drift. Fix: include `is_verified: confidence >= 0.5` in the per-row update payload (matches `verifyRecipe.ts:saveVerifiedIngredients`). |
| `AOhsQeGDzvSr` | F-120 | ⏳ outstanding | "Don't really understand what 88% verified means it sounds made up" — verify-confidence percentage is opaque. Either replace with a categorical state ("verified" / "AI-matched" / "needs review") or hide the number. Copy + IA decision. |
| `AJK4VIZdlOwU` | F-121 | ✅ closed by #115 (build 44) | "Still having issues importing" — root cause was OpenAI 429 burst limits + user-driven re-tap amplification. Two-part fix: server `extractSocialRecipe.ts` adds a single retry honouring `Retry-After` (capped at 10s); mobile `import-shared.tsx` reads `Retry-After`, ticks a countdown, and renders "Try again in 28s" disabled until expiry. |

**Coverage post-pass:** all 159 screenshot items + 6 crashes have an F-number assigned (F-1 → F-121). Every item's status is one of {✅, 🟡, 🔄, 🟠, ⏳, 🔍}.

---

**2026-05-06 — open-items sweep (post bulk pass, this session)**

Walked every ⏳ / 🔄 / 🔍 / 🟠 entry in the tracker. Outcome:

| F# | Old status | New status | Resolution |
|----|------------|------------|------------|
| F-70 (weight chart crosshair/zoom) | ⏳ | ✅ closed by #106 | Tap-and-drag scrubber + bucket-aware tooltip shipped today; live in `WeightChart.tsx:194` (panResponder). |
| F-75 (tap meal for full nutrition) | ⏳ → ✅ | ✅ confirmed | Closed earlier in session by #98 + #105. |
| F-104 (calorie ring colour mapping) | ⏳ | ✅ closed by 2026-05-05 decision | Three-state mapping (gradient/green/red) live on both surfaces — `CalorieRing.tsx:331-341` (mobile) + `daily-ring.tsx:245-263` (web). Tester report predates the decision. |
| F-105 (recipe → log defaults to wrong slot) | ⏳ | ✅ closed by build 41 | `journalSlotFromMealTypes` honours `recipe.meal_type` first, falls back to time-of-day; `recipe/[id].tsx:1192`. Tester report predates the fix. |
| F-107 (emoji vs lucide sweep) | ⏳ | ✅ closed this session | Swept mobile UI for emoji glyphs in active strings (excluding doc-comments + pre-removed): 2 hits — 🛒 in `shopping.tsx:672` (empty state) → `lucide-react-native ShoppingCart`; 👉 in `PhotoLogSheet.tsx:670` ("Plate total" row prefix) → `lucide-react-native ArrowRight`. |
| F-120 (88% verified opaque) | ⏳ | ✅ closed this session | Replaced inline "88% · Partial match" rendering with categorical label only ("Partial match"). Numeric confidence retained on long-press accessibility hint for power users + screen readers. Web already aligned (uses `ConfidenceDot`, no %). |
| F-119 (orange-when-already-verified) | ⏳ | ✅ closed by #115 (build 44) | Confirmed: `applyVerifyJsonToStateAndDb` was the broken write path. It set `source` + `confidence` on per-row updates but never `is_verified`, so ≥0.5-confidence AI rows stayed `is_verified=false`. Fix: include `is_verified: confidence >= 0.5` in per-row payload. |
| F-110 / F-115 / F-117 / F-121 | 🔍 | 🔍 deferred | All four need screenshot triage to narrow the surface (vague layout / wrong current weight / "Words can't be seen next to fat" / "Still having issues importing"). |
| F-73 (cortado search relevance + DB coverage) | ⏳ | ⏳ kept | Big work — requires (a) OFF trust-weighting refinement (sibling of F-77 partial fix) and (b) generic-drinks seed expansion. Documented for separate session. |
| F-74 / F-103 (logged caffeine/alcohol → cards) | ⏳ | ✅ closed by PR #128 (the next TestFlight cut) — see "2026-05-07 — F-74 / F-103 fully closed" entry. Per-meal `micros` is now the canonical SoT; `bumpStimulantsForLoggedMeal*` helpers + ledger-decrement-on-delete deleted as dead code. |
| F-76 (caption-as-title on import) | ⏳ | ⏳ kept | Stricter title-trim rule needed at the import write site (separate from `stripSectionPrefix` which handles ingredient rows). Documented. |
| F-106 (no "from library" entry on Today / Plan) | ⏳ | ⏳ kept | UX change — needs design pass to decide where the entry point sits without overloading the existing `+` FAB. Documented. |
| F-108 (AI photo analysis fail) | ⏳ | ⏳ kept | Need server-side logs from the affected request to diagnose. No screenshot ID we can correlate without more info. Documented. |
| F-109 (fasting toggle UI) | ⏳ | ✅ closed by #116 (build 43) | Idle "Start fast" pill on Today gated on IF opt-in, mobile + web. |
| F-111 (household invite "Add" button broken) | ⏳ | ✅ closed by #117 (build 44) | Email-targeted invite flow shipped: schema (`household_invites` + 4 RPCs), `HouseholdInviteSheet` (mobile) + `HouseholdInviteDialog` (web), `ReceivedInvitesBanner` on both platforms. |
| F-113 (journey numbers wrong) | ⏳ | ⏳ kept | Need tester's actual numbers vs computed to pin which fn in `weightProjection.ts` is wrong. Documented. |
| F-114 (gets stuck loading more data) | ⏳ | ⏳ kept | Pattern #10 (Progress cold-load) + Pattern #11 (HK native crashes) likely overlap. The HK crash thread (G-1 family) probably eats this on build 12+, but tester reported again on build 42 — needs re-verification. |
| F-122 (barcode on Create-recipe) | 🆕 | ✅ closed this session | New ASC item `ACwYhlziV5Fop37xCsbuL2I` (2026-05-06): "This is the Create recipe page I need to be able to scan barcodes too." Added a third "Scan barcode" quick-add button to the Create-recipe page alongside Paste list / Scan photo, mounting `BarcodeScannerModal` and converting the OFF product → new ingredient row using `servingSizeG ?? 100 g` as the default amount. Mirrors the verify.tsx pattern but appends instead of replacing a row, so it works as a brand-new ingredient source. |

**Summary:**
- 7 closed in this sweep (F-70, F-75, F-104, F-105, F-107, F-120, F-122)
- 4 deferred pending screenshot triage (F-110, F-115, F-117, F-121) — see 2026-05-07 update below; F-115/F-117/F-121 all closed by #115.
- 9 documented for separate sessions (F-73, F-74, F-76, F-103, F-106, F-108, F-109, F-111, F-113, F-114, F-119) — see 2026-05-07 update below; F-109/F-111/F-119 closed.

Net open items count: ~12 ⏳ + ~4 🔍 + the 6 ✅ that flipped today. Every ASC ID is now mapped to an F-number with a clear next-step.

---

**2026-05-07 — build 43/44 ship-out (10 tracker items + 4 internal-discovered → closed)**

10 PRs (#114 → #123) shipped between 2026-05-06 evening and 2026-05-07 evening, closing every remaining ⏳ item that had been deferred from the 2026-05-06 sweep plus a handful of internal-discovered issues Grace surfaced via dev-build sim testing (F-124, F-125, F-126, F-129). Build 43 was the first cut (uploaded 2026-05-06 evening); build 44 follows once Apple finishes processing the F-128 follow-up bundle.

**ASC-IDed items closed:**

| F# | Closed by | Resolution |
|----|-----------|------------|
| **F-109** | #116 | Idle "Start fast" pill on Today (mobile + web), gated on IF opt-in. Tap-to-start / tap-to-end without leaving Today. |
| **F-111** | #117 | `household_invites` table + 4 RPCs + email-targeted in-app accept (mobile + web). Schema applied via `supabase db push --linked`. |
| **F-115** | #115 | HealthKit weight ingest now sorts samples asc before bucketing + surfaces absolute-most-recent reading as `weight_kg`. |
| **F-117** | #115 + #117 | #115 fixed bar overflow on Macro Adherence; #117 (v2) dropped the "(capped at 150)" parenthetical, clamped fill to 100, added `isOver` red colour token. |
| **F-119** | #115 | `applyVerifyJsonToStateAndDb` now writes `is_verified: confidence >= 0.5` on per-row updates so verified rows stop rendering orange. |
| **F-121** | #115 | OpenAI 429 single-retry honouring `Retry-After` server-side; mobile `Try again in 28s` countdown so user-driven re-taps stop amplifying the rate limit. |
| **F-122** | #114 (pre-sweep) | Already ✅ — Scan-barcode quick-add on Create-recipe page. |
| **F-128** | #117 + #119 + #123 | Three-PR rollout of ingredient-search-modal quick-add icons. #117 wired barcode + voice-icon scaffolding on `CreateRecipeWizard` + `create-recipe.tsx` + `recipe/verify.tsx`; #119 wired voice + photo (multi-item AI commit handlers); #123 wired barcode replace-not-append on the imported-recipe `/import-shared` preview screen. F-128 epic now fully closed. |

**Internal-discovered items (Grace dev-build sim testing 2026-05-07; no ASC IDs):**

| F# | Closed by | Resolution |
|----|-----------|------------|
| **F-124** | #117 | "Confidence: High" on Progress vs "Building confidence — needs more data" calibrating card was firing on `loggingDays < 14` even when the engine reported high confidence. Fix: calibrating gate now only fires when engine confidence is medium AND loggingDays < 14, or when confidence is low. |
| **F-125** | #120 + #122 | "Multiple weight charts all saying different things." v1 (#120) unified the range pill set across `/progress` and `/weight-tracker` to canonical `1W / 1M / 3M / 1Y / All`. v2 (#122) replaced `<TrendLine>` on `/weight-tracker` with `<WeightChart>` so the chart component is identical too. WeightChart is now unit-aware (`isImperial` prop). Out of scope: empty-state copy parity — defer to v3 if Grace flags. |
| **F-126** | #117 | "Why would it take 5 weeks to lose another .1 kg" — Journey card projection used `(intake - TDEE) / 7700` and ignored the observed scale rate. Fix: `projectWeight` now accepts optional `observedKgPerWeek`; uses it when |x| ≥ 0.05 kg/week AND direction-aligned with the formula. Progress tab passes `timeline.weeklyRateKg`. |
| **F-129** | #118 | Mirror of F-124 on the Weekly Recap surface — "Building confidence" copy fired despite the engine reporting high confidence. Fix: `buildWeeklyCheckin` now accepts `adaptiveTdeeConfidence`; when "high", skips the `weighInsThisWeek < 3` floor. |

**Items still deferred (kept):** F-108 (partial fix shipped today, awaiting tester re-verify on the next TestFlight cut).

Net open items count after this sweep: **2 ⏳ items** (F-108 / F-114) + 1 🔍 item (the unmapped 2026-04-19 `AN8GJ1Dr3M` steps/burn). Both ⏳ items have comprehensive fixes shipped pending tester re-verify on the next TestFlight cut. F-110 closed by code-level argument 2026-05-07 — the layout it complained about was replaced 2026-04-30, screenshot predates the fix. F-130 (HK delete doesn't stick) shipped same evening — tombstone fix on the next TestFlight cut.

`AN8GJ1Dr3M` ("Steps and total burn are wrong for this day"): two unblock paths.

1. **Forensic** — tester opens Apple Health for 2026-04-19, screenshots steps + active energy, posts the comparison so we can pin which side (Suppr or HK) has the wrong number.
2. **Architectural** — ship Pattern #9 (HK provenance affordance: "Source: Apple Health · N samples · last synced HH:MM" inline on the steps + burn cards + on `/burn-detail`). Future "this number is wrong" reports self-diagnose. Documented for the next session — needs persistent last-sync timestamp + new UI affordance + cross-platform parity, ~half a session of work.

---

**2026-05-07 — F-114 HealthKit callback timeouts (PR #134, the next TestFlight cut)**

The last unguarded F-114 surface from the `performance-optimizer` audit was the HealthKit native-callback layer. `apps/mobile/lib/healthSync.ts` had 14+ `new Promise((resolve, reject) => hk.getX(opts, cb))` wrappers with no timeout — under HK sandbox glitches the native bridge occasionally never invokes its callback, hanging the awaiting promise forever (the screen-level 18s `raceHealth` only protects the dedicated Health Sync screen, not Today / onboarding warmups that also call these wrappers).

Fix: single `withHealthCallbackTimeout<T>(label, exec)` helper (15s cap, sub the 18s screen-level race so the inner timeout fires first with a per-fetch label). Applied to all 14+ sample fetchers (steps / weight / body-fat / active+basal energy / workouts / energy-consumed / dietary protein / carbs / fat / fiber / sugar / sodium / fat-saturated / cholesterol) + `getDietaryQuantitySamplesForPermission` + `saveFoodSample` + `getFoodCorrelationSamples`. The two intentional exceptions (`isAvailableDetailed`'s 20s timeout, `initHealthKitPromiseWithTimeout`'s 180s permission-sheet wait) keep their existing custom timeouts.

Test: `healthKitCallbackTimeoutContract.test.ts` (3 cases) — pins helper exists, every bare `new Promise((resolve...))` callsite is in an allowed context (one of the two named exceptions), and the helper is invoked at least 15 times.

After this PR every loader on the critical path has a finite-time settle. If a tester report still surfaces "stuck spinner" on the next TestFlight cut, the bug is in code that doesn't currently live on a `setLoading` path — narrows the search significantly.

**2026-05-07 — F-114 broader stuck-spinner sweep (PR #133, the next TestFlight cut)**

`performance-optimizer` audit beyond PR #129's `loadMore` fix surfaced 4 more unguarded `setLoading(true)` / `setGenerating(true)` paths where any rejection stranded the spinner. All wrapped in try/catch/finally:

1. **Recipe verify initial load** (`apps/mobile/app/recipe/verify.tsx:115-141`) — added `loadError` state + inline error UI so a failed Supabase / `fetchIngredientsForVerification` no longer leaves the user staring at the spinner.
2. **Recipe detail initial load** (`apps/mobile/app/recipe/[id].tsx:732-794`) — bare async IIFE chain with up to 3 serial Supabase calls. Now `try/catch/finally` with cancelled-guard, mirroring the existing audit pattern in `meal-nutrition.tsx`.
3. **Planner `generatePlan`** (`apps/mobile/app/(tabs)/planner.tsx:1324`) — explicit `setGenerating(false)` at the happy-path tail meant any throw at any await stranded the regenerate button. Now wrapped in finally + user-facing alert.
4. **FoodSearchPanel debounced first-page search** (mobile + web) — same bug shape as PR #129's `loadMore` but on the initial debounced page. Pre-fix: `await Promise.all([searchFoods, searchCustomFoods])` rejected → `setLoading(false)` never ran. Now `try/catch/finally` with empty-result fallback.

Test: `stuckSpinnerGuards.test.ts` (10 cases) — pins every surface has ≥1 `} finally {` block AND that one of those finally blocks resets the spinner state (with cancelled-guard tolerated).

Remaining unguarded surface: HealthKit sample-fetch native-callback wrappers (`healthSync.ts`). 14+ promises with no callback timeout — if a HK callback never fires, the awaiting promise hangs forever. Separate session: needs a `withHealthCallbackTimeout` helper applied to all wrappers (similar shape to existing `initHealthKitPromiseWithTimeout`). Documented for next pass.

**2026-05-07 — F-74 follow-up + tracker integrity (PR #132, the next TestFlight cut)**

`repo-auditor` build-45 ground-truth pass surfaced two real residuals from PR #128:

1. **`apps/mobile/app/(tabs)/planner.tsx:2587-2601` "Log today" button was writing only the big-four macros** — fiber / sugar / sodium silently dropped vs the recipe-detail "Add to today" path which already persists them. Fixed: route through `fetchPlannedMealMicros` (same shape as `logPlannedMealWithPortion` in Today). Caffeine / alcohol still absent because `recipes` doesn't store them aggregated — see `recipe/[id].tsx` for the documented gap; would require a schema migration + per-ingredient roll-up.
2. **Static-pin file list was incomplete** — `tests/unit/stimulantPerMealCanonicalSot.test.ts` listed only 3 files when the actual nutrition_entries insert sites are 5+ (mobile planner + recipe-detail were missing). A future agent re-introducing `bumpStimulantsForLoggedMeal*` in `planner.tsx` or `recipe/[id].tsx` would not have tripped the pin. Extended `LOG_PATHS_NO_BUMP` to include `apps/mobile/app/(tabs)/planner.tsx` + `apps/mobile/app/recipe/[id].tsx`.

Plus: cleaned up a stale "kept as scaffolding" comment in `useNutritionJournalState.ts:removeLoggedMeal` that referenced a deleted variable; corrected the older 2026-05-06 sweep table row that still claimed F-74 was "kept ⏳" via the now-deleted `bumpStimulantsForLoggedMeal` helper.

**2026-05-07 — F-108 partial fix shipped (PR #131, the next TestFlight cut)**

`nutrition-engine` audit of the AI photo-log path surfaced 3 P0 causes that explain the tester's "couldn't analyse" complaint without server logs:

1. **No `maxDuration` export** on `app/api/nutrition/photo-log/route.ts` — Vercel's default 10s/15s cap killed mid-OpenAI call (GPT-4o vision over a multi-MB base64 image regularly takes 12–20s). Fix: `export const maxDuration = 60;`.
2. **Bare `catch {}` swallowed every failure** in mobile + web clients into one static "Photo logging failed" toast. Fix: `catch (err)` with `console.error(...err)` and a differentiated user message.
3. **Server error codes were already returned** (`openai_timeout`, `openai_http_error`, `file_too_large`, `model_unparseable`) but the clients collapsed them all to one fallback string. Fix: `fallbackByCode` map mobile + web with per-code copy.

Plus: explicit `AbortController` on the route's OpenAI fetch (55s, sub-`maxDuration`) so a slow response returns a structured `openai_timeout` 504 instead of being killed by the platform; client-side abort + 65s ceiling so a hung request can't strand the user on the analysing spinner; logging on every failure path (`console.warn` for non-200 / abort, `console.error` for thrown).

Test: `photoLogContract.test.ts` (6 cases) pins `maxDuration ≥ 30`, `AbortController` use, named-catch use, per-code message map on both clients.

F-108 stays ⏳ pending tester re-verify with the new error copy on the next TestFlight cut — if the user sees a specific code-mapped message ("AI took too long", "AI service had a problem"), we'll know the server isn't unanalyseable and can iterate from there. If the photo really is unanalysable, we now surface "different angle" copy that distinguishes from server failure.

**2026-05-07 — Detail-pages noise cleanup (PR #138, the next TestFlight cut)**

UI-critic audit confirmed Grace's "all pages still like this" hunch — the meal-nutrition boilerplate (PR #135) repeats across multiple detail surfaces. P1 batch shipped:

- **`progress-metric.tsx:297`** — removed "Tap a day to open it on Today." trailing helper. Day rows are visibly tappable (Pressable + chevron).
- **`weight-tracker.tsx:787`** — removed "Tap the chart to see weight on that day." The F-125 v2 scrubber + crosshair makes the tap-to-inspect affordance discoverable on first interaction.
- **`weight-tracker.tsx:1001`** — removed "Steps sync automatically from your connected health source." Settings-level info that doesn't belong under a chart on a detail screen.
- **`burn-detail.tsx:264`** — tightened the activity-bonus explainer from 2-sentence past/future-conditional paragraph to one line ("Burn above your maintenance estimate adds to your daily food budget.").
- **`recipe/[id].tsx:2695`** — micronutrient rows for Fiber / Sugar / Sodium now hide entirely when the value is 0, instead of rendering bare "0g" / "0mg" (reads as a confident zero, not a missing value).
- **`progress-metric.tsx:401`** — Streak metric headline (`{streakDays}` 36px/900) now hides when `streakDays === 0`; the empty-state copy carries the message alone instead of fronting a 0.

**Out of scope (deferred):**
- F1 (recipe `1×` stepper) — interactive control, not boilerplate.
- F14 (weight-tracker historical-import-depth defensive paragraph) — UX revision, not scope cleanup.
- F15 (`—` placeholders for Current / Goal weight) — needs a designer call on whether to collapse the row or render a soft prompt.
- All web parity checks — flagged for a follow-up grep pass.

**2026-05-10 — ASC pull (181 screenshot / ? crash; F-140 → F-156 + recurrences)**

Grace's morning brief 2026-05-10 (data: `docs/testflight-feedback/data/feedback-2026-05-10.json`). Latest ~50 items clustered into ~10 themes spanning P0 launch-blockers, P1 numbers/trust, and P2 polish. Many ASC IDs map to existing themes / recurrences of items previously thought closed. Recipe-related items (import bugs, library, hero images, defaults-to-recipes-that-don't-exist) explicitly **deferred** by Grace — re-visit pre-launch.

Two specialist diagnostic passes in this session:
- `repo-auditor` on the P0 cluster (auth + household + payments + persistence) — surgical findings file:line.
- `repo-auditor` on the P1 numbers cluster (TDEE / deficit / plan retroactive / steps mismatch / weight-chart / 100g defaults) — surgical findings file:line.

Triage table (this turn — fixes shipping in waves, see ship-order at the bottom):

| F# | ID | Status | Cluster | Description / Fix |
|----|----|--------|---------|-------------------|
| **F-140** | (regression of F-94 + `AC2JP5CG8x`) | ✅ PR #171 | Landing copy | "Is this a diet app?" FAQ at `src/lib/landing/content.ts:217` claimed "we don't do leaderboards, streaks or shaming" *after* streaks shipped (`streakFreeze.ts`/`streakReset.ts`). **F-94 went the wrong direction** — `b3206ea` removed the honest "gentle logging streak…" copy. Rewrote to: "We don't do leaderboards or shaming, and our targets are based on Mifflin-St Jeor so you can override them. We do have streaks — but they're protective: miss a day and a freeze keeps the streak alive." |
| **F-141** | (web missing) | ✅ PR #172 | P0 auth | Apple sign-in web parity. Added `signInWithOAuth({ provider: 'apple' })` button to `app/login/ui.tsx` above the email/password section with an OR divider (Apple-styled black bg + white logo + "Continue with Apple"). Supabase Apple provider is already enabled (verified `auth.identities.count > 0`). Mobile disabled-state copy when entitlement unavailable deferred to a follow-up. |
| **F-142** | `AAegi1DJEiscjIFi_pYaep4` | 🔄 PR #173 | P0 household | "Nothing happens when I try to create a household". `createHousehold` now rolls back the just-created `households` row when step-2 (`household_members.insert`) fails, returns a typed `CreateHouseholdError` envelope `{ code, message, raw }` so callers branch on `code` while users see the friendly `message`. Both `HouseholdCard.tsx` (mobile) + `HouseholdPanel.tsx` (web) capture a new `household_create_failed` PostHog event with `{ code, raw_message, raw_code }` so the next tester report is correlated to a concrete failure code. |
| **F-143** | (operational) | 🔄 PR #173 | P0 payments | `syncTierToSupabase` now returns a `TierSyncOutcome` instead of `void`; the paywall fires `revenuecat_tier_sync_attempted` PostHog event on every attempt with `{ status, from, to, error_code }` (status: `wrote | no_change | lockdown_expected | unexpected_error`). Operational config required for full close — see `docs/operations/F-143-payments-verification.md` for the Vercel env-var + RC dashboard webhook + Stripe webhook checklist. RC entitlement (the immediate truth) still drives the success message on the happy path; this PR makes the silent post-purchase profile-write failure observable. |
| **F-144** | `APU2FBCjLALmugeCLmQ4Ii0` (templates) + (notes/ratings) | 🔄 PR #173 | P0 persistence | New `src/lib/nutrition/persistenceErrors.ts:mapPersistenceError` translates Postgres codes (23503 FK violation / 22P02 uuid parse / 42501 RLS deny) into actionable copy. Wired into `recipeNotesClient.upsertUserRecipeNotes`, `recipeNotesClient.incrementCookCount`, and `recipeCookHistoryClient.insertCookHistory`. 23503 from the recipe-wipe cascade now surfaces "This recipe is no longer in your library — save it again to keep notes, ratings, and cook history." 9 unit assertions in `tests/unit/persistenceErrors.test.ts` pin each PG code path. Templates "Could not load" remains a separate diagnosis (deferred to a follow-up). |
| **F-145** | `ALcwMFPjf` + `AAtW7dYcCBP` (recurrences) | 🟠 PR #176 (snapshot fix) | P1 numbers | **Snapshot drift closed**: `dailyTargetSnapshot.ts` now resolves maintenance via the canonical `resolveMaintenance` helper at write time instead of storing raw `profile.adaptive_tdee`. Past-day reads now show the same number Today shows — resolved adaptive when confident + non-stale, Mifflin-St Jeor formula otherwise. Closes the "1900 today vs 1600 past" Maintenance divergence. **`getEffectiveTDEE` staleness check still parked**: that change touches every surface displaying maintenance and benefits from a focused PR. |
| **F-146** | `AEyOuUJrB4` (recurrence) | 🔄 PR #174 | P1 numbers | Week-view "Net deficit / Net surplus" tile at `apps/mobile/components/today/TodayWeekView.tsx` + `src/app/components/suppr/today-week-view.tsx` previously compared `weekConsumed > weekTarget` (consumed-vs-goal). **Wrong** when consumed is above goal but below total burn — that's still a deficit. Now plumbs `weekBurnTotal` (sum of basal + activity per day across the visible week — same data the Activity Bonus card already uses) through and labels by `weekBurnTotal − weekConsumed`. Web prop is optional with a `maintenanceForWeek × 7` fallback for callers not yet upgraded. |
| **F-147** | `AD6_JNUaEjoJ5phZ_N1kv6o` | 🔄 PR #174 | P1 numbers | Progress tab steps card flipped `stepsSyncStatus` to `success` immediately when the HK sync resolved, but the steps_by_day re-read landed shortly after — for users with no row for today in the initial profile load, the success branch painted "0" before the re-read flowed through. Today (different sync timing) showed the correct count. Fix: defer the success status flip to AFTER the re-read finishes, so the big number paints with fresh data. Mobile-only (web has no HealthKit). |
| **F-148** | `AF7bS2DQrH_wZWxGosBJ3K8` | ⏳ product call | P1 weight chart | "Weight chart 3/6/9 month buttons don't change months shown". The 6M / 9M pills literally don't exist in `apps/mobile/components/charts/TimeRangeSelector.tsx:26` — `RANGES = ["1W", "1M", "3M", "12M", "All"]`. Even if added, `weightTrendRange` collapses 6M/9M to `"1y"` buckets so they'd render identically to 12M (visual no-op). The 1M → 3M → 12M jump was an intentional 2026-04-26 polish prune. **Decision needed from Grace:** (a) re-add 6M with a real `"6m"` bucket (medium effort — extends `WeightRange` union + `weightTrendRange` switch + `computeWeightTrend`), or (b) keep current ladder + close as by-design with clearer copy if testers expect 6M. Defaulting to (b); reopen if (a) is the call. |
| **F-149** | (recurrence Theme 3) | ✅ PR #176 + 🔄 PR #179 (web parity) | P1 numbers | **Mobile retune (PR #176)** + **web Settings retune (PR #179)** both backfill past-day daily_targets snapshots before writing new target values. Same helper (`backfillDailyTargetsFromProfile`), same posture: `upsert(..., { ignoreDuplicates: true })` protects existing snapshots; only gaps fill. Wired into `apps/mobile/components/recap/GoalPaceRetuneSheet.tsx` (mobile) + `src/app/components/Settings.tsx:handleActivityLevelConfirm` (web). Web backfill only fires when `recomputed` is non-null (i.e. when targets actually change), not on every preference change. Past days without logs now show the target that was effective on that day, not the new one — both platforms. **Proper Theme 3 fix (`goal_history` table) still parked** — schema decision worth its own PR. |
| **F-150** | `AKvgjnb` + `APGJJlg` (recurrence Theme 1) + new mentions | 🟠 PR #175 (partial) | P1 portions | **Worst-case macro corruption closed**: `apps/mobile/lib/verifyRecipe.ts:317` previously did `unit === "g" && amount ? amount : 100` for the per-100g back-calc, so any non-gram unit (cup of rice, medium banana, etc.) divided macros by factor=1 and inflated per-100g by up to 58%. Now uses `measureToGrams` from the shared nutrition module. **Receiver-side fallbacks deferred**: 5 sites where the search panel's resolved `PrimaryServing` is thrown away on selection need a contract change to plumb `PrimaryServing` through the food-pick callback. Follow-up PR. |
| **F-151** | `APdpODtJDL8q2JhtGup6DK0` | ⏳ diagnosis needed | P2 broken | "Notifications don't appear to be working". Code path exists: `apps/mobile/lib/expoPushToken.ts` registers a push token to `profiles.expo_push_token`, `pushNotificationsSetup.ts` + `weeklyRecapPush.ts` consume it. Common failure modes: permission denied + cached "asked", token registration silently warns, server-side push not firing on cron. Needs a focused diagnosis with PostHog instrumentation on each step + a probe push send. |
| **F-152** | `AOOBv-1Ow` (recurrence Theme 7) | 🟠 PR #175 + #176 (3 sites) | P2 polish | **Mobile chrome lock-emoji sweep complete**: PR #175 caught 2 of 3 locked-chip instances in `apps/mobile/app/(tabs)/planner.tsx`. PR #176 follow-up caught the remaining 3rd (line 2059 — same pattern, different scope). All 3 locked-chip plan-length pills (1/3/7-day toggles in both Plan Setup and the inline planner) now render a real `Lock` lucide icon next to the label, not `" 🔒"` inside the text string. **Wider sweep still deferred**: shopping.tsx export-string emojis (`🛒 Shopping List`, `📌 ${cat}`) are kept (user-shareable text). `✓ Verified` in `barcode.tsx` + `NutritionSourceBadge.tsx` use checkmark abbreviations that could be lucide icons but are scoped follow-ups. |
| **F-153** | `AH8csBqtZsBJJr0uHgXyEcE` | ✅ already shipped | P2 feature | "Plan doesn't tell me how close it is to my macro targets". Verified shipped on both platforms. Mobile (`apps/mobile/app/(tabs)/planner.tsx:2238-2257`) renders calorie alignment + per-macro delta chips with tone-coloured tolerance bands ("P 154g +42  C 200g ✓  F 65g −5"). Web (`src/app/components/MealPlanner.tsx:884-899`) renders the same shape via `dayTotalLine.cells.slice(1).map`. Build-12 H-5 (2026-04-19) + F2-E (2026-04-28) closed this — tester report predates the fix. Closure on code-level argument; no PR needed. |
| **F-154** | (no specific ID, multiple mentions) | ⏳ later PR | P2 feature | "Way to share only dinner not whole plan, and not my macros (husband has different ones)". Per-meal share affordance + privacy strip on macros. |
| **F-155** | `AOI9xgY88Dx-uphiXI8IzEk` (recurrence of F-96) | ⏳ verify | P2 broken | "Unclear if Edamam is integrated yet — would expect meals from restaurants". F-96 was closed 2026-05-06 with Edamam Food Database swap; verify the restaurant-lookup path actually surfaces in the UI for restaurants the tester is searching. May be a UX issue (where do these surface?) rather than integration. |
| **F-156** | (no specific ID, multiple mentions) | ⏳ later PR | P2 feature | "Add-custom-food too thin vs MFP / Lose It". Parity gap with comparable trackers. Needs scoping pass. |
| **F-157** | (Grace 2026-05-10, screenshot in chat) | 🟠 PR #176 | P1 weekly check-in | "Burn lower than expected but proposes increasing cals". The build-47 floor explainer (PR #163) shipped — the modal correctly displays "Math would land at 1,039, capped at 1,200 minimum" — BUT the visual hierarchy buries it. Subtitle reads "Your real burn is −93 kcal lower than the formula", suggested target reads 1,200 (struck-through 1,132), explainer is fine print BELOW. Reads as a contradiction at a glance. Fix: reframe the `whyLine` in `src/lib/nutrition/weeklyCheckin.ts:buildWeeklyCheckinContent` when the floor binds AND suggestion > current — append "Your goal pace would dip below the safety floor, so we're suggesting X kcal/day (a slower pace) instead." in the SAME prominent line so the math + safety story are read together, not as separated facts. The fine-print explainer remains as backup detail. 2 new unit assertions in `tests/unit/weeklyCheckin.test.ts` pin both branches (floor-binds reframe + no-reframe when floor doesn't bind). |

**Recipe-related items deferred per Grace's 2026-05-10 brief (re-visit pre-launch):**
- `AJHZNp8NHTiFNk9TjQfdYBk` — "Imported MFP carbs way higher than actual" (recipe import accuracy)
- "Imported recipes lose source link" / "Esther Clark recipe — source not clickable" / "Some recipes pulling whole caption in as title"
- "Library inconsistency: some recipes have images, some don't" (the hero-images thread, paused pending strategy call)
- "Defaults to recipes that don't exist" on some surface (recipe library state)

**Other items in Grace's brief already closed in earlier waves:**
- "Score seems irrelevant — make it relevant or remove" → score pill removed from More + web Profile + score popover deleted in 2026-04-25 P1 sweep (line 46 above). Verify against build 47.
- "Discover feed pagination caps too low" → already raised in earlier sweep; verify if recurrence.

**Ship order (this multi-PR run):**
1. **F-140** — landing streaks honest copy. Self-contained, lowest blast radius. *(in flight as PR)*
2. **F-141 + F-142 + F-144** — P0 cluster (auth web parity + household telemetry + notes/ratings FK guard).
3. **F-143** — P0 payments diagnostics + operational config note (real fix needs Vercel + RC dashboard).
4. **F-145 + F-146 + F-149** — P1 numbers cluster (TDEE reconciliation, week-view net deficit, plan retroactive snapshot backfill).
5. **F-147 + F-148** — Steps mismatch + weight-chart range buttons.
6. **F-150** — 100g defaults sweep across the 6 call-sites.
7. **F-151 → F-156** — P2 polish + features in remaining waves.

---

**2026-05-08 — Build-44 testing session (11 new ASC items, F-131 → F-139)**

Grace's first session on build 44 surfaced 11 screenshot items in two bursts (00:44 UTC + 02:15-02:21 UTC). Mapped to 9 F-numbers (4 of the 11 are sub-symptoms of F-134). Triage:

| F# | ID | Page | Diagnosis | Status |
|----|----|------|-----------|--------|
| **F-131** | `AMmlpVOqMnaKKdV2dobjjjg` | Today / burn-summary card | "Need to check this number is correct - would be helpful to click on here and see what it's made up of" — exact validation of Pattern #9. PR #143 wired the WhereThisComesFromSheet on `TodayActivityCard` only; the burn-summary card / 7-day rolling summary card needs the same affordance. | ⏳ partial fix shipped (Today activity), burn-card extension pending |
| **F-132** | `AGNEODiMEK7F` + `ALP1WPzhIZqba0TBcWKw7gU` | Progress + Weight tracker | "Do we need weight graphs in 3 places? Do it once and do it well" + "Page is so slow to load". F-125 unified the chart components but not the surfaces — Progress page renders both a small weight widget AND a bigger weight section, plus the standalone `/weight-tracker` route. | ⏳ — needs UX consolidation pass |
| **F-133** | `AFlB4oMfwQGIFx-w0DxOofE` | Weight & Trends | "Graph is broken" — the y-axis stretches to include the goal line (50 kg) when current is 54.6 kg, so the actual data line collapses to near-invisible at the top of the plot area. Looks like one floating dot with the rest empty. | ⏳ — y-axis clip logic |
| **F-134** | `AH2YKLI84Fc` + `AIwJjIxWtKm` + `ALYyTJ5iBRo` + `ADU-JU` | Barcode result sheet | **Same visual bug across 4 of 11 screenshots** — a rounded grey blob sits stacked behind the barcode result sheet. Looks like an orphan modal layer or a misplaced backdrop pill. P0 — visible on every barcode scan. | ⏳ P0 |
| **F-135** | `ADU-JU-1zRIm2WQBeovKEjA` | Barcode result | "Log · 1 rice paper (~9" green button text wraps mid-token; "11.33 rice papers" chip uses absurd decimal precision. | ⏳ |
| **F-136** | `AG5LqMGUpER2Gqi5N03_ytc` | Scan Barcode empty state | Red error icon for an informational state ("We don't have this product yet" isn't an error). 3 stacked CTAs ("Snap the label / Scan again / Enter manually") = decision fatigue. | ⏳ |
| **F-137** | `ALYyTJ5iBRo3qzeXngFZclA` | Barcode result | "Need to be able to edit simply like 4 nuggets instead of edit the grams. Like it says 1 nugget I should be able to select that and say 4 of 1 nugget like mfp lose it etc". Portion chip needs a count multiplier. | ⏳ — UX design |
| **F-138** | `AIwJjIxWtKm1szmRd4CkzWs` | Correct This Product | "Need a better way of adding to the database. Need some sort of submission success this will be verified by the team etc". Submission has no confirmation toast / success state / verification status messaging. | 🟡 Phases 0–2 shipped (success card + honest copy + P0 schema hardening + plausibility/consensus). Phases 3 (vote UI + flagging + two-path submit) / 4 (admin) / 5 (trust + vision auto-verify) scoped in `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`, deferred to a focused multi-day session. |
| **F-139** | `ACyWRLx2M-_D9t2jdcNjmaU` | Today | "The goals hit banner looks cheap" — solid blue banner overlaps the calorie ring. Needs lighter visual weight + non-overlapping placement. | ⏳ |

**Ship order (this turn):** F-134 (P0, fixes 4 screenshots) → F-135 + F-136 + F-139 (UI batch) → F-131 (Pattern #9 v2) → F-133 (chart y-axis). F-132 + F-137 + F-138 deferred to a focused UX session.

**Source:** `docs/testflight-feedback/data/feedback-2026-05-08.json` (171 screenshots / 6 crashes / 10 builds; URLs valid through 2026-05-13).

**2026-05-08 — Architectural follow-ups batch (PRs #140–143, the next TestFlight cut after build 44)**

Four parked architectural items shipped in one batch.

- **PR #140 — UI-critic P2 batch.** Mobile F14 (`weight-tracker.tsx` "Historical import depth" 4-sentence paragraph trimmed). Web parity for F4 (recipe `0g`/`0mg` micros hide), F8 (ProgressMetricDetail + today-week-view "Tap a day" helpers removed), F11 (web streak `0` headline hidden when streakDays===0).
- **PR #141 — F-130 cross-device tombstone.** New `deleted_health_samples` table (user_id, health_sample_id, deleted_at, source) + RLS + L1 (AsyncStorage) / L2 (Supabase) helper. Tombstone now survives reinstall and cross-device sync. Migration `20260510100000_deleted_health_samples.sql` applied via `supabase db push --linked`.
- **PR #142 — F-74 cross-device.** `recipes.caffeine_mg` + `alcohol_g` + matching `recipe_ingredients` columns. Verifier rolls up per-ingredient → per-serving. `fetchPlannedMealMicros` reads + scales them so the planner-tab "Log today" + recipe-detail "Add to today" log paths now populate caffeine/alcohol on the meal row (closes the "honest closure" gap from PRs #128 / #132). Migration `20260510100100_recipes_caffeine_alcohol_aggregates.sql` applied.
- **PR #143 — Pattern #9 (`AN8GJ1Dr3M`) provenance affordance.** New `WhereThisComesFromSheet` (mobile) mirroring `WhyThisNumberSheet` shape. Info icon on `TodayActivityCard` opens a bottom sheet showing source / range / "Last synced X ago" + a "Sync now" CTA. `healthSyncMeta.ts` stamps `lastSyncedAt` to AsyncStorage after every successful sync. Closes the architectural unblock for the most-frequent surface (Today). Burn-detail mount + web parity deferred to a follow-up.

Net open after this sweep: **2 ⏳** (F-108 / F-114, both await tester re-verify on the next TestFlight cut after build 44) + **1 🔍** (`AN8GJ1Dr3M` — code-level closure but tester-side still needs the build install). All architecturally-deferred follow-ups now shipped.

**2026-05-08 — Build 45 / 46 / 47 hotfix cluster (PRs #154–#163, 5+ OTAs)**

Three same-day TestFlight builds. Build 45 caught two latent bugs (edit-meal freeze + voice-log no-op). Build 46 was rejected by Apple (90683 — missing `NSSpeechRecognitionUsageDescription`). Build 47 unmasked a critical data-loss issue (re-install wiped ~25 days of meals) plus four follow-up product asks. All 9 work items shipped via the next OTA / TestFlight cut.

| Item | PR | Fix |
|------|----|-----|
| Apple 90683 reject — missing speech-recognition purpose strings | #157 | `expo.ios.infoPlist` on `app.json` (the `expo-speech-recognition` plugin only handles Android) |
| iPhone Camera HEIC → Anthropic 400 invalid base64 | #158 | Server-side `normalizeImageForAi` (sharp; 2048px cap; auto-rotate) plumbed into all 3 image routes |
| Voice button silent no-op | #159 | `voiceLog.ts` rewrite — package exports `ExpoSpeechRecognitionModule` named (not default) and uses `start()` / `stop()` (not `*Async`) |
| **CRITICAL — re-install wiped ~25 days of meals** | #160 | All 8 `setByDay` paths in `(tabs)/index.tsx` now go through `persistMealsImmediate`; old 600ms-debounced useEffect was cancelling on every dep change |
| Weekly-checkin pop-up loop on every meal edit | #161 | Edit-flow guard now sets `weeklyCheckinHandledRef.current = true` so the modal stays suppressed for the rest of the session |
| Per-100g vs Per-serving toggle missing on the LOG card + auto-log after correction-save | #162 | Mirrors the toggle from the correction form; "Log this now" CTA on success card pre-fills gramsInput to one serving |
| TDEE-vs-target floor explainer (Grace `APPzhqLXgb64_9reZ44rGk4` — "If my tdee is lower why is my target higher?") | #163 | Expose raw pre-clamp target via `floorAppliedKcal`; modal renders calm copy when the 1,200 kcal/day safety floor is applied |
| AI errors + "no vitamins and minerals even when they do exist" | (deferred) | Scoped in `docs/decisions/2026-05-08-ai-photo-log-micronutrient-gap.md` — right fix is to wire AI photo-log items through the existing OFF/USDA/FatSecret matcher on commit (not extend the AI prompt). Sequenced after F-138 Phase 5 |
| F-138 Phase 0–2 (correction success state + P0 schema + plausibility) | #148, #150–#153 | Honest copy + numeric constraints + RLS hardening + state-machine guard + `verified_food_canonical` projection + 3-tier `lookupBarcode` read |

Plus a CI unblock (PR #163 follow-up): integration tests that fed 4-byte fixture buffers to `normalizeImageForAi` were 415-ing on every multipart-passing case after #158 merged, so main was red on `test`. Mocked the helper at the test boundary; real sharp coverage stays in `tests/unit/normalizeImageForAi.test.ts`.

Net open after this sweep: F-138 Phases 3 / 4 / 5 (vote UI + admin queue + Claude-vision label-photo verify) — multi-day, scoped in the same decision doc. F-132 (weight-chart consolidation) + F-137 (portion-chip count multiplier) remain deferred to a focused UX session per the build-44 ship order.

**2026-05-07 — F-130 fix shipped (PR #137, the next TestFlight cut)**

Grace (out-of-band, 2026-05-07): "sometimes when items copy from MyFitnessPal / Apple Health etc. even when I try to delete them, they don't delete. for example if a duplicate entry shows up." The bug: HK sync's dedup logic in `apps/mobile/lib/healthSync.ts:1709` queries `nutrition_entries` for existing rows with `source = 'apple_health'`. When the user deletes a row, it leaves the table — so the next sync sees the same HK sample, finds no row to dedup against, and re-imports it. The "duplicate" reappears every sync.

Fix: AsyncStorage-backed local tombstone keyed by HK sample UUID.
- New helper `apps/mobile/lib/deletedHealthSamples.ts` with `markHealthSampleDeleted` / `loadDeletedHealthSampleIds` / `clearDeletedHealthSampleIds`.
- `deleteMeal` in `(tabs)/index.tsx` now reads `source + health_sample_id` from the row before deleting; if the row was apple_health-sourced with a non-null sample id, marks it tombstoned.
- HK sync `existingHkIds` set OR'd with the tombstone before the dedup check.

Tests: `apps/mobile/tests/unit/deletedHealthSamples.test.ts` (6 cases) — empty on init, persists across reloads, ignores null/empty ids, dedupes, clears, survives corrupted payload.

Scope cap: tombstone is local-only (one device). Fine for solo tester (memory: project_solo_tester). Cross-device durability would need a server-side column on `profiles.deleted_health_sample_ids` or a `deleted_health_samples` table — filed as a follow-up for the next focused session.

---

**2026-05-07 — F-76 fully closed (build 44, PR #125)**

F-76 had been kept ⏳ since 2026-04-25 because the build-41 fix only sanitised the `meta.title` fallback. Tester `AFVnLJIVdjQY` showed the leak still happened when the LLM's `recipe.title` itself carried caption shape. Build 44 closes the rest: `sanitiseImportedTitle` is now called at every response-shape title site across `app/api/recipe-import/{,image,caption}/route.ts`. New static-analysis test (`recipeImportTitleSanitiserCallsites.test.ts`) pins the contract — each route file must invoke the helper for each response branch (3 / 1 / 1 minimums). Net open after this PR: **7 ⏳ items** (F-73 / F-74 / F-103 / F-106 / F-108 / F-113 / F-114) + 2 🔍.

**2026-05-07 — F-113 fully closed (build 44, PR #126)**

F-113 (`AMg4BaMwZWZ8`, "Journey numbers are wrong") was kept ⏳ pending tester re-verify against the F-126 fix. Investigation found the F-126 fix (a117789) only landed on mobile — `apps/mobile/app/(tabs)/progress.tsx` passes `observedKgPerWeek` to `projectWeight`, but `src/app/components/ProgressDashboard.tsx` (web Journey card) was still calling `projectWeight` without the argument, so web users would have seen the same wrong projection numbers Grace originally reported. Web parity now wired (mirrors mobile derivation: `timeline.weeklyRateKg` × `timeline.trendDirection`), with a parity-pin test (`journeyProjectionWebParity.test.ts`) that asserts both files mention `observedKgPerWeek` ≥ 2 times and derive from `timeline.weeklyRateKg`. Net open after this PR: **6 ⏳ items** (F-73 / F-74 / F-103 / F-106 / F-108 / F-114) + 2 🔍.

**2026-05-07 — F-73 closed (already shipped 2026-04-27)**

F-73 (`AKtz5LtrL39b39-CPXdFE08`, "cortado returns Spanish cheese") had been ⏳ kept since 2026-04-25 documented as "DB coverage" + "ranking refinement" work for a separate session. Walking the code: `src/lib/nutrition/genericBeverages.ts` ships 30 generic-beverage entries (espresso/americano/cortado/flat-white/cappuccino/latte/macchiato/mocha/drip/pour-over/cold-brew/black-tea/green-tea/matcha-latte/chai-latte/herbal-tea/earl-grey/whole-milk/semi-skimmed/skim/oat/almond/soy/orange-juice/apple-juice/red-wine/white-wine/lager/IPA + 1) covering every named complaint plus the broader "milk", "green tea", "red wine" class. `matchGenericBeverage(query)` is wired at the TOP of merged search results in both `apps/mobile/lib/verifyRecipe.ts:888` and `src/app/components/food-search/FoodSearchPanel.tsx:630`, so a generic match preempts USDA Branded noise synchronously. 17 unit tests + alias coverage including typos (cappucino / capuccino). Tester report predates the 2026-04-27 fix. Closure on code-level argument; no PR needed.

**2026-05-07 — F-106 closed (already shipped 2026-05-01)**

`AECfotBlQgwf` ("No way to add recipes saved to library from here"). Walking the code found this was already fully addressed on both platforms:
- Mobile `LogSheet` has a Library tab (`recipes`, `onPick`, `onBrowseRecipes`) wired from Today via `useSavedLibraryRecipes` — see `(tabs)/index.tsx:5067`.
- Web `NutritionTracker` mirrors the LogSheet `library={{...}}` prop with the same shape — `NutritionTracker.tsx:3191`.
- Mobile Planner has "Open recipe library" + "Browse recipe library" CTAs — `(tabs)/planner.tsx:1998 + 2115`.
- Web Planner shipped equivalent entry points in F-72 (2026-04-24).

Tester report `AECfotBlQgwf` predates the 2026-05-01 fix. Closure on code-level argument; no PR needed.

**2026-05-07 — F-114 robustness fix in most-likely-suspect surface (the next TestFlight cut, PR #129)**

`AHOkMJ8yu5hA` ("Gets stuck trying to get more data") doesn't pinpoint a specific surface, but the FoodSearchPanel pagination is the only `onEndReached`-driven loader on either platform. Reading the code surfaced a real bug: the `loadMore` callback had `try/finally` but no `catch`. A throwing `searchFoods` (network failure, session refresh hang, server 5xx) left `hasMoreRef.current = true` while the spinner reset to false. Every subsequent scroll-to-bottom retriggered the failing fetch — the user sees an endless spinner cycle with no explanation.

Fix (mobile + web parity): `try/catch/finally` with the catch setting `hasMoreRef.current = false` and logging the failure. The list settles into a final state on first error. Static-pin test (`foodSearchLoadMoreErrorHandling.test.ts`) asserts both files contain the catch block AND ≥2 `hasMoreRef.current = false` assignments (one for empty-page, one for catch).

F-114 stays ⏳ pending tester re-verify on the specific surface. The robustness fix reduces the known stuck-pagination footprint; if the tester's "stuck" was elsewhere (HealthKit historical pull, Progress chart cold-load), a follow-up pass will hunt it.

**2026-05-07 — F-74 / F-103 fully closed (the next TestFlight cut, PR #128)**

The double-count bug discovered earlier today is now fixed. Picked **per-meal `micros` as canonical SoT** (deletes self-heal; matches macros pattern). Changes:

- Removed every `bumpStimulantsForLoggedMeal*` call from food-log paths: mobile `(tabs)/index.tsx` (×3 — quick-add-meal, food-search, AI-commit + duplicate-day + planned-meal), mobile `(tabs)/barcode.tsx`, web `useNutritionJournalState.ts` (single-meal + bulk).
- Removed every `updateStimulantsForDay({caffeineMg: -X, alcoholG: -Y})` decrement-on-delete call (mobile + web). Per-meal row removal automatically drops the contribution from `caffeineFromMealsMg` on the next render.
- Quick-add (`addCaffeineMg` / `addAlcoholG`) keeps writing the ledger directly — that ledger now holds quick-add only.
- Dead-code purge: deleted `src/lib/nutrition/bumpStimulantsForLoggedMeal.ts` + `updateStimulantsForDay.ts` + their tests + 2 inverted parity-pin tests (`bumpStimulantsParity.test.ts`, `stimulantsAutoTrackParity.test.ts`).
- New test `stimulantPerMealCanonicalSot.test.ts` (11 cases): behavioural pin (single 64mg espresso displays as 64, not 128; quick-add + meal stack additively; delete self-heals) + static pin (log paths must NOT call the helpers).
- Stale comments swept across `recipe/[id].tsx`, `usdaNormalize.ts`, `aiLogging.ts`.

Net open after this PR: **3 ⏳ items** (F-106 / F-108 / F-114) + 2 🔍.

---

**2026-04-25 ASC pull (build 39; `npm run testflight:feedback`):** 139 screenshot / 6 crash threads. **+4 new rows** vs the 2026-04-24 pull:

- `AKtz5LtrL39b39-CPXdFE08` — ⏳ **F-73** (search relevance + DB coverage) — "cortado" returns Spanish cheeses/lacón cuts, not the coffee drink. Two compounding causes: (a) OFF user-uploaded rows for unrelated foods named *cortado* outrank our intended hits with no trust weighting; (b) common drinks (cortado, flat white, cappuccino) need first-class generic rows in our seed. Ranking fix is a sibling of F-71/F-74; DB coverage is its own track.
- `AN3mTmZK5T2Nhj13aMFLk2E` — ⏳ **F-74** (logged-food → caffeine/alcohol cross-update) — log a cortado in the food diary, the Caffeine card stays at 0/400 mg. Same for wine → Alcohol. Currently the Hydration & Stimulants chips and the food log are isolated stores. Architectural: `caffeine_mg` and `alcohol_g` should be **derived** from logged foods + manual quick-add, not a separate ledger.
- `AO5PEI1xgamOQ-Nx4Gbr8Ok` — ✅ **F-75** (closed 2026-05-06 by #98 + #105 — see F-98) — "Tap meal for full nutrition" now actually surfaces per-meal micros. Root cause was the OFF-only `microsPer100g` pull-through path; USDA/Edamam/FatSecret all wired now. Calcium/iron/vitamins still read "did not publish" for FatSecret-sourced meals (intentional — units are unsafe), accurate "did not publish" for Edamam beyond fiber/sugar/sodium (their endpoint genuinely doesn't ship more).
- `AFVnLJIVdjQY7bkWyi0AG8A` — ⏳ **F-76** (caption-as-title on import) — Instagram/TikTok captions sometimes land in `recipe_title`. Stricter title-trim rule needed (already partially handled by `stripSectionPrefix`; this is the title not the ingredient row).

**Internal observations (Grace, 2026-04-25 review session — not on TestFlight as separate IDs but actioned same day):**
- **F-77** OFF poisoned generic-name rows (`Eggs` → 210 kcal / 3 g protein @ 40 g) outrank verified USDA. Atwater plausibility gate + trust-weighted ranking — see commit closing this row.
- **F-78** Barcode `lookupBarcode` JSON parse error toast despite UI populating. Missing `res.ok` guard before `res.json()` on direct OFF v2 fetch + duplicate-call race from `expo-camera` re-fires. `res.ok` guard + `useRef`-based dedup.
- **F-80** Meal-card header text-wrap regression — the "Log usual: <name>" pill crowded the title column to ~80 px so "Breakfast" letter-wrapped. Mobile `TodayMealsSection.tsx` — `numberOfLines={1}` on title + meta, `flex: 1, minWidth: 0` on title column, `flexShrink: 0` on trailing controls, `maxWidth: 160 + flexShrink: 1` on the chip. Web was already fine (Tailwind `truncate` + `flex-1`). Pinned by parity test.
- **F-81** Raw `[searchUsda] failed: Aborted` toast on Today screen. AbortError fired by debounced re-fetch cancellations was being `console.error`'d. New `isBenignAbort` helper in `verifyRecipe.ts` filters AbortErrors at all three search paths (USDA / OFF / Edamam).
- **F-82** "100% of macro calories" misled on partial-data items (Fly By Jing chili crisp = 0/0/3g rendered as "100% fat"). Shared `src/lib/nutrition/macroSplitConfidence.ts` decides between `complete` / `single_macro` / `empty` states; `single_macro` swaps the misleading bar/% for an attributed explainer ("Only fat reported — protein and carbs not published by source"). Atwater check ensures real single-macro foods (olive oil, sugar) still render normally. Mobile `meal-nutrition.tsx` uses the gate; web has no equivalent surface yet.
- **F-83** "7-day avg: ~2 kcal/day deficit" was below logging precision — read as broken to the user. `TodayDeficitInsight.tsx` now hides the sub-line when `|avgDeficit| < 50` kcal/day (≈ 0.05 kg/week threshold).
- **F-84** Day/Week toggle competed visually with the prev/next chevrons + week strip + calendar icon (customer-lens 2026-04-25: "three time-navigation things — why?"). Replaced "Day"/"Week" text labels with sun-outline / grid-outline icons in `TodayDateHeader.tsx` so the scope toggle reads visually distinct from date-nav. Accessibility labels preserve the original wording for screen readers.
- **F-85** Recipe detail (mobile + web): de-CAPS shouty imported titles ("HEALTHY 3 INGREDIENT…" → "Healthy 3 Ingredient…") via shared `src/lib/recipe/normaliseDisplayTitle.ts` (preserves protected acronyms PB / BBQ / UK and lowercases short articles in middle position). Per-ingredient macro split bar removed from `apps/mobile/app/recipe/[id].tsx` — recipe-level split in the Nutrition tab is the source of truth; per-row bars added visual noise. Web parity applied in `RecipeDetail.tsx`.
- **F-86** Meal-detail "Vitamins, minerals & more" panel rendered 14 rows of "—" on OFF entries with no micros (read as a debug surface). Now renders a single attributed empty state ("Open Food Facts did not publish vitamin or mineral data for this product.") when zero micros are populated; otherwise renders the full list with a count + source attribution and uses "Not published" instead of "—" for absent fields. F-79 (OFF micronutrient ingest) now writes the data — F-86 frames absence as the source's gap, not Suppr's.
- **F-91** Tester re-verified after F-88: search row for verified USDA generics ("Eggs, Grade A, Large, egg whole" / "Bananas, raw" / "Apples, raw, with skin") still rendered "per 100g". Root cause: USDA's `/foods/search` endpoint does not ship `foodPortions[]` for Foundation / SR Legacy hits — only `/food/{id}` does. F-88 fixed the picker (post-tap by fetching detail) but the row display itself still had `primaryServing = null` because there was no `foodPortions[]` to derive from at search time. Fix: name-based natural-serving inference in `src/lib/nutrition/inferNaturalServing.ts`. Pattern table maps verified USDA descriptions → known natural serving (`Eggs, Grade A, Large, egg whole` → 1 large egg = 50g, `Bananas, raw` → 1 medium banana = 118g, plus apples / oranges / pears / peaches / plums / kiwis / avocados / mangoes / nectarines / strawberries / lemons / limes / grapefruit / tomatoes / carrots / cucumbers / bell peppers / onions / potatoes / sweet potatoes). Gram weights come from USDA's own foodPortions[] for the corresponding detail rows so picker (F-88) and search row (F-91) stay consistent. Inference fires only on verified rows — branded "EGGS" rows must use their own `servingSize` field via `pickUsdaBrandedPrimaryServing`. Mobile + web parity. 11 unit tests + 2 parity assertions.

- **F-89 + F-90** Tester re-verified after F-87/F-88: searching "egg" still returned a row called just `"Egg"` at 525 kcal/100g (1 egg 31.2g = 160 kcal — internally consistent, passes Atwater, but a misnamed Edamam product), and searching "eggs" returned `"Cacio E Pepe Ravioli"`, `"E+quenchal Water"`, `"Mister E Flavor Toaster Pastries"` etc — Edamam category-tag matches that have nothing to do with eggs. Two new defence-in-depth filters in `src/lib/nutrition/searchRowTrust.ts`:
  - **F-89 `isBareGenericNounRow`** — drops a non-verified row whose post-brand display name is a single bare generic-food noun (egg / eggs / banana / chicken / milk / 60+ others). Verified USDA always carries modifiers ("Eggs, Grade A, Large, egg whole" / "Bananas, raw"), so a bare noun from Edamam / OFF / USDA Branded is presumed mis-labelled and dropped.
  - **F-90 `isLowRelevanceNonVerifiedRow`** — drops non-verified rows with relevance < 0.30 (catches the "Cacio E Pepe Ravioli" surfacing because Edamam tags it as containing eggs). Verified USDA exempt at any relevance — the user typed something the verified corpus matched, that's the canonical answer.
  
  Applied in mobile `mergeResults` and web `mergeAndDedup`. 10 unit tests + 2 parity assertions across the F-80…F-90 audit pin file.

- **F-88** Singular items (eggs, bananas, apples) defaulted to grams instead of "1 medium" / "1 large". Two compounding causes: (1) USDA's `foodPortions[]` for SR Legacy bananas (fdcId 173944) lists `modifier: "NLEA serving"` (the FDA Nutrition-Facts-label standard, 126g) FIRST — picker took the first non-blocklisted row; (2) label assembly used `measureUnit.name` literally, which on USDA non-branded rows is `"undetermined"`, leaking into chip text as `"1 undetermined NLEA serving"`. Fix: score-based picker in `pickUsdaFoodPortionsPrimaryServing` rejects NLEA / household-reference rows, boosts `medium > large > whole > small > extra large` via ranked regexes (negative lookbehind keeps `\blarge\b` from matching "extra large"), strips `"undetermined"` measureUnit + parenthetical size hints from labels. Server `/api/usda/food` route also returns a `primaryPortion` field so the client can default to "1 medium" / "1 large" even when the search-stage primaryServing was null (USDA's search endpoint doesn't ship foodPortions on non-branded hits). Mobile + web parity. 7 new unit tests + all 23 existing primaryServing tests green.
- **F-87** Tester re-verified after F-77: searching "Eggs" still returned a USDA Branded row showing **160 kcal at 31g serving = 513 kcal/100g** for what looks like a chicken egg. Root cause: USDA's default scoring put a misnamed branded product called "EGGS" (a baked/glazed product whose macros agree internally so passes Atwater) above the verified Foundation row "Eggs, Grade A, Large, egg whole". F-77 plausibility caught arithmetic poison but couldn't catch internally-consistent garbage. Fix: server-side two-stage fetch in `src/lib/usda/fdcClient.ts` (verified types — Foundation, SR Legacy, Survey (FNDDS) — fetched in parallel with branded; verified slice ~60% of page size, leads the merged list) + client-side trust demotion in mobile `mergeResults` and web `mergeAndDedup` (USDA verified +0.10, USDA Branded −0.15 — larger penalty than OFF-branded because USDA Branded looks authoritative but isn't). 6 unit tests pin the two-stage path.
- **F-79** OFF micronutrient pull-through — sugar/sodium/satfat/mono/poly/trans/cholesterol/caffeine/calcium/iron/magnesium/phosphorus all "—" on logged OFF items. **Shipped 2026-04-25**: shared `src/lib/openFoodFacts/parseOffMicros.ts` (parser + `scaleMicrosForGrams`) applied at every OFF ingest point (mobile `searchOpenFoodFacts` + `lookupBarcode`, web `searchOff` in `FoodSearch.tsx` + `searchProducts.ts` + `fetchProductByBarcode.ts`); `microsPer100g` threaded through `OffSearchResult` / `BarcodeProduct` / `UnifiedSearchResult` / `SelectedFood` / `FoodSearchSelection` / preview state; commit sites (`apps/mobile/app/(tabs)/index.tsx` Today food log, `apps/mobile/app/(tabs)/barcode.tsx`, `src/app/components/NutritionTracker.tsx` Today search + barcode dialog) write the full scaled set into `nutrition_entries.nutrition_micros`. F-13 caffeine/alcohol explicit overrides preserved via `merge` arg. Bonus: caffeine extraction in `fetchProductByBarcode.ts` (declared but never populated) now also wired. 25 new passing tests (12 parser unit + 13 cross-platform parity pin). No migration needed — additive jsonb writes, display layer already gracefully renders absent keys as "—".

**2026-04-24 ASC pull (build 39; `npm run testflight:feedback` @ 16:03Z):** 136 screenshot / 6 crash threads. Deduped summary now ships **`screenshots[].url`** (time-limited) for vision triage — see `scripts/fetch-testflight-feedback.mjs`.

**2026-04-24 action shipped (F-71 / F-72):**
- **F-71** — Meal-plan coherence when DB rows have kcal but P/C/F ≈ 0: shared `src/lib/nutrition/coerceRecipeMacrosForPlanning.ts`; applied in `generateSmartPlan` + web `generatePlanFromLibrary` (sampler adds `mealPlanPortionSpreadPenalty` for extreme 0.2× vs 1.8× spreads); mobile `planner.tsx` coerces relational `meal_plan_meals` rows + generator pool inputs. Targets TestFlight `AGSeM-FnnYbZy6FJveUKBoc` (portion + 0g macro rows), `APPRkg_BADnAUvYA2GNIILY`, `ALbFGzbT4ImWVgX0FzXDGOY`, `AHQdqnRxBaTHxYN3vuzV4CM`, `AJ_dfDvM2j6rnkOAgHTpwig` (partial — household layout still C5).
- **F-72** — Plan tab library entry: **Open recipe library** (empty plan card) + **Browse recipe library** (when a plan exists). Targets `APHEBaM02gFAhoeHQ5mtxuE`, `AFF_UA88-CeE5TDCRhbaY_M`.

**Same pull — still open / design-only:** `ABo2673OW9Z_GsXuifRsOjo` (⏳ MFP-style secondary IA — needs product pass, not a one-line fix).

**Action-round plan:** per-cluster next steps in [../planning/testflight-2026-04-22-action-plan.md](../planning/testflight-2026-04-22-action-plan.md).

**2026-04-22 pilot-round action shipped (8 F-tracks):**
- **F-56** Trend-tile stale-data guard (>14 day recency) — closes `AOVuCyOCNB1p…`.
- **F-57** HealthKit dietary-perm-denied recovery — closes `AEzcUFvXt…` + 3 siblings (Open Health deeplink + post-sync Alert when body moves but dietary returns empty).
- **F-58** Plan tab Pro→Free downgrade guard + `ensurePurchasesUser` — closes `ADpuHU6O` + 2 siblings. Pure helper `resolveNextTier` pinned with 7 test cases.
- **F-59** Discover cache poison fix — closes `AEwoLmeE` + 2 siblings. Never persist or return cached empty array; prod has 20 discoverable seeded recipes per direct Supabase query.
- **F-60** Today hero shrink (Ring 160→140, Number 56→44) — closes `AB6WOylB` + 1 sibling.
- **F-61** Discover "More ideas" now renders hero-style cards (uniform social-feed density) — closes `AEq5NTi0n…`.
- **F-62** Import empty-state split (denied vs already-own vs genuinely-empty) — closes `ABG0cZzo` + 1 sibling.
- **F-63a/b/d/e** Plan day-card density, Library filter pill clip, Household Settings duplicate header, Recipe ingredient kcal clip — closes 6 C9 submissions.
- **C10** `AHS6xzyU…` closed ✅ as duplicate of `AA63DQ7xd…` (score already removed everywhere).
- **C11** `ANfXXs6H…` ✅ — ops fix applied 2026-05-01: Grace regenerated the Edamam keys in the developer portal and updated Vercel env vars (`EDAMAM_APP_ID` / `EDAMAM_APP_KEY`). `searchEdamam` resumes returning results; no code change required.
- **C9c** (`AIC05bpyu…`) ✅ — Health Sync redesign shipped 2026-04-22 (commit 41b1262). HealthStatusPill + HealthDataRow, three-state pill, AsyncStorage last-values cache, no per-type permission UI. Decision: `docs/decisions/2026-04-22-health-sync-redesign.md`.
- **C5** Household Netflix-model ✅ — shipped 2026-05-01 in two commits: schema + RLS privacy pin (5cc6b88), then runtime wiring (a5e9fa4). Per-member `share_preset` drives meal filtering; `disbanded_at` soft-delete; `cook_display_name` snapshot on insert; preset picker updated (web + mobile). Decisions: `docs/decisions/2026-05-01-household-netflix-model-v1-schema.md`.
- **C6-chart** Weight chart redesign ✅ — shipped 2026-04-22 (commit 435335f). Inline SVG chart, 7-day MA, range toggle (1W/1M/3M/1Y/All), sparse-state for <3 weigh-ins, goal line, stale chip.
- **F-64** Recipe image upscale — parser prefers og:image; 12 of 20 prod rows backfilled; 4 new regression tests pinned.

**2026-04-22 build-29 action shipped (5 F-tracks):**
- **F-65** Health connected state now persisted in AsyncStorage — tapper no longer needs to re-grant on every app launch. Closes `AI3j3W0pb4KXOeHpfSb_4bg`.
- **F-66** Import API: always return parsed ingredient amounts/units even when `verifyIngredients` throws — fixes all-zero kcal on difficult recipes. Closes `AFFLASGiZtipiNIVNStLAxM`.
- **F-67** Recipe Verify screen: tap any ingredient → expanded row now shows a Remove button (confirm dialog → deletes from DB + removes from local state). Closes `AMp-9LdEySJR-4b3FoO5zI0`.
- **F-68** Recipe detail: cook/prep times ≥60 min now format as `Xh` or `Xh Ym` (mobile + web). Closes `AEnCdLrqNCk8S5IbqYD-ma8`.
- **F-69** Discover hero cards now show `{P}g P · {C}g C · {F}g F` instead of protein-only. Web parity applied in same commit. Closes `AE2MdvYfJVQL298eoF_fps4`.

**Build-29 new submissions (9) — triage:**
- `AI3j3W0pb4KXOeHpfSb_4bg` — 🟡 C1 repeat (HealthKit); F-65 shipped (persist connected state).
- `AFFLASGiZtipiNIVNStLAxM` — 🟡 0 kcal ingredients; F-66 shipped.
- `AMp-9LdEySJR-4b3FoO5zI0` — 🟡 Can't delete ingredients; F-67 shipped.
- `AEnCdLrqNCk8S5IbqYD-ma8` — 🟡 360m not formatted; F-68 shipped.
- `AE2MdvYfJVQL298eoF_fps4` — 🟡 Discover cards protein-only; F-69 shipped.
- `AD3qa1g9ZI7Co3tvazH-yUQ` — ✅ C11 repeat (Edamam keys resolved ops-side 2026-05-01).
- `AHjCqNMXhdrnnUIikNRWdW0` — 🟡 F-70 shipped: plan algo was storing fit multiplier as `portionMultiplier`; `dayPlanTotalsFromMeals` then double-applied it (e.g. 1,667 kcal plan displayed as 5,421 kcal). Fix: fit mult baked into `calories`, never set as `portionMultiplier`.
- `AEVC-WdrU9sw9ql6rDR62e8` — ⏳ F-70 weight chart crosshair/zoom (covered by weight chart redesign brief).
- `AK91aaRcQ6ILWgQIvCatZXI` — 🟡 C5 repeat (household invite in wrong place; Netflix-model brief covers it).

All tracker rows now have IDs mapped to an F-number, a routing verdict, or a design brief with a concrete executor path.

**2026-04-22 pilot-round pull delta (+34 new rows):** grouped into 11 clusters — **C1** Apple Health still broken (×4), **C2** Pro→Free on Plans (×3), **C3** recipes not seeded (×3), **C4** calorie hero still massive (×2), **C5** household prototype drift (×4), **C6** weight graph (×3), **C7** Discover feed cards (×2), **C8** import "no meals" bug (×2), **C9** layout/spacing/prototype mismatch (×7), **C10** score removal repeat (×1), **C11** Edamam status (×1). Plus 1 meta (✅ Confirming build) + 1 🔍 (no comment).

**2026-04-22 delta (builds 23 → 27):**
- **F-37..F-42** (build 23): HealthKit init split, household create success Alert, multi-item meal modal stays open, recipe `/n` regex widened, recipe source name clickable, notes `recipe_id` uuid guard.
- **F-43..F-46** (build 23): RC+promo reconcile on Plan mount (fixes Pro-shown-as-Free); HK nutrition + body lookback 120/366 → 730 days; fit-% pill removed on Discover (web + mobile).
- **F-47..F-48** (build 23): Today hero calorie section shrunk (Number 80→56, Bar 44, endpoint row killed, gesture caption dropped); household card caption clarified ("Your remaining calories and macros for today. Members' targets are private.").
- **F-49** (build 26): visible build-stamp in **More → Build** — tester can screenshot "MARKER F49-2026-04-22" to confirm which binary is installed.
- **F-50** (build 27): **HealthKit single-init** consolidation (reverts F-37 split — iOS was silently skipping the second sheet so dietary perms were never granted → "Connected but no meals"). Also: seed-script `author_id` fix (was `null`, hidden by `.not("author_id","is",null)` Discover filter) + one-shot DB backfill for 20 existing seeded rows.
- **Build 27 marker** in place — new ledger rows from 2026-04-22 15:03–15:07Z are confirmed against build 26 or 27 via Grace's `ALQ5grg…` "Confirming correct version" screenshot.

Build 17 adds (for the 5 new items that came in after build-15 install):
- **F-33** Library card grey-band overlay removed (AH96GSgB4pjq).
- **F-34** Recipe import — LLM prompt rule + defensive `stripSectionPrefix` helper kill "For the creamy cucumber salad:" duplicate prefix on every ingredient row (ANmFiVpOfYEN).
- **F-35** HealthKit alert gains a "if Suppr isn't listed" fallback paragraph that tells the user to force-quit + relaunch so the auth sheet re-presents (AAUjI8ZWEQKi).
- **F-36** Library filter pills get `maxFontSizeMultiplier={1.2}` so iOS Dynamic Type stops stretching them to absurd widths (AAOBOOX-2zyX).
- **Build 15 → 16 install lag** (AKL4IQ_aQ2bX) — not a code fix. Grace shot this on build 15 (F-29 Regenerate is visible, F-32 avatars aren't). Build 16 auto-installs and closes it.

Build 14 covers:
- **G-7** Apple Health native @try + main-queue flip → closes AHSTS2YR7k-l + ACwDKGBhb897 (🟡 pending tester verify).
- **F-21** image-rotation fallback → closes AKhHD-Uv1JWd + ABTpne3YnbHm + AGr4EisM3BOC (🟡).
- **F-22** correction-form field labels → closes AJlhpO020UK- labels half (🟡).
- **F-23** recipe detail calories-hero shrink → closes AIf4Z6q1KL2j (🟡).
- **F-24** weight sparkline trimmed domain → closes AOCd89_asuNA (🟡).
- **F-25** deficit banner hidden on empty day → closes AJ2q4OgYYXE7 (🟡).

Build 15 adds:
- **F-26** softer HealthKit permission-denied alert copy → closes AG-5oy-1vqo7 (🟡).
- **F-27** weight delta label — "since {firstKey}" when actual data < 70% of nominal range → closes AGOlc2wi1UZD span half (🟡).
- **F-28** correction form fiber field — DB already supported, just exposed (🟡).
- **F-29** Plan Regenerate button in header, always visible when plan exists → closes AAtQgwFWaQTF regenerate half (🟡).
- **F-30** correction form sugar / sodium / satfat — migration `20260430100000_user_foods_micros.sql` adds `sugar_g`, `sodium_mg`, `saturated_fat_g` columns; form + `submitFoodCorrection` + `BarcodeProduct` type all wired → closes AJlhpO020UK- micros half in full (🟡).
- **F-31** weight delta tone — goal-aligned color (progress = green, regress = amber) on the range delta magnitude while keeping the arrow factual → closes AGOlc2wi1UZD arrow half (🟡).
- **F-32** household card prototype language — overline typography (11/700/1.1) + coloured circular initials avatar + audit-aligned spacing → closes AAtQgwFWaQTF drift half (🟡).
- **Infra** `OPENAI_API_KEY` rotated in Vercel prod by Grace 2026-04-21 → closes AIoBkBBn3bgh + AIe-YzITIaTX (🟡 pending re-test with a reel URL).

All H-tracks committed:
- **H-1** household `.single()` → regression tests pinned invariant; fix originally in build-11 `ef2a9f4`
- **H-2** per-serving headline → new shared `resolveFoodSearchHeadline` helper (both platforms)
- **H-3** Today Maintenance column → regression tests locked the F-3 runtime fix
- **H-4** Progress tab perf → skeleton-first paint + deferred `getDailyTargets` + one-frame chart mount
- **H-5** Plan day-total vs goal → new shared `dayTotalVsGoal` helper (both platforms)
- **H-6** import `source_url` → previously shipped in build-11 F-5 (`normaliseSource` SSOT)

All six move to 🟡 pending tester re-verification once build-13 installs. The one **🔍** (`AN8GJ1Dr3M` steps/burn "wrong for this day") stays unverifiable without the tester's raw HealthKit snapshot for that date.

## Lifecycle

```
TestFlight submission
    │
    ▼
npm run testflight:feedback  (fetches ASC API → data/*.json, gitignored by default)
    │
    ▼
This tracker (ledger)  +  resolved.md (diary)   ← update both after every fix
    │
    ▼
Commit referencing the ASC ID in the message
    │
    ▼
Next build uploaded → tester verifies → status flips to ✅
```

Ship rules:
- **Never** mark a ticket ✅ without either a tester re-verification, a regression test pinning the fix, or a code-level argument showing the failure mode can no longer occur.
- **Never** delete a row from the ledger — even dead-end attempts stay here with a status note. Churn is a feature, not a bug, for this file.
- **Always** tag the ASC ID in the commit message that fixes it (`"closes AIIm60n"`) so `git log --grep` can cross-reference.

## Ledger

| Date | ID | Type | Status | Fix / track | Complaint |
|------|-----|------|--------|-------------|-----------|
| 2026-04-25 | `AKtz5LtrL39b39-CPXdFE08` | screenshot | ✅ | **F-73** — already shipped 2026-04-27: 30-entry `genericBeverages.ts` matcher (`matchGenericBeverage`) preempts USDA Branded noise at the top of merged search results on both platforms. Covers cortado, flat white, cappuccino, plus 27 more drinks (coffee/tea/milk/juice/wine/beer). | "cortado should have lots of options" |
| 2026-04-25 | `AN3mTmZK5T2Nhj13aMFLk2E` | screenshot | ✅ | **F-74** — closed by PR #128 (the next TestFlight cut). Picked per-meal `micros` as canonical SoT; removed 7 bump-on-log callsites + 4 decrement-on-delete callsites + 2 dead helpers. Quick-add ledger now holds quick-add only. New `stimulantPerMealCanonicalSot.test.ts` (11 cases) pins behaviour + static contract. | "Alcohol and caffeine should auto update from things logged" |
| 2026-04-25 | `AO5PEI1xgamOQ-Nx4Gbr8Ok` | screenshot | ✅ | build-42 F-75 → F-98 (closed by #98 + #105) | "Tap meal for full nutrition doesn't show … full nutrition for the meal" |
| 2026-04-25 | `AFVnLJIVdjQY7bkWyi0AG8A` | screenshot | ✅ | **F-76** — `sanitiseImportedTitle` now wired at every recipe-import response site (web-scrape, social/LLM, HTML-fallback, image, caption). Build 41 only sanitised `meta.title` fallback; build 44 also sanitises `recipe.title` (LLM output) + `parsed.title` (HTML scrape) + `websiteRecipe.title` (JSON-LD). Static-analysis test pins the contract — every route file must call `sanitiseImportedTitle` for each response branch. | "Some recipes pulling in with the whole caption on the title" |
| 2026-04-24 | `AGSeM-FnnYbZy6FJveUKBoc` | screenshot | 🟡 | **F-71** — coerce zero-macro recipe rows + penalise extreme portion spreads in meal-plan sampler; hydrate relational plan rows | "Portioning is not logical - … double lunch and 0.2 breakfast" |
| 2026-04-24 | `APHEBaM02gFAhoeHQ5mtxuE` | screenshot | 🟡 | **F-72** — Plan tab explicit library links | "Need to be more obvious ways to access the library" |
| 2026-04-24 | `ABo2673OW9Z_GsXuifRsOjo` | screenshot | ⏳ | cluster **C12-IA** — MFP-style secondary surfaces (design) | "This should be on a secondary more subtle page like mfp" |
| 2026-04-24 | `AFF_UA88-CeE5TDCRhbaY_M` | screenshot | 🟡 | **F-72** | "No way to add from library here" |
| 2026-04-24 | `APPRkg_BADnAUvYA2GNIILY` | screenshot | 🟡 | **F-71** sibling (zero pull-through) | "Still pulling in 0" |
| 2026-04-24 | `ALbFGzbT4ImWVgX0FzXDGOY` | screenshot | 🟠 | **F-71** improves macro row honesty; fibre on imports still tracked separately | "Fibre and other nutrients not pulling in" |
| 2026-04-23 | `AJ_dfDvM2j6rnkOAgHTpwig` | screenshot | 🟡 | **F-71** + existing **C5** household Netflix model — re-verify on build ≥39 | "House hold looks the same and calories are still way off compared to targets" |
| 2026-04-23 | `AHQdqnRxBaTHxYN3vuzV4CM` | screenshot | 🟡 | **F-71** sibling (seeded recipe zeros) | "Seeded recipes still don’t have macros or calories" |
| 2026-04-23 | `ALlGgnDVP-rzqUojRWknayY` | screenshot | 🟡 | **F-57** sibling | "Same apple health error message" |
| 2026-04-22 | `AEzcUFvXt-ux…` | screenshot | 🟡 | **F-57** — health-sync gains (a) always-visible "Open Health app · Manage permissions" deeplink that opens `x-apple-health://`, (b) post-sync Alert when body data moved but dietary returned empty AND no Suppr-owned samples (proxy for silent dietary-read-denied). Root cause: iOS silently suppresses re-prompt for dietary perms after prior split-init had asked | "Apple health still doesn't work this is urgent it used to work perfectly" |
| 2026-04-22 | `AEWQ5gs3vyvs…` | screenshot | 🟡 | sibling of F-57 | "Apple health still not fixed" |
| 2026-04-22 | `AAcIj2Vc1D60…` | screenshot | 🟡 | sibling of F-57 — 730-day lookback was already shipped (F-44); new alert explains why dietary is empty when body syncs fine | "Apple health successfully synced but it has not pulled in historical meals like it used to (from lose it mfp etc)" |
| 2026-04-22 | `AGZq4O-Z9qZX…` | screenshot | 🟡 | sibling of F-57 (assumed "still happening" = HealthKit) | "Still happening" |
| 2026-04-22 | `ADpuHU6O7jEY…` | screenshot | ⏳ | cluster **C2** — Pro entitlement drift on Plans surface | "Also thinks I'm free but I'm on pro" |
| 2026-04-22 | `AIryDu7i28Rl…` | screenshot | ⏳ | cluster **C2** | "On pro but plans thinks I'm on free" |
| 2026-04-22 | `AIm3KPwBYlA1…` | screenshot | ⏳ | cluster **C2** | "Im on pro but plan still thinks im on free" |
| 2026-04-22 | `AEwoLmeE5w47…` | screenshot | 🟡 | **F-59** — prod Supabase confirmed: 20 published+authored seeded recipes exist + RLS allows read. Root cause is a poisoned empty-array AsyncStorage cache from an earlier broken build — new build flash-paints "No recipes yet" before network resolves. Fix: never cache `[]`, and treat cached empty arrays as "no cache" on read | "Recipes still not seeded" |
| 2026-04-22 | `AKcZwsipNdSx…` | screenshot | 🟡 | sibling of F-59 | "Recipes still aren't seeded" |
| 2026-04-22 | `AJr60qsyVUcM…` | screenshot | 🟡 | sibling of F-59 | "Recipes still not seeded" |
| 2026-04-22 | `AB6WOylB6-Qz…` | screenshot | 🟡 | **F-60** — Ring size 160→140 (+ card paddingY xl→md); Number fontSize 56→44 / lineHeight 64→52 / paddingY 20→16 for parity with Bar. All three hero variants now share one kcal number size | "Calorie section still massive" |
| 2026-04-22 | `ADt-4U9u_9NE…` | screenshot | 🟡 | sibling of F-60 | "Cals still too big hasn't been fixed" |
| 2026-04-22 | `ALpppRnGzIx9…` | screenshot | ✅ | cluster **C5** — Netflix-model v1 shipped 2026-05-01 (commits 5cc6b88 + a5e9fa4) | "Still doesn't look like the prototype for households" |
| 2026-04-22 | `ALQQyjCHjzbt…` | screenshot | ✅ | cluster **C5** — Netflix-model v1 shipped 2026-05-01 | "Household sections still doesn't make much sense and doesn't match the prototype for this page" |
| 2026-04-22 | `AKQGhg8wc6FZ…` | screenshot | ✅ | cluster **C5** — Netflix-model v1 shipped 2026-05-01 | "I don't really know what the household section is telling me right now" |
| 2026-04-22 | `AGpLe8GO99nQ…` | screenshot | ✅ | cluster **C5** — Netflix-model v1 shipped 2026-05-01 | "Household still not updated" |
| 2026-04-22 | `AKuLcrQUR7pf…` | screenshot | ✅ | cluster **C6** — weight chart redesign shipped 2026-04-22 (commit 435335f) | "Weight graph still wrong" |
| 2026-04-22 | `AGM9xRpzTLnD…` | screenshot | ✅ | cluster **C6** — weight chart redesign shipped 2026-04-22 | "Weight graph either not accurate or not clear" |
| 2026-04-22 | `AOVuCyOCNB1p…` | screenshot | 🟡 | **F-56** — `computeWeightTrendCopy` now returns `{delta: null, copy: "Log weight to see trend"}` when most recent weigh-in is >14 days old (test pinned) | "Up 0.9 this week is not correct as I have not logged weight in about a month" |
| 2026-04-22 | `AEq5NTi0ncnZ…` | screenshot | 🟡 | **F-61** — Discover "More ideas" section now renders hero-style cards (same layout/image treatment/kcal+macro row as the top 2), 12px stack gap. Uniform social-feed density across the whole feed | "All recipes should render like the first 2 (bigger feed like)" |
| 2026-04-22 | `APpAKhhRSuv0…` | screenshot | 🟡 | **F-64** — parser now prefers og:image / twitter:image over JSON-LD thumbnails (social meta tags are 1200×630+ by convention; JSON-LD frequently ships a 225×225 thumbnail). Plus a URL upscaler that strips WP `-WxH` suffixes and Photon `fit/resize/w/h` params. One-shot backfill `scripts/reseed-recipe-images.mjs` ran against prod: 12 of 20 seeded rows upscaled, 8 already correct | "Images are here but they are terrible" |
| 2026-04-22 | `ABG0cZzoaaeJ…` | screenshot | 🟡 | **F-62** — sync-status copy now distinguishes three empty-states: (a) truly empty → F-57 denied-perm Alert fires, (b) all samples were Suppr-authored → "N samples skipped (already logged in Suppr)", (c) nothing new → generic "No new meals" | "Says no new meals but there are" |
| 2026-04-22 | `AELbM8VJ40Jl…` | screenshot | 🟡 | sibling of F-62 | "Says no meals to import but there are meals to import" |
| 2026-04-22 | `AIC05bpyuit_…` | screenshot | ✅ | cluster **C9c** — Health Sync redesign shipped 2026-04-22 (commit 41b1262) | "This page doesn't match prototype" |
| 2026-04-22 | `AERuv07KITiH…` | screenshot | 🟡 | **F-63a** — Plan day-card: "Day total · X/Y kcal · P/C/F" wrap row removed; calorie target promoted into the day header line in tonally-coloured (neutral/amber/red) form. Macro state continues to flow through the existing delta-pill row below. Test updated | "Day totals section is overcrowded looks messy" |
| 2026-04-22 | `AJ8Fk6ud6Dl1…` | screenshot | 🟡 | sibling of F-63a | "Macro section is confusing and spacing is off" |
| 2026-04-22 | `AAUNtlDI0VvV…` | screenshot | 🟡 | **F-63b** — Library filter pills were clipped vertically on iOS when the horizontal ScrollView had no explicit row style. Added `style={{ flexGrow: 0, minHeight: 44 }}` + `alignItems: "center"` + `paddingTop: Spacing.xs` on the content container | "Format layout still terrible on this page" |
| 2026-04-22 | `ALvjyW7wHU7K…` | screenshot | 🟡 | sibling of F-63b | "Layout still messed up" |
| 2026-04-22 | `AHitOL0RmJmQ…` | screenshot | 🟡 | **F-63d** — Household Settings rendered two stacked titles: the auto router header ("Household Settings") + the in-content header ("Household"). `<Stack.Screen options={{ headerShown: false }} />` removes the auto header so the content starts 80pt higher | "Spacing a little off move up" |
| 2026-04-22 | `AAtwbwVxlQ70…` | screenshot | 🟡 | **F-63e** — Recipe detail ingredients row: long ingredient names were pushing the kcal column off-screen (e.g. rendering as "0 kc"). `ingredientName` now gets `flex: 1, flexShrink: 1`; `ingredientCalories` gets `flexShrink: 0`; row aligns `flex-start` with 8px gap | "Cals and macros and the coloured line not showing here" |
| 2026-04-22 | `AHS6xzyUumrl…` | screenshot | ✅ | duplicate of `AA63DQ7xd…` (already resolved). Verified 2026-04-22: `grep -r "score" apps/mobile/**/*.tsx` returns no product surfaces — tester's screenshot must predate or cache from an older build | "Score doesn't mean anything remove" |
| 2026-04-22 | `ANfXXs6H1qPP…` | screenshot | ✅ | cluster **C11** — ops fix applied 2026-05-01: Grace regenerated Edamam keys + updated Vercel env vars. | "Not sure if edamam is still connected as restaurant foods not showing" |
| 2026-04-22 | `AJNcZdalctgg…` | screenshot | ✅ | meta — tester self-verification ("Confirming build"); no code action | "Confirming build" |
| 2026-04-22 | `AEaTIZJodtNQ…` | screenshot | 🔍 | no comment — no actionable context | (no comment) |
| 2026-04-22 | `AKAyzCHqEBAE…` | screenshot | 🟡 | build-28 **F-52** — Discover hero + More-ideas row now render `image_url` when present (RN `Image` with gradient fallback) | "Recipes have finally come in but they don't have images on this page" |
| 2026-04-22 | `AJgeWQvRSt1v…` | screenshot | 🟡 | build-28 **F-55** — More-ideas rows gained 56×56 thumbnail; chef-hat box only on image-less rows (social-feed parity) | "Should all be like the two at the top with a pic etc. the more you might like is wrong" |
| 2026-04-22 | `ABMrc96mPkNp…` | screenshot | 🟡 | sibling of F-52 — Discover hero now uses the real image, not the gradient fallback | "Terrible image quality" |
| 2026-04-22 | `ABCjwJb4cU5U…` | screenshot | 🟡 | build-28 **F-51** — recipe-detail calorie hero shrunk (34→26, single-line composition, tighter padding) | "Cals section is huge and still wrong" |
| 2026-04-22 | `AA44j8pjh8tZ…` | screenshot | 🟡 | build-28 **F-53** — recipe-detail falls back to recipe-level totals when every ingredient has 0-nutrition (seeded recipes only carry recipe-level totals) | "None of the cals and macros are pulling in" |
| 2026-04-22 | `ALQ5grg-65Rh…` | screenshot | ✅ | meta — F-49 MARKER confirmed installed on build 26; no code action | "Confirming correct version before sending more feedback" |
| 2026-04-22 | `APUA9ZBFPysH…` | screenshot | 🟡 | build-27 **F-50** — HealthKit single-init (was splitting into two sheets; iOS skipped the second → no dietary perms → "Health access needed" dialog on every sync). Tester on build 26 screenshot, build 27 ships the fix | "Getting this error again" (HealthKit "Health access needed" dialog) |
| 2026-04-21 | `AKL4IQ_aQ2bX…` | screenshot | 🟡 | no code fix — build-16 install lag (F-32 avatars land there) | "Still not fixed" — Plan tab household card |
| 2026-04-21 | `AAOBOOX-2zyX…` | screenshot | 🟡 | build-17 F-36 (clamp Dynamic Type on pills) | "Pills are whether scrunched or huge" (Library filter row) |
| 2026-04-21 | `AH96GSgB4pjq…` | screenshot | 🟡 | build-17 F-33 (kill grey-band overlay) | "Images on this page look weird why are the grey half" |
| 2026-04-21 | `AAUjI8ZWEQKi…` | screenshot | 🟡 | build-17 F-35 (alert gains "not listed" fallback) | Suppr not listed under Settings → Health |
| 2026-04-21 | `ANmFiVpOfYEN…` | screenshot | 🟡 | build-17 F-34 (prompt + stripSectionPrefix) | "Duplicate unnecessary wording" (Verify ingredient prefixes) |
| 2026-04-21 | `AGOlc2wi1UZD…` | screenshot | 🟡 | build-15 F-27 (since-date label) + F-31 (goal-aligned tone) | "This is incorrect" — span + arrow-colour both addressed |
| 2026-04-21 | `AOCd89_asuNA…` | screenshot | 🟡 | build-14 F-24 (trimmed sparkline domain) | Weight for all time too scrunched up |
| 2026-04-21 | `AAtQgwFWaQTF…` | screenshot | 🟡 | build-15 F-29 (Regenerate) + F-32 (household card drift) | Regenerate + prototype language both addressed |
| 2026-04-21 | `AKhHD-Uv1JWd…` | screenshot | 🟡 | build-14 F-21 (image-rotation fallback) | Library — all recipes showing same photo |
| 2026-04-21 | `AIoBkBBn3bgh…` | screenshot | 🟡 | infra — `OPENAI_API_KEY` rotated in Vercel 2026-04-21 | OpenAI API 401 on Instagram import |
| 2026-04-21 | `AIf4Z6q1KL2j…` | screenshot | 🟡 | build-14 F-23 (calories hero shrink) | Calories section is too big (recipe detail) |
| 2026-04-21 | `AJ2q4OgYYXE7…` | screenshot | 🟡 | build-14 F-25 (hide deficit on empty day) | Middle section cluttered with 3 prompts (Today) |
| 2026-04-21 | `AG-5oy-1vqo7…` | screenshot | 🟡 | build-15 F-26 (softer copy) + G-7 (crash) | HealthKit permission alert in production |
| 2026-04-19 | `AIe-YzITIaTX…` | screenshot | 🟡 | infra — `OPENAI_API_KEY` rotated in Vercel 2026-04-21 | Import error (OpenAI 401) |
| 2026-04-19 | `ABTpne3YnbHm…` | screenshot | 🟡 | build-14 F-21 (image-rotation fallback) | Placeholder photos instead of imported photos |
| 2026-04-19 | `AGr4EisM3BOC…` | screenshot | 🟡 | build-14 F-21 (image-rotation fallback) | Placeholder meals (Plan Day 1) |
| 2026-04-19 | `AJlhpO020UK-…` | screenshot | 🟡 | build-14 F-22 (labels) + build-15 F-28/F-30 (fiber + sugar/sodium/satfat via migration 20260430100000) | Correction form fields unlabeled; can't correct full nutrition label |
| 2026-04-21 | `ACwDKGBhb897…` | crash      | 🟡 | build-14 G-7 (native @try + main-queue) | Apple Health crash "Again" (build 13) |
| 2026-04-19 | `AHSTS2YR7k-l…` | crash      | 🟡 | build-14 G-7 (native @try + main-queue) | "Same apple health crash" (build 12) |
| 2026-04-18 | `AF0btCuj90Ab…` | screenshot | ✅ | see `AF0btCuj9…` in resolved.md | Can't save alcohol limit |
| 2026-04-18 | `AISAWnLgU9cj…` | screenshot | ✅ | see `AISAWnLgU…` in resolved.md | Not intuitive (Progress tab) |
| 2026-04-18 | `AAegi1DJEisc…` | screenshot | ✅ | see `AAegi1DJE…` in resolved.md | Nothing happens when I try to create a household |
| 2026-04-18 | `AH8csBqtZsBJ…` | screenshot | 🟡 | build-13 H-5 (`dayTotalVsGoal` SSOT) | Plan doesn't tell me how close it is to my macro targets |
| 2026-04-18 | `AEe5QKJqkPPx…` | screenshot | ✅ | pre-build-10 (auto-generate modal) | Grocery list should regenerate when plan regenerates |
| 2026-04-18 | `APU2FBCjLALm…` | screenshot | ✅ | see `APU2FBCjL…` in resolved.md | Could not load templates (supabase related) |
| 2026-04-18 | `AJHZNp8NHTiF…` | screenshot | ✅ | see `AJHZNp8NH…` in resolved.md | Numbers here seem wrong (MFP carbs inflated) |
| 2026-04-18 | `AOI9xgY88Dx-…` | screenshot | ✅ | see `AOI9xgY88…` in resolved.md | Unclear if Edamam is integrated |
| 2026-04-18 | `AAtW7dYcCBPy…` | screenshot | ✅ | see `AAtW7dYcC…` in resolved.md | Lost clarity around total burn / projected burn |
| 2026-04-18 | `AEb7NcjnvK4P…` | screenshot | 🔄 | build-12 H-4 | Progress page takes a while to load |
| 2026-04-18 | `AD6_JNUaEjoJ…` | screenshot | ✅ | see `AD6_JNUaE…` in resolved.md | 0 steps today inaccurate vs today page |
| 2026-04-18 | `AF7bS2DQrH_w…` | screenshot | ✅ | see `AF7bS2DQr…` in resolved.md | Weight section not helpful nor accurate |
| 2026-04-18 | `APdpODtJDL8q…` | screenshot | ✅ | see `APdpODtJD…` in resolved.md | Notifications don't appear to be working |
| 2026-04-18 | `AMsdTaWai1sJ…` | screenshot | ✅ | see `AMsdTaWai…` in resolved.md | Not sure if this feature is working at all |
| 2026-04-18 | `AO4NtyNBpP4F…` | screenshot | ✅ | see `AO4NtyNBp…` in resolved.md | Instructions placeholder /n |
| 2026-04-18 | `AFE6h9Tlq0bU…` | screenshot | ✅ | see `AFE6h9Tlq…` in resolved.md | None of the trial / payments stuff is hooked up |
| 2026-04-18 | `AOjQg5DGBZqS…` | screenshot | ✅ | see `AOjQg5DGB…` in resolved.md | Notifications keep popping up but don't work |
| 2026-04-18 | `AOHTbpXsKXz9…` | screenshot | ✅ | see `AOHTbpXsK…` in resolved.md | Caption pulled in as recipe title + notes error |
| 2026-04-18 | `AHgJ5AK6VQow…` | screenshot | ✅ | see `AHgJ5AK6V…` in resolved.md | Could not load notes |
| 2026-04-18 | `ADpfDkX8c-Ke…` | screenshot | ✅ | see `ADpfDkX8c…` in resolved.md | Can't save ratings (same notes error) |
| 2026-04-18 | `AFdtq8z_FmWR…` | screenshot | ✅ | see `AFdtq8z_F…` in resolved.md | Unsure how TDEE compares to today numbers |
| 2026-04-18 | `ALkK-XrcMz_V…` | screenshot | ✅ | see `ALkK-XrcM…` in resolved.md | "Set to gain weight" logic wrong |
| 2026-04-18 | `AIIm60nKi_sT…` | screenshot | ✅ | see `AIIm60nKi…` in resolved.md | Where did 1900 maintenance come from |
| 2026-04-18 | `ABwH6OVJ-kJx…` | screenshot | ✅ | see `ABwH6OVJ-…` in resolved.md | Imported wrong (dupe Dinner/Snacks numbers) |
| 2026-04-18 | `AMAxKVVxPZtU…` | screenshot | ✅ | see `AMAxKVVxP…` in resolved.md | Need a source section at the bottom |
| 2026-04-18 | `AGzhQaCDvrZa…` | screenshot | 🟡 | Supabase dashboard Apple provider config | Apple login not working |
| 2026-04-18 | `AKvgjnbEOcb4…` | screenshot | 🔄 | build-13 H-2 (`resolveFoodSearchHeadline`) | Everything defaults to 100g rather than actual portions |
| 2026-04-19 | `ACEH_IlshzpR…` | screenshot | ✅ | see `ACEH_Ilsh…` in resolved.md | Imported recipes missing source section / link |
| 2026-04-19 | `AHCSYMATSHht…` | screenshot | ✅ | see `AHCSYMATS…` in resolved.md | Maintenance still showing at 1900 which it's not |
| 2026-04-19 | `AJFZ1hiEPo29…` | screenshot | 🟡 | Supabase dashboard Apple provider config | Apple sign in error |
| 2026-04-19 | `APo0qS9vcFvm…` | screenshot | ✅ | see `APo0qS9vc…` in resolved.md | Everything still 100g rather than proper servings |
| 2026-04-19 | `AE52_fIRZ-ZI…` | screenshot | ✅ | see `AE52_fIRZ…` in resolved.md | Add custom food needs more detail (mfp / lose-it style) |
| 2026-04-19 | `AEXP_nvFy4c7…` | crash | ✅ | build-12 G-1 (ObjC @try/@catch) | Crashes every time I try to connect Apple Health |
| 2026-04-19 | `AHhgUl6i1lax…` | crash | ✅ | build-12 G-1 | Crashed (Apple Health connect) |
| 2026-04-19 | `AB75VswCeXvj…` | screenshot | 🟡 | build-11 `ef2a9f4` (maybeSingle + unique migration) | Can't create a household |
| 2026-04-19 | `AC0AeyMF3Ehh…` | crash | ✅ | build-12 G-1 | Keeps crashing trying to connect to Apple Health |
| 2026-04-19 | `AN8GJ1Dr3MAd…` | screenshot | 🔍 | — | Steps and total burn are wrong for this day |
| 2026-04-19 | `ADFYpDgEEb0Q…` | screenshot | ✅ | see `ADFYpDgEE…` in resolved.md | TDEE / maintenance numbers don't align, not explained |
| 2026-04-19 | `AI-CNKcmy7y3…` | screenshot | 🟡 | build-11 `ef2a9f4` (F-5 `normaliseSource` SSOT) | "Esther Clark" source not clickable |
| 2026-04-19 | `AO2jdncS2Gxy…` | screenshot | ✅ | see `AO2jdncS2…` in resolved.md | Unsave vanishes recipe completely from library |
| 2026-04-19 | `AC2JP5CG8xLA…` | screenshot | ✅ | `9a9a2fd` (landing honest-claims SSOT) | Landing page says we don't do streaks etc. |
| 2026-04-19 | `ACoMvhUoe_ri…` | screenshot | ✅ | see `ACoMvhUoe…` in resolved.md | Weight chart 3/6/9 mo buttons don't change months shown |
| 2026-04-19 | `AOOBv-1OwtDI…` | screenshot | ✅ | see `AOOBv-1Ow…` in resolved.md | Use icons not emojis |
| 2026-04-19 | `AA63DQ7xd2gR…` | screenshot | ✅ | see `AA63DQ7xd…` in resolved.md | Score seems irrelevant — make it relevant or remove |
| 2026-04-19 | `AAHS7CjeXNC-…` | screenshot | ✅ | see `AAHS7CjeX…` in resolved.md | Defaults to recipes that don't exist |
| 2026-04-19 | `AMXSjeaXJeCf…` | screenshot | ✅ | see `AMXSjeaXJ…` in resolved.md | Pre-populated shopping list before user creates plan |
| 2026-04-19 | `APO0Nk_bre7h…` | screenshot | ✅ | see `APO0Nk_br…` in resolved.md | Portions / meal-plan-to-macros needs to be smarter |
| 2026-04-19 | `AJ1AeYJ--fFF…` | screenshot | ✅ | see `AJ1AeYJ--…` in resolved.md | Share only dinner / dinner & lunch / not macros etc. |
| 2026-04-19 | `AEyOuUJrB4lT…` | screenshot | ✅ | see `AEyOuUJrB…` in resolved.md | Plan retroactively changed past goals |
| 2026-04-19 | `AHEeeC9a4-lK…` | screenshot | ✅ | see `AHEeeC9a4…` in resolved.md | "Not moving on starting weight" is not 3% progress |
| 2026-04-19 | `APGJJlglIgFL…` | screenshot | 🔄 | build-13 H-2 (`resolveFoodSearchHeadline`) | Lots of foods still defaulting to 100g |
| 2026-04-19 | `AHnI_fIc7SKb…` | screenshot | ✅ | see `AHnI_fIc7…` in resolved.md | Pagination + mixed image / no-image rows |
| 2026-04-19 | `ABs9n0AyFkA8…` | screenshot | ✅ | see `ABs9n0AyF…` in resolved.md | Scan barcode layout sloppy |
| 2026-04-19 | `ADACe4M-PsjN…` | screenshot | ✅ | see `ADACe4M-P…` in resolved.md | Back button not working (meal detail) |
| 2026-04-19 | `AIOek8w6GKW5…` | screenshot | ✅ | see `AIOek8w6G…` in resolved.md | Barcode correction only accepts per-100g |
| 2026-04-19 | `AIjmgrBMmY-M…` | screenshot | ✅ | see `AIjmgrBMm…` in resolved.md | Can't add multiple items to one meal |
| 2026-04-19 | `AIIUzBeKpng0…` | crash | ✅ | build-12 G-1 | Still crashing on Apple Health connect |
| 2026-04-19 | `AGC7oEKypuMA…` | screenshot | ✅ | see `AGC7oEKyp…` in resolved.md | Apple Health issues persist |
| 2026-04-19 | `AJKHqJeCi83s…` | screenshot | ✅ | build-12 G-5 | Household feature — what are the numbers it's showing? |
| 2026-04-19 | `ALU8hrB1I9Sn…` | screenshot | ✅ | build-12 G-2 | Shopping list still has stale items from old plan |
| 2026-04-19 | `ALcwMFPjfmJv…` | screenshot | ✅ | build-12 G-4 | TDEE / maintenance still not explained well enough |
| 2026-04-19 | `AGJmliHTxnmt…` | screenshot | ✅ | build-12 G-3 | Graphs still not working properly |
| 2026-04-19 | `AC4oDEnQ0SuP…` | screenshot | ✅ | build-12 G-6 | JSON export — shouldn't it be CSV? |

## Recurring themes — architectural continuity / restart guide

These are the patterns that showed up across multiple tickets — the ones worth holding a shape for if this app (or the next) rebuilds from scratch.

### 1. Nutrition display honesty — "per 100 g" is always wrong for a consumer

Eight separate tickets (`APo0qS9v`, `AKvgjnb`, `APGJJlg`, `AIOek8w6`, `AE52_fIR`, `ABwH6OVJ`, `AJHZNp8N`, `AF7bS2DQ`) hit the same failure mode: we stored nutrition per-100 g (USDA convention) and defaulted to displaying that, while users mentally expect per-serving. Every time we "fix" one surface (barcode correction, search row, custom food), another surfaces the same mismatch.

**Architectural lesson:** per-100 g is the correct *storage* unit; per-serving is the correct *display* unit. The display layer should never render raw per-100 g without an explicit per-serving resolution step first. Treat "which unit is in this number?" as a type-system obligation, not a string label.

### 2. Source-of-truth drift between Today tab and the rest of the app

`AAtW7dYcCBP`, `AFdtq8z_FmWR`, `ADFYpDgEE`, `AHCSYMATS`, `AIIm60n`, `ALcwMFPjf` all report some variant of "the number on Today doesn't match the number on Progress / Maintenance / Plan". Maintenance TDEE, goal calories, total burn, all diverge between surfaces.

**Architectural lesson:** one resolver (`resolveMaintenance`, similar for goals and daily totals) should be the only function that produces each of these numbers. Every surface calls it; nothing recomputes. Caching per-day snapshots avoids the timing divergence we keep hitting.

### 3. Onboarding / settings changes must not backdate history

`AEyOuUJrB4` ("updating my plan has retroactively changed my goals so days where I hit my goal I'm now over my goal amounts") — any self-edit of goals / activity level / plan was backdating across all historical days.

**Architectural lesson:** user goal + activity level + plan must be stored as time-scoped records (effective-from date), and every read of "was I on target on day X" must use the record live on day X. This is a data-modelling bug, not a UX bug. Design for it from day one.

### 4. Apple Sign-in / native-bundle audience config is invisible until it isn't

`AJFZ1hi`, `AGzhQaCDvr` — after rebranding bundle ID `com.platemate.*` → `com.supprclub.supprapp`, Supabase's Apple provider still expected the old audience. Tester hit `Unacceptable audience in id_token`.

**Architectural lesson:** maintain a "rebrand checklist" that explicitly includes every external system that knows your bundle ID or Services ID (Apple Developer, Supabase OAuth, RevenueCat, OneSignal, Sentry release tags, App Store Connect). Bundle-ID drift manifests late and looks unrelated.

### 5. Relative URLs in React Native silently fail

`AAegi1DJ` (household creation doing `fetch("/api/household")`) — React Native has no origin, so relative URLs resolve to garbage. Compounded by a surrounding `try/catch` that swallowed the failure.

**Architectural lesson:** (a) ESLint rule banning relative URL strings in `fetch()` in mobile code; (b) never wrap network calls in silent `try/catch` — surface errors visibly or not at all.

### 6. `.single()` is a landmine unless you control the row count

`AB75VswCe` — PostgREST `.single()` throws when 0 or >1 rows. The moment you allow partial state (user leaves a household without cleaning `household_members`, user joined from two devices racing, etc.), `.single()` becomes a user-blocking error dialog.

**Architectural lesson:** default to `.maybeSingle()` with explicit null handling; reserve `.single()` for joins on a unique key that is enforced at the database level. Pair with a DB unique constraint.

### 7. Icons vs. emojis — cheap-looking by default

`AOOBv-1Ow` — emoji icons ship fast but look amateur and inconsistent across platforms (emoji fonts differ iOS vs. Android vs. web).

**Architectural lesson:** have an explicit icon registry (lucide for web, vector iconset for mobile) and never use string emojis in product chrome. Emojis are OK in user-generated content, not in our own UI.

### 8. Copy drift between landing and app

`AC2JP5CG8x` — landing page claimed "no streaks" while the app shipped streaks.

**Architectural lesson:** landing copy should be generated from (or tested against) product constants whenever possible — feature names, tier gates, nutrition source list, numeric thresholds. We now do this via `src/lib/landing/content.ts` — keep it as a hard rule, not an optional one.

### 9. Health data integrity reporting is hard to validate

`AN8GJ1Dr3M` ("steps and total burn are wrong for this day"), `AD6_JNUaE` ("0 steps inaccurate vs today page"), `AJHZNp8N` ("numbers way higher than actual"). Testers report "wrong" without a reference.

**Architectural lesson:** include a visible "source of this number: HealthKit → type X → range Y → Z samples" pane behind an info chevron on every derived fitness/nutrition number. If the user can see provenance, they can tell you which assumption to fix.

### 10. Progress / Analytics tabs punish cold loads

`AEb7NcjnvK` — Progress tab spinner-only on cold load because it eagerly computes 180 days of chart data on the sync render path.

**Architectural lesson:** any tab with derived analytics must render a skeleton immediately and defer heavy derivation. Budget every tab at first-meaningful-paint <1 s warm, <2 s cold. Enforce with a perf regression test, not a promise.

### 11. Native crashes from third-party patches need defensive try/catch at the boundary

`AIIUzBeK`, `AC0AeyMF`, `AHhgUl6i`, `AEXP_nvFy`, `AGC7oEKyp` — all same crash: `react-native-health` HKCorrelation enumeration threw `NSException` on iOS 26.5, taking the app down before any JS-side guard could catch it.

**Architectural lesson:** every native patch for a third-party library must wrap enumerator callbacks (HealthKit, CoreBluetooth, AVFoundation, etc.) in `@try/@catch` + log. Don't rely on JS-side `try/catch` around a bridge call — bridge calls are asynchronous and the native exception has already unwound by the time JS hears about it.

### 12. Partial fixes that only address half a surface

`APo0qS9v` fixed per-serving metadata in the search subline but left the big kcal number per-100g (caught later as `AKvgjnb` / `APGJJlg`). `AAegi1DJ` fixed household create via the REST route but missed that the iOS error dialog came from a different `.single()` call (later surfaced as `AB75VswCe`).

**Architectural lesson:** when closing a ticket, walk every callsite of the affected data path before marking ✅. Tests should pin not just the happy path but the sibling surfaces.

## Build → IDs map

Quick reverse-lookup: which IDs were closed by which shipped build.

- **build-10** (`e2c2884`): early E-tracks. IDs covered by sub-entries E-1..E-*.
- **build-11** (`ef2a9f4`): 17 F-tracks. Includes F-1 (JS-only HealthKit guard), F-5 (recipe `normaliseSource` SSOT — closes `AI-CNKcmy`, `ACEH_Ilshz`, `AMAxKVVxP`), F-17..F-20 (Today/barcode polish — closes `AIjmgrBMm`, `ABs9n0AyF`, `ADACe4M`, `AIOek8w6`), plus household `.maybeSingle()` + unique-member migration (closes `AB75VswCe`).
- **landing fix** (`9a9a2fd`): honest-claims SSOT — closes `AC2JP5CG8x`.
- **build-12** (`515124d`): G-tracks. G-1 (ObjC `@try/@catch` for HealthKit crashes — closes all four crash IDs), G-2 (shopping stale-items + dedupe — closes `ALU8hrB1I`), G-3 (weight chart y-axis + range — closes `AGJmliHT`, `ACoMvhUoe`), G-4 (maintenance chain explainer — closes `ALcwMFPjf`), G-5 (household per-member number labels — closes `AJKHqJeCi`), G-6 (CSV export — closes `AC4oDEnQ0`).
- **build-12 H-tracks** (in flight): H-2 per-serving headline number, H-3 Today Maintenance column parity, H-4 Progress perf, H-5 Plan day delta. Will close `AKvgjnb`, `APGJJlg`, `AEb7NcjnvK`, `AH8csBqt`, and the still-latent half of `AAtW7dYcCBP`.

## Related files

- **[resolved.md](./resolved.md)** — narrative per-incident log (what, why, the fix, verification).
- **[../planning/testflight-followups-2026-04-19.md](../planning/testflight-followups-2026-04-19.md)** — prioritised backlog of work still to do (B-tracks).
- **[README.md](./README.md)** — how to pull feedback from App Store Connect.
- **`data/`** — gitignored raw + deduped pulls (`feedback-YYYY-MM-DD.json`).
- **`scripts/fetch-testflight-feedback.mjs`** — the pull script.
- **`CHANGELOG.md`** at repo root — shipped-build history; every entry should link back to the IDs it closed.
