# Full-product orchestration sweep — 2026-07-01

**Scope:** the whole product as currently built — branch `agent/cursor/eng-1240-coach-screen` (= main + Coach screen), web + iOS + mobile-web + landing/marketing, code + pixels + market position.
**Method:** 2 capture agents (86 verified PNGs: 27 iOS sim + 59 web, light/dark, scrolled, populated account) → 25 code/market lenses → 6 pixel-grounded visual lenses → adversarial verification (12 clusters verified before the spend cap; 3 verified inline against the live DB/repo by the orchestrator; the rest confirmed by multi-lens + pixel convergence) → consolidation against 111 open Linear issues.
**Totals:** 336 raw findings → deduped below. Capture walls: `apps/mobile/screenshots/agent/sweep-2026-07-01/`, `screenshots/web-drive/sweep-2026-07-01/`. Full lens JSONs + verdicts: session scratchpad `sweep/` (lenses/, verdicts.json, verify-queue.json, orchestrator-notes.md).

---

## Release readiness verdict: **HOLD the public viral push. TestFlight/beta continues fine.**

The product core is real and well-built (repo-auditor: "genuinely built, not a facade; numbers never guessed; AI degrades gracefully"). But the 2026-07-01 public push cannot start today:

1. The **flagship viral wedge (IG/TikTok reel import) is deliberately OFF in prod** — `IG_TT_IMPORT_ENABLED` is un-flippable until DMCA registration, which is gated on the incorporation/immigration chain (GROW-47/48). The launch thesis's lead bet is dark by design until legal clears.
2. **Web /pricing makes a false trial claim** ("No payment due now — first charge on Day 7") while web checkout charges immediately — false-advertising-grade, S-effort fix (VERIFIED, conf 10).
3. ~~Web /login and /signin are unreachable~~ — **RETRACTED (2026-07-01): phantom, see below.**
4. **Mobile analytics + session replay run with no consent gate**, contradicting the privacy policy (VERIFIED). EU/UK launch legal blocker.
5. **Ops floor incomplete:** Supabase Free plan (24h RPO, no PITR, restore never rehearsed), storage buckets unmirrored, 4/6 runtime alarms unwired, solo-founder vault unpopulated. All already ticketed (GROW-57/48, ENG-509 follow-up) but must close before traffic arrives.

None of these is large. The gap between today and "pushable" is roughly: one legal/ops closing sprint (mostly Grace-gated external tasks) + ~2 focused engineering days on item 2 + the Coach/imagery hardening below.

**Refuted during verification (do NOT action):**
- ~~ENG-1237 migration staged-not-applied / Progress broken~~ — live DB checked: migration `20260702120700` applied; `profiles.body_fat_pct_by_day` exists. Phantom.
- ~~ENG-955 `last_weigh_in_reminder_sent_at` staged-not-applied~~ — column exists live. Same phantom class. (The **generated types** being stale is the real, smaller issue — see actions.)
- ~~Web /login and /signin unreachable (redirect to landing, "pixel-confirmed twice")~~ — **tooling bug, not an app bug.** `scripts/web-drive.mjs`'s `dismissOverlays()` page-wide-matched button accessible names before every capture; the login screen's dismiss X (`app/login/ui.tsx`, `aria-label="Close"`) matched the generic `/^(keep going|got it|close)$/i` pattern and got clicked before the screenshot, and its `onClose` hard-navigates to `/` — so both capture agents "confirmed" the same self-inflicted redirect. Fixed by scoping that pattern (and the cookie-banner/checklist patterns) to their genuine overlay containers (`[role=dialog]`/`[role=alertdialog]`, `[data-testid="cookie-consent-banner"]`, `[data-testid="first-run-checklist"]`) instead of page-wide matching — same fix applied to `tests/e2e/utils/visual.ts#dismissVisualOverlays`, which had the identical (worse: unanchored) defect and is used by 8 live visual-regression specs including ones that capture `/login`. Recaptured `login-desktop.png` / `signin-desktop.png`: both render the actual chooser-first login screen, URL stays on-route. No app-side bug exists.
- "Paywall CTA says Open App Store to subscribe" — **suspected sim-only RevenueCat fallback**; verify on device before filing as a prod bug.

---

## Top ranked actions

