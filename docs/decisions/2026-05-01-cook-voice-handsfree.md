# Decision: Cook-mode voice handsfree

- **Date opened:** 2026-05-01
- **Date resolved:** 2026-05-02
- **Owner:** product
- **Status:** Resolved (v2 implementation merged dark behind
  `COOK_HANDSFREE_FEATURE_ENABLED`; flag flip pending Grace's review)
- **Area:** mobile/cook, mobile/privacy, mobile/legal

## Problem

Paprika ships a true handsfree cook mode that listens for "next" /
"previous" / "repeat" / "pause" / "resume" keywords so dirty hands
never have to touch the screen. The 2026 competitor audit (gap #7)
flagged this as a P2-with-high-delight feature — Suppr's cook mode
already keeps the screen awake but does not listen for keywords.

The v1 implementation (2026-05-01) shipped only the SHELL: an opt-in
preference, an in-cook mic toggle, and a transparency banner that
explicitly told the user "voice control is coming soon — we don't
record audio yet." The actual recogniser was deferred pending the
privacy + legal review.

This decision records the v2 architecture choice plus the legal /
design constraints we resolved before flipping the feature flag.

## Architecture choice — Option A (on-device)

Three options were considered:

| Option | Recogniser | Audio path | Privacy claim | Cost |
| --- | --- | --- | --- | --- |
| A | iOS Speech framework, on-device | RAM-only, never persists | "Audio never leaves your phone" | None — on-device |
| B | iOS Speech framework, server-routed | Audio streamed to Apple servers | "Audio is sent to Apple for transcription" | None — Apple-hosted |
| C | Third-party cloud (Deepgram / Google STT) | Audio streamed to vendor | "Audio is sent to a third-party transcription service" | $-per-minute |

**Decision: Option A.**

Rationale:
1. **Privacy posture.** The whole reason this feature is in scope is
   that the kitchen is the most-trusted private surface in the home;
   a network-routed recogniser would invert that. On-device
   recognition lets us truthfully say "audio is processed on your
   device and never sent to our servers" — which is the copy the
   legal review approved for the consent sheet.
2. **Latency.** On-device recognition resolves a final transcript
   in roughly 150-300ms on iPhone 12+ — fast enough to feel like a
   button press. A round-trip to a cloud STT adds 200-600ms of
   variable network latency, which makes the listener feel sluggish
   exactly when the user's hands are full.
3. **Zero infrastructure cost.** No audio leaves the device, so we
   never pay STT-per-minute or Apple-routed compute. The build size
   delta from `expo-speech-recognition` is small (the recogniser is
   already in iOS).

Tradeoff: on-device recognition is iOS 13+ only and is gated by
`SFSpeechRecognizer.supportsOnDeviceRecognition`. Devices that don't
support it disable the toggle with a clear "Voice control isn't
supported on this device" tooltip — we never silently fall back to
network recognition.

## Zero-retention RAM-only buffer

The implementation does NOT pass `recordingOptions` to the
`expo-speech-recognition` `start()` call, which means audio is never
persisted to disk (`recordingOptions.persist` defaults to false; we
explicitly do not set it). The transcript lives only in the JS
event handler's argument, is run through `matchHandsfreeCommand`,
and is then discarded — we hold a 220ms-window snapshot in
component state to render the "Heard: <command>" feedback chip,
then null it out.

We do NOT log the transcript text to PostHog. The
`cook_handsfree_command_detected` event payload is `{ recipeId,
command, latencyMs }` — `command` is one of the canonical enum
values, never the raw transcript. This is deliberate: shipping
transcripts to analytics would re-introduce the privacy risk
on-device recognition was chosen to avoid.

## English-only at launch

The keyword vocabulary in
`apps/mobile/lib/cookHandsfree.matchHandsfreeCommand` is English
(plus minor synonyms like "previous step" / "go back"). The
`expo-speech-recognition` `start()` call is hard-coded to
`lang: "en-US"`.

Non-English locales are deferred pending a translation pass. Adding
`es-ES` or `fr-FR` without translating the vocab would silently
break for non-English users — the recogniser would resolve text in
that locale, the matcher would return null, and the listener would
appear "broken" without any error UI to explain why.

When non-English support lands it must:
1. Translate the vocabulary table (in `cookHandsfree.ts`) per
   supported locale.
2. Resolve the user's current locale (Expo `Localization.locale`)
   and pass it to the `start()` call.
3. Verify the locale is installed on the device via
   `getSupportedLocales()` before enabling the toggle — fall back to
   English if not.

## Web parity — deferred

Web cook mode (`src/app/components/CookMode.tsx`) does NOT receive
the v2 listener.

The browser `SpeechRecognition` / `webkitSpeechRecognition` API on
all major browsers (Chrome, Safari, Edge) routes audio to the
browser vendor's cloud STT (Google for Chrome, Apple for Safari).
There is no equivalent of iOS's `requiresOnDeviceRecognition: true`
setting — every transcript is server-routed. Shipping web voice
handsfree would force us to rewrite the privacy claim from "audio
never leaves your phone" to "audio is sent to your browser
vendor's transcription service" — which is a materially different
contract.

The audit also flagged that web cook mode is rarely used in
practice (the kitchen surface is overwhelmingly mobile). We'd be
paying a privacy-policy revision cost for ~5% of cook sessions.

If web voice handsfree becomes a serious requirement we revisit
this with three options: (a) rewrite the privacy disclosure to
cover browser-routed STT, (b) ship a WASM-based on-device
recogniser (e.g. Whisper.cpp) at significant binary cost, or (c)
hold the surface mobile-only as a deliberate platform-divergence.

This is the rare case where mobile-only is the correct answer per
the project's "web and mobile must stay in sync" rule — the
**capability** is mobile-only because the **platform constraint**
is mobile-only. Documented here so `sync-enforcer` doesn't flag it
as drift.

## Six legal-review requirements

The 2026-05-02 legal review surfaced six requirements on top of the
architecture choice. All are implemented in the v2 PR; the matrix
below records where each lives.

| # | Priority | Requirement | Implementation |
| --- | --- | --- | --- |
| 1 | P0 | Age gate (<16 OR unknown → toggle disabled with explanatory tooltip) | `apps/mobile/lib/cookHandsfree.ts` `resolveHandsfreeAgeGate`, wired in `cook.tsx` |
| 2 | P0 | Privacy notice section on the live policy page | `app/privacy/page.tsx` — new "Voice control in Cook Mode" section |
| 3 | P1 | `NSMicrophoneUsageDescription` in iOS Info.plist | `apps/mobile/app.json` `expo.ios.infoPlist` |
| 4 | P1 | Pre-permission explainer sheet before iOS prompt | `apps/mobile/components/cook/CookHandsfreeConsentSheet.tsx` |
| 5 | P2 | Decision doc (this file) | This file |
| 6 | P1 | Banner copy swap (v1 → v2) gated on flag + consent | `apps/mobile/app/cook.tsx` |

We also added `NSSpeechRecognitionUsageDescription` (separate iOS
permission gate) so the OS-level prompt explains the recognition
side too — the spec only required the microphone string but the iOS
Speech framework will reject `start()` without both.

## Feature flag — `COOK_HANDSFREE_FEATURE_ENABLED`

Implemented as a module-level `const` in
`apps/mobile/lib/cookHandsfree.ts`, default `false`. When `false`
the cook screen renders the v1 transparency banner ("We don't
record audio yet.") unchanged and no listener / consent / age-gate
logic runs. When `true` the v2 path lights up.

We deliberately did NOT use a remote-config flag — this is a
privacy-sensitive surface where every flip should be auditable in
git history, not in a remote dashboard. Flipping the constant is a
one-line PR that requires explicit Grace review.

## Test coverage

Unit tests pin the legal-sensitive contracts:

- **Age gate:** `resolveHandsfreeAgeGate(14)` returns
  `"blocked_too_young"`, `(16)` returns `"allowed"`, `(null)` returns
  `"blocked_unknown"`.
- **Consent sheet:** first-time toggle ON → sheet renders before iOS
  prompt; AsyncStorage flag = "1" → sheet skipped.
- **On-device only:** `isOnDeviceRecognitionSupported() === false`
  → toggle renders disabled with "isn't supported on this device"
  tooltip.
- **Banner copy:** flag OFF → v1 transparency banner; flag ON +
  consent given → v2 listening hint banner.
- **Recognition:** simulated `result` event with transcript "next"
  advances the step + emits the transcript chip + fires the
  detection analytics event.
- **Soft cap:** three consecutive misses (unmatched transcript +
  manual-tap within 4s) renders the de-escalation strip.

## Follow-ups

- Flip `COOK_HANDSFREE_FEATURE_ENABLED` to `true` after Grace's
  review of the merged dark code.
- Translate the keyword vocabulary for the next supported locale
  (Spanish or French most likely first).
- If TestFlight feedback flags the soft-cap threshold of 3 as too
  aggressive (or too lenient), tune `HANDSFREE_MISS_THRESHOLD` and
  `MISS_TAP_WINDOW_MS` constants in `cook.tsx`.
- Wire the same listener path into the web cook mode IF we adopt
  Whisper.cpp on-device recognition for the browser. Until then,
  web stays mobile-divergent (documented above).
