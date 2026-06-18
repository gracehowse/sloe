# Local `npm run ci` ⇄ CI parity (ENG-1074)

**Goal:** `npm run ci` exit 0 ⇒ `.github/workflows/ci.yml`'s **deterministic** gates
are green for the same tree. No more false-confidence reds like PR #400 (CI-only
`check:type-scale` failed after a clean local `npm run ci`).

`npm run ci` (and the build-less `npm run ci:preflight`) now run every cheap,
deterministic CI gate:

| Gate | CI step | local script |
|------|---------|--------------|
| Production env checklist | ✅ | `verify:production-env` |
| Migration filename/dup (static) | ✅ | `check:migrations:static` |
| Web typecheck | ✅ | `typecheck` |
| Web ESLint | ✅ | `lint` |
| Web unit/component (coverage) | ✅ | `test:coverage` |
| Today capture pairs (ENG-629) | ✅ | `check:today-captures` |
| Type-scale lint (ENG-119) | ✅ | `check:type-scale` |
| Web `next build` | ✅ | `build` |
| Mobile ESLint | ✅ | `mobile:lint` |
| Mobile typecheck | ✅ | `mobile:typecheck` |
| `@suppr/shared` re-exports + cross-boundary resolve | ✅ | `check:mobile-shared-imports` |
| Mobile unit (coverage) | ✅ | `mobile:test:coverage` |
| Maestro suite manifest | ✅ | `mobile:test:e2e:verify-suite` |

`check:mobile-shared-imports` (`scripts/check-mobile-shared-imports.sh`) is the
single source for the mobile `@suppr/shared` boundary check — **CI calls the same
script**, so the two can't drift. It also fixes a latent bug in the old inline CI
version (the resolve loop ran in a `grep | while` pipe subshell, so `FAIL=1`
never escaped and a MISSING import still passed CI).

## Intentionally NOT in local `npm run ci` (env-dependent / heavy)

These stay CI-only by design — they need network, credentials, browser/sim
binaries, or are too slow for the local gate. If `npm run ci` is green but one of
these is red on CI, it's an environment/integration issue, not a code-tree issue:

- **Playwright browser install + E2E smoke** — needs `npx playwright install` +
  a running app + network (`test:e2e`).
- **Food-search provider smoke** — optional; hits FatSecret/Edamam (creds + network).
- **Metro bundle-check (`expo export`)** — the full Metro pipeline (~minutes) with
  Expo env placeholders; catches RN/Expo SDK mismatches before EAS (ENG-562).
  Run it manually when touching native deps / Expo SDK.
- **gitleaks secret-scan** — needs the gitleaks binary.
- **`npm audit` dep-audit (web + mobile, high+ prod)** — network; advisory DB.
- **sourcemap-verify** — build + assert sourcemaps (redundant with `build` locally).
- **Chromatic / Storybook build / Applitools / UI Tests** — separate workflows
  (not `ci.yml`); visual baselines needing service tokens. ENG-1090 hardens
  `npm run build-storybook` by running Storybook with `staticDirs` disabled for
  the production build, then copying `public/` into `storybook-static/` once via
  `scripts/build-storybook.mjs` so Storybook's parallel static-copy race cannot
  create duplicate directories.

## Per CLAUDE.md

Keep scoping day-to-day checks to what you touched (mobile-only →
`mobile:lint && mobile:typecheck && mobile:test`; web-only → `typecheck && lint
&& test`). Run the full `npm run ci` once before the final push — it now matches
CI's deterministic gates, so a green local run means CI won't surprise you on the
cheap checks.
