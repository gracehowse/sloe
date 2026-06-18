# Backlog priority order — entire ENG backlog (2026-06-14)

**Owner:** Grace · **Working set:** **~283 open** ENG issues (was 320; ~54 Done 2026-06-14/17 — excludes 25 Duplicate-state zombies queued for cancellation via ENG-1143). **Updated:** 2026-06-18 (rev 18 — batch 4 Codex #471 Done; #476/#477 Cursor doc+paywall; ENG-901 Done).  
**Branch:** `main` · **Closeout:** `docs/planning/2026-06-17-gate-15-closeout.md` · **Quick wins:** `docs/planning/2026-06-17-quick-wins-backlog.md` · **Gate 0/1 audit:** `docs/planning/2026-06-17-gate-0-1-agent-audit.md` · **Companion docs:** `docs/planning/launch-queue-2026-07-01.md`, `docs/ux/reviews/2026-06-14-launch-readiness-audit.md`, `docs/ux/research/2026-06-14-mfp-mealplan-voc.md`.
**How to read this:** work top-to-bottom by gate. Gates are *sequencing*, not strict 1-N ranks — within a gate, Urgent→High→Medium, clear blockers/deps first. Full **WHAT / WHY / HOW** lives in each ticket body.

**Brief-coverage status (2026-06-14 enrichment pass):**
- **Gate 0 + Gate 1 + Gate 2 + the thin/implementable Gate-B/Wave-3/Wave-4 tickets (158 tickets): DONE** — each has a developer-ready, code-grounded WHAT/WHY/HOW (path-verified; the audit-era ones in the description, legacy/Codex ones as an "Implementation brief" comment).
- **~109 already well-spec'd** (≥900-char bodies): verified adequate, left as-is.
- **32 Figma-conformance tickets:** HOW is the named Figma frame (design context), annotated rather than fabricated.
- **~22 founder-ops** (incorporation, Cayman, runway, decisions): WHAT/WHY already clear; not dev briefs.

## The gate model

| Gate | Meaning | Open | Done |
|------|---------|------|-------------------|
| **Gate 0** | Before onboarding ANY user (security / legal / data-integrity) | 1 | 8 |
| **Gate 1** | Before the 2026-07-01 viral push (trust / parity / launch quality) | 2 | 15 |
| **Gate 1.5** | **NEW (2026-06-16)** — launch *cohesion & wedge*: what makes the viral push LAND (not just be safe). Redesign core-5 + Wave-3 wedge + mis-filed launch-hardening security. | **~4 partial** | **~20** |
| **Gate B** | Before the first PAID sub (billing) — parallel, NOT a July blocker | 4 | 3 |
| **Gate 2** | Beta window (wedge-validated polish + bulk of audit P2s) | ~56 | 14 |
| **Wave 3** | Category-leading *residual* + audit P3s (wedge items promoted to 1.5; rest beta/post-launch) | ~120 | 8 |
| **Wave 4** | Redesign *residual* (Layer-3 pixel close-out) + platform / AI-imagery / creator (post-launch) | ~45 | 5 |

**Sequencing:** Gate 0 → Gate 1 → **Gate 1.5** → launch (Gate B ∥, NOT a blocker) → Gate 2 → Wave 3/4.

**Two distinct launch bars (don't conflate):**
- **Gate A = "safe to onboard"** (Gate 0 + Gate 1, `launch-blocker` label) — nearly clear: 1 DMCA + 2 Grace-device tests, no code left.
- **Gate 1.5 = "launch lands its promise"** — the viral push sells a *differentiated, cohesive* product. A refugee who lands on a half-conformed app, or never hits the "what to eat next" North Star / import magic-moment, churns even though the app is technically "safe." This is the real pre-July engineering tier.

The meal-planning + food-data-trust cluster (pantry, plan→log date, over-buy, micros, Verified-store) and the redesign-cohesion core-5 both jump the normal P2 queue — competitive wedge + first-impression integrity.

**Linear filters:** `label:launch-blocker` = the 19 Gate-0/Gate-1 must-ship items (authoritative "blocking July" view). `label:paid-ga-blocker` = Gate B. **New:** `label:launch-cohesion` = Gate 1.5 (proposed — apply to the pulled-forward set below).

---

## Re-sequencing 2026-06-16 (rev 9)

Two framing errors in rev 8 are corrected here:

**1. "Redesign = post-launch" was wrong — it's a launch-cohesion requirement, AND it's mostly already shipped.** The Sloe redesign ships in 3 layers (`docs/ux/redesign/migration-coverage.md`):
- **Layer 1 — tokens + fonts:** SHIPPED, un-gated. Every screen renders the Sloe palette + Newsreader. The app is *not* half-old-blue / half-new at the colour/type level.
- **Layer 2 — per-screen layout craft:** LARGELY SHIPPED via `REDESIGN_DEFAULT_ON` flags that default **true** in every build (`apps/mobile/lib/analytics.ts` / `src/lib/analytics/track.ts`), legacy kept only as a kill-switch `else`. Today tier, Discover import-hero, fit-verdict banner, empty-ring gradient, card cohesion — all live, both platforms.
- **Layer 3 — Figma-exact pixel conformance:** the Wave-4 ENG-889→918 tickets. Polish on a coherent surface, *not* the difference between coherent and broken.

So the redesign-cohesion work for July is narrow, not 55 tickets: **(a) Onboarding (ENG-895)** — the cold-open and the *least*-conformed core surface (0/12); **(b) Log-a-meal layout (ENG-900)**; **(c) a Suppr→Sloe brand-string sweep** ("SUPPR PRO", "Suppr's servers", suppr-club.com — screenshots badly); **(d) verify every `REDESIGN_DEFAULT_ON` flag is default-on in prod on a populated account** (no legacy-leak mid-viral). Foundations decisions ENG-919–925 were **ratified 2026-06-11** (`docs/decisions/2026-06-11-redesign-deferred-decisions-ratified.md`) — no open blocker. *(The `figma-migration-tracker.md` still lists them as "decisions needed" — stale; reconcile.)* Cohesion confidence by 2026-07-01: **7/10**, gated mainly on Onboarding.

**2. "All of Wave 3 = post-launch" was wrong.** The ENG-928→983 "category-leading" cluster contains the wedge-defining first-session experience (North Star "what to eat next", import magic-moment, refugee-activation paywall honesty) the viral push actually sells. And several **security/launch-hardening** items (ENG-1137, 1124, 558, 541, 1158) were mis-filed as Wave 3. Both are pulled into **Gate 1.5** below.

⚠️ **Pixel caveat:** the redesign scoping is code-grounded; on-disk captures predate HEAD. Before declaring cohesion done, run `npm run test:screens:tour` + `npm run test:e2e:visual` against HEAD on a populated account and assemble a fresh wall.

---

## Shipped 2026-06-14 (`claude/eng-1099-tracker-tier`)

Linear → **Done** (comment + commit SHA on each). Gate 0 migrations **applied on prod** (2026-06-15: `supabase db push` up to date; `verify:gate0:live` **8/8 PASS**).

| Commit | Issues | Notes |
|--------|--------|-------|
| `6f2eebe1` | ENG-1103, 1106, 1108 | Gate 0 SQL + verify scripts; `saveVerifiedIngredientsRpc` + web `RecipeDetail` RPC path |
| `26933dda` | ENG-49, 667, 123 | `lifetime_pro` webhook floor; EUR Pro checkout; Base→Free migration **script** (not run on prod) |
| `13952d62` | ENG-774, 776, 1123, 1127, 1132, 1134, 928, 929, 930, 973, 802, 880, 1077, 905 | Logging loop, gate-2 fixes, cookie consent, micro clamp, go-tos tab |
| *(dup)* | ENG-904 | Closed as duplicate of ENG-930 (S13 confirmation) |
| `97983c0a` | ENG-1162, 1161, 1163, 1167, 1178, 805, 1171, 1073, 931 (mobile) | Gate 1 polish: library deep-link, paywall CTA, log sheet scroll, dual-host auth, import test, check-in suppression, mobile search quick-log |

## Shipped 2026-06-15 (`claude/eng-1130-plan-slots-sync` · PR #456)

Linear → **Done** (comment + commit SHA on each when merged).

| Commit | Issues | Notes |
|--------|--------|-------|
| `ff3be9bc` | ENG-1130 | Plan slot metadata cloud sync (web + mobile) |
| `73d065bc` | ENG-1099 | Today tier M1–M6: PressableScale, NorthStar sage chip, Complete Day rhythm |
| `25936a81` | ENG-1125 | Durable journal write queue (web + mobile) |
| `7b4c3a97` | ENG-1099/1125 | Mobile tier press wiring + queue meal edits |
| `9183dd04` | ENG-1125 | Web journal queue wiring tests |
| `61c3ab3d` | ENG-1051 | Pantry staples from shopping rows (web + mobile) |
| `2211f18c` | ENG-1121 | FatSecretBadge on food-search results panel (Wave 3) |
| `62e367f5` | ENG-1129, ENG-983 | Cook servings confirm close-out + shopping dedupe/aisle-sort at generation |
| `5f8b09f1` | ENG-1131 | Web Plan smart suggestions behind plan_web_parity_v1 |
| `a77a34eb` | ENG-978, ENG-979 | Shareable import-success card + creator credit in share text (web + mobile) |
| `3d0353ab` | ENG-972 | NL describe meal logging inside Log sheet (web + mobile) |
| `b1496047` | ENG-971 | AI paywall photo_log copy parity (web matched mobile honest cap wording) |
| `95a83070` | ENG-827, 900, 980, 962, 966, 970, 1137 (+895/889/901/896/965 partial) | **Gate 1.5A–C bulk:** onboarding chrome, Sloe brand sweep, log-a-meal Figma, save-first import, signup-after-reveal, paywall honesty (web+mobile), `assertOrigin` CSRF, visual-regression goldens, `REDESIGN_DEFAULT_ON` parity tests |
| `90702887` | ENG-1118 | FatSecret %DV→absolute unit guard (v1/v2 inference + plausibility) |
| `47c4fa06` | *(merge)* | PR #456 squash merge to `main` (includes rows above + Gate 2 stack) |

## Shipped 2026-06-16 (post-#456 · PR [#457](https://github.com/gracehowse/Suppr/pull/457))

| Commit | Notes |
|--------|-------|
| `362e940a` | Today hero ring density — `Type.statLabel`, stat values 20/24, AA status chip, tighter card padding (design-director; not a Gate 1.5 ticket) |

**Still open — next in logging loop:** ~~ENG-932~~ Done (`BARCODE_LOUD_CTA_LABEL` web + mobile). ~~ENG-931~~ mobile quick-log shipped (`97983c0a`); web parity in follow-up commit.

**Gate B ops still open:** ENG-101, 198, 33, 3 (RevenueCat/IAP, Stripe Tax, SBP — no code ship this session).

**Gate 0 still open:** ENG-859 only (DMCA filing — Grace ops; checklist `docs/operations/eng-859-dmca-filing-checklist.md`).

**Gate 0 closed this session:** ENG-1102, 1104, 1105, 1107, 1110 (tests + docs + prod verify).

---

## GATE 0 — pre-any-user (1 open)

Only things that can corrupt data, leak entitlements, or create legal exposure on the first user. Full WHAT/WHY/HOW in each ticket. *(Shipped: 1102–1108, 1110 — see Shipped section; prod migrations applied 2026-06-15.)*

| # | Pri | Project | Title |
|---|---|---|---|
| ENG-859 | Urgent | Import posture & legal | Register DMCA designated agent (depends on incorporation) — ops checklist: `docs/operations/eng-859-dmca-filing-checklist.md` |

~~ENG-1102~~ Done — Gate-0 live 8/8 re-proof on prod + verify script (ENG-1108 RPC check).  
~~ENG-1110~~ Done — search chip reads **"Structured"** (vendor-source tier); distinct from empty `verified_food_canonical` crowd store.  
~~ENG-1107~~ Done — copy/duplicate re-anchors `eaten_at` via `reanchorMealEatenAt`.  
~~ENG-1105~~ Done — re-log / duplicate carries `nutrition_micros`.  
~~ENG-1104~~ Done — genericFoodMicros fdc pins + kcal plausibility audit.

---

## GATE 1 — pre-viral-launch (2 open Grace-owned, 15 done)

What refugees hit, screenshot, and churn on in the first session. Full WHAT/WHY/HOW in each ticket.

**Done (code + docs on branch):** ENG-1162, 1161, 1163, 1167, 1178, 805, 1171, 1073, 931, 1109, 1111, 771 (932/973/931 loop), 1177, 1179, 1112, 670 (harness + npm scripts — **live 100-Reel run pending Grace**).

| # | Pri | Project | Title |
|---|---|---|---|
| ENG-1060 | High | (none) | TestFlight build-57 smoke — 2026-06-12 (22 ASC threads) — **Grace device**; checklist: `docs/testing/testflight-build-57-smoke-checklist.md` |
| ENG-874 | High | Today tab | Apple Health: verify MFP meal import on device (HS-01–HS-09) — **Grace device**; runbook: `docs/testing/health-sync-device-runbook.md` |

~~ENG-771~~ Done — MFP-refugee logging loop: ENG-931 quick-log, ENG-932 loud barcode CTA, ENG-973 paywall barcode-free chip (web + mobile).
~~ENG-670~~ Done (harness) — `npm run audit:reels` + `audit:reels:check-streak`; exit 1 below 90% on gate fixture. **Grace:** curate 100 Reel URLs + three consecutive green days.  
~~ENG-1109~~ Done — contrast census (web + mobile) + Playwright sweep `tests/e2e/journeys/today-contrast-eng1109.spec.ts`.  
~~ENG-1177~~ Done — `meal_slot_config` preset (classic / 4 / 6 meals); Settings web + mobile; Today hosts.  
~~ENG-1179~~ Done — `apps/mobile/storekit/SupprPro.storekit` + plugin + `docs/testing/storekit-sandbox-harness.md`.  
~~ENG-1112~~ Done — MFP × Cal AI Mar 2026 re-test in `docs/ux/research/2026-06-14-mfp-mealplan-voc.md` §0.1.

~~ENG-1162~~ Done — `suppr:///library?keep=1` lands Recipes tab without empty-library redirect.  
~~ENG-1161~~ Done — paywall sticky footer CTA only (in-scroll duplicate removed).  
~~ENG-1163~~ Done — LogSheet Go-tos tab scroll inset above sticky footer.  
~~ENG-1167~~ Done — E2E auth fixtures for localhost + 127.0.0.1.  
~~ENG-1178~~ Done — recipeImportDescriptionNull mocks SSRF guard.  
~~ENG-805 / ENG-1171~~ Done — weekly check-in never cold-opens (web + mobile); source pin tests.  
~~ENG-1073~~ Done — adherence_over_display flag removed from render paths.  
~~ENG-931~~ Done — search row + quick-log (web + mobile).  
~~ENG-1111~~ Done — measured TDEE for weekly check-in (`measured_tdee_check_in` flag); double-count guard; migration + tests.

**Order:** ENG-670 (measure Reel parse-rate) + ENG-771 (MFP-refugee logging-loop parity) are headline; ENG-1073 (ramp the adherence fix — kills the live "108% · over" bug) + ENG-1109 (WCAG contrast) are cheap high-visibility wins; ENG-1161/1162 follow; ENG-1060/874 are Grace-owned.

---

## GATE B — paid GA (parallel, NOT a July blocker) (4 open)

Gate the first *paid* sub only — but long ops lead times (Stripe Tax, RC provisioning, SBP), so start now. *(Shipped: 49, 667, 123 — see Shipped section. ENG-49 closed on webhook floor; creator lifetime-comp half still future work.)*

| # | Pri | Project | Title |
|---|---|---|---|
| ENG-101 | Urgent | Pre-launch monetisation +  | Wire RevenueCat + StoreKit IAP for Free + Pro on iOS (audit #3) |
| ENG-198 | High | Pre-launch monetisation +  | Provision RevenueCat offerings before mobile launch |
| ENG-33 | High | Pre-launch monetisation +  | Wire jurisdiction-aware Stripe Tax (UK/EU inclusive, US automatic) |
| ENG-3 | High | Phase 0 — Viral push prep | Phase 0 polish: enrol Apple Small Business Program in App Store Connect |

---

## GATE 1.5 — launch cohesion & wedge (pull-forward for 2026-07-01)

Not a "safe to onboard" gate (that's Gate A) — this is "**the viral push lands its promise**." A refugee who lands on a half-conformed app, or never hits the North Star / import magic-moment, churns even though the app is technically safe. Pulled forward from Wave 3 (wedge) and Wave 4 (redesign), plus mis-filed launch-hardening security. Target: as much as fits before July; the **core-5 redesign + brand-sweep + North Star + refugee-activation** are the non-negotiables.

### A. Redesign cohesion — core-5 cold-open loop (Layer-2 close-out)
*Mostly shipped via `REDESIGN_DEFAULT_ON`; this is closing layout drift on the screens a refugee screenshots in session one. Foundations ratified 2026-06-11.*

| # | Pri | Surface | Note |
|---|---|---|---|
| ENG-895 | Urgent | Conform Onboarding to Figma | **Done** (closeout) — welcome/reveal/pace/projection; photo-hero WO1 split deferred |
| ENG-889 | High | Conform Today to Figma | **partial** — L1 + S5 + coach-in-hero on main (#472/#476); TD1–TD4 + pixel deltas open |
| ~~ENG-900~~ | High | ~~Conform Log-a-meal to Figma~~ | **Done** `95a83070` |
| ENG-901 | High | Conform Paywall & win-moments | **Done** — M5/M6 (#472) + trust strip + Sloe upgrade dialog (#476) |
| ENG-896 | High | Conform Recipes & Cookbook | **partial** — Library grid + Discover slabs verified (#472); 9 partials remain on parent |
| ~~*(new)*~~ | Urgent | ~~**Suppr→Sloe brand-string sweep**~~ | **Done** `95a83070` (no Linear ticket) |
| ~~*(new)*~~ | High | ~~**Verify `REDESIGN_DEFAULT_ON` default-on**~~ | **Done** `95a83070` — `tests/unit/redesignDefaultOnParity.test.ts` (no Linear ticket) |
| ~~ENG-827~~ | High | ~~Golden visual-regression + parity suite~~ | **Done** `95a83070` — `tests/e2e/visual-redesign-gate15*.spec.ts` |

*Conform-if-Onboarding-lands (else accept Layer-1 re-skin):* ENG-898 (Import), ENG-890 (Recipe detail), ENG-893 (Global/Nav/skeletons), ENG-897 (Auth — near-done), ENG-899 (Plan week-view).

### B. Wedge experience — the differentiated first session (from Wave 3)
*The features the viral push actually sells. Confidence wedge set is launch-defining: 8/10.*

| # | Pri | Title | Why launch |
|---|---|---|---|
| ~~ENG-935~~ | High | "What to eat next" — permanent glanceable Today block | **Done** `01e6c6e1` (#469) |
| ~~ENG-933~~ | — | ~~Single time-aware editorial Today line~~ — **Won't-do (2026-06-17, founder-ratified):** reverses the settled ENG-1032 call (ring numeral = display moment); kernel folded into the under-ring coach line + ENG-939 | not launch-blocking |
| ~~ENG-939~~ | High | Warm food-forward Today empty/cold-open state | **Done** `01e6c6e1` (#469) |
| ~~ENG-938~~ | High | Protein-remaining as priority macro on Today | **Done** `01e6c6e1` (#469) — caption at 0g logged |
| ~~ENG-962~~ | High | ~~Move signup after the plan reveal~~ | **Done** `95a83070` |
| ENG-964 | High | Date projection on the Reveal step (tangible goal) | **Done** — `revealProjection.ts` + web/mobile reveal UI |
| ENG-965 | High | Surface data-import path earlier for MFP/MacroFactor refugees | **Done** — `app-choice` step (ENG-990) |
| ~~ENG-980~~ | High | ~~Save-first import lands in library instantly~~ | **Done** `95a83070` |
| ~~ENG-966~~ | High | ~~Lead the paywall with the plan the user already built~~ | **Done** `95a83070` |
| ~~ENG-970~~ | Medium | ~~"No payment due now" chip above CTA in trial~~ | **Done** `95a83070` |
| ENG-932 | Medium | Loud, free, first-class barcode affordance | **Done** — `BARCODE_LOUD_CTA_LABEL` in LogSheet |
| ENG-1065 | Medium | TF57 Today cohesion — Complete Day, Planned card, meal-section | **Done** — empty branch default-on; tier flat lift |
| ENG-1184 | High | Fresh start badge lacks target methodology explanation | **Done** — status chip → `WhyThisNumber` |

*Strong-but-can-slip-to-early-beta:* ENG-968 (Duolingo trial), ENG-969 (projected-trajectory paywall), ENG-951 (forecast line), ENG-957/943 (plan→shopping), ENG-977 (post-log what-to-eat-next), ENG-854 (make-anything-fit Today).

### C. Mis-filed launch-hardening (was in Wave 3 / Phase-0 — these are pre-push)

| # | Pri | Title | Why launch |
|---|---|---|---|
| ~~ENG-1137~~ | High | ~~assertOrigin CSRF guard on ALL cookie-auth mutating routes~~ | **Done** `95a83070` |
| ENG-1124 | High | Web nutrition_entries write-payload untested + 2nd buildNutritionEntryRow that can drift | **Done** — PR #463 |
| ~~ENG-1118~~ | High | ~~FatSecret %DV→absolute micro conversion has no version guard~~ | **Done** `90702887` |
| ENG-558 | Medium | Enable Leaked Password Protection in Supabase Auth | pre-push security |
| ENG-541 | Medium | Lock down Sentry Allowed Domains (suppr-web) | pre-push security |
| ENG-1158 | High | Decide AI_BUDGET_ENFORCEMENT before the viral push (cost breaker) | cost-runaway at viral scale |
| ENG-1128 | Medium | Web/blog import paraphrases instruction steps (legal posture) | **Done** — `paraphraseInstructionsField` at persist + import |

---

## GATE 2 — beta window (~56 open)

Audit P2s + wedge-validated planning/recipe gaps. Prioritise the meal-planning + food-trust cluster first. *(Shipped on PR #456: 1099, 1122, 1125, 1130 — see Shipped section.)*

| # | Pri | Project | Title |
|---|---|---|---|
| ENG-769 | Urgent | Audit sweep remediation | Visual-sweep Maestro captures fire pre-hydration (unreliable as design evidence) |
| ENG-514 | Urgent | Phase 0 — Viral push prep | [B6] Solo-founder safety net — recovery vault + trusted contact + offline playbook |
| ENG-513 | Urgent | Phase 0 — Viral push prep | [B5] Phase 2 compliance chain — book Cayman immigration call + downstream cascade |
| ENG-183 | Urgent | Pre-launch incorporation + | Trademark TM-1 direction (blocker for Atlas) |
| ENG-182 | Urgent | Pre-launch incorporation + | US cross-border CPA consult |
| ENG-179 | Urgent | Pre-launch incorporation + | Cayman immigration counsel call |
| ENG-34 | Urgent | Recipes tab | [Audit P0] FatSecret search returns no results |
| ENG-7 | Urgent | Phase 0 — Viral push prep | Phase 0 polish: recipe import ≥90% success on 100 random TikTok food Reels |
| ENG-4 | Urgent | Phase 0 — Viral push prep | Phase 0 polish: App Store rating ≥4.6 (wider beta required first) |
| ENG-2 | Urgent | Phase 0 — Viral push prep | Phase 0 polish: plate-loop daily active rate ≥40% on active cohort |
| ENG-1099 | High | Today tab | ~~Close Today's craft gap~~ — **Done** PR #456 (visual verify pending) |
| ENG-1023 | High | Today tab | Health follow-ups: micro-probe permission alignment + error stringify + native-hang invest |
| ENG-1022 | High | Design system cleanup | Web parity: chips/segments/tags §7-§8 grammar (mobile census shipped 2026-06-10) |
| ENG-1013 | High | Design system cleanup | Migrate 188 hex literals outside theme.ts to semantic tokens |
| ENG-1007 | High | Design system cleanup | Programmatic spacing + token census gate (generalise contrast-audit pattern) |
| ENG-879 | High | Today tab | Health Sync fix: MFP meals dropped on re-import (tombstone over-suppression) + Sync Now do |
| ENG-828 | High | Design system cleanup | Systemic low-contrast `bg-primary/10` + `text-primary` (2.89:1) across chips/badges/pills  |
| ENG-775 | High | MFP-refugee capture | P1 — Converge the 4 portion pickers onto shared PortionPicker (+ preserve quantity on unit |
| ENG-768 | High | Audit sweep remediation | Deeplink surfaces use raw spinners instead of skeletons (inconsistent loading state) |
| ENG-735 | High | Recipes tab | Bulk photo recipe import (multi-image, Alta-style) — candidate primary import path |
| ENG-728 | High | Audit sweep remediation | Recipe-import "magic moment" — parse → reveal → saved celebration |
| ENG-727 | High | Audit sweep remediation | Shame-free achievements & milestones system |
| ENG-726 | High | Audit sweep remediation | Premium motion + haptics foundation (shared primitive) |
| ENG-725 | High | Audit sweep remediation | Premium feel & wow moments — Noom delight + shame-free gamification |
| ENG-703 | High | Audit sweep remediation | Decompose + memoise mobile Today (5,868-line unmemoised re-render) |
| ENG-699 | High | Audit sweep remediation | Add move-meal to web /planner (parity with mobile) |
| ENG-695 | High | Audit sweep remediation | Converge mobile Discover to web cuisine-carousel IA |
| ENG-685 | High | Audit sweep remediation | Adopt expo-image on Discover / Today / Library to kill image pop-in |
| ENG-657 | High | Plan Import — Sprint 2 (PD | Plan import: image vision adaptor (Sonnet vision → parse pipeline) |
| ENG-656 | High | Plan Import — Sprint 2 (PD | Plan import: PDF text extract adaptor (pdf.js → parse pipeline) |
| ENG-655 | High | Plan Import — Sprint 2 (PD | Plan import: multi-source input sheet (paste / PDF / photo) |
| ENG-654 | High | Plan Import — Sprint 1 (pa | Plan import: API route + auth + rate limit |
| ENG-652 | High | Plan Import — Sprint 1 (pa | Plan import: commit as template + optional activate |
| ENG-651 | High | Plan Import — Sprint 1 (pa | Plan import: assessment panel (avg vs target + 3 actions) |
| ENG-650 | High | Plan Import — Sprint 1 (pa | Plan import: review screen (editable rows + dual kcal trust) |
| ENG-649 | High | Plan Import — Sprint 1 (pa | Plan import: LLM parse → structured plan JSON schema |
| ENG-648 | High | Plan Import — Sprint 1 (pa | Plan import: paste sheet + plan name field |
| ENG-647 | High | Plan Import — Sprint 1 (pa | Plan: Generate dropdown — library vs import existing plan |
| ENG-646 | High | Plan Import — Sprint 1 (pa | Plan Import — program coordination |
| ENG-567 | High | Operations | Premium launch bar — program coordination |
| ENG-531 | High | Onboarding + Auth | [CF-1 / RTP-6] Fix Maestro `00c_onboarding_v2_steps.yaml` flow to advance past Welcome |
| ENG-525 | High | Onboarding + Auth | [P0 5.3] Decide — keep or remove `/login` in-card Sign-up/Sign-in toggle |
| ENG-522 | High | Phase 0 — Viral push prep | [SS8] Flip STRIPE_TAX_ENABLED=true once Phase 2 Stripe Tax is active |
| ENG-194 | High | Pre-launch monetisation +  | Tiering audit — which Health/advanced features sit behind Base vs Pro |
| ENG-190 | High | Operations | Update Runway snapshot — 2026-04 |
| ENG-184 | High | Pre-launch monetisation +  | Activate Stripe $2,500 processing credit |
| ENG-172 | High | Pre-launch incorporation + | T18 — Suppr Club branding decision + sweep |
| ENG-122 | High | Pre-launch incorporation + | UK/EU gluten claim language sign-off (B3.2 blocker) |
| ENG-121 | High | Recipes tab | Characterise north-star scorer on thin libraries (B2.2 input) |
| ENG-96 | High | Today tab | Profile vs Targets duplication — dedupe (audit #7 follow-up) |
| ENG-62 | High | Recipes tab | Cook ↔ Recipe Detail flow consolidation (P1) |
| ENG-1165 | Medium | Today tab | Mobile-web Today date strip exposes excessive dates to assistive tech |
| ENG-1164 | Medium | Landing + Marketing site | Web pricing mobile has excessive first-viewport blank space |
| ENG-1136 | Medium | Recipes tab | ~~Recipe-import parser leaks prep-states into shopping~~ — **Done** |
| ENG-1135 | Medium | Plan tab | ~~Shopping list plan-date subtitle + staleness hint~~ — **Done** |
| ENG-1133 | Medium | Plan tab | ~~Expand grocery categoriser beyond ~12 keywords~~ — **Done** |
| ENG-1131 | Medium | Plan tab | ~~Web Plan feature parity (move, templates, portion, suggestions)~~ — **Done** |
| ENG-1130 | Medium | Plan tab | ~~Sync named plan slots (cut/family/vacation) across devices~~ — **Done** PR #456 |
| ENG-1129 | Medium | Recipes tab | ~~Cook-mode servings confirm (batch vs eaten)~~ — **Done** |
| ENG-1126 | Medium | Recipes tab | Recipe collections/folders for library organisation (Paprika parity) |
| ENG-1125 | Medium | Today tab | ~~No offline/durable write-queue~~ — **Done** PR #456 |
| ENG-1122 | Medium | Today tab | ~~Web has NO logged-meal edit~~ — **Done** (`web_logged_meal_edit` flag) |
| ENG-1051 | Medium | Plan tab | ~~P2: pantry/staples model for the planner~~ — **Done** (Settings + per-row shopping) |
| ENG-1148 | Low | Today tab | ~~Net-energy subline maintenance band (±60 kcal)~~ — **Done** |

---

## WAVE 3 — category-leading *residual* + audit P3s (~120 open)

**Re-sequenced 2026-06-16:** the wedge-defining items (North Star ENG-935/933/939/938, refugee-activation ENG-962/964/965, import-moment ENG-980, paywall-honesty ENG-966/970, ENG-932, ENG-1065) are **promoted to Gate 1.5** — see that section. The mis-filed launch-hardening security (ENG-1137, 1124, 1118, 558, 541, 1158, 1128) is **also in Gate 1.5**. What remains below is genuine beta-window value + post-launch polish: deeper cook-mode/plan/discover features, design-token sweeps, schema refactors, ops, long-tail. Grouped by project; within each Urgent→Low. *(Shipped: 928, 929, 930, 971, 972, 973, 978, 979, 983, 1121 — see Shipped section.)*


**Category-leading growth backlog** (49)

| # | Pri | Title |
|---|---|---|
| ~~ENG-979~~ | High | ~~[Category-leading] Embed attributed creator credit into the shared card and link it to t~~ — **Done** |
| ~~ENG-978~~ | High | ~~[Category-leading] Generate a shareable 'Reel → clean card' artifact at the import succe~~ — **Done** |
| ~~ENG-972~~ | High | ~~[Category-leading] Add natural-language text meal logging to the single Log sheet ("desc~~ — **Done** |
| ~~ENG-971~~ | High | ~~[Category-leading] Fix the web/mobile parity bug and palette drift on web paywall surfac~~ — **Done** (AI paywall copy; pricing CTA already on Sloe tokens) |
| ENG-966 | High | [Category-leading] Lead the paywall with the personalised plan the user already built, t |
| ENG-962 | High | [Category-leading] Move signup after the plan reveal — let users see their targets befor |
| ENG-957 | High | [Category-leading] Wire 'Add to plan' straight into the shopping list and re-sync on eve |
| ENG-956 | High | [Category-leading] Add per-meal lock so Regenerate refreshes only the unlocked meals |
| ENG-951 | High | [Category-leading] Add a forecast line: 'At this pace you'll reach your goal around 14 A |
| ENG-945 | High | [Category-leading] Unify the two cook surfaces into one — retire the thin inline overlay |
| ENG-944 | High | [Category-leading] Show the ingredients needed for each step, inline beneath the instruc |
| ENG-940 | High | [Category-leading] Surface the recipe-fit score as a calm "matches your day" signal on D |
| ENG-935 | High | [Category-leading] Make 'What to eat next' a permanent, glanceable Today block — the nor |
| ~~ENG-933~~ | — | ~~Lead the Today screen with a single time-aware editorial line~~ — **Canceled (won't-do, 2026-06-17):** keep ENG-1032 |
| ~~ENG-983~~ | Medium | ~~[Category-leading] Deduplicate and aisle-sort shopping list at generation~~ — **Done** |
| ENG-982 | Medium | [Category-leading] Add editorial Collections (named, cover-image cookbooks) on top of th |
| ENG-981 | Medium | [Category-leading] Support batch / multi-recipe import in one share action |
| ENG-980 | Medium | [Category-leading] Save-first, review-later: let an import land in the library instantly |
| ENG-977 | Medium | [Category-leading] Add a calm post-log "what to eat next" micro-moment after AI logging |
| ENG-976 | Medium | [Category-leading] Surface the "we remember your corrections" learning loop as a visible |
| ENG-975 | Medium | [Category-leading] Add a portion-size assist on the photo result (reference object + on- |
| ENG-974 | Medium | [Category-leading] Add a "refine by describing" conversational correction step on photo  |
| ENG-970 | Medium | [Category-leading] Surface a "No payment due now" chip above the CTA in trial state |
| ENG-969 | Medium | [Category-leading] Add an honest projected-trajectory visual to the paywall and trial ti |
| ENG-968 | Medium | [Category-leading] Replace the "remind me" toggle with a Duolingo-style user-picked tria |
| ENG-965 | Medium | [Category-leading] Surface the data-import path earlier for MFP/MacroFactor refugees |
| ENG-964 | Medium | [Category-leading] Make the goal tangible with a date projection on the Reveal step |
| ENG-963 | Medium | [Category-leading] Add a 'why now' motivation step that the app reflects back later |
| ENG-961 | Medium | [Category-leading] Replace the bare-week summary with an editorial week digest the plan  |
| ENG-960 | Medium | [Category-leading] Let weekdays and weekends carry different day targets (training-day / |
| ENG-959 | Medium | [Category-leading] Add a calm cook mode from the plan: full-screen, step-by-step, screen |
| ENG-958 | Medium | [Category-leading] Surface 'Cook this twice' — repeat a recipe across chosen days as pla |
| ENG-955 | Medium | [Category-leading] Add a gentle, smart weigh-in reminder tied to cadence, not a daily na |
| ENG-954 | Medium | [Category-leading] Make the chart respond to plateaus with a calm, de-shaming insight li |
| ENG-953 | Medium | [Category-leading] Surface expenditure (adaptive TDEE) as a calm trend widget, not a bur |
| ENG-952 | Medium | [Category-leading] Break the goal into named milestones with a quiet two-tier celebratio |
| ENG-949 | Medium | [Category-leading] Make cook-mode text size and contrast first-class (large, legible, gl |
| ENG-948 | Medium | [Category-leading] Let users start a timer from any duration in the step, and run severa |
| ENG-947 | Medium | [Category-leading] Enable swipe-between-steps with a quiet page indicator |
| ENG-946 | Medium | [Category-leading] Add an ingredient checklist with tap-to-check-off (mise en place + du |
| ENG-943 | Medium | [Category-leading] Generate a shopping list from any recipe (and from a meal plan) |
| ENG-942 | Medium | [Category-leading] Add an ingredient panel with check-off to Cook Mode |
| ENG-941 | Medium | [Category-leading] Add an editorial Collections layer to Discover (seasonal + themed cur |
| ENG-939 | Medium | [Category-leading] Give Today a warm, food-forward empty/cold-open state — not a zeroed- |
| ENG-938 | Medium | [Category-leading] Surface protein-remaining as the priority macro on Today, not buried  |
| ENG-937 | Medium | [Category-leading] Add a calm weekly 'how this week went' nutrition-quality reflection ( |
| ENG-936 | Medium | [Category-leading] Add an intake-vs-expenditure energy-balance trend strip below the rin |
| ENG-932 | Medium | [Category-leading] Position barcode scanning as a loud, free, first-class affordance — t |
| ENG-931 | Medium | [Category-leading] Make the search result row directly loggable at its default serving |

**Operations** (23)

| # | Pri | Title |
|---|---|---|
| ENG-1140 | Medium | Replace source-grep button/card string-pins with render-level behavioural tests for load |
| ~~ENG-1121~~ | ~~Medium~~ | ~~FatSecretBadge missing from the food-search results panel~~ — **Done** PR #456 |
| ENG-1119 | Medium | No retry at any vendor call site; USDA search returns 502 (not the degraded envelope) on |
| ENG-1118 | Medium | FatSecret %DV→absolute micro conversion has no v1/v2 API version guard (latent ~13-18x i |
| ENG-1117 | Medium | Edamam /nutrients (and USDA detail) routes not counted by the vendor quota guard |
| ENG-1115 | Medium | Gate + document SUPADATA_KEY (verify-production-env + .env.example); alarm on import leg |
| ENG-1113 | Medium | Web AppDataContext god-context + FoodSearchPanel duplicated web/mobile — extract pure lo |
| ENG-1101 | Medium | Dependency update pass — 34 production-dep bumps fail CI, do in smaller batches |
| ENG-993 | Medium | Defensive: route PostHog flags/experiments through a first-party proxy |
| ENG-853 | Medium | Docs-only PRs are permanently BLOCKED by required visual checks that never run |
| ENG-1166 | Low | Root docs reference missing `apps/mobile/AGENTS.md` | **Done** — Option C: `.claude/CLAUDE.md` canonical; root `AGENTS.md` tracked mirror (`docs/decisions/2026-06-17-agent-docs-claude-canonical.md`) |
| ENG-1160 | Low | Re-home 7 architecture-enabler issues to Platform foundations + retire the dead Premium  |
| ENG-1159 | Low | Vendor/logging cleanups: edamamNutritionAnalysis dead code, 4000-char caption truncation |
| ENG-1156 | Low | Delete orphaned onboarding/finalStep.ts (dead code, banned 'staged for follow-up', refer |
| ENG-1151 | Low | Extend Sentry PII redaction denylist to health fields (weight/measurements/sex-at-birth/ |
| ENG-1149 | Low | Delete stale 'KNOWN APPROXIMATION' header in measureToGrams.ts (ENG-701 already fixed th |
| ENG-1146 | Low | Add FATSECRET_TIER to CI + Vercel + a startup assertion (no prod micros-zeroing — CI hyg |
| ENG-1145 | Low | Route mobile OFF barcode through /api/off/barcode proxy (curated overrides + rate limit  |
| ENG-1144 | Low | Sync mobile database.types.ts (missing eaten_at) + CI diff-guard vs web |
| ENG-1143 | Low | Sweep 25 Duplicate-state issues → Canceled + retire the defunct Premium-bar-audit projec |
| ENG-1142 | Low | Re-arm visual-regression gate (Chromatic review or Playwright golden) for cohesion-wave  |
| ENG-1120 | Low | FatSecret OAuth2 token cached in module memory only — store in Redis to survive serverle |
| ENG-1114 | Low | Single-region/single-instance SPOF topology (Vercel US-East for UK/EU users; Upstash bla |

**Audit sweep remediation** (17)

| # | Pri | Title |
|---|---|---|
| ENG-1168 | Medium | Silent-deferral re-sweep: live comments still describe untracked gaps |
| ENG-763 | Medium | Visual-testing follow-ups: Storybook Tier 1 10→18 + deep authed VR baselines |
| ENG-751 | Medium | nutrition_entry_ingredients snapshot table for AI/photo multi-item meal breakdown |
| ENG-750 | Medium | Opt-in per-entry enrichment of imported log rows (replaces "re-match low-confidence MFP  |
| ENG-721 | Medium | Celebration moments (confetti + flourish) on genuine accomplishments |
| ENG-720 | Medium | Progressive text reveal on key onboarding beats (reduce-motion safe) |
| ENG-713 | Medium | Add trend-only / hide-weight mode (ED + dysphoria dignity) |
| ENG-1083 | Low | Add no-salt-added canned tomatoes to genericFoods (with correct micro bake) |
| ENG-845 | Low | [Security][P3] search_path pg_temp consistency tail on SECURITY DEFINER helpers (ENG-557 |
| ENG-724 | Low | One hand-drawn human touch on a permission sheet |
| ENG-723 | Low | Calm structured (dotted-baseline) empty states — Discover / Plan / weight chart |
| ENG-722 | Low | Log-confirm checkmark micro-animation (haptic already shipped) |
| ENG-717 | Low | P2 cluster — code-health quick wins |
| ENG-716 | Low | P2 cluster — design-token + a11y nits |
| ENG-714 | Low | Separate gender/pronoun from sex-at-birth |
| ENG-696 | Low | Build web Plan Import UI — launch parity |
| ENG-718 | No pri | Sweep decisions log — Grace's resolutions (2026-05-25) |

**Design system cleanup** (14)

| # | Pri | Title |
|---|---|---|
| ENG-1141 | Medium | Off-scale spacing/radius/type-ramp literal sweep (Today/Discover/DiscoverFeed) |
| ENG-1139 | Medium | Replace raw Pressable with PressableScale (haptics) on Today meal rows + Discover cards |
| ENG-1138 | Medium | Add focus-visible rings to web import-hero slab + meal-slot header (keyboard a11y) |
| ENG-1056 | Medium | Enforce no-raw-hex: flip web rule warn→error + add mobile selector (split from ENG-811,  |
| ENG-1018 | Medium | Radius literal cleanup: 24/22/14/11/10/9/5/3/2 → {4,6,8,12,full} (carve-outs excepted) |
| ENG-1016 | Medium | Haptic rebalance: route commit-actions through PressableScale (Light→Medium), add web co |
| ENG-986 | Medium | Shared macro-icon mapping (single source of truth) to prevent glyph drift |
| ENG-780 | Medium | Storybook 100% coverage — web + mobile, all components + screens (additive) |
| ENG-778 | Medium | Systemic contrast sweep: text-primary on bg-primary/N tints (WCAG AA) |
| ENG-120 | Medium | Lucide sweep — long-tail (~64 files remaining) |
| ENG-1180 | Low | Brand review: over-budget RED ring vs body-neutral / no-shame positioning (VoC: MacroFac |
| ENG-1147 | Low | Discover/DiscoverFeed recipe cards missing accessibilityLabel/aria-label + sub-floor tex |
| ENG-1002 | Low | Mobile type-scale conformance + parity with web ENG-119 snap |
| ENG-881 | Low | Add macro/fiber (teal) colour variable to Sloe/Color Figma collection |

**Today tab** (10)

| # | Pri | Title |
|---|---|---|
| ENG-884 | Medium | Expand Storybook/Chromatic to feature/screen components (Today, ring, energy, meals) |
| ENG-882 | Medium | Today (sim): serif renders heavier than Figma + spacing drift to re-check |
| ENG-871 | Medium | Today: reduce vertical monotony — vary card rhythm |
| ENG-854 | Medium | "Make anything fit" — Mode A: portion-to-fit (Today page) |
| ENG-737 | Medium | Barcode scan result card — visual redesign ("looks awful") |
| ENG-1096 | Low | Remove dead TodayMealsFigmaLayout (web + mobile) — off-by-default figma meals path |
| ENG-984 | Low | Dead-code: retire the eat-again banner components on both platforms (rendered nowhere po |
| ENG-872 | Low | Today: redundant top nudges (banner + chip + coach say the same thing) |
| ENG-849 | Low | Wire real householdSize on Today WeeklyInsightCard (ENG-758 follow-up) |
| ENG-848 | Low | Web macro-detail surface — wire MacroDetailPanel or delete it (parity decision) |

**Gate 0 — launch hardening** (6)

| # | Pri | Title |
|---|---|---|
| ENG-1137 | Medium | Apply assertOrigin CSRF guard to all cookie-auth mutating API routes |
| ENG-1124 | Medium | Web nutrition_entries write-payload untested + a second buildNutritionEntryRow that can  |
| ENG-1154 | Low | Pin search_path on the Gate-0 tier-lockdown trigger functions (advisor WARN) |
| ENG-1153 | Low | Defence-in-depth on claim_web_push_subscription endpoint-only DELETE |
| ENG-1152 | Low | Harden SSRF string-layer: block 0.0.0.0 + integer/octal/hex IPv4 encodings |
| ENG-1075 | Low | Route mobile OFF barcode lookup through /api/off/barcode proxy (parity with web) |

**Schema refactor** (4)

| # | Pri | Title |
|---|---|---|
| ENG-989 | Medium | Step-centric recipe schema (ingredients nested inside steps) |
| ENG-1155 | Low | RLS perf: wrap auth.<fn>() in subselect (referrals/referral_credits) + consolidate 12 pe |
| ENG-1076 | Low | eaten_at timezone hardening before multi-device editing (thread canonical tz through mea |
| ENG-1052 | Low | P3: schema hardening batch — calories smallint→int, nutrition_entries.source CHECK, save |

**Phase 0 — Viral push prep** (4)

| # | Pri | Title |
|---|---|---|
| ENG-558 | Medium | [Security] Enable Leaked Password Protection in Supabase Auth |
| ENG-541 | Medium | Lock down Sentry Allowed Domains for `suppr-web` project |
| ENG-560 | Low | [Housekeeping] Resolve 4 Sentry DSN-test issues + lock Allowed Domains |
| ENG-559 | Low | [Perf] Review and drop 31 unused indexes |

**Plan tab** (3)

| # | Pri | Title |
|---|---|---|
| ENG-855 | Medium | "Make anything fit" — Mode B: distribute-around-anchor (Plan tab) |
| ENG-1150 | Low | Include fiberG when recomputing plan day totals after leftovers/move |
| ~~ENG-1100~~ | Low | ~~Plan empty-slot unification~~ | **Done** #472+#475 — extract + partial-day canonical rows |

**Progress tab** (3)

| # | Pri | Title |
|---|---|---|
| ENG-1116 | Medium | Adaptive-TDEE ±0.35 kg/wk slope cap under-credits legitimate fast losers — make it windo |
| ENG-992 | Medium | Life-Score: weekly "health, not just calories" number |
| ENG-376 | Medium | [Audit 2026-05-12] Group H — Mobile Progress / Weight chart (canonical card): Single-sou |

**MFP-refugee capture** (3)

| # | Pri | Title |
|---|---|---|
| ENG-846 | Medium | Goal-pace editor — inline editable fibre input (ENG-779 follow-up) |
| ENG-777 | Medium | P2/P3 — Logging-loop polish roll-up (stepper, recents portion, post-log toast, household |
| ENG-847 | Low | [Schema] Add profiles.target_fiber_source for full fibre stickiness (ENG-779 follow-up) |

**Import posture & legal** (2)

| # | Pri | Title |
|---|---|---|
| ENG-1128 | Medium | Web/blog import persists instruction steps verbatim — paraphrase per the legal posture d |
| ENG-860 | Medium | Adopt user-as-actor / private-by-default framing in ToS + Help (keep the honest bot UA) |

**(none)** (2)

| # | Pri | Title |
|---|---|---|
| ENG-1090 | Medium | CI flake: storybook build EEXIST mkdir race in static-asset copyDir |
| ENG-1065 | Medium | TF57 — TODAY-tab cohesion: Complete Day button, Planned card, meal-section styling (F-15 |

**Pre-launch monetisation + billing** (2)

| # | Pri | Title |
|---|---|---|
| ENG-991 | Medium | Monetisation: HSA/FSA payments via TrueMed (US) |
| ENG-199 | Medium | Add VAT / tax notes to Stripe + RevenueCat dashboards |

**Recipes tab** (2)

| # | Pri | Title |
|---|---|---|
| ENG-736 | Medium | Recipe yield + portion-style logging (log by g / slices, not just servings) |
| ENG-193 | Medium | Discover feed depth — filters, creator profile, saves→library→plan loop |

**Onboarding + Auth** (2)

| # | Pri | Title |
|---|---|---|
| ENG-663 | Medium | Tech debt: Onboarding web/mobile flow parity |
| ENG-125 | Medium | Mobile post-onboarding edit affordance for nutrition targets |

**Landing + Marketing site** (2)

| # | Pri | Title |
|---|---|---|
| ENG-71 | Medium | Re-export Bundle 3 (Suppr Landing) — not yet mirrored to repo (audit 2026-04-30) |
| ENG-65 | Low | Hero ring gesture asymmetry between web and mobile (audit 2026-04-30) |

**AI features** (1)

| # | Pri | Title |
|---|---|---|
| ENG-1158 | Low | Decide AI_BUDGET_ENFORCEMENT_ENABLED before the viral push (cost breaker is monitoring-o |

**Plan Import — Sprint 2 (PDF + image)** (1)

| # | Pri | Title |
|---|---|---|
| ENG-658 | Medium | Plan import: E2E + Maestro — paste happy path |

**Plan Import — Sprint 1 (paste + auto-rebalance)** (1)

| # | Pri | Title |
|---|---|---|
| ENG-653 | Medium | Library: Imported plans filter chip |

**Post-iOS platform** (1)

| # | Pri | Title |
|---|---|---|
| ENG-202 | Low | Spike Google Fit / Health Connect for Android |

---

## WAVE 4 — redesign *residual* / platform / AI-imagery / creator (~45 open)

**Re-sequenced 2026-06-16:** the redesign is NOT a post-launch block — Layers 1+2 are live (`REDESIGN_DEFAULT_ON`), and the launch-cohesion close-out (core-5 + Onboarding + brand-sweep) is **promoted to Gate 1.5**. What remains in Wave 4 is genuinely post-launch: **Layer-3 pixel-exactness on edge surfaces** (Account deep sub-screens ENG-892, Fasting ENG-894/918, Landing ENG-902), **net-new Figma-only feature builds** (ENG-906/907/908/910–917 — additive, not conformance; ENG-913 Ask-coach already deferred per ENG-923), the **App-Only→Figma backfill EPIC** (ENG-903/888 — APP-FIRST policy keeps deprioritised; documents reality, zero user pixels), **dark mode** (no dark frames exist — ship light-only at launch), **Redesign P5 residual** (ENG-829/831/832/834/836/837/838/804), **AI image generation** (ENG-861→999 — separate program), **creator platform** (ENG-868/869/870 — claim/merge post-launch), and **architecture enablers** (ENG-619→665 — user-invisible tech debt). *(Shipped: 802, 880, 1077, 905; ENG-904 dup of 930 — see Shipped section.)*


**Figma conformance migration** (29)

| # | Pri | Title |
|---|---|---|
| ENG-888 | Urgent | EPIC: Figma conformance migration — web + mobile to Sloe source of truth |
| ENG-908 | High | Build Figma-Only: Recipes — "Recipes in action" Reels rail (528:105) |
| ENG-907 | High | Build Figma-Only: Recipes — Discover "Popular collections" carousel (528:61) |
| ENG-903 | High | EPIC: Figma design — App-Only → Pending Sign-Off (177 wired screens need Julienne Figma  |
| ENG-901 | High | Conform Paywall & win moments to Figma (6 partials) |
| ENG-900 | High | Conform Log a meal to Figma (6 partials) |
| ENG-899 | High | Conform Plan to Figma (7 partials) |
| ENG-898 | High | Conform Import to Figma (8 partials) |
| ENG-896 | High | Conform Recipes & Cookbook to Figma (10 partials) |
| ENG-893 | High | Conform Global / Nav / System states to Figma (13 partials) |
| ENG-892 | High | Conform Account / Settings / More to Figma (13 partials) |
| ENG-891 | High | Conform Progress to Figma (15 partials) |
| ENG-890 | High | Conform Recipe detail / create / cook to Figma (16 partials) |
| ENG-889 | High | Conform Today to Figma (13 partials + pixel deltas) |
| ENG-917 | Medium | Build Figma-Only: Import — macro-check reassurance card (177:81) |
| ENG-916 | Medium | Build Figma-Only: Paywall — Web import-success surface M6 (304:2) |
| ENG-915 | Medium | Build Figma-Only: Auth — Continue-with-email progressive disclosure (296:33) |
| ENG-913 | Medium | Build Figma-Only: Account — Ask coach screen (185:2) — net-new feature |
| ENG-912 | Medium | Build Figma-Only: Account — Region row (334:96) |
| ENG-911 | Medium | Build Figma-Only: Account — Sloe Pro upsell banner (335:23) |
| ENG-910 | Medium | Build Figma-Only: Onboarding — About-you consolidated body stats S2 (190:2) |
| ENG-906 | Medium | Build Figma-Only: Today — Activity Summary modal (web, 834:2) |
| ENG-897 | Medium | Conform Auth to Figma (8 partials) |
| ENG-895 | Medium | Conform Onboarding to Figma (12 partials) |
| ENG-894 | Medium | Conform Fasting to Figma (12 partials) |
| ENG-918 | Low | Build Figma-Only: Fasting — K4 "Fasting on Today" explainer header (498:3) |
| ENG-902 | Low | Conform Landing & Marketing (web) to Figma (2 partials) |

**Redesign P5 — Web & mobile-web parity** (10)

| # | Pri | Title |
|---|---|---|
| ENG-834 | High | [P5] Web colour/CTA + search-chip parity (design_system_colours / redesign_search_result |
| ENG-829 | High | [P5] Web redesign_branded_sheets — branded meal-action header + branded error screens |
| ENG-827 | High | Golden visual-regression + parity test suite — lock the redesign ramp + release-gate |
| ENG-804 | High | [Mobile-web] Investigate Next.js "1 Issue" runtime/build error on authed web build |
| ENG-837 | Medium | Web meal-nutrition — add slot-aggregate (per-slot) nutrition mode |
| ENG-836 | Medium | Web meal-nutrition dialog — wire the Edit action into the log-sheet edit flow |
| ENG-832 | Medium | [P5] Web brandmark placements + wordmark ratio align (design_system_brandmark) |
| ENG-831 | Medium | [P5] Web emoji→Lucide residuals — 4 surfaces ENG-808 missed on web |
| ENG-838 | Low | Wire flag-ON visual-regression goldens into CI for the redesign surfaces |

**AI image generation** (9)

| # | Pri | Title |
|---|---|---|
| ENG-999 | High | fal image-gen cost guardrail + model tier (Nano vs FLUX at viral scale) |
| ENG-863 | High | Runtime "Generate an image" on import (cache, label, nutrition-decouple, removable) |
| ENG-862 | High | Add image_source provenance column (+ model, generated_at) |
| ENG-861 | High | Image-gen engine spike: fal.ai + FLUX 2 Pro + the locked Sloe prompt template |
| ENG-987 | Medium | Ratify image-prompt template changes (Nano switch) + matched-name persistence + alias st |
| ENG-865 | Medium | Reconcile image-gen monetisation: free-base-gen vs Pro-gen-for-polish |
| ENG-864 | Medium | AI-image precedence ladder + disable generation on the public/Discover plane |
| ENG-867 | Low | Julienne UX adopts (post-Today): import loading, cook-step chips, Est. Cost, graceful Di |
| ENG-866 | Low | Design-time fal/FLUX batch generator (replace Stitch friction) |

**Premium P5 — Architecture enablers** (7)

| # | Pri | Title |
|---|---|---|
| ENG-661 | High | Tech debt: OFF ODbL — cache-only (Option A) |
| ENG-622 | High | Web App Router migration (remaining views) |
| ENG-619 | High | Extract useToday() + composition root |
| ENG-856 | Medium | Decompose Today megafile (index.tsx, 6,317L) — guarded by 19 source-pin tests |
| ENG-665 | Medium | Tech debt program — Q3 2026 priority stack |
| ENG-620 | Medium | @suppr/nutrition-core package |
| ENG-573 | Medium | P5 umbrella — Architecture enablers |

**Creator platform** (3)

| # | Pri | Title |
|---|---|---|
| ENG-869 | Medium | Two-plane content model + content_origin (private imports vs first-party canonical) |
| ENG-868 | Medium | Resolve author_id vs creator_id canonical-ownership ambiguity (blocks claim & merge) |
| ENG-870 | Low | Claim & merge (post-launch): verified ownership, forward-only, non-destructive |

**Redesign P2 — Food logging & search** (0 open — both shipped 2026-06-14)

~~ENG-1077~~, ~~ENG-880~~ → Done (`13952d62`).

---

## Cross-cutting priorities

1. **The wedge cluster jumps the queue** — meal-planning + food-data-trust (ENG-1051, ~~1132~~, ~~1134~~, 1133, 1105/~~1106~~, 1110, 1177): where Suppr is weakest AND MFP most-resented (VoC doc).
2. **Web↔mobile parity** broken on load-bearing flows (ENG-1107, ~~1108~~, 1122, 1131, ~~1127~~) — fix forward.
3. **Slot/date correctness** (~~ENG-1132~~, ENG-1162) — 1132 shipped; 1162 still open before marketing the planner.
4. **Don't fight lost arms races** (photo logging, DB breadth); lead on the wedge.

## Linear reconciliation

- `label:launch-blocker` = exactly the 19 Gate-0/Gate-1 must-ship items.
- `label:paid-ga-blocker` = Gate B (**4 open** after 2026-06-14 ship).
- **2026-06-14:** 21 issues → Done on `claude/eng-1099-tracker-tier` (see Shipped section); ENG-1099 remains In Progress.
- ENG-1073 bumped Medium → High (prior pass).
- This document is the authoritative ordering; Gate 2+ keep existing Linear priority levels.
- 25 Duplicate-state zombies (Premium-bar-audit project) excluded — cancel via ENG-1143.