Blockers first, then severity × user-impact / effort. ✅ = adversarially verified; ⛰ = multi-lens + pixel convergence; Linear IDs = already ticketed (don't re-file).

| # | Action | Evidence / verdict | Effort | Owner |
|---|---|---|---|---|
| 1 | **Fix the false web trial claim**: either add `trial_period_days` to the web Stripe checkout or remove `PricingNoPaymentChip` from Pro annual (`app/pricing/PricingTiersGrid.tsx:360`, `src/lib/landing/paywall…`) | ✅ s5 c10 | S | Cursor |
| 2 | ~~Restore web sign-in~~ — **RETRACTED (2026-07-01): phantom.** Root cause was `scripts/web-drive.mjs`'s `dismissOverlays()` clicking the login screen's Close X (page-wide accessible-name match, not scoped to real overlays) before every capture, self-navigating to `/`. Fixed in tooling (scoped to `[role=dialog]` etc.); `/login` and `/signin` render correctly. No app code change needed. | — | — | — |
| 3 | **Gate mobile PostHog + session replay behind consent** (`apps/mobile/lib/analytics.ts:175-229` inits unconditionally, `enableSessionReplay:true`; web gates via `AnalyticsProvider`); add Settings toggle | ✅ s5 | M | Cursor |
| 4 | **Fix recipe imagery decoupling** — wrong stock photos on Coach/Log-sheet/Library cards, same recipe different photos per platform, Discover colour-block placeholders, one tofu photo repeated across 6 cards. 4 lenses + both capture agents; root cause in the image-resolution pipeline (likely index/fallback mismatch in SmartImage/seed mapping) — needs a root-cause pass first | ⛰ s5 (imagery is the viral-hook surface) | M | Cursor |
| 5 | **Coach launch-hardening bundle** (ENG-1240 fast-follow): (a) web "What to eat next" EMPTY despite 9 saves — `savedRecipesForLibrary` wiring on `/coach`; (b) "Refining order…" never resolves; (c) decouple the Coach entry from the deficit line — it vanishes when over budget/<50 kcal/past days, exactly when needed (✅ V6/V23, one root cause); (d) wire `meal_coach_suggestion_shown` + add `coach_ask_answered` (✅ V1/V2 — north-star moment currently unmeasurable); (e) route + e2e tests (sibling template exists); (f) card-vs-no-card + chip parity | ✅/⛰ s4-5 | M | Cursor |
| 6 | **Close the ops floor**: Supabase → Pro plan + PITR decision, storage backup, wire alarms 3-6, populate recovery vault, run one restore rehearsal | OPERATIONAL — already ticketed GROW-57, GROW-48, ENG-509-follow-up, scaling doc | M (mostly Grace dashboard work) | Grace |
| 7 | **Rebrand transactional emails**: all 6 `supabase/templates/*.html` + `config.toml` subjects still Suppr-branded with the retired blue→magenta gradient; extend `brandDriftSloe.test.ts` to cover them; `supabase config push` after. Do NOT flip link hosts yet (suppr-club.com is still canonical) | ✅ s4 | S | Cursor |
| 8 | **Stale-Suppr web sweep** (one mechanical PR): roadmap "sloe Suppr" header + body, recipe-detail "Suppr Kitchen", Settings copy, `/licences`, `ATTRIBUTIONS.md`, `REBRAND.md` ("rebrand complete" is false), `legal@suppr.app` → `legal@getsloe.com`, StoreKit sub-group name (App-Store-visible) | ⛰ s4 (3 lenses + capture) | S | Cursor |
| 9 | **Fix mobile-web Today week strip** — dates 9–14, no selected day, 6 day letters under a "Wednesday 1 July" header; plus FAB overlapping the Carbs "of Xg" label and "Quick add" peeking behind the tab bar | ⛰ s4 (3 lenses + orchestrator eyes) | S | Cursor |
| 10 | **Settings hardening PR**: contradictory entitlement (Free row + "Sloe Pro — Manage" + Upgrade section — decide the authoritative source, `profiles.user_tier`), the live RN "Text outside <Text>" LogBox error, tab bar overlaying Membership content (missing bottom inset) | ⛰ s4 (3 lenses + capture evidence PNG) | M | Cursor |
| 11 | **Web catches up to v3 on Plan + Log sheet**: web Plan is a full pre-v3 layout (no week strip/status line/household banner, wrong title, flat day cards); web Log sheet is a dated dropdown form vs the canonical iOS entry-modes sheet. Design already exists (v3 prototype `web-plan.png`) — fold into ENG-1247 | ⛰ s4 ×3 lenses each | L | Cursor (under ENG-1247) |
| 12 | **Web perf before traffic**: web Today loads the ENTIRE `nutrition_entries` history unwindowed (mobile is windowed); ~8 eager round-trips incl. a 200-recipe Discover fetch on boot; near-zero code-splitting | lens-evidence s4 (not adversarially verified — verify while fixing) | M | Cursor |
| 13 | **Decisions for Grace** (route, don't silently change): (a) **Coach Pro-gating** — free users currently trigger paid Haiku calls while the paywall sells "AI coach" (✅ V18); (b) **B9 governance** — ENG-1240 built the unified Coach screen the 2026-06-11 ratification declined; acknowledge/re-ratify; (c) **over-budget ring colour** — ships coral/amber arc + amber numeral (`--accent-warning-solid`), not the locked destructive-red (measured); MacroFactor-style "no red numbers" is a live counter-argument — pick red or re-ratify amber; (d) **empty-ring visibility** — the empty/under gradient reads as a grey skeleton (design-director s5 vs enforcer "conformant"; my eyes lean design-director at empty state); (e) **guilt-free** paywall copy (one-liner, `paywallValueProps.ts:77`) | ✅/⛰ | decision | Grace |
| 14 | **North-star CTA friction**: Today's suggestion + Coach candidate rows all route to Recipe Detail — no one-tap log anywhere on the "what to eat next" path (✅ V13). Spec a one-tap "Log this" secondary action | ✅ s3-4 | M | ui-product-designer → Cursor |
| 15 | **Mechanical batch** (one PR): regen `database.types.ts` (stale: missing 2 live columns, ✅ V7); add `log_refine_describe_v1` to both REDESIGN_DEFAULT_ON sets (decision doc says shipped; it's dark — verified inline); ticket the 6 silent-deferral comments; re-pin token budget (~89 literals of slack); fasting duplicate chip row; `sitemap.md` + docs for `/coach` | ✅ | S | Cursor |

**Also worth noting (below the fold but real):** ~~onboarding never surfaces recipe import or the MFP CSV adapters~~ **resolved ENG-1304 (2026-07-03)** — real recipe import + CSV on `data-bridges`; no referral/attribution loop anywhere (s4 growth); recipe-import path drops the micronutrient panel the food-log path plumbs (s4 nutrition, unverified); RevenueCat REFUND/TRANSFER webhooks are silent no-ops; `/api/healthz` missing while alarms assume it; AI budget enforcement ships OFF by default; household 7×4 grid persists locally only; Plan first-paint target=0 race; status-bar underlap on recipe-detail/paywall; "You're all set!" toast overlaying most authed web pages; recipe-detail sticky footer flaky AND invisible to VoiceOver (a11y).

---

## Findings by area (deduped highlights; full detail in scratchpad lens JSONs)

### Coach (new, ENG-1240) — 66 findings across 20 lenses, the sweep's hottest area
Real, genuinely shared web/mobile architecture with graceful AI degradation (repo-auditor praise). But: unmeasurable (2 events unwired ✅), undiscoverable + entry vanishes when over budget (✅), un-gated Pro value (✅), zero tests, web suggestions empty (bug), permanent "Refining order…" loader, imagery mismatches, BEST FIT dark-mode contrast 1.79:1 (WCAG fail), governance conflict with ratified B9, no "estimated" qualifier on predicted kcal. One coherent hardening bundle = action #5 + decisions #13a/b.

### Monetisation & legal
False web trial claim (✅ #1); mobile consent gate (✅ #3); STRIPE_TAX still off (ticketed GROW-45/ENG-33 — Blocked); US visitors silently charged GBP; web has no trial at all vs mobile 7-day (real asymmetry); DMCA unregistered (GROW-47); OFF ODbL Option A unbuilt (GROW-64); emails off-brand (✅ #7). Positives: cancellation honest, free tier genuinely generous, billing paths well-tested (qa-lead calibration), paywall trust copy strong.

### Design / visual (from pixels)
Mobile app is the strongest surface and largely v3-conformant. The gap is web (Plan + Log sheet a generation behind — #11) and mobile-web (week strip #9). Cross-cutting: recipe imagery crisis (#4), light-mode card elevation imperceptible (challenge — evidence-backed), ring colour contract contradictions (#13c/d), status-bar underlaps, toast overlay, fasting duplicate chips, Progress light/dark parity gaps. Premium-auditor's refuse-to-pass list gates on: imagery, log-sheet parity, week strip, entitlement contradiction. (/login dropped from this list — 2026-07-01 retraction, was a capture-tooling artifact, not an app defect.)

### Nutrition engine
No guessing confirmed as real posture (positive). Gaps: import path drops micros panel (s4); live accept floor 0.55 vs published 0.70; web drops caffeine/alcohol on import while mobile rolls them up; is_verified floor 0.5 vs 0.55 cross-platform drift; ~~no OFF staleness gate~~ **resolved ENG-1326** (corpus-derived confidence downgrade); "pepper" → bell-pepper default. None launch-blocking; all worth a nutrition-correctness sprint.

### Platform / perf / data
Web Today unwindowed (#12); AppData boot fan-out; `_by_day` JSONB read-modify-write races (HealthKit vs manual can clobber); no unique constraint on `recipes.source_url` (duplicate imports); types stale (✅ #15); 15 files >2,000 lines + ~50 collapsed-but-not-deleted flags (ENG-1225 continuation); expo-image disk cache flag-OFF (lens-evidence: grids refetch on scroll).

### Growth / market
MFP exodus live and worsening (verified external sourcing) — the capture window is real and open; Cal AI in reputational free-fall (opportunity); Lose It winning the frugal-casual refugees. Suppr's honest-estimate posture is a genuine differentiator. But: wedge dark (#legal), onboarding hides import, zero referral loop, retention unmeasurable until events fire. Recipes+macros gap validated as unfilled — Suppr's exact thesis.

### Ops / production readiness
See action #6. Also: no Web Vitals pipeline, TestFlight expiry monitoring is a calendar reminder, AI provider fallback config-only, Supabase compute Micro (scaling doc says upgrade pre-2026-06-30, unactioned), stale Notion-mirror instructions still in `_project-context.md`/CLAUDE.md (contradicts the 2026-06-28 discontinuation).

### Inclusion & a11y
Strong overall (Coach body-neutral filters exemplary; onboarding sex-step model-grade). Fix: "guilt-free" (#13e), gender/pronoun field dark (flag off — decide), "just track" goal silently assigns a deficit, "Asian" cuisine cluster flattening, recipe-footer VoiceOver gap, BEST FIT contrast.

---

## Verification ledger

- **Adversarially verified (12 clusters):** V1+V2, V3, V6+V23, V7, V9, V10+V11 (PARTIAL — wedge is deliberately dark pending DMCA, not broken), V12, V13, V14, V15+V29 (operational), V17, V18. All confirmed with corrected severities; several root causes sharpened (e.g. Coach entry welded to the deficit line with a <50 kcal honesty floor).
- **Verified inline by orchestrator:** ENG-1237 phantom (refuted, live DB), ENG-955 column exists (refuted), V4 (6,993 lines), V5 (guilt-free), V8 (flag dark).
- **Confirmed by convergence (not adversarially re-run — spend cap):** imagery ×4 lenses, web Plan ×3, log sheet ×3, week strip ×3 + my eyes, entitlement ×3 + capture PNG, ring colours (visual-qa measured `--accent-warning-solid` numeral), settings tab-bar overlay, B9 governance, coach parity ×4.
- **Retracted (2026-07-01):** /login "unreachable" ×2 agents + lens — all three independently reproduced the same `web-drive.mjs` `dismissOverlays()` tooling bug (page-wide Close-X click self-navigating to `/`), not independent confirmation of a real defect. Multi-source convergence does not rule out a shared-tooling artifact; see "Refuted during verification" above.
- **Unverified lens-evidence (verify while fixing):** V16 (ODbL data flow), V19 (prod env state), V20 (micros), V21 (unwindowed query), V22 (expo-image flag), V25-V30 details, V31/32 (test absence — low risk), V34/V38 (elevation/ring perception — decision items anyway), V62.

## Open questions for Grace
1. Ship the public push when? The legal/ops chain (DMCA → wedge flip, consent gate, Supabase plan) is the critical path — everything else is normal engineering.
2. ~~Decisions #13a–e~~ — RESOLVED, see addendum.
3. ~~File to Linear?~~ — RESOLVED: filed in full, see addendum.
4. Paywall "Open App Store to subscribe" — needs one real-device check to rule the sim fallback in/out. (Still open.)

---

# Addendum — 2026-07-01 evening: verification round 2, decisions, filing

## Round-2 verification (8 clusters, all returned — verification ledger now complete)

- **REFUTED — V49 web /login unreachable** (was blocker #3): capture-harness artifact; see the retraction above. No app bug; tooling fixed + recaptured.
- **RE-ROOTED — V43/52/56/58 Coach divergence (s4→s3, not a blocker):** web "What to eat next" EMPTY is the *designed* over-budget gate (`mealCoach.ts:127` returns `[]` when remaining ≤ 0 — the web persona was 915 kcal over) wearing the WRONG empty copy ("log a meal or save a few recipes" to a fully-logged user). Mobile showed rows because its day-state differed — the "same data, different result" premise was false. Real defects confirmed: the wrong copy; a genuine refining stuck-path (`useCoach.ts` never resets `refining` on the early return, no client timeout); card/chip chrome divergence (file:lines in verdict); BEST FIT dark contrast 1.79:1.
- **CONFIRMED + upgraded — V35 imagery (s5 blocker, root cause found):** `apps/mobile/lib/recipes.ts:38-41` assigns `hashStr(recipeId) % 6` over a 6-photo Unsplash stock pool whenever `image_url` is null (all persona recipes AND all real IG/TikTok imports) — fabricated photos presented as real, consumed by Recipes cards, Coach thumbnails, and the Today north-star. Web has parallel fallbacks (`AppDataContext.tsx:954,1032`).
- **CONFIRMED — V21** unwindowed web journal (`useNutritionJournalState.ts:161-168`, no `.gte(date_key)`, no limit; ENG-542's window landed mobile-only). **V20** micros structurally impossible (`VerifiedMacros` is exactly 7 fields). **V22** `expo_image_adoption_v1` absent from REDESIGN_DEFAULT_ON → raw RN Image in prod. **V40** week strip: `DayStrip.tsx:80` pager assumes panel width == viewport width; breaks at mobile-web width.
- **PARTIAL — V46/39/50/62 Settings:** the "three data sources" hypothesis refuted — `profiles.user_tier` is the single source; the contradiction is a non-tier-conditional banner label (`SettingsBundleContent.tsx:1512-1514`). LogBox error + tab-bar inset confirmed.

## Decisions (Grace, 2026-07-01 — `docs/decisions/2026-07-01-sweep-decisions.md`)

1. **Coach AI: Pro-gate the AI calls only** — template narrative/answers stay free.
2. **Over-budget ring: amber re-ratified; the red carve-out is RETIRED** (diet-culture-exhaustion evidence prevailed).
3. **Coach screen: keep; B9 formally reversed; persistent entry** (Today hero chip + web sidebar).
4. **Sweep filed to Linear in full.**

## Filed to Linear (2026-07-01)

**ENG-1285 → ENG-1306** (22 issues, `agent/claude`; 7 with `launch-blocker`): 1285 false trial claim · 1286 mobile consent gate · 1287 imagery fabrication · 1288 coach analytics · 1289 email rebrand · 1290 unwindowed journal · 1291 DayStrip stride (all launch-blockers) · 1292 coach Pro-gating · 1293 coach persistent entry · 1294 coach UX hardening · 1295 coach tests · 1296 amber ring implementation · 1297 settings polish · 1298 stale-Suppr sweep · 1299 import micros · 1300 expo-image flag · 1301 one-tap log · 1302 mechanical batch · 1303 web v3 catch-up (Plan + Log sheet, under ENG-1247) · 1304 onboarding refugee capture · 1305 nutrition floors · 1306 data-integrity batch. Ops/legal blockers stay on their existing tickets (GROW-45/47/48/57, ENG-33). Initiative status update posted on **Launch 2026-07-01** (health: atRisk).

**Verdict unchanged: HOLD the public push** — but the code side shrank: with /login retracted and Coach re-scoped, the engineering gap is ENG-1285/1286/1287/1288/1289/1290/1291 (~2 focused days); the critical path remains the founder-gated legal/ops chain.

---

# Addendum 2 — 2026-07-01 night: gap-closure round (SEE-the-flows, live infra, release-gate)

The original sweep never walked five flows, never ran live-infra checks, and skipped the `release-gate` lens under the spend cap. All closed tonight.

## Flows captured and judged (48 new verified PNGs: `flows/` subdirs of both capture walls)

- **Web onboarding, full 14-step walk** (flags `onboarding-app-choice`/`why-now` forced ON): clean — no traps, no dead ends; step 15 correctly gates on a real session. First genuinely healthy full-journey capture of onboarding.
- **Live recipe import (web, authed)**: WORKS end-to-end — BBC lasagne parsed, auto-saved with a "4 of 15 ingredients need review" confidence banner and per-row estimate chips. The import spine is real. But it exposed **ENG-1308 (NEW P0, launch-blocker)**: cookie-auth 401s whenever Supabase chunks the auth token into `.0/.1` cookies — `getUserIdFromRequest` (`src/lib/supabase/serverAnonClient.ts:39-58`) JSON.parses a base64 fragment, falls through to a broken token, 401s. Proven with paired requests; release-gate re-verified at code level. Masked at N=1 (small session); breaks at public scale. Every cookie-auth API consumer is suspect.
- **Cook mode**: captured on BOTH platforms (iOS via deep link, bypassing the flaky footer) — full parity, ENG-944 per-step chips render. One shared bug: the mise "Gather your ingredients" H1 is dark-on-dark, near-invisible on both platforms (ENG-1311).
- **Log sheet deep states**: iOS "All" search never appends DB results + Branded returns generics (evidence commented onto Blocked **ENG-34**; env caveat noted). Web voice/photo gating aligned with mobile (**ENG-1312** Done — free voice → paywall + PRO badge; photo free-taster unlocked; describe uses PRO badge not lock icon). Web "Scan barcode" opens a plain search dialog, no scanner (ENG-1310). Import errors render raw codes (`forbidden_origin`) to users (ENG-1309).
- **Coach ask interaction**: works (template path, synchronous); imagery mismatches consistent with ENG-1287.

## Live-infra checks (never run in the original sweep)

- **RLS census (live prod)**: all 54 public tables RLS-enabled; the 4 zero-policy tables are the intentional deny-all/service-role posture. Clean.
- **Migration drift (live)**: ZERO unapplied, ZERO true orphans — repo(main)↔DB in perfect sync. The two "orphan" versions are ENG-1235/ENG-1236 merged to main after this branch forked. **Correction: the "no referral loop exists" growth finding is STALE — ENG-1236 shipped a referral reward loop on main this week.**
- **Supabase security advisors**: one new actionable cluster — ~19 SECURITY DEFINER functions anon-executable via PostgREST RPC + one mutable `search_path` trigger fn → per-function review filed (ENG-1307). Leaked-password protection already tracked (GROW-60).

## Design challenges resolved (measured, then decided by Grace)

- **Empty ring**: ticks measured `#C6BED6`/`#E9E4F3` on white ≈ **1.8:1** (below the 3:1 UI floor). Decision: **deepen the gradient to ≥3:1** (ENG-1315).
- **Card lift**: page `#FEFEFE` vs card `#FCFBFC` = **2/255 delta**. Decision: **strengthen the lift token; one-card architecture stands** (ENG-1316).

## Nutrition reclassification (Grace, critical)

The nutrition findings are a **consistency + trust-label cluster, not broken macro math** — and are **critical, never defer-grade**: ENG-1305 escalated to Todo/urgent/launch-blocker, scope widened to include the estimated-qualifier gaps (Coach rows) and number-format inconsistency. ENG-1299 (micros) relates.

## Release-gate (final lens of the defined order — now run)

**HOLD confirmed, confidence 9/10.** Two sharpenings: (1) ENG-1308 added to the blocker set; (2) **the Coach branch is already merged to main (#691)** — Coach ships in the next promoted build, so ENG-1288 (analytics) / ENG-1292 (Pro-gating) / ENG-1294 (UX hardening) moved onto the critical path (escalated to launch-blocker/urgent). Ordered critical path: DMCA filing (Grace) → consent gate (ENG-1286) → trial claim (ENG-1285) → chunked-cookie auth (ENG-1308) → imagery (ENG-1287) → ops floor (Grace: GROW-57/48) → unwindowed journal (ENG-1290) → Coach gating (ENG-1292) → DayStrip (ENG-1291) → Coach analytics (ENG-1288) → email rebrand (ENG-1289). Grace-gated items are the long pole; the code items are ~2–3 focused days.

## Final ledger

Filed across the sweep: **ENG-1285 → ENG-1316** (30 issues + 2 escalations + evidence comment on ENG-34). Decisions ratified: 6 (`docs/decisions/2026-07-01-sweep-decisions.md`). Phantoms killed by verification: 4 (two staged-migration claims, /login unreachable, coach empty-state-as-data-bug) plus one stale finding (referral loop). Every blocker/sev-4 cluster is now adversarially verified, convergence-confirmed, or explicitly marked operational. Remaining open: real-device paywall CTA check; the founder-gated legal/ops chain.
