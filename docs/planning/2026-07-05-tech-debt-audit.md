# Tech Debt Audit — 2026-07-05

Full-repo tech-debt audit (code, architecture, tests, dependencies, docs/hygiene, CI/infra),
run 2026-07-04/05 via six parallel category sweeps with independent verification of
load-bearing claims. Prioritisation: **Priority = (Impact + Risk) × (6 − Effort)**, each 1–5.

Linear is the canonical tracker — every item below is filed as an ENG issue (see the
"Tech debt program — 2026-07 audit stack" coordinating issue). This doc is the cold-context
reference for agents; do not work from this file directly.

## TL;DR

The codebase is in better shape than its size suggests — the ratchet system,
silent-deferral discipline, and runbooks are genuinely working. The dangerous debt
concentrates in three places:

1. **Nothing watches production.** No post-deploy smoke automation, no failure
   alerting anywhere in the repo. `scripts/production-smoke.ts` exists but is
   manual-only and stale (2026-05-24, pre-dates billing/Today surfaces).
2. **Two safety nets believed active are silently dead.**
   `scripts/auto-push-on-stop.sh` matches only `claude/*` branches while all active
   work is on `agent/*` (verified: no-ops on a current branch). And CI omits three
   ratchet gates that local `npm run ci` runs (`check:spacing-scale`,
   `check:token-scale`, `check:redesign-foundation-touch`) — CLAUDE.md's claim that
   they bind "in npm run ci + CI" is half false.
3. **High-churn mega-files.** `NutritionTracker.tsx` (4,340 lines, 134 commits in
   3 months — highest churn in the repo), `TodayScreen.tsx` (7,023 lines, one
   6,591-line component function, 51 useState), the ~5,800-line duplicated
   `FoodSearchPanel` pair.

Plus one big known-but-unfunded item: **92 feature flags permanently forced on via
`REDESIGN_DEFAULT_ON` (84 web / 81 mobile), all still carrying live dead
else-branches** — the COLLAPSE-in-same-PR convention has not been executed.

## Verified healthy (do not re-audit)

- **Silent-deferral discipline holding**: ~zero untracked gaps vs ~22 in the May
  sweep. One violation ticketed: unshipped household hard-delete job
  (`src/lib/household/householdClient.ts:705`).
- **No shipped dead code**; `@suppr/shared` alias layer used correctly by 257 mobile
  files (though it is a tsconfig/Metro path alias, not a real package — see item 11).
- **Nutrition/matching logic well tested** (~55 dedicated test files + golden
  fixtures under `tests/unit` + `tests/integration`). The "185 files, 0 co-located
  tests" pattern is a naming artifact, not a gap.
- **CI healthy**: 15.4 min median, 0% flake across last 20 runs, concurrency groups
  on all push/PR workflows, no `pull_request_target` hazards.
- **Runbooks strong**: disaster recovery, Supabase scaling, Stripe/RevenueCat webhook
  replay, founder safety net all exist under `docs/runbooks` + `docs/operations`.
  Gap: no TestFlight-rejection runbook.
- **Data-layer sync guarded**: both `database.types.ts` copies byte-identical and
  CI-checked; 172 migrations strictly monotonic; API auth canonical on 42/48 routes
  (remaining 6 legitimately signature-verified webhooks/crons).
- **AGENTS.md ↔ CLAUDE.md sync clean** (verified byte-identical via the sync script).
- Sentry web config mature (sourcemaps, tunnel route, sane sample rates); PostHog
  session replay ON both platforms with inputs masked.

## Prioritized backlog

### P0 — this week (each hours, not days)

