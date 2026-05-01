# Decision: EAS Update for OTA JS pushes (2026-04-30)

**Status:** Resolved.
**Owners:** Engineering.

## Context

Mobile JS-only changes were taking 15-25 minutes to reach the test
device because every change required a fresh TestFlight build + Apple
processing cycle. This bit us today: PR #11 shipped FatSecret search to
web instantly (Vercel deploy) but the mobile bundle still showed the
older USDA-labelled "Big Mac" because the binary on the device was from
before PR #11. The mobile JS was a release-cycle behind the web JS.

Without an OTA pipeline, the only fix is "wait for the next build" —
which collapses the iteration loop and incentivises batching unrelated
changes into single builds (and thus larger blast radius per ship).

## Decision

Wire EAS Update into the mobile app:

- Install `expo-updates` via `npx expo install` so the version stays
  SDK-aligned (currently `~29.0.17` on Expo SDK 54).
- Set `expo.runtimeVersion.policy = "appVersion"` in `app.json`. OTA
  updates only ship to binaries with a matching `expo.version`. This is
  the safe default — it forces a fresh build whenever native code or
  config changes (because we'd bump the version), while letting JS-only
  changes flow OTA freely.
- Set `expo.updates.url` to the project's EAS Update endpoint
  (`https://u.expo.dev/<projectId>` where `<projectId>` is the existing
  `expo.extra.eas.projectId`).
- Set `expo.updates.fallbackToCacheTimeout = 0` so the app never blocks
  cold start waiting for an update — the new bundle (if any) downloads
  in the background and runs on the next launch.
- Set `expo.updates.checkAutomatically = "ON_LOAD"` (explicit; this is
  the default).
- Add a `channel` field to each `eas.json` build profile:
  - `development` → `"development"`
  - `preview` → `"preview"`
  - `production` → `"production"`

## Safety rules — non-negotiable

These mirror the workflow doc; capturing them here so the rationale lives
with the decision.

- **OTA is safe for**: pure JS / TS changes, copy edits, bug fixes in
  existing screens, and assets that Metro already knows about.
- **OTA is NOT safe for**: new native modules, `app.json` native config
  changes (plugins, entitlements, Info.plist, scheme, icons, splash),
  Expo SDK upgrades, or anything that bumps `runtimeVersion`. These
  require a fresh build.
- **Always publish `preview` first** unless the change is trivially
  safe and reproducible.
- **Never publish from a feature branch.** `git push` + merge to `main`
  first; publish from a clean `main` checkout. OTA from a feature
  branch silently overrides what `main` claims is shipped.
- **OTA does not save you from a boot-loop.** If a bad update prevents
  the app from launching long enough to fetch the next update, the
  republish never lands. Recovery is a fresh TestFlight build.

## Why these specific settings

- **`runtimeVersion: { policy: "appVersion" }`** — pins OTA eligibility
  to `expo.version`. We bump `expo.version` whenever we ship a new
  binary, which means a binary at `1.0.7` only accepts OTA updates
  published while `app.json` says `1.0.7`. This stops a future change
  to a native module from being silently shipped to users running an
  older binary.
- **`fallbackToCacheTimeout: 0`** — never block the splash on a network
  request. Users on flaky networks (or in airplane mode at app launch)
  get the cached bundle immediately; the new bundle downloads
  in the background and applies on the next launch.
- **`checkAutomatically: "ON_LOAD"`** — default, but explicit for
  clarity. The check fires every cold launch, not just on first install.

## Out of scope

- A web/landing equivalent. Web is on Vercel — already instant deploys.
- An Android channel. Android is not built (per project instructions).
  The `eas.json` `channel` settings cover Android profiles only because
  EAS treats channels as platform-agnostic; if we ever build for
  Android, the channel routing already works.

## References

- Workflow: [`docs/operations/eas-update-workflow.md`](../operations/eas-update-workflow.md)
- `apps/mobile/app.json` — runtime version + updates URL
- `apps/mobile/eas.json` — channel routing
- `apps/mobile/tests/unit/easUpdateConfig.test.ts` — pin tests
