# Today premium sprint — sim captures

**Sprint:** 2026-05-19 · paired mobile + web  
**Baseline:** [`docs/ux/today-premium-sprint-2026-05-19-baseline.md`](../today-premium-sprint-2026-05-19-baseline.md)

## How to capture

1. iOS Simulator (iPhone 13 or 15) + mobile-web at **390×844**, light and dark.
2. Same account / seed data where possible.
3. Name files: `{state}-{platform}-{theme}.png` (e.g. `one-meal-mobile-light.png`).

### Playwright scaffold (local dev + auth)

With the web app running and (ideally) a logged-in storage state:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  npx playwright test tests/e2e/screenshots/today-premium-2026-05-19.spec.ts
```

Outputs land in this folder. Extend `STATES` in the spec as you seed each matrix row.

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
