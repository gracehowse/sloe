# Full-app ultracode audit — 2026-07-11

**Run by:** Claude (Fable 5) agent session, directed by Grace.
**Scope:** the entire product — mobile (iOS), web, mobile-web — with emphasis on UI/UX, security, and launch blockers.
**Canonical outputs:** this doc + Linear issues **ENG-1506 → ENG-1536** (all labelled `agent/claude`, descriptions carry file:line evidence) + ~60 screenshots (index below).
**Status:** partially complete — see [Coverage matrix](#coverage-matrix) and [Remaining gaps](#remaining-gaps--how-to-resume). A follow-up session should start from those two sections.

---

## Method

1. **Multi-agent fleet (Workflow `wf_888bb705-e58`):** 21 specialist auditors (repo agent roster: ui-critic ×4, visual-qa, design-system-enforcer, customer-lens, journey-architect, sync-enforcer, security-reviewer ×4, data-integrity, production-readiness, performance-optimizer, code-quality, nutrition-engine, legal-reviewer, product-lead, repo-auditor) + Linear inventory + per-finding adversarial verifiers + completeness critic + synthesis. **6 dimensions completed (~2.1M tokens, 532 tool uses) before the Anthropic monthly spend limit refused the remaining 24 agent spawns.** Completed agents' results are cached and the run is resumable (see Remaining gaps).
2. **Simulator visual pass (by the directing session, not agents):** ~45 captures on iPhone 17 Pro — every tab and fold, log sheet + live search, recipe detail + cook mode, paywall, coach, weekly recap, targets, notifications, settings (all folds incl. dev flag panel), barcode scanner (camera granted), dark mode, Dynamic Type accessibility-large, true fresh-install first-run (second simulator, dev build reinstalled), post-auth onboarding via deep link, sign-out flow.
3. **Web pass (`scripts/web-drive.mjs`):** unauthenticated (landing desktop/mobile/dark, /login, /onboarding steps 1–3, /pricing) + **authed** via the repo's `auth.setup.ts` storage state (Today desktop/mobile-web/dark, Plan, Progress, Library).
4. **Inline security spot-checks** (compensating for the refused security agents): Stripe webhook signature verification, cron `X-Cron-Secret` enforcement, AI-route auth + rolling quota (photo-log), export/delete authz, middleware public-route carve-outs, barcode lookup 401. **All passed.**

## Verdict (as of 2026-07-11)

The product is **good with premium moments, failing coherence tests premium apps never fail**. Server-side security fundamentals held up under every spot-check; the open security risk is what Gate 0 already tracks (ENG-1389, ENG-1391 — both FAIL-verdict remediations, still open). The launch gate is therefore: **ENG-1389 + ENG-1391 + the billing go-live bundle (ENG-1433, GROW-46) + ops pair (ENG-1402, ENG-1401) + the new trust/claims cluster (ENG-1506/1507/1508/1510/1511/1512)**. Everything else is rampable post-push.

### The five systemic failures (each maps to filed issues)

1. **The app cannot agree on its central number** — five burn/goal values with one unqualified word, including a proven **cross-platform divergence on the identical Progress card** (web 1,778 vs mobile 1,567). → **ENG-1506** (data-layer), ENG-1507 (goal-state).
2. **Trust vocabulary is half-migrated** — "Structured" chip still in search (evidence commented on **ENG-1464**), bare kcal on cards vs "needs review" detail, "High confidence" dialect, unexplained dots. → ENG-1464 (existing) + ENG-1425-adjacent.
3. **The app misreports its own state** — Apple Health "Connected" vs "enable Apple Health" (**ENG-1534**), "Welcome to Suppr" brand leak (**ENG-1533**), "coming soon" vs working email (**ENG-1516**).
4. **Same element, N treatments** — two search-row grammars, two sub-tab grammars, three barcode entries, 10px-vs-24px corners, 13 alpha-tint values. → **ENG-1532, ENG-1520, ENG-1521, ENG-1527**.
5. **Degradation states are an afterthought** — Dynamic Type clips the Log sheet (**ENG-1529**, App Store risk), dark-mode fallback art glows (**ENG-1528**), status-bar/tab-bar clipping on 5+ screens (**ENG-1530**), camera-denial dead end (**ENG-1518**).

### What is genuinely strong — do not "fix" these

Cook Mode (best surface in the app); the Log sheet IA + "Barcode scan is free — always. No paywall. No asterisk."; Settings' body-neutral copy voice ("never a streak", "they just won't be shown back to you"); voice-log AI disclosure; recipe import attribution ("Not affiliated with or endorsed by…"); serif editorial identity incl. dark mode; the mobile weight chart; plan→shopping non-destructive sync; web onboarding (16-step, refugee-capture-first, disabled-until-valid Continue); mobile-web parity of Today (near-identical to iOS); cookie consent defaulting analytics-off; cron/webhook/API auth posture.

## Coverage matrix

| Dimension | Status | Where covered |
|---|---|---|
| today-ui | ✅ fleet + sim pixels | ENG-1506/1523/1524/1529/1534; ring-below-Skia-ceiling → verify ENG-1225 scope |
| plan-progress-ui | ✅ fleet + sim/web pixels | ENG-1509/1525/1526/1527 |
| conversion-ui | ✅ fleet + sim/web pixels | ENG-1507/1510/1511/1516; paywall radius mix → ENG-1497 sweep |
| visual-forensics | ✅ fleet (grep-verified) | ENG-1519/1520/1521/1522/1530 |
| first-user | ✅ fleet + fresh-install pixels | ENG-1512/1513/1514/1515/1518 |
| linear-inventory | ✅ | 31 open launch-blocker/Gate 0 issues enumerated; no dupes filed |
| api-security | ⚠️ spot-checked inline only | Auth/quota/signature checks passed; full route walk NOT done → ENG-1536 |
| rls-security | ❌ refused | ENG-1389 (existing FAIL remediation) + ENG-1536 |
| secrets-client | ❌ refused | ENG-1536 |
| billing-account | ⚠️ partial | Stripe sig verified; entitlement bypass walk NOT done; ENG-1487/1490 exist → ENG-1536 |
| data-integrity | ❌ refused | ENG-1536 (note: ENG-1506 is a data-integrity finding found visually) |
| prod-readiness | ❌ refused | ENG-1402/1401/1471/1435 exist → ENG-1536 |
| performance | ❌ refused | ENG-1536 |
| deferrals (silent-deferral sweep — **mandated cadence audit**) | ❌ refused | ENG-1536 |
| nutrition | ⚠️ partial | ENG-1508 + ENG-1531 found; full posture audit → ENG-1391 + ENG-1536 |
| legal | ⚠️ partial | ENG-1511/1535 + coach disclaimer verified present; full review → ENG-1536 |
| product-launch | ⚠️ partial | Verdict above; formal cut-list → ENG-1536 |
| repo-reality | ❌ refused | ENG-1536 |
| parity | ⚠️ partial | ENG-1526 + mobile-web Today verified tight; systematic sweep → ENG-1536 |
| recipes-ui | ⚠️ partial | Sim/web pixels only (ENG-1528/1535); code-level critique → ENG-1536 |
| v3-conformance | ❌ refused | ENG-1247 remains the vehicle → ENG-1536 |
| journeys | ⚠️ partial | Log/search/recipe/cook/shopping walked visually; import/household/health-sync flows NOT walked → ENG-1536 |
| gap-sweep (accessibility, deep links…) | ⚠️ partial | Dynamic Type done (ENG-1529); VoiceOver, deep-link matrix, offline NOT done → ENG-1536 |

## Issue index (filed 2026-07-11)

**Gate 0:** ENG-1506 (energy reconciliation, Urgent), ENG-1507 (goal divergence), ENG-1508 (Net carbs), ENG-1509 (fake superlative).
**Monetisation:** ENG-1510 (trial-step claims + £), ENG-1511 (/pricing trial contradiction).
**Onboarding + Auth:** ENG-1512 (web confirm copy), ENG-1513 (first-run inversion — needs/decision), ENG-1514 (email sign-in default + safe area), ENG-1515 (onboarding-skip race), ENG-1516 (papercuts).
**Today:** ENG-1518 (barcode), ENG-1522 (optimistic alerts), ENG-1523 (empty day), ENG-1524 (kcal hierarchy), ENG-1529 (Dynamic Type, High), ENG-1534 (Apple Health state).
**Progress:** ENG-1525 (hierarchy), ENG-1526 (web craft/parity). **Plan:** ENG-1527 (shopping). **Recipes:** ENG-1528 (fallback art), ENG-1535 (seeded creators — needs/decision).
**Design system:** ENG-1519 (PressableScale ×87, High), ENG-1520 (ratchet blind spots, High), ENG-1521 (soft tints), ENG-1530 (insets/scrims), ENG-1532 (grammar dedup).
**Team-level:** ENG-1517 (sign-out confirm), ENG-1531 (search ranking), ENG-1533 (copy sweep).
**Meta:** ENG-1536 (resume the audit).
**Comments added:** ENG-1464 (Structured chip live in search + confidence-dialect inventory).
**Deliberately not filed (already tracked):** ring Skia upgrade (check ENG-1225), desktop Today composition (ENG-1495 — note: the frame IS rendering for the audited account, better than the code-read suggested; remaining work is composition tightening), paywall radius mix (ENG-1497), shopping hairline (ENG-1316), empty-state grammar epic (ENG-1372).

## Screenshot index

**Mobile (`apps/mobile/screenshots/agent/`):** `audit-01`–`04` Today folds · `audit-10-*` planner/shopping/library/discover/progress/settings · `audit-20-*` paywall/coach/weekly-recap/logsheet · `audit-30/31` recipe detail · `audit-40/41` dark Today/Library · `audit-50-*` notifications/targets/health-sync/barcode · `audit-60`–`62` planner/progress/settings deep folds (⚠️ `audit-60-planner-fold1.png` is the Expo dev launcher — discard) · `audit-63b` live search "chicken" · `audit-64` voice-log sheet · `audit-66-*` nutrition-sources/whats-new (uninspected — free material) · `audit-67/68` recipe folds + cook mode · `audit-70-*` dark planner/progress/paywall/logsheet (70-planner/progress uninspected) · `audit-71-*` Dynamic Type · `audit-80`–`82` fresh install chain · `audit-83` scanner (camera granted) · `audit-90/91` post-auth onboarding · `audit-92/93` sign-out.
**Web (`screenshots/web-drive/`):** `audit-landing-*` (desktop/mobile/dark) · `audit-login/onboarding/pricing-desktop` · `screenshots/web-drive/audit-onb-step2.png` (nested path quirk) + `audit-onb-step3.png` · **authed:** `audit-a-today-{desktop,mobile,dark}`, `audit-a-{plan,progress,library}-desktop`.

## Environment state left by this session

- **Main sim (iPhone 17 Pro `D7BD0616`)**: **signed out** (authorized); camera permission granted to the app. Second sim (iPhone 17 `503FF386`) shut down after fresh-install captures.
- **`.env.local`** now contains `E2E_EMAIL`/`E2E_PASSWORD` (Grace's test account) — **rotate the `testing123` password post-audit; it also appears in the session transcript.** Playwright storage state at `tests/e2e/.auth/user.json` (regenerate: `npx playwright test auth.setup.ts --project=setup`).
- Metro (`npm run mobile:dev`) and `npm run dev` (port 3000) were left running in that session's background.
- This doc is **uncommitted** at time of writing — commit it (branch first per repo rules).

## Remaining gaps — how to resume

1. **The 15 refused fleet dimensions + verification + synthesis (ENG-1536).** After raising the spend limit: `Workflow({scriptPath: "/Users/gracehowse/.claude/projects/-Users-gracehowse-sloe/7318fc3e-e5b9-45dd-8400-9a8814406702/workflows/scripts/suppr-full-deep-audit-wf_888bb705-e58.js", resumeFromRunId: "wf_888bb705-e58"})`. Journal (full per-agent returns): `.../subagents/workflows/wf_888bb705-e58/journal.jsonl`. Note: most surviving findings are **not adversarially verified** (verifiers were refused) — treat evidence as strong but single-sourced.
2. **Live barcode scan E2E** — impossible on the simulator (no camera feed injection); needs a physical device via `npm run mobile:ios:device` or TestFlight. Everything up to the camera frame is verified (ENG-1518).
3. **Write-path journeys untested** — this audit deliberately performed **zero data mutations** (no logging, no plan generation, no weigh-ins) against the live prod DB. Log-commit, plan-generate, weigh-in, import, and household flows still need an interactive pass (throwaway `@example.com` account per repo convention).
4. **Populated-data renders** — most captures show empty states (fresh week). Re-capture Today/Progress after a few logged days for hierarchy judgments on full surfaces.
5. **Accessibility beyond Dynamic Type** — VoiceOver labels, contrast measurement, reduced motion; deep-link matrix (`sitemap.md`) untested this pass; offline/poor-network behaviour untested.
6. **Post-auth mobile onboarding beyond step 2** — walked only to the refugee-capture step to avoid mutating Grace's stored answers; steps 3–16 + reveal unverified on mobile (web verified to step 3).

## Handoff checklist for the next session

- [ ] Commit this doc (+ screenshots if desired).
- [ ] Fix cluster 1 (one afternoon, all copy/logic-local): ENG-1508, ENG-1509, ENG-1510, ENG-1511, ENG-1512, ENG-1533's brand leak.
- [ ] Fix cluster 2 (data): ENG-1506 + ENG-1507 (shared energy/goal selector).
- [ ] Decision needed from Grace: ENG-1513 (first-run order), ENG-1535 (seeded creators).
- [ ] Raise spend limit → run ENG-1536 (resume fleet).
- [ ] Rotate the test-account password.
