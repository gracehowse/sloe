# Sloe polish — session handoff (2026-06-09)

State + queue for the next session. Branch: `claude/sloe-redesign-2026-06-04`
(all committed + pushed; tree clean at handoff). Goal unchanged: finished,
premium/luxury app — editorial equal-or-better than Julienne, better than
trackers on function; iOS leads, web in lockstep; everything SEE-verified.

> **⚠️ DO NOT INHERIT PRIOR VERDICTS.** The 2026-06-09 design-director review
> called light mode "Premium, knocking on Flagship". **Grace disputes this —
> "there are still many inconsistencies, spacing problems etc."** Treat that
> review as one agent's read of static, top-of-screen captures on a sparse
> account: no scroll depths, no sheets/modals, no interaction or keyboard
> states, and no spacing forensics. Multiple agents over-claimed this session
> (migrations reported complete that weren't). The next session's FIRST job is
> a fresh-eyes review that assumes nothing — do not feed prior tier verdicts
> into the reviewing agents' prompts.

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

- **Design craft contract adopted (2026-06-09, after handoff was written)** —
  `docs/decisions/2026-06-09-design-craft-contract.md`. The fleet was upgraded
  for exactly queue #1's constraints: census-before-verdict + verdict-grade
  walls are now IN the agents (`_project-context.md` craft contract; visual-qa
  rebuilt forensic; design-director/ui-critic patched), and write-time UI
  rules are in root + mobile CLAUDE.md. The fresh-eyes review should lean on
  the upgraded `visual-qa` six-pass protocol for the spacing-forensics and
  consistency passes (don't re-specify them ad hoc); the no-anchoring rule
  (don't feed prior tier verdicts) still applies. ENG-1007 = programmatic
  spacing+token census gate (build it as the review's measuring instrument).
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

## ⚠️ DIRECTION QUESTION — OPEN (Grace, 2026-06-10, "food for thought, don't action yet")

Grace is actively questioning the warm-editorial shell (cream ground + serif
display + wellness-warm accents) as converging on the AI-default look. Her
sketch: **"a calm, intelligent food companion"** — soft neutral ground,
charcoal ink, ONE accent (her seasonal list includes plum — current aubergine
may survive), modern sans, colour comes from the FOOD PHOTOGRAPHY not the UI
chrome. Reference triangle: Apple Health × Paprika × Pinterest. NOT actioned —
no design changes from this yet. Consequences for this queue:

- **Lane B (serif titles) — CHECK WITH GRACE BEFORE RUNNING.** It invests
  further into the serif direction she's questioning. Do not start it on
  autopilot.
- **The review comes FIRST and runs DIRECTION-BLIND (sequencing decided with
  Grace 2026-06-10).** Do NOT feed Grace's sketch, the three candidate arms,
  or any shell preference into any review agent's prompt — same anti-anchoring
  rule as tier verdicts. design-director proposes its own unifying direction
  from the wall + external references. Knowing the direction is "under
  challenge" (it's in `_project-context.md`) is fine — that frees judgment;
  the candidate answers are what must stay out.
- **Why review-first:** the review's censuses separate "wrong direction" from
  "badly executed direction" — spacing drift, near-duplicates, and missing
  states make ANY shell look cheap, and pivoting the shell won't fix them.
  Decide the shell AFTER seeing how much of the slop-feel is execution debt.
- **After the review:** compare its independent direction proposal against
  Grace's calm-intelligent-companion sketch (convergence = strong evidence).
  Then the G3.5 gate — rendered three-arm side-by-sides (current shell vs
  neutral+sans vs break-the-bundle hybrid with serif at display tier only),
  using the review's worst-flagged screens as test screens and the wall as
  the honest "current" arm. Grace decides on renders. Route positioning
  language to `brand-manager`.
- The "Decisions are challengeable" mandate is now in
  `.claude/agents/_project-context.md` (craft contract).

## THE QUEUE (in order — REVISED 2026-06-10)

**0. Merge PR #375 first** (decided with Grace 2026-06-10): the only REQUIRED
checks are Chromatic's ("Run Chromatic" / "UI Tests" / "storybook") — Grace
accepts the redesign diffs in the Chromatic UI, then squash-merge. The red
`test`/`playwright-visual` visual specs are ADVISORY — fix their baselines
in a small follow-up PR from CI's Linux artifacts (NOT local macOS renders;
see commit 503518b9 for the pattern). All later work = small PRs off main.

**1. FRESH-EYES FULL REVIEW (before any building).** Re-capture EVERYTHING:
every screen, light + dark, top AND scrolled states, key sheets/modals
(LogSheet, edit-meal, portion, move-meal), onboarding, cook mode — populated
account where possible. Then run the agent ladder per Grace's sequence
(design-director → premium-auditor on lagging surfaces → ui-product-designer
specs → build with ui-critic checks) with these constraints:
  - Do NOT mention prior tier verdicts in any prompt (no anchoring).
  - Add an explicit SPACING-FORENSICS pass: measured, programmatic checks of
    gaps/padding against the Spacing scale (4/8/16/20/24/32/40) per surface —
    Grace: spacing is a recurring weak spot; eyeballing misses it. Pixel-
    measure card gaps in captures where code reading is ambiguous.
  - Add a CONSISTENCY sweep across screens: same element, same treatment
    (chips, pills, rows, section headers, dividers, icon sizes, radii) —
    "multiple styles fighting" was the last review's miss until Grace saw it.
  - The review's backlog SUPERSEDES the queue below where they conflict.

2. **Lane A — CTA weight fixes** (Spec 2): import-shared Import→outline,
   LOG TODAY rows→outline pills, weekly-recap Log-a-meal→outline, whats-new
   Done→pill. Web in same commit. Guard pins (hook-form `accent.primarySolid`).
3. **Lane B — serif titles** (Spec 3): `Type.screenTitle`/`Type.navTitle`
   tokens + web classes; Targets/Health-Sync/Household/weekly-recap +
   PushScreenHeader; tokenise weight-tracker/nutrition-sources; guard test.
4. **Lane C — WeightChart onto Progress** (premium-audit P0-1): mount the
   existing `WeightChart` in the Progress weight card, wire the range picker
   (chart hardcodes "1m"), port `rangeDelta.tone`, delete Sparkline path.
   Web ProgressDashboard parity.
5. **Lane D — recipe-detail cleanups** (premium-audit gaps 1,3,5,6): cook-CTA
   dedup (Log becomes dominant), method steps→primary ink, ingredient tap→
   IngredientInfoSheet (not Alert), allergen null-state collapse. Web parity.
6. **Create-recipe green labels → textSecondary + haptic rebalance** (DD move 5).
7. **After lanes land**: ui-critic per changed surface → premium-auditor
   re-run on FIXED dark Today+Paywall → refresh the advisory visual baselines
   again if the lanes moved pixels.
8. **Skia ring** (Spec 1): build behind `ring_skia_v1` for the NEXT EAS
   build; brightening-plum overflow per the decision doc.
9. P0-2 adherence-headline product call (story-gate window vs range window;
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
  test job stays red until the advisory baselines are regenerated (queue #0
  follow-up PR, from CI Linux artifacts).

## Mirrors — DONE 2026-06-10 (do not repeat)

- Notion Decisions log: 3 rows created (aubergine accent, one-card-treatment,
  ring-overflow-brightening-plum).
- Linear: ENG-1003/1004/1005/1006 created + Done with commit evidence;
  initiative updates posted on Platform foundations + Surface polish.
  ENG-1002 (mobile type-scale) remains OPEN.
