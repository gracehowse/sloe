# Storybook + Chromatic always-current catalog (2026-07-22)

**Status:** Adopted  
**Owner:** Engineering  
**Supersedes:** informal “stories when convenient” practice; complements [2026-06-18 visual regression posture](./2026-06-18-visual-regression-posture.md) (Playwright goldens remain the merge gate for full-route cohesion; this decision is the **component catalog** gate).

## Context

Grace’s anatomy / design-system program requires every visual component in Storybook with Chromatic snapshots before anatomy refactors ship. After the 2026-07-22 full-coverage pass, the remaining risk is **drift** — new UI landing without a sibling story, or stories going stale relative to Chromatic.

## Decision

**Keep Storybook and Chromatic 100% current as a non-negotiable**, enforced in CI and agent rules:

1. **Sibling `*.stories.tsx`** (or an explicit skip row) for every visual component under `src/app/components/**` and `apps/mobile/components/**`.
2. **`npm run check:storybook-coverage`** fails CI when a new visual file has neither a story nor a skip (`scripts/storybook-coverage-skips.json`).
3. **Storybook workflow** builds Storybook, runs the coverage check, runs story vitest coverage, and **publishes Storybook to Chromatic** on every PR so the hosted catalog matches `main`/PRs.
4. Skips are allowed only when render is impossible without live auth/Supabase/camera/native and cannot be stubbed lightly — never as “we’ll add stories later”.

## Non-goals

- Flipping Chromatic Playwright `autoAcceptChanges` (still inform-not-gate for E2E archives — ENG-1142).
- Replacing Playwright cohesion goldens with Storybook.

## Related

- `docs/design/2026-07-22-storybook-coverage-matrix.md`
- `scripts/check-storybook-coverage.mjs`
- `.github/workflows/storybook.yml`
- Agent rule: “Storybook + Chromatic — non-negotiable” in `.claude/CLAUDE.md`