| # | Item | Score | Effort | Evidence |
|---|------|-------|--------|----------|
| 1 | Wire `production-smoke.ts` into a post-deploy workflow + failure notification path; refresh its checks (currently 4 static pages + 2 API-401s) | 40 | S | `package.json` `smoke:production` manual-only; zero alert wiring repo-wide |
| 2 | Fix `scripts/auto-push-on-stop.sh:38` glob `claude/*` → include `agent/*` | 40 | S | Verified no-op on `agent/cursor/eng-1342-haptics-phase4` |
| 3 | Add `check:spacing-scale`, `check:token-scale`, `check:redesign-foundation-touch` to `.github/workflows/ci.yml` | 40 | S | Verified absent from ci.yml; present in local `npm run ci` |
| 4 | Coverage blind spots: web vitest `include` omits root `app/**` (123 files unmeasured); mobile vitest has no `thresholds` block | 32 | S | `vitest.unit.config.ts`, `apps/mobile/vitest.config.ts` |
| 5 | Stale-direction docs: Figma-conformance plan/tracker read as live (canceled 2026-06-11); `docs/README.md` + `DOCUMENTATION_HUB.md` 72 days stale, point at dead `TODO.md` worklist; banner `TODO.md` / `DESIGN-OVERHAUL.md` / `PRODUCT_AUDIT.md` as historical (pattern: `PARITY_AUDIT.md`) | 35 | S | Agents read docs cold — stale direction docs are executable misinformation |
| 6 | Bump `posthog-js` (20 minors behind) | 25 | S | Clears the 10-CVE DOMPurify moderate cluster; only actionable security finding (zero high/critical anywhere) |

### P1 — next 1–2 weeks

| # | Item | Score | Effort | Evidence |
|---|------|-------|--------|----------|
| 7 | Scheduled live-RLS verification (Supabase advisors on a cron workflow) | 32 | S–M | 13 RLS-touching migrations; zero automated live verification; applied-migration edits invisible to `db push` |
| 8 | Billing test coverage: 44 bespoke Stripe/RevenueCat source files, 2 test files | 27 | M | Thinnest high-stakes area; entitlement writes + webhook handling bespoke |
| 9 | Flag-collapse sweep round 1: 117 flags / 451 call sites / 92 permanently-on; start with 9 confirmed-stale (incl. `sloe_v3_editorial_shelves` — documented collapse-eligible, forgotten; `today_tracker_tier_v1` has 19 sites) | 21 | M | `src/lib/analytics/track.ts:180-386`, `apps/mobile/lib/analytics.ts:370-575`; 8/8 spot-checked flags uncollapsed |
| 10 | Sentry RN 7→8 + RevenueCat 9→10 majors, sim-verified | 24 | S–M | Crash reporting + billing SDK are the two majors not to defer |
| 11 | Unify 5 hand-mirrored logic pairs: `macroColors`, `barcodePortionMemory` (byte-identical), `formatRecipeMinutes`, `journalNavigation`, `weeklyCheckinBannerDismissal` — use `calmMode.ts` shared-logic + storage-adapter template | 24 | S | Sync currently comment-enforced; drift = silent web/mobile divergence |
| 12 | Housekeeping: household hard-delete job ticket; root-cause ENG-1337 (excluded `settingsBundleNoStrayText` test = protection off); verify/re-baseline `visual-applitools.spec.ts` (pre-redesign baselines) | 20 | S | Three half-tracked protection gaps |

### P2 — structural, alongside feature work

