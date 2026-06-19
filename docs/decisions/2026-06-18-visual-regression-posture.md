# Visual regression posture (ENG-1142)

**Date:** 2026-06-18  
**Status:** Adopted  
**Owner:** Engineering  

## Context

Chromatic runs with `autoAcceptChanges: true` (Grace decision 2026-06-14) so UI Tests never block merge. Playwright golden specs carry the real gate. ENG-1142 asked for an explicit **cohesion gate** — three surfaces whose visual drift is most damaging to brand perception:

1. **Today** (`/today`) — daily home, highest traffic
2. **Upgrade paywall dialog** — monetisation trust surface
3. **Recipe detail** (`/discover?recipe=…`) — core recipe read experience

## Decision

**Option (b): Playwright goldens for cohesion surfaces.** Do not flip Chromatic `autoAcceptChanges` without Grace sign-off.

| Surface | Spec | Snapshot prefix |
|---------|------|-----------------|
| Today (mobile + desktop) | `tests/e2e/visual-audit-authed.spec.ts` | `tabs/today-*.png` |
| Recipe detail (mobile + desktop) | `tests/e2e/visual-regression-deep.spec.ts` | `deep/recipe-detail-*.png` |
| Upgrade paywall dialog (mobile + desktop) | `tests/e2e/visual-regression-deep.spec.ts` | `deep/paywall-dialog-*.png` |

### Cohesion-only CI command

```bash
npm run test:e2e:visual:cohesion
```

Runs only the six snapshots above (grep filter on the two specs). Use when iterating on Today, paywall, or recipe-detail without the full visual suite.

### What Chromatic is for

- Landing/pricing archives via `chromatic-e2e.spec.ts`
- Browsable history — **inform**, not **gate**
- Storybook component snapshots (separate project)

### Full visual suite

`npm run test:e2e:visual` — all Playwright golden specs including cohesion + sub-pages + redesign gates. PR workflow: `.github/workflows/visual-review.yml`.

## Acceptance

A deliberate visual change to Today, paywall, or recipe-detail **must** update committed baselines in `tests/e2e/__snapshots__/` and pass `npm run test:e2e:visual:cohesion` locally before merge.

## Related

- `docs/testing/VISUAL_REGRESSION.md`
- `.github/workflows/chromatic.yml` (autoAcceptChanges comment)
- Linear ENG-1142
