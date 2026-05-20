# Today premium sprint — sim captures

**Sprint:** 2026-05-19 · paired mobile + web  
**Baseline:** [`docs/ux/today-premium-sprint-2026-05-19-baseline.md`](../today-premium-sprint-2026-05-19-baseline.md)

## How to capture

1. iOS Simulator (iPhone 13 or 15) + mobile-web at **390×844**, light and dark.
2. Same account / seed data where possible.
3. Name files: `{state}-{platform}-{theme}.png` (e.g. `one-meal-mobile-light.png`).

### Automated capture (2026-05-20)

```bash
# 1. Seed matrix rows (purges all meals on empty-day offset −14)
set -a && source .env.local && set +a
npx tsx scripts/e2e-seed-today-premium-matrix.ts

# 2. Mobile-web + desktop (dev server on :3000)
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  npx playwright test tests/e2e/screenshots/today-premium-2026-05-19.spec.ts --workers=1

# 3. iOS sim (Metro on :8081/8082, booted sim)
~/.maestro/bin/maestro test apps/mobile/.maestro/00d9_today_premium_matrix_full.yaml
npx tsx scripts/e2e-seed-today-premium-matrix.ts --activate-fast
~/.maestro/bin/maestro test apps/mobile/.maestro/00d9_today_premium_active_fast.yaml
bash apps/mobile/scripts/run-today-premium-matrix-dark.sh
bash scripts/copy-today-premium-mobile-captures.sh
```

Outputs land in this folder as `{state}-{mobile|mobile-web|desktop}-{light|dark}.png`.

### PR review gate (ENG-629)

For Today visual PRs, reviewers should compare **paired** shots (native sim next to mobile-web for the same state/theme). PR template checklist links here.

Desktop light matrix includes **deficit-insight** (`deficit-insight-desktop-light.png`) — re-run Playwright desktop block after seed changes.

## State matrix

| # | State | Notes |
|---|--------|--------|
| 1 | Empty day | 0 meals, remaining calories |
| 2 | One meal (~10am) | **Cold-open bar:** ring + macro grid + meals visible without scroll |
| 3 | Active fast | Context slot = fasting pill only |
| 4 | Eat-again | Budget met; neutral card (not primary tint) |
| 5 | Deficit insight | Remaining > 0 with logs |
| 6 | Over-budget | Amber on ring/tiles, not red |

## Compare

- Prototype HTML: `docs/audits/2026-05-15-premium-sweep-v2/prototypes/mobile/P0/today-first-render.html`
- Claude bundle: `docs/ux/claude-design-bundles/prototype/project/Suppr Prototype.html`

## Sign-off

When captures look calm vs prototype, note verdict in the baseline doc (one paragraph: what still feels busy, if anything).
