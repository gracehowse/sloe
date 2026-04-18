# Shortcuts and Widgets

**Audience:** End Users (iOS)

Suppr exposes three deep-link URLs so you can log water, start a fast, or jump to Today's remaining macros from anywhere on iOS — Siri voice, the Shortcuts app, an Action Button, a Focus automation, or a Home-screen icon. A Home / Lock-screen widget shows your calorie ring and remaining macros at a glance.

## The three deep links

| What you want | URL |
|---|---|
| Log 250 ml of water | `suppr://log/water?ml=250` |
| Log a custom amount | `suppr://log/water?ml=500` (any value 1..5000) |
| Start a 16 h fast | `suppr://fast/start?hours=16` |
| Start a custom-length fast | `suppr://fast/start?hours=18` (any value 1..48) |
| Open Today's remaining | `suppr://today/remaining` |

All three work whether Suppr is closed or already open. If the app was backgrounded, it is brought to the foreground and the action is applied as soon as Today loads.

## Add a shortcut to the Shortcuts app

1. Open the **Shortcuts** app on iPhone.
2. Tap **+** in the top-right to create a new shortcut.
3. Tap **Add Action** and search for **Open URL**.
4. Paste one of the URLs from the table above.
5. Tap the shortcut name at the top and rename it — e.g. "Log water (250 ml)", "Start 16 h fast", "How much left today?".
6. Optionally tap the **(i)** button at the bottom and toggle **Add to Home Screen** or **Use with Siri** so you can say *"Hey Siri, log water"* to trigger it.
7. Tap **Done**.

You can create as many variations as you like — "Log 500 ml water", "Log 100 ml water", "Start 18 h fast", etc. Each one is just a different URL.

## What happens when you run one

- **Log water** — adds the specified volume to today's hydration card. An accessibility announcement confirms the amount ("Logged 250 millilitres of water") so VoiceOver users hear the confirmation even without the screen on.
- **Start fast** — begins a new fasting session right now, using the number of hours you passed. If a fast is already active it is a no-op (we never stack two fasts).
- **Today remaining** — opens Suppr to the Today tab so you can see your calorie ring and remaining macros.

## Home / Lock-screen widget (coming next)

When Suppr's iOS widget extension ships, you will be able to add a calorie-ring + remaining-macros widget to your Home screen and Lock screen:

1. Long-press an empty spot on the Home screen → **+** in the top-left.
2. Search for **Suppr**.
3. Choose a size — small shows the calorie ring and kcal remaining; medium adds protein / carbs / fat; a lock-screen variant shows the fasting countdown when a fast is active.
4. Tap **Add Widget**, then **Done**.

Tapping the widget opens Today (same behaviour as `suppr://today/remaining`).

The widget snapshot is refreshed whenever you log a meal, change a target, or start/end a fast. If you're offline the widget shows the last-known numbers and a subtle "updated at …" timestamp.

## Troubleshooting

- **Shortcut does nothing.** Make sure you installed the dev / TestFlight build that understands the `suppr://` scheme. The App Store build added the scheme in Batch 5.12.
- **Water didn't appear.** Open Suppr — the action is applied as soon as Today loads. If the app was woken from a long background pause (>5 min) the queued action is discarded to avoid surprise logs.
- **Fast didn't start.** You are already fasting. Suppr never stacks a second session on top of an active one. End the current fast from the Fasting screen first.
- **VoiceOver didn't announce.** Confirm the system is unlocked and VoiceOver is on. The announcement is a best-effort hint; the on-screen toast / card is the source of truth.
