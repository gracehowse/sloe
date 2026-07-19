# Shortcuts and Widgets

Log water, start a fast, or check today's remaining calories and macros —
all without opening Sloe or tapping through the app. You can set this up in
a couple of minutes using Siri, the Shortcuts app, or the iPhone Action
Button.

This guide is for iPhone users. It covers the three quick-action links you
can add to your phone, how to set them up, what happens when you use them,
and what to do if something isn't working. Sloe doesn't have a Home Screen
or Lock Screen widget yet — see "Home Screen and Lock Screen widgets" below
for what that means.

## What you can do

These are the three actions people most want to log without unlocking
their phone and hunting for the app: a glass of water, the start of a fast,
or a quick "how am I doing today" check.

| What you want to do | Link to paste |
|---|---|
| Log 250 ml of water | `suppr://log/water?ml=250` |
| Log a custom amount of water | `suppr://log/water?ml=500` (any amount from 1 to 5,000 ml) |
| Start a 16-hour fast | `suppr://fast/start?hours=16` |
| Start a fast of a different length | `suppr://fast/start?hours=18` (any length from 1 to 48 hours) |
| See today's remaining calories and macros | `suppr://today/remaining` |

You'll notice these links start with `suppr://` rather than `sloe://`.
That's simply left over from before the app was renamed from Suppr to
Sloe — it doesn't affect anything, and you'll only ever need to copy and
paste the link once, when you set up your shortcut.

All three work whether Sloe is closed or already open. If Sloe was running
in the background, it comes to the front and finishes your request as soon
as the Today screen has loaded.

## Setting up a shortcut

1. Open the **Shortcuts** app on your iPhone.
2. Tap **+** in the top-right corner to create a new shortcut.
3. Tap **Add Action** and search for **Open URL**.
4. Paste one of the links from the table above.
5. Tap the shortcut's name at the top and give it a clear name — for
   example, "Log water (250 ml)", "Start 16 h fast", or "How much left
   today?"
6. If you'd like to trigger it with your voice, tap the **(i)** button at
   the bottom and turn on **Use with Siri**. You can also turn on **Add to
   Home Screen** if you'd like a tappable icon for it.
7. Tap **Done**.

You can create as many of these as you like — "Log 500 ml water", "Log
100 ml water", "Start 18 h fast", and so on. Each one is just a different
link.

**Siri only responds to shortcuts you've set up yourself.** Sloe doesn't
teach Siri anything automatically — there's no "Hey Siri, log water" out of
the box. Siri only recognises the exact phrase after you've created the
shortcut, named it, and turned on **Use with Siri** (step 6 above). Skip
that step, and saying "Hey Siri" about water or fasting won't do anything.

## What happens when you use one

- **Log water** — adds that amount to today's hydration total. If you have
  VoiceOver turned on, Sloe reads the amount back to you out loud ("Logged
  250 millilitres of water"), so you get confirmation even with the screen
  off.
- **Start a fast** — begins a new fasting session right away, for however
  many hours you chose. If you're already fasting, nothing happens — Sloe
  never starts a second fast on top of one that's already running.
- **See today's remaining** — opens Sloe straight to the Today screen, so
  you can see your calorie ring and remaining macros at a glance.

## Home Screen and Lock Screen widgets — not available yet

Sloe doesn't have a widget yet. If you long-press your Home Screen and
search for Sloe in the widget picker, you won't find one — it simply
hasn't been built.

This is something we'd like to add in future, though we don't have a date
to share yet. Adding it, once it exists, will work the same way any iPhone
widget does: long-press an empty spot on your Home Screen, tap **+** in the
top corner, search for **Sloe**, choose a size, and tap **Add Widget**.
Tapping it would take you to Today — the same place the "remaining" link
above opens. Think of that as a preview of what's coming, not something you
can do today.

## Troubleshooting

- **The shortcut doesn't do anything.** Make sure you have the latest
  version of Sloe installed — this feature needs a recent update of the
  app.
- **My water didn't show up.** Open Sloe — the amount is added as soon as
  the Today screen loads. If you ran the shortcut but didn't open Sloe
  again for a while (more than about 5 minutes), the log is quietly
  skipped rather than applied late, so you don't end up with an entry that
  looks like it just happened when it didn't. If that happens, just run
  the shortcut again.
- **My fast didn't start.** This usually means you're already fasting —
  Sloe won't stack a second fast on top of one that's already running. End
  your current fast from the Fasting screen, then try again.
- **VoiceOver didn't say anything.** Check that your iPhone is unlocked and
  VoiceOver is turned on. The spoken confirmation is a nice-to-have — what
  actually gets logged in the app is what counts, whether or not you heard
  it announced.
- **"Hey Siri, log water" doesn't do anything.** You haven't created and
  named that shortcut yet, or you didn't turn on **Use with Siri** when you
  made it — see "Setting up a shortcut" above. Siri never logs anything on
  its own; it only runs shortcuts you've built yourself.
- **I can't find a Sloe widget.** That's expected for now — see "Home
  Screen and Lock Screen widgets" above. There's nothing to add yet.

## Want to learn more?

- [Getting started with Sloe](./getting-started.md) — the basics these
  shortcuts skip past
- [How your calorie target works](./how-your-calorie-target-works.md) —
  what "today's remaining" actually means
