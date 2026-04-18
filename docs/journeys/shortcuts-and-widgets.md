# User Journey: Shortcuts and Widgets (iOS)

**Audience:** Product / Design

## Overview

Power users want to log common actions (a glass of water, the start of a fast) without opening the app and without tapping through a menu. iOS provides three levers for that: the Shortcuts app, Siri voice, and Home / Lock-screen widgets. Suppr exposes all three through a single `suppr://` URL scheme so we ship the behaviour today without blocking on a full Swift Intent extension.

## Entry points

- Shortcuts app → Open URL → `suppr://…`
- Siri → "Hey Siri, <shortcut name>"
- iOS Action Button (iPhone 15 Pro+) → run a shortcut
- Home / Lock-screen widget (native extension — deferred) → tap to open Today
- Focus automation / time-of-day automation in the Shortcuts app

## Deep-link contract

All three URLs are parsed by `src/lib/nutrition/siriDeepLinks.ts#parseSiriDeepLink`. The parser uses the WHATWG `URL` class, is case-insensitive on host + path, clamps to sensible bounds, and rejects any present-but-non-numeric parameter rather than silently defaulting (so a typo never triggers a surprise action).

| URL | Action | Defaults / limits |
|---|---|---|
| `suppr://log/water?ml=N` | Add N ml of water to today's hydration | Default 250; `N` clamped to 1..5000; rejects non-numeric |
| `suppr://fast/start?hours=N` | Begin an N-hour fast | Default 16; `N` clamped to 1..48; rejects non-numeric |
| `suppr://today/remaining` | Open Today tab | — |

## Flow — "Log water (250 ml)"

1. User creates a Shortcut with **Open URL → `suppr://log/water?ml=250`** and optionally adds it to Siri / Home screen.
2. They tap / say it. iOS launches Suppr (cold or warm) with the URL.
3. `HandleSiriDeepLinks` in `_layout.tsx` parses the URL, fires `siri_action_invoked { kind: "log_water" }`, calls `setPendingSiriAction`, triggers `AccessibilityInfo.announceForAccessibility("Logged 250 millilitres of water")`, and routes to `/`.
4. Today mounts, calls `consumePendingSiriAction`, and runs `addWaterMl(250)` — identical path as the Hydration card quick-add chip. Fires `hydration_logged`.
5. Widget snapshot writer picks up the change in its `useEffect` and schedules the next snapshot write 500 ms later.

## Flow — "Start 16 h fast"

1. User taps the shortcut.
2. `HandleSiriDeepLinks` enqueues `{ kind: "start_fast", hours: 16 }`, announces "Starting a 16 hour fast", routes to `/`.
3. Today flushes the queue and calls `startFastFromShortcut(16)`, which reads `profiles.fasting_sessions`, appends `{ start: now, end: null }`, and persists. If a session is already active it is a no-op (never stacks).
4. `activeFastStart` updates; the fasting status pill appears on Today; widget snapshot now has `fastActive: true` on its next write.

## Flow — "Today remaining"

1. User taps the shortcut.
2. `HandleSiriDeepLinks` routes to `/` with an accessibility announcement. No state is mutated.
3. This is also the deep link a Home / Lock-screen widget opens when tapped.

## States

- **Cold launch with deep link.** `Linking.getInitialURL()` catches the URL; the handler enqueues, Today flushes on first mount.
- **Warm launch.** `Linking.addEventListener("url")` catches the URL.
- **Background → foreground.** The Today flush re-runs on every `AppState.change → "active"` in case a shortcut fired while the app was suspended.
- **Stale action.** Pending actions older than 5 minutes are discarded (never surprise-log water the user forgot about).
- **User signed out.** `addWaterMl` and `startFastFromShortcut` both guard on `userId` — the action simply no-ops.
- **Malformed URL.** `parseSiriDeepLink` returns `null`; `HandleSiriDeepLinks` does nothing. The existing Social-share forwarder explicitly skips Siri URLs so the two handlers don't race.
- **Already fasting.** `startFastFromShortcut` reads existing sessions and refuses to start a second concurrent session. The announcement still fires — the user hears "Starting a 16 hour fast" — but the fasting card on Today continues to show the original session. (Future polish: surface a factual "You're already fasting" alert. Left as a follow-up since the shortcut is a fire-and-forget voice action.)

## Analytics

- `siri_action_invoked { kind }` — once per deep link handled.
- `widget_snapshot_updated` — fires on each successful AsyncStorage write of the Today snapshot (debounced 500 ms).
- Existing `hydration_logged` still fires when a water action flushes through `addWaterMl`.

## Parity

iOS-only feature by design. The web app does not register the `suppr://` scheme. The shared pure helpers (parser, builder, snapshot) live in `src/lib/nutrition/` so the schema stays owned in one place.

## Deferred / follow-up

- **Native iOS widget extension.** The snapshot is already written to a predictable AsyncStorage key + documents-directory file. An Xcode widget target (`WidgetKit` Swift) can read this via the App Group once `expo-apple-targets` (or equivalent) lands. No new JS work required for the render.
- **`react-native-siri-shortcut` donation.** Installing that library (native code) would let us donate each shortcut so they appear in the Shortcuts app automatically without the user pasting a URL. Behaviour is identical to the URL path once they're donated.
- **"Already fasting" confirmation.** See above.
- **Android parity.** Android has the Assistant + App Shortcuts, but this batch is iOS-only per task scope.
