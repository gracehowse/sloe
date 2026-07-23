# Storybook + Chromatic always-current catalog (2026-07-22)

**Status:** Adopted (amended 2026-07-22 — curated snapshots)  
**Owner:** Engineering  
**Supersedes:** informal “stories when convenient” practice; complements [2026-06-18 visual regression posture](./2026-06-18-visual-regression-posture.md) (Playwright goldens remain the merge gate for full-route cohesion; this decision is the **component catalog** gate).

## Context

Grace’s anatomy / design-system program requires every visual component in Storybook before anatomy refactors ship. After the 2026-07-22 full-coverage pass, the remaining risk is **drift** — new UI landing without a sibling story.

A second risk surfaced the same day: publishing **all** ~1,600 stories as Chromatic snapshots on every PR exhausts the monthly snapshot quota and conflates the Playwright E2E Chromatic project with the Storybook library. Storybook is the library; Chromatic is the visual-regression layer — they must not share one “snapshot everything” budget.

## Decision

**Keep the Storybook catalog 100% current as a non-negotiable. Use Chromatic snapshots only for a curated visual contract.**

1. **Sibling `*.stories.tsx`** (or an explicit skip row) for every visual component under `src/app/components/**` and `apps/mobile/components/**`.
2. **`npm run check:storybook-coverage`** fails CI when a new visual file has neither a story nor a skip (`scripts/storybook-coverage-skips.json`).
3. **Storybook workflow** builds the **full** Storybook and **publishes the library** to Chromatic on every PR so the hosted catalog matches `main`/PRs (browse URL).
4. **Chromatic snapshots** are limited to the visual contract:
   - Default in `.storybook/preview.tsx`: `chromatic.disableSnapshot: true`
   - Opt-in via `.storybook/chromaticVisualContract.ts` + `scripts/chromatic-storybook-visual-contract.txt`
   - CI passes `onlyStoryFiles` for that list via `chromatic.storybook.config.json` (mutually exclusive with TurboSnap `onlyChanged`)
5. **Separate Chromatic projects** (preferred):
   - `CHROMATIC_PROJECT_TOKEN` → Playwright E2E archives (`.github/workflows/chromatic.yml`)
   - `CHROMATIC_STORYBOOK_PROJECT_TOKEN` → Storybook library + curated snapshots (`.github/workflows/storybook.yml`)
   - Until the Storybook project exists, the workflow falls back to `CHROMATIC_PROJECT_TOKEN` (shares quota — temporary only)
6. Skips are allowed only when render is impossible without live auth/Supabase/camera/native and cannot be stubbed lightly — never as “we’ll add stories later”.

## Non-goals

- Flipping Chromatic Playwright `autoAcceptChanges` (still inform-not-gate for E2E archives — ENG-1142).
- Replacing Playwright cohesion goldens with Storybook.
- Snapshotting the full ~1,600-story catalog on every PR.

## Related

- `docs/design/2026-07-22-storybook-coverage-matrix.md`
- `scripts/check-storybook-coverage.mjs`
- `scripts/chromatic-storybook-visual-contract.txt`
- `.storybook/chromaticVisualContract.ts`
- `chromatic.storybook.config.json`
- `.github/workflows/storybook.yml`
- Agent rule: “Storybook + Chromatic — non-negotiable” in `.claude/CLAUDE.md`
