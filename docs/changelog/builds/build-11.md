# Build 11 (1.0.0 #11) — 2026-04-20

Placeholder entry for the next TestFlight build. Items will be added
here (and mirrored into `src/lib/changelog/entries.ts`) ahead of the
build being promoted.

Do not populate until the build is actually scheduled — an empty entry
is intentional so renderers that fetch "latest" don't break between
builds. See `docs/changelog/README.md` for the authoring workflow.

## Fixed

- **Progress — skeleton no longer pins indefinitely on a failed load.**
  `loadData` / `load` are now wrapped in `try/finally`, so a thrown
  supabase error (network blip, auth expiry mid-call) flips `loading`
  → false and the UI falls through to the empty or populated state
  rather than staying stuck on the skeleton loader. Mobile +
  web (`apps/mobile/app/(tabs)/progress.tsx`,
  `src/app/components/ProgressDashboard.tsx`).

## New

- **Progress — header + range picker ported to 2026-04-19 prototype.**
  Both mobile and web now show an uppercase range overline
  (`LAST 7 DAYS` / `LAST 30 DAYS` / `LAST 90 DAYS` / `ALL TIME`),
  large 28pt "Progress" title, and a round calendar-icon button
  top-right. A horizontal `[7d / 30d / 90d / All]` pill row below
  the header drives the overline text and the chart windows that
  already consumed `rangeDays` on web. Default range is `30d`,
  matching the prototype. Deeper card-level restructure (sparkline
  weight card, calories / protein bar cards) is deferred.

## Coming soon

_(none yet)_

## Engineering notes (not surfaced to testers)

- **Cook handsfree v2 — merged dark behind feature flag.** On-device
  speech recognition for "next" / "back" / "repeat" / "pause" / "resume"
  now ships in the binary but is gated by `COOK_HANDSFREE_FEATURE_ENABLED`
  in `apps/mobile/lib/cookHandsfree.ts` (default `false`). Flag-off
  users see the unchanged v1 transparency banner. Flipping the flag is
  a separate one-line PR pending Grace's review of the merged code.
  See `docs/decisions/2026-05-01-cook-voice-handsfree.md` for the
  Option-A rationale, the legal review's six requirements (age gate,
  privacy notice, Info.plist strings, consent sheet, decision doc,
  banner copy swap), and the deliberate web-parity carve-out.
- **Privacy policy section added.** `app/privacy/page.tsx` now carries
  a "Voice control in Cook Mode" section explaining the on-device
  recognition + zero-retention posture. Surfaces today even though
  the listener is dark — the legal reviewer required the policy to
  pre-date any flag flip so installed-base users see the disclosure
  before the prompt.
