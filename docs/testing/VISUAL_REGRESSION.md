# Visual regression — web + mobile

**Web:** Playwright snapshots (committed baselines) + optional **Applitools Eyes** (hosted AI diff when `APPLITOOLS_API_KEY` is set) + **Storybook** (component isolation). **Mobile:** Maestro deeplink sweep + pixel diff. **Beta feedback:** Centercode (qualitative — not layout QA). Optional **PostHog Visual Review** on PRs.

## Process — when you change a sub-page

Do not rely on tab-level flows alone. For every UI change on a deep route:

| Platform | Action |
|----------|--------|
| **Web** | Add or update the matching snapshot in `tests/e2e/visual-regression-*.spec.ts`, then `npm run test:e2e:visual:update` for that test only if intentional. |
| **Mobile** | Ensure `00z_sweep_deeplinks.yaml` captures the route (`screenshots/latest/deeplink-*`), run sweep + diff, promote baseline. |

**Rule:** one changed sub-page → at least one new or updated baseline PNG committed with the PR.

---

## Web — Playwright `toHaveScreenshot`

| File | Coverage |
|------|----------|
| `visual-audit.spec.ts` | Landing, login, pricing, tab shells (unauthenticated) |
| `visual-audit-authed.spec.ts` | Today, Discover, Plan, Progress, Settings, Library, Shopping |
| `visual-regression-subpages.spec.ts` | Help, legal, profile, import, billing, create |
| `visual-regression-deep.spec.ts` | Settings preferences band, `/home?view=targets`, profile Targets tab, recipe detail (`?recipe=`), upgrade paywall dialog |

**Baselines:** `tests/e2e/__snapshots__/` (committed).

```bash
# Compare
npm run test:e2e:visual

# Refresh after intentional UI change (review test-results/ first)
npm run test:e2e:visual:update

# Single spec while iterating
npm run test:e2e:visual:update -- tests/e2e/visual-regression-deep.spec.ts -g "recipe detail"
```

**Env:** `E2E_EMAIL` / `E2E_PASSWORD` in `.env.local` for authed specs. Optional `E2E_RECIPE_ID` (default `seed-v2-mediterranean-greek-salad`).

**Threshold:** `maxDiffPixelRatio: 0.01` in `playwright.config.ts` for product shells. Public marketing/legal routes (`landing`, `pricing`, help, terms, etc.) use **0.10** per-spec to tolerate Linux vs macOS font raster drift in CI without masking real layout breaks.

**CI:** `.github/workflows/visual-review.yml` (PRs) + public shell in main `ci.yml`.

---

## Mobile — Maestro + `pixelmatch`

**Deeplink sweep:** `apps/mobile/.maestro/00z_sweep_deeplinks.yaml`

Writes `screenshots/latest/deeplink-*.png` (diff) and `docs/audits/visual-sweep-expanded/*` (human audit pack).

```bash
npm run mobile:dev
npm run mobile:test:sweep:deeplinks
npm run mobile:test:screens:diff
npm run mobile:test:screens:update-baseline   # after approving diffs
```

---

## PostHog Visual Review (medium term — PR UI)

