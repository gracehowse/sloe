# Web core-screen page gutter — converge onto `.product-shell` (ENG-1629)

**Date:** 2026-07-21
**Decider:** 2026-07-17 design sweep (`docs/audits/2026-07-17-design-sweep/report.md`,
cluster 14) named `.product-shell` (40px) as the target; this ticket implements it.
**Status:** Implemented, flag-gated, default-OFF

## Decision

`Targets.tsx` and `RecipeDetail.tsx` converge their page gutter onto
`.product-shell`'s composition (`src/styles/theme.css`) behind a new flag,
`web_gutter_convergence_v1`:

- **`Targets.tsx`** — `px-pm-5` (32px) → `px-pm-6` (40px). Scope is the
  padding step only; this screen's `max-w-5xl` container width is its own
  convention, distinct from `.product-shell`'s responsive
  `max-w-4xl`/`md:max-w-6xl`/`xl:max-w-7xl`, and stays as-is (out of scope —
  the 2026-07-17 audit only named the padding value as the offender here).
- **`RecipeDetail.tsx`** — every one of its **six** `max-w-4xl`/`px-6`
  container declarations converges, driven off two shared constants
  (`gutterWidthClass`, `gutterPadClass`) so they can never drift
  independently again:
  1. Loading skeleton early-return (width + pad)
  2. Fetch-failed early-return (width + pad)
  3. Loaded-content outer wrapper (width only — the hero image must stay
     edge-to-edge, so no padding lives on this container)
  4. Hero title overlay, a `px-6` child of the loaded wrapper (pad only)
  5. Body content wrapper, a `px-6` child of the loaded wrapper (pad only)
  6. Sticky bottom CTA bar's inner content column (width + pad — it mirrors
     the body's reading column so the footer buttons stay aligned with the
     content above it at every breakpoint)

Two sites that also match a bare `px-6`/`max-w-4xl` grep are **not** page
gutters and are intentionally left alone: the ingredient empty-state card's
own `rounded-2xl px-6 py-8` padding, and the Log CTA pill's `h-12 px-6`
button padding.

## Why this needed a retry

A first attempt at this convergence was reverted before merge. Adversarial
review caught two real bugs:

1. **Partial convergence, not full.** The obvious fix — swap the loading and
   error early-returns' `max-w-4xl mx-auto px-6` for the new value — only
   touches those transient states. Before any fix, loading / error / loaded
   all shared the identical static `max-w-4xl` (896px) + `px-6` (24px), so
   the three states were visually consistent. Fixing only the two
   early-returns breaks that consistency: the loading skeleton widens to the
   new responsive breakpoints while the real loaded content (a **separate**
   `max-w-4xl` wrapper further down the component, plus its own raw `px-6`
   children) stays at the old fixed width — a visible container-width SNAP
   the instant the skeleton is replaced by real content, on any recipe
   viewed at ≥768px.
2. **No cohesion-gate baseline refresh.** RecipeDetail is one of three named
   visual-regression "cohesion gate" surfaces
   (`docs/decisions/2026-06-18-visual-regression-posture.md`, ENG-1142). A
   deliberate visual change here must update the committed
   `deep-recipe-detail-*.png` baselines and pass
   `npm run test:e2e:visual:cohesion` locally — the first attempt didn't.

This retry fixes both: **all six** RecipeDetail containers converge off the
same two shared constants (structurally impossible to re-drift one without
the others), and the e2e cohesion suite force-flags `web_gutter_convergence_v1`
ON (`tests/e2e/utils/visual.ts` `REDESIGN_VISUAL_FLAGS`) so the committed
baselines show the converged state.

## Flag: `web_gutter_convergence_v1`, DEFAULT-OFF

Per `.claude/CLAUDE.md`'s feature-flag rule, a layout/gutter-width change is
explicitly listed as requiring `isFeatureEnabled(...)` gating — it is not
exempt as a "bug fix with no visual surface." Old gutter values stay alive
in the `else` branch as the kill switch.

**Why default-OFF** rather than this repo's more common "always flag on for
the beta-window N=1 tester" convention: `RecipeDetail.tsx` is a named
cohesion-gate surface on the launch-critical Recipes tab, and this file
already has three precedent flags that all shipped DEFAULT-OFF for exactly
that reason — `recipe_verdict_chip_v1` (ENG-1612), `avatar_monogram_frost_ring_v1`
(ENG-1593), `recipe_estimated_cost_v1` (ENG-1274) — each explicitly reasoning
that a structural/visual change to this surface ships dark until Grace's own
glance, not on the "always flag on" additive-card default. A page-gutter
convergence touches every breakpoint of the container everything else sits
inside; that risk shape sits closer to `progress_hierarchy_v1`'s "full-surface
structural change → default-off, ramp with before/after screenshots"
precedent than to an inert additive card. Off → both screens render their
exact pre-ENG-1629 gutter (byte-identical kill switch).

Registered in `src/lib/analytics/track.ts`'s `KNOWN_DEFAULT_OFF_FLAGS` (and
mirrored in `apps/mobile/lib/analytics.ts` for web↔mobile discoverability
parity only — the flag is WEB-ONLY; mobile has no Tailwind `.product-shell`
equivalent to converge onto).

## Verification

- `npm run typecheck`, `npm run lint`, `npm run test` (full web suite) — clean.
- `npm run mobile:lint`, `npm run mobile:typecheck`, `npm run mobile:test` —
  clean (mobile-side change is a doc-comment + registry-array entry only, no
  logic).
- Re-pinned two source-string tests that asserted the pre-ENG-1629 container
  classNames as single literals (`tests/unit/recipeDetailLayoutWeb.test.tsx`,
  `tests/unit/recipeDetailFigmaReskin.test.ts`) onto the new
  flag-derived-constant pattern; both legacy and converged values still
  exist verbatim in source as the ternary branches.
- `npm run check:screen-budget` — `RecipeDetail.tsx` net-shrank one line
  (a real, unrelated dead-code removal: `redesignColours` was an orphaned
  `isFeatureEnabled("design_system_colours")` read left over from ENG-1612's
  extraction of the "Fits your day" chip into its own component; nothing in
  RecipeDetail.tsx has read it since), re-pinned lower in
  `scripts/screen-line-budget.json`. `Targets.tsx` holds exactly at its pin.
- `npm run check:web-spacing-scale`, `check:token-scale` — clean; `px-pm-5`/
  `px-pm-6` are pre-existing named tokens on the legal scale, not raw
  Tailwind numerals, so neither ratchet's regex scans them.
- `npm run test:e2e:visual:cohesion` — see the PR for the actual run output;
  requires `E2E_VISUAL_EMAIL`/`E2E_VISUAL_PASSWORD` (the dedicated
  visual-golden account), which this session did not have available locally.
  Baselines were regenerated via the `update-visual-baselines.yml`
  workflow_dispatch, which supplies those secrets in CI.

## Known pre-existing, unrelated finding

While running `check:screen-budget`, `apps/mobile/app/plan-import.tsx` was
found already over its pinned budget (721 lines vs. 658 pinned) on `main`,
independent of this change (confirmed via `git stash`). PR #993 (ENG-1601)
grew the file without re-pinning. Left untouched here — out of scope for
ENG-1629 — but flagged separately since it currently fails
`npm run check:screen-budget` / the `screenLineBudget.test.ts` self-check on
a clean `main`.
