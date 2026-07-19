# User Journey: Shortcuts and Widgets (iOS)

**Audience:** Product / Design

## Overview

Power users want to log common actions (a glass of water, the start of a fast) without opening the app and without tapping through a menu. iOS provides three levers for that: the Shortcuts app, Siri voice, and Home / Lock-screen widgets. Suppr exposes all three through a single `suppr://` URL scheme so we ship the behaviour today without blocking on a full Swift Intent extension.

## Loop

This doc is the home of the **Cross-Device Entry Loop** (Shortcuts, Widgets, Deep Links) — power-user entry points that skip the app UI entirely:

1. User creates/names a Shortcut (or uses the Action Button) pointing at a `suppr://` URL.
2. Shortcut fires → the app parses and validates the URL (see Deep-link contract below).
3. Pending action is queued (5-minute staleness discard) if the app was cold-launched.
4. Today flushes the queue on mount — water/fast state updates exactly as if logged in-app. **This is where the loop rejoins the canonical Today spine** — see [food-tracking.md](./food-tracking.md) for the in-app hydration/fast cards this loop feeds into (same `addWaterMl` / `fasting_sessions` write paths).
5. A native Home/Lock-screen widget would close the loop with an always-visible surface. This step is deferred and currently blocked, not just pending — see "Deferred / follow-up" below. Nothing renders it today, and the data plane it would need is wired to the wrong storage target.

The other funnel this doc sits near — public marketing surfaces into signup — is a separate loop with no shared code path; see `docs/product/landing-maintenance.md` if you're looking for that one.

## Entry points

- Shortcuts app → Open URL → `suppr://…`
- Siri → "Hey Siri, <shortcut name>"
- iOS Action Button (iPhone 15 Pro+) → run a shortcut
- Home / Lock-screen widget (native extension — deferred **and currently blocked**; see Deferred / follow-up) → tap to open Today
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
- **Already fasting.** `startFastFromShortcut` reads existing sessions and refuses to start a second concurrent session — correct, it never stacks. But the VoiceOver announcement is a **real bug, not polish**: it fires unconditionally in `HandleSiriDeepLinks` at parse time, before Today has even read `fasting_sessions` to know whether a session is already active. So a user who is already fasting hears "Starting a 16 hour fast" and has no way to tell — from the announcement alone — that nothing happened. That's a false confirmation, the exact failure mode voice-only interactions can't afford. See Known issues below.

## Analytics

- `siri_action_invoked { kind }` — once per deep link handled **for `log_water` and `today_remaining`**. **`start_fast` fires it twice, not once:** once in `_layout.tsx`'s `HandleSiriDeepLinks` at parse time (`{ kind: "start_fast" }`, no `hours` — `apps/mobile/app/_layout.tsx:209`), and again in `TodayScreen.tsx`'s `startFastFromShortcut` at flush/execute time (`{ kind: "start_fast", hours }` — `apps/mobile/app/(tabs)/_today/TodayScreen.tsx:2855`). Any funnel or count built on this event over-counts `start_fast` invocations by 2x relative to `log_water` / `today_remaining`. See Open product questions below.
- `widget_snapshot_updated` — fires on each successful AsyncStorage write of the Today snapshot (debounced 500 ms). **Has no consumer today** — nothing reads `SUPPR_WIDGET_SNAPSHOT_KEY` outside the writer and its own tests — so every Today totals/target/fast change burns a PostHog event that nothing downstream acts on (see Deferred / follow-up).
- Existing `hydration_logged` still fires when a water action flushes through `addWaterMl`.

## Known issues

- **"Already fasting" VoiceOver announcement is factually wrong.** See States → Already fasting above. The fix is straightforward in principle — move the announcement after the `startFastFromShortcut` no-op check resolves, or branch the copy on the result — but it touches the fire-and-forget architecture (`HandleSiriDeepLinks` announces before Today even mounts), so it isn't a one-line change.
- **`start_fast` double-fires `siri_action_invoked`.** See Analytics above and Open product questions below.

## Parity

iOS-only feature by design. The web app does not register the `suppr://` scheme. The shared pure helpers (parser, builder, snapshot) live in `src/lib/nutrition/` so the schema stays owned in one place.

## Deferred / follow-up

- **Native iOS widget extension — blocked, not just deferred.** An earlier version of this doc (and the `widgetSnapshot.ts` code header it was drawn from) claimed the snapshot file is "readable via the App Group once wired." That's wrong. `getWidgetSnapshotFilePath()` (`apps/mobile/lib/widgetSnapshot.ts`) resolves to `FileSystem.documentDirectory` — the app's own private sandbox — not the shared App Group container (`group.com.supprclub.supprapp`, declared in `apps/mobile/app.json` under `iosAppGroupIdentifier`, but created for `expo-share-intent`'s import share sheet, not this widget). A `WidgetKit` extension can only read files inside its App Group container; it has no access to another target's private `documentDirectory`. So even once a native widget target exists, it could not read this file as currently written — the write target itself has to change (to the App Group container path, via `expo-file-system`'s App Group support or an equivalent native bridge) before "no new JS work required for the render" is true. Until that's fixed, the pre-staged snapshot plumbing doesn't actually de-risk the eventual widget build; treat it as a known-wrong assumption, not banked progress. The code comment in both `apps/mobile/lib/widgetSnapshot.ts` and `src/lib/nutrition/widgetSnapshot.ts` carries the same inaccurate claim and needs the same correction.
- **`react-native-siri-shortcut` donation.** Installing that library (native code) would let us donate each shortcut so they appear in the Shortcuts app automatically without the user pasting a URL. Behaviour is identical to the URL path once they're donated.
- **"Already fasting" confirmation.** See Known issues above — this is a real bug, not a deferred nice-to-have.
- **Android parity.** Android has the Assistant + App Shortcuts, but this feature is iOS-only today.

## Open product questions

**Whether the native widget extension ships for the current launch or stays indefinitely deferred is undecided.** If it ends up indefinitely deferred, the "coming next" framing in `docs/user/shortcuts-and-widgets.md` (which walks through full add-a-widget steps) overstates how imminent the feature is, and `widget_snapshot_updated` firing on every Today change with zero consumers should be gated off or removed rather than left running.

**Whether the `start_fast` double-fire of `siri_action_invoked` is intentional or a bug is unresolved.** The second fire (`TodayScreen.tsx`) carries `hours`; the first (`_layout.tsx`) doesn't. If the intent is to capture `hours` on this event, the cleaner fix is to drop the parse-time fire and keep only the flush-time one — which also only fires after the no-op check, so it wouldn't double-count no-op invocations.