1. Enable Visual Review in your PostHog project and connect GitHub.
2. Add secret `VR_API_TOKEN` to the repo.
3. Uncomment the `posthog-visual-review` job in `.github/workflows/visual-review.yml`.
4. Install/configure the VR CLI per [PostHog Visual Review docs](https://posthog.com/docs/visual-review) (`playwright/snapshots.yml` is the manifest stub).

Until then, PRs still get Playwright snapshot failures + HTML report artifacts from the `playwright-visual` job.

---

## Applitools Eyes (optional hosted AI diff)

Complements committed Playwright PNGs — baselines live in the Applitools dashboard, not in git.

```bash
# .env.local
APPLITOOLS_API_KEY=your-key

npm run test:e2e:applitools
```

| Env | Purpose |
|-----|---------|
| `APPLITOOLS_API_KEY` | Required to run Eyes specs |
| `APPLITOOLS_BATCH_NAME` | Optional batch label in dashboard |
| `APPLITOOLS_SERVER_URL` | Optional private Eyes server |

**Spec:** `tests/e2e/visual-applitools.spec.ts` (public shell subset). **CI:** `applitools-eyes` job in `.github/workflows/visual-review.yml` when the repo secret is set.

Use when in-repo snapshots + PostHog VR still miss regressions (smart diff, cross-browser expansion).

---

## Storybook (component-level)

Isolated stories for design-system primitives — **not** full-route layout QA.

```bash
npm run storybook              # http://localhost:6006
npm run build-storybook        # static → storybook-static/
npm run test:storybook         # vitest — plays, a11y, interactions
npm run test:storybook:watch   # same, watch mode locally
npm run test:storybook:coverage # 100% coverage gate on storied UI primitives (CI)
```

**Automating in CI (pick one or both):**

| Approach | Command | What it runs |
|----------|---------|----------------|
| **Vitest** (default here) | `npm run test:storybook` | Storybook Test addon — story `play` functions, a11y checks, component tests in Chromium |
| **Chromatic (Playwright CLI)** | `npm run chromatic` | Uploads Playwright archives from `./test-results` (run `chromatic-e2e` spec first) |
| **Chromatic (Storybook CLI)** | `npm run chromatic:storybook` | Builds Storybook, uploads component snapshots |
| **Chromatic (Playwright E2E)** | CI only | `tests/e2e/chromatic-e2e.spec.ts` + `.github/workflows/chromatic.yml` |

`.github/workflows/storybook.yml` runs **Vitest** on PRs that touch components/styles.

`.github/workflows/chromatic.yml` runs **Playwright → Chromatic**: job `playwright` archives E2E pages (`@chromatic-com/playwright`), job `chromatic` uploads `./test-results` via `chromaui/action` with `playwright: true`. Requires `CHROMATIC_PROJECT_TOKEN` (use the token from your **Playwright** Chromatic project if you created one separately from Storybook).

**Coverage in the Storybook UI:** Re-run tests with coverage after pulling latest — coverage is scoped to the storied UI primitives enumerated in `STORYBOOK_UI_COVERAGE` (`vitest.storybook.config.ts`, re-exported by `vitest.config.ts`) — currently 24 — so **All files** should read **100%** when every story variant is exercised. That is the intended target, not 100% of the whole repo (~73k lines). Adding a storied component means adding its source path to that list; the 100% gate then forces full branch/line coverage on it.

**Whole-app coverage** is a separate track: `npm run test:coverage` (web `src/**`, ~53% lines baseline with CI thresholds in `vitest.unit.config.ts`) and `npm run mobile:test:coverage`. See [testing/overview.md](./overview.md#whole-app-baseline-npm-run-testcoverage).

HTML reports land in `coverage/storybook/` (`npm run test:storybook:coverage`).

**Stories:** `src/app/components/ui/*.stories.tsx`, overview `src/stories/DesignSystem.mdx`. **CI:** `.github/workflows/storybook.yml` on component path changes.

Add a story when shipping or changing a shared primitive; still add a Playwright or Maestro baseline when the change affects a full page.

---

## Centercode (beta feedback — not layout QA)

Tester cohorts, release announcements, surveys, and qualitative feedback. Does **not** replace screenshot regression.

See [`docs/operations/centercode-beta-feedback.md`](../operations/centercode-beta-feedback.md).

```bash
npm run centercode:publish-release   # after env in .env.local
```

Pair with TestFlight (`npm run testflight:feedback`) for ASC screenshot threads; use Centercode for structured beta program feedback.

---

## Chromatic (optional)

Hosted PR visual review for **web**. Two modes in this repo:

**Playwright E2E (CI):** `.github/workflows/chromatic.yml` — public shell pages in `tests/e2e/chromatic-e2e.spec.ts`. Local dry-run (needs built app on :3100):

```bash
npm run build && npm run start -- --port 3100 &
npx wait-on http://127.0.0.1:3100/login
npx playwright test tests/e2e/chromatic-e2e.spec.ts --project=chromium
npm run chromatic
```

**Storybook components (CLI):**

```bash
export CHROMATIC_PROJECT_TOKEN=chpt_…
npm run chromatic:storybook
```

Add `CHROMATIC_PROJECT_TOKEN` as a GitHub Actions secret. If Chromatic shows separate **Storybook** vs **Playwright** projects, use the Playwright project token for the workflow above.

---

## Release checklist

1. `npm run test:e2e:visual`
2. `npm run mobile:test:sweep:deeplinks` → `npm run mobile:test:screens:diff`
3. Review `apps/mobile/screenshots/diff/report.html` and Playwright `playwright-report/` on failure
4. Commit updated baselines only for intentional visual changes

See also: [`docs/qa/SCREEN_TEST_MATRIX.md`](../qa/SCREEN_TEST_MATRIX.md), [`apps/mobile/.maestro/README.md`](../../apps/mobile/.maestro/README.md).
