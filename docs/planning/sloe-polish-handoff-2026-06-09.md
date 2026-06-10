# Sloe polish — session handoff (2026-06-09)

State + queue for the next session. Branch: `claude/sloe-redesign-2026-06-04`
(all committed + pushed; tree clean at handoff). Goal unchanged: finished,
premium/luxury app — editorial equal-or-better than Julienne, better than
trackers on function; iOS leads, web in lockstep; everything SEE-verified.

## Shipped this session (all pixel-verified + green)

1. **CI reconciliation** — branch was never green; now every gate passes
   locally except visual-regression E2E (deliberately deferred, see queue #6):
   71 root-unit failures fixed, mobile lint/tsc, dep-audit (shell-quote
   override), journey E2E re-pinned to the redesigned app (19/19), type-scale
   gate green (25 snaps), build green.
2. **One-card-treatment elevation** (decision doc 2026-06-09) — soft lift for
   page-ground cards app-wide (Today, Plan, Progress, Settings, Profile,
   Household, secondary screens), nested stay flat; guard tests re-pinned.
3. **Dark accent inversion** — scheme-resolved `useAccent()`; 172 reads
   migrated. Dark today/paywall/settings/planner/fasting verified legible.
4. **One scheme source** — `useResolvedScheme()`; the OS-vs-app two-source
   bug (dark fragments on light screens, Grace's screenshots) fixed at the
   wrapper + 7 direct importers; repro-verified (system dark + app Light).
5. Progress coherence (adherence gate + WEIGHT header), Settings name fix,
   Plan duplicate-Generate removed, paywall hero (FLUX), Settings stat tile.

## Key context

- **Reviews/specs persisted**: `docs/ux/reviews/2026-06-09-design-director-review.md`,
  `docs/ux/reviews/2026-06-09-premium-audit-recipe-progress.md`,
  `docs/ux/specs/2026-06-09-skia-ring-cta-map-serif-titles.md`.
- **Decisions this session**: one-card-treatment soft elevation; ring overflow
  = brightening plum (amber rejected; Grace delegated, decided + documented);
  CTA rule (filled = FAB + conversion only); calm-minimal empty states.
- **Captures**: `apps/mobile/screenshots/agent/sweep-dd-2026-06-09/{light,dark,dark-fixed}/`.
- **Agent sequence Grace wants for sweeps**: design-director → premium-auditor
  (on flagged surfaces) → ui-product-designer (specs) → build with ui-critic
  mid-build checks.

## THE QUEUE (in order)

1. **Lane A — CTA weight fixes** (Spec 2): import-shared Import→outline,
   LOG TODAY rows→outline pills, weekly-recap Log-a-meal→outline, whats-new
   Done→pill. Web in same commit. Guard pins (hook-form `accent.primarySolid`).
2. **Lane B — serif titles** (Spec 3): `Type.screenTitle`/`Type.navTitle`
   tokens + web classes; Targets/Health-Sync/Household/weekly-recap +
   PushScreenHeader; tokenise weight-tracker/nutrition-sources; guard test.
3. **Lane C — WeightChart onto Progress** (premium-audit P0-1): mount the
   existing `WeightChart` in the Progress weight card, wire the range picker
   (chart hardcodes "1m"), port `rangeDelta.tone`, delete Sparkline path.
   Web ProgressDashboard parity.
4. **Lane D — recipe-detail cleanups** (premium-audit gaps 1,3,5,6): cook-CTA
   dedup (Log becomes dominant), method steps→primary ink, ingredient tap→
   IngredientInfoSheet (not Alert), allergen null-state collapse. Web parity.
5. **Create-recipe green labels → textSecondary + haptic rebalance** (DD move 5).
6. **After lanes land**: full-app capture sweep (light+dark incl. the 4
   dark-uncovered screens: household, health-sync, nutrition-sources,
   whats-new) → ui-critic per changed surface → premium-auditor re-run on
   FIXED dark Today+Paywall → **regenerate visual-regression baselines**
   (`npm run test:e2e:visual:update` + mobile equivalents) → full CI green →
   branch mergeable.
7. **Skia ring** (Spec 1): build behind `ring_skia_v1` for the NEXT EAS
   build; brightening-plum overflow per the decision doc.
8. P0-2 adherence-headline product call (story-gate window vs range window;
   >100% hero tone) — route ui-product-designer, needs Grace.

## Gotchas (cost real time this session)

- **A stash-actor / revert-actor is live on this shared tree** (Cursor):
  twice ate uncommitted work; once reverted committed-file edits in the
  working tree. COMMIT AFTER EVERY VERIFIED STEP; check `git stash list` if
  work vanishes.
- **Workflow agents over-claim**: two waves claimed migrations/fixes that
  were partial — ALWAYS re-verify programmatically (grep/tsc), never trust
  the report.
- Root unit suite = `npm test` at ROOT (`vitest.unit.config.ts`, ~618 files);
  a bare `npx vitest run` at root hits the 27-file storybook config and
  under-verifies. Mobile suite = `cd apps/mobile && npm test`.
- `mealPlanAlgo.test.ts` flakes under CPU contention (passes isolated) —
  don't run suites concurrently with workflows.
- Metro can serve a stale mid-edit module graph after agent edits → relaunch
  the app (terminate + launch + `exp+suppr://expo-development-client/?url=http://localhost:8081`)
  before judging pixels. Sim: iPhone 17 Pro `C348952F-E8DB-4067-A3F2-E8599BF464BB`;
  swipes need `idb connect` first + `--duration 0.6` (fast swipes no-op).
- `simctl ui <udid> appearance dark|light` switches the SIM scheme; the app
  preference lives in Settings → Theme (`settings-theme-preference`).
- CI "E2E (smoke)" runs ALL Playwright specs incl. visual-regression — the
  test job stays red until queue #6 regenerates baselines.

## Pending mirrors (batched, not yet done)

- Notion Decisions log rows for: 2026-06-08 aubergine accent system,
  2026-06-09 one-card-treatment, 2026-06-09 ring-overflow-brightening-plum.
- Linear: close/update elevation + dark-mode work under Surface polish;
  ENG-1002 (mobile type-scale) remains open; consider issues for queue items.
