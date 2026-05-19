# Storybook deferred — Chromatic runs in Playwright mode

Date: 2026-05-18  
Status: Resolved  
Area: visual-regression infrastructure  
Decided by: Grace (this session)

## Decision

Storybook is deferred from Phase 1.3 of the UI elevation plan
(`/Users/graceturner/.claude/plans/i-m-really-struggling-to-goofy-rivest.md`).
Chromatic stays wired in `--playwright` mode and consumes the same full-page
captures that `tests/e2e/visual-regression/web-baseline.spec.ts` produces.

## Why deferred

Phase 1.3 of the original plan called for Storybook 8 + per-primitive
`*.stories.tsx` files (`SupprCard`, `TrustChip`, `SourceDot`, `ConfidenceChip`,
`EmptyState`, `SkeletonRow`, etc.) so Chromatic could diff component-level
state matrices.

Three honest reasons to defer:

1. **Primitives aren't yet formalised as standalone components.** Most of the
   UI primitive surface area on Suppr is composed inline with Tailwind utility
   classes inside App Router pages, not extracted into pure React components
   with explicit prop surfaces. Wrapping each in a story with a meaningful
   prop matrix would be ~2 days of structural work first, then story authoring
   on top.
2. **Chromatic already provides visual review via `--playwright`.** The
   `chromatic.yml` workflow consumes Playwright's `toHaveScreenshot` captures
   (currently 48 baselines covering 6 public surfaces × 4 breakpoints × 2
   themes). Page-level review catches everything that ships. Component-level
   catches a different class (primitive drift before page exposure), but
   that's the second-order win, not the urgent one.
3. **6 weeks to launch.** With limited engineering time, the visual elevation
   work itself (cross-cutting patterns flagged in the 2026-05-18 brutal
   screenshot review — persistent toast, ALL-CAPS overlines, bordered-card
   container, blue-everywhere, etc.) carries more conversion impact than
   adding a second regression layer.

## What's in place today

| Layer | Status | File / config |
|---|---|---|
| Playwright `toHaveScreenshot` baseline | ✅ 48 snapshots committed | `tests/e2e/visual-regression/web-baseline.spec.ts` + `*-snapshots/` |
| Lost Pixel (full-page diff + PR comment) | ✅ Configured, workflow wired | `lostpixel.config.ts`, `.github/workflows/lost-pixel.yml` |
| Chromatic (`--playwright` mode) | ✅ Workflow wired, no-ops without token | `.github/workflows/chromatic.yml` |
| Storybook | ❌ Deferred (this doc) | — |

## One-time setup Grace still needs to do

These two steps are NOT blocking but the workflows are partial no-ops until done:

1. **Generate Lost Pixel baseline images** (one-time):
   ```bash
   npm run dev   # start the dev server in another terminal
   npx lost-pixel update
   git add .lost-pixel/baseline
   git commit -m "chore(visual): seed Lost Pixel baseline"
   ```
   Without these, the first PR run will fail "no baseline image found" on
   every page-shot. Subsequent runs will fail only on actual drift.

2. **Add `CHROMATIC_PROJECT_TOKEN` to repo secrets**:
   - Sign up at https://www.chromatic.com (free for ~5k snapshots/month)
   - Link the GitHub repo, copy the project token
   - GitHub → Settings → Secrets and variables → Actions → New repository
     secret → `CHROMATIC_PROJECT_TOKEN` = `<token>`

## Re-entry criteria — when to revisit Storybook

Add Storybook when one of the following becomes true:

- We extract ≥ 4 UI primitives into standalone components with explicit prop
  surfaces (e.g. once `SupprCard` and `TrustChip` exist as real components
  rather than Tailwind compositions).
- A regression slips past `--playwright` mode by being a primitive-state
  variant that no page-level capture exercises (e.g. button `loading` state).
- Post-launch, with the cold-open visual elevation work shipped, we have
  capacity to set up the primitive matrix properly.

Until then, Phase 1.3 is closed with status: **deferred-with-decision**.

## Affected paths

- `/Users/graceturner/.claude/plans/i-m-really-struggling-to-goofy-rivest.md` — Phase 1.3 status moves from "pending" to "deferred per `docs/decisions/2026-05-18-storybook-deferred-chromatic-playwright-mode.md`"
- `docs/audits/drift-scoreboard.md` — no impact; the scoreboard tracks token drift, not regression-coverage layers
