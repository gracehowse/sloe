# Changelog — "What's new in Suppr" curation

Testers see the latest entry in-app via Settings → About → **What's new
in Suppr** (mobile) and at `/whats-new` (web). The same surface also
auto-opens once on mobile after a build-number bump. Content is
hand-curated per release and committed to this repo — no network
fetch.

## Files you touch per release

1. `docs/changelog/builds/build-{N}.md` — human-readable source for
   the release notes. Copy the bullets from `docs/testflight-feedback/resolved.md`
   or your PR list, then rewrite in plain English.
2. `src/lib/changelog/entries.ts` — add a new entry at the top of the
   `CHANGELOGS` array with the same bullets, typed as `ChangelogItem[]`.
   Keep the entries array newest-first by convention (the accessor
   re-sorts defensively, but readers expect the file to read that way).

Both files must land in the same commit — the app reads only
`entries.ts` at runtime; the markdown exists for humans reviewing the
repo and for future automation.

## Copy rules

- Plain English, under **120 chars** per bullet (enforced by a lint
  rule in `tests/unit/changelogEntries.test.ts`).
- No file paths, no TestFlight IDs, no ASC feedback IDs, no internal
  feature flags. If you would not say it in a user-facing release
  note, leave it out.
- No emoji in `text`. Category icons (if any) are chosen by the
  renderer, not by the string.
- Group bullets by `kind`: `fixed` (bug fixes), `new` (newly shipped
  capability), `coming_soon` (deliberately staged item the user can
  see but not yet use).
- 3–6 bullets per build. If you have more than six, the build is
  probably doing too much — split.

## Tester attribution

Set `testerAttribution` to `Shaped by TestFlight feedback from N
testers.` where **N** is the number of **distinct `email` values** in
the matching `docs/testflight-feedback/data/feedback-{YYYY-MM-DD}.json`
file whose reports actually drove a bullet in this build.

Only set it when the build actually closed tester-reported items —
omit for maintenance / infra-only builds. Never name individual
testers in the string; the count is the privacy-safe way to
acknowledge them.

## Before you ship

- Preview on mobile: Settings → About → What's new in Suppr.
- Preview on web: visit `/whats-new`.
- Confirm `getLatestChangelog()` returns the new entry by running
  `npx vitest run tests/unit/changelogEntries.test.ts`.
- The app's auto-surface fires on mobile only. It keys off the build
  number, not the markdown filename. Promote the build through EAS
  as usual — `eas.json` auto-increments `ios.buildNumber`, which the
  helper reads at launch.
