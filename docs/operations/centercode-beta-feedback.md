# Centercode — beta feedback (not layout QA)

Centercode manages **beta testers, builds, surveys, and qualitative feedback**. It does **not** replace Playwright snapshots, Maestro pixel diff, or Applitools for layout regression.

| Channel | Use for |
|---------|---------|
| **Centercode** | Tester cohorts, release notes, in-app feedback, surveys, TestFlight sync |
| **TestFlight + ASC API** | Screenshot feedback export (`npm run testflight:feedback`) |
| **Playwright / Maestro** | Pixel and route-level UI regression |

## Setup (~15 minutes)

1. Create a [Centercode](https://www.centercode.com/) project for Suppr.
2. **Management → Releases** — add a release type (e.g. `ios-testflight`) and note the **release type key**.
3. **Management → API** — create a community-level API key authorized for the release endpoint.
4. Optional: connect **TestFlight** so Centercode syncs external testers and auto-creates releases when new builds land ([App testing guide](https://help.centercode.com/en/guide-to-app-testing-via-centercode)).

Add to `.env.local` (never commit keys):

```bash
CENTERCODE_BASE_URL=https://yourco.centercode.com
CENTERCODE_API_KEY=your-api-key
CENTERCODE_PROJECT_KEY=Suppr
CENTERCODE_RELEASE_TYPE_KEY=ios-testflight
# Optional per publish:
CENTERCODE_RELEASE_TITLE=Suppr iOS 1.2.0 (42)
CENTERCODE_RELEASE_VALUE=1.2.0
CENTERCODE_DOWNLOAD_URL=https://testflight.apple.com/join/XXXX
CENTERCODE_RELEASE_BODY=<p>Focus areas: Today macro tiles, recipe edit.</p>
```

## Publish a release (manual or CI)

```bash
npm run centercode:publish-release
```

Uses `scripts/centercode/publish-release.mjs` → `POST /projects/{projectKey}/releaseTypes/{releaseTypeKey}` ([API reference](https://welcome.centercode.com/api/)).

GitHub Actions: workflow `centercode-release.yml` — `workflow_dispatch` when repo secrets are set.

## Workflow with TestFlight

1. Ship build via EAS → TestFlight external group.
2. Either Centercode **auto-creates** a release from TestFlight integration, or run `npm run centercode:publish-release` with `CENTERCODE_DOWNLOAD_URL`.
3. Testers submit **feedback and surveys** in Centercode; triage in Linear.
4. For screenshot threads with ASC IDs, still run `npm run testflight:feedback` — see [`docs/testflight-feedback/README.md`](../testflight-feedback/README.md).

## What not to use Centercode for

- Approving pixel diffs or screenshot baselines
- Replacing `npm run test:e2e:visual` or `mobile:test:screens:diff`
- Automated PR visual gates (use Playwright snapshots or Applitools instead)

See also: [`docs/testing/VISUAL_REGRESSION.md`](../testing/VISUAL_REGRESSION.md).
