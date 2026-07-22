# Storybook / Chromatic coverage matrix

**Status:** always-current (non-negotiable). Decision: [`docs/decisions/2026-07-22-storybook-chromatic-always-current.md`](../decisions/2026-07-22-storybook-chromatic-always-current.md).

**Rule:** every visual component ships with a sibling `*.stories.tsx` in the same PR, or an explicit skip row. Chromatic Storybook publishes on every PR.

**Counted:** `.tsx` under listed roots, excluding `*.stories.*` / tests / hooks (`use*.tsx`, `use-*.tsx`) / `_`-prefixed fixtures.

| Area | Visual | Stories | Explicit skips | Status |
|------|--------|---------|----------------|--------|
| `src/app/components/ui` | 62 | **62** | 0 | ✅ |
| `src/app/components/suppr` | 167 | **160** | **7** | ✅ |
| `src/app/components` (other hosts) | 147 | **112** | **35** | ✅ |
| `apps/mobile/components/ui` | 23 | **23** | 0 | ✅ |
| `apps/mobile/components` (features) | ~352 | **~264** | **88** | ✅ |

Canonical skip list: [`scripts/storybook-coverage-skips.json`](../../scripts/storybook-coverage-skips.json) (130 entries). CI: `npm run check:storybook-coverage` (`npm run ci` + Storybook workflow).

## Pipeline

- Web + mobile share one Storybook (`.storybook/main.ts` → RN-web aliases + stubs).
- PR CI: coverage ratchet → `build-storybook` → vitest → Chromatic Storybook publish.
- Playwright Chromatic (shell E2E archives) remains a separate workflow.

## Skip policy

Add a skip **only** when the surface cannot render without live auth/Supabase/camera/native and cannot be stubbed lightly — never as deferred work. Prefer a presentational leaf story over skipping a host.

## Anatomy role stories

| Role | Web | Mobile |
|------|-----|--------|
| Card | `ui/suppr-card` | `Mobile/UI/SupprCard` |
| Notice | `ui/suppr-notice` | `Mobile/UI/SupprNotice` |
| AddRow | `ui/add-row-button` | `Mobile/UI/AddRowButton` |
| IconButton | `ui/icon-button` | `Mobile/UI/IconButton` |
| CountBadge / pills / chips | stories | per-file `Mobile/UI/*` |

```bash
npm run check:storybook-coverage
npm run build-storybook
npm run chromatic:storybook   # needs CHROMATIC_* token
```
