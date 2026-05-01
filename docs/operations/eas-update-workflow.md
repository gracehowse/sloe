# EAS Update — OTA JS pushes for the mobile app

**Audience:** Internal (engineering).
**Status:** Live as of 2026-04-30.
**Decision record:** [`docs/decisions/2026-04-30-eas-update-ota.md`](../decisions/2026-04-30-eas-update-ota.md).

## What this is

EAS Update lets us ship JavaScript-only changes to the iOS app without
going through TestFlight. A `eas update --branch production` push lands on
user devices in seconds (next app launch / background fetch), bypassing
the 15-25 minute TestFlight build + processing cycle.

The wiring lives in:

- `apps/mobile/app.json` — `expo.runtimeVersion.policy = "appVersion"`,
  `expo.updates.url`, `expo.updates.fallbackToCacheTimeout = 0`,
  `expo.updates.checkAutomatically = "ON_LOAD"`.
- `apps/mobile/eas.json` — each build profile (`development`, `preview`,
  `production`) declares a matching `channel`. The channel is the EAS
  Update routing key.
- `apps/mobile/package.json` — `expo-updates` (SDK-aligned version).

## When OTA is safe

OTA only ships the JS bundle and the assets bundled with it. Use OTA when:

- The change is JavaScript / TypeScript only (UI tweaks, copy fixes,
  pure-JS logic).
- New assets the app already knows how to load (images, JSON, fonts that
  are referenced via `require(...)` and resolved by Metro).
- Bug fixes in existing screens / components.

## When OTA is NOT safe — fresh build required

Stop and ship a TestFlight build (`eas build --platform ios --profile
production --auto-submit`) when:

- A new native module is added (anything with a Pod / native iOS code,
  e.g. installing a new `expo-*` package that includes native code).
- An `app.json` field that affects native config changes (icons, splash
  config, scheme, plugins array, entitlements, Info.plist values).
- The `runtimeVersion` policy needs to change. Today it's tied to
  `expo.version` — a binary at version `1.0.7` only accepts updates
  published with `runtimeVersion: 1.0.7`. Bumping `expo.version` in
  `app.json` requires a new build.
- The Expo SDK is upgraded.
- Any change to `eas.json` build envs that the JS reads via
  `process.env.*` at build time (vs runtime via `expo-constants`).

If you're unsure whether a change is OTA-safe, ship a fresh build. The
incremental cost of a TestFlight build is far smaller than the cost of
a broken OTA update bricking sessions until the next launch.

## Publishing an OTA update

```bash
cd apps/mobile
eas update --branch production --message "Brief, present-tense summary"
```

The `--branch` flag MUST match the `channel` of the binary you're
targeting. Production binaries built from `eas.json`'s `production`
profile listen on the `production` channel.

For a preview build (TestFlight or simulator install via the `preview`
profile):

```bash
cd apps/mobile
eas update --branch preview --message "..."
```

## Verifying a publish

After `eas update` exits successfully:

1. **Console output** — note the update group ID printed to the
   terminal.
2. **Dashboard** — open
   `https://expo.dev/accounts/<account>/projects/suppr/updates` and
   confirm the new group is listed under the correct branch with a
   matching runtime version.
3. **CLI listing** —

   ```bash
   eas update:list --branch production --limit 5
   ```

   The newest entry should match the message and runtime version you
   just published.
4. **On device** — relaunch the app twice. The first cold launch fetches
   the new bundle in the background; the second cold launch runs it.

## Rollback

There is no "delete update" — EAS forward-rolls. To undo a bad update,
re-publish a known-good update group on top of it:

```bash
eas update:list --branch production
# Find the group ID of the previous, known-good update.
eas update:republish --group <good-group-id> --branch production
```

The republished update lands on devices the same way as a normal
publish. If the bad update has caused crashes that prevent the app from
ever booting and fetching the next update, an OTA cannot save you — ship
a fresh build.

## Safety rules — non-negotiable

- **Never publish to `production` without testing on `preview` first**
  unless the change is trivially safe (copy edit, single-line bug fix
  with reproduction).
- **Never publish across runtime versions.** If the binary on a user's
  device is at `version: 1.0.6` and you publish from a checkout at
  `version: 1.0.7`, that user will not receive the update — and that's
  by design. Don't bypass it.
- **Hold the line on parity.** OTA updates the mobile JS bundle only.
  The web equivalent still needs a Vercel deploy in the same commit.
  The two surfaces must not drift.
- **Never publish over a deploy that hasn't been merged to `main`.**
  OTA from a feature branch silently overrides what `main` says is
  shipped. Always `git push` + merge first, then `eas update` from a
  fresh checkout of `main`.

## Related

- Decision: [`docs/decisions/2026-04-30-eas-update-ota.md`](../decisions/2026-04-30-eas-update-ota.md)
- TestFlight build cycle: see `apps/mobile/scripts/ios-run-device.sh`
  for local iOS development; production builds are kicked off via
  `eas build --platform ios --profile production --auto-submit`.