| # | Item | Score | Effort | Evidence |
|---|------|-------|--------|----------|
| 13 | Decompose `NutritionTracker.tsx` **first** (4,340L, 40 useState, 134 commits/3mo — highest churn) | 18 | L | Churn × size = interest rate; paid on more often than TodayScreen |
| 14 | Then `TodayScreen.tsx` (7,023L; one 6,591-line component, 51 useState / 29 useEffect; 22 commits/3mo). Ratchet-pinned at 7,023 — pin stops growth, doesn't fund shrinkage. Not parallel with #13 (overlapping regression surface) | ~15 | L | Worst complexity signature in repo; retention surface |
| 15 | FoodSearchPanel shared core round 2: web+mobile ~5,800 combined lines, 82 identically-shaped identifiers (ENG-550 extracted once; panels re-fattened). Tests first, then extract non-JSX logic to `src/lib/food-search/` | 14 | L | Largest true duplication surface |
| 16 | Shared ratchet lib `scripts/lib/ratchet.mjs`: 4 pin-based checkers are >85% line-identical (~720–800 duplicated scaffolding lines; ~500–600 net savings; `stripComments` edge-case bug repeated 3× untested) | 24 | S–M | 10 checkers, 1,904 lines, six own `walk()`s, zero shared imports |
| 17 | `AppDataContext` selector hooks (2,556L, 109 exposed fields, 23 consumers, zero indirection) | 14 | L | Widest single-file blast radius on web; mobile's fragmented contexts are the healthier model |
| 18 | React 18→19 convergence, one atomic PR (React 19 + Radix/Storybook/recharts + delete mobile vitest dedupe shim) | 15 | M | Next 15.5 already supports 19 |
| 19 | Cleanup batch: dead deps (`react-slick`, `react-popper`+`@popperjs/core`, `react-responsive-masonry`; confirm `motion`); 8 zero-reference scripts (`apply-eng-backlog-migrations.sh`, `backfill-cuisine-and-dietary-flags.ts`, `backfill-generic-micros.ts`, `gen-landing-devices.mjs`, `linear/mark-gate1-done.mjs`, `migrate-mobile-fontsize-12-15.mjs`, `setup-gate0-verify-user.mts`, `validate-agents.mjs` — confirm one-shot-ops intent before deleting; quarantine keepers to `scripts/ops/`); root artifacts (`tmp-shot-proto.mjs`, 2 stray PNGs, 2 icon-concept HTMLs, `build-storybook.log`); hardcoded `/Users/graceturner` in 5 scripts; `vercel.json` `ignoreCommand` (mobile-only pushes trigger full web builds); `.env.example` drift (`VAPID_*`, `FAL_KEY`, `NEXT_PUBLIC_SITE_URL`, `LINEAR_API_KEY`); delete vestigial `centercode-release.yml` | ~20 | S | One agent-afternoon of deletion |

### P3 — booked sprints, never opportunistic

| # | Item | Score | Effort | Evidence |
|---|------|-------|--------|----------|
| 20 | Expo SDK 54→57 (3 majors; `expo-share-intent` 3 majors behind — feeds the Reel-import wedge). Native re-verification: camera, HealthKit, speech, purchases | 7 | XL | Falls further behind each release |
| 21 | Migration baseline: core tables (`profiles`, `recipes`, `meals`…) have no `CREATE TABLE` in tracked migrations — schema cannot be rebuilt from files | 21 | M | Blocks clean environment rebuilds |
| 22 | Docs hub re-scope: 327 decision docs, no index; hub 72 days behind | 15 | M | Pairs with item 5's quick fix |

## Phased plan

- **Phase 1 (this week, ~1 agent-day):** items 1–6. Config/one-liners except the smoke
  workflow; zero product-code conflict.
- **Phase 2 (next 2 weeks, interleaved):** items 7–12. Flag collapse in small
  capture-verified batches per the COLLAPSE convention.
- **Phase 3 (ongoing, rule-based):** items 13–19 under a standing **boy-scout rule**:
  any PR touching `NutritionTracker.tsx`, `TodayScreen.tsx`, or a `FoodSearchPanel`
  must extract the slice it touches — plus one dedicated extraction PR per week.
- **Phase 4 (booked sprints):** items 20–22, Expo SDK first.

## Corrections vs raw sweep output

- The architecture sweep claimed `TodayScreen.tsx` isn't ratchet-pinned — **false**,
  it is pinned at 7,023 in `scripts/screen-line-budget.json`.
- "24 dead scripts" (CI sweep) narrows to **8 action-ready zero-reference scripts**;
  the rest are intentional manual ops tools (confirmed via docs/git-history refs).

## Prior art

Q3 2026 tech-debt program (ENG-665, Done) closed: FoodSearchPanel core extraction
(ENG-550 — since re-fattened), Today megafile decomposition (ENG-856 — regrew to
7,023 lines as `TodayScreen.tsx`), dead-code deletions, perf P0s. Open carryovers:
ENG-1344 (mobile toast primitive), ENG-1247 (Sloe v3 conformance), ENG-1337
(hanging settings test).
