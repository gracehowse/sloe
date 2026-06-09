# Overnight / unattended Claude Code runs

**Problem this solves.** You set Claude a big task before bed and wake up to find
it stopped halfway — not crashed, not waiting on a permission prompt, just
_ended early_ with a tidy summary while three steps remained. Root cause:
nothing external checks Claude's own "I'm done" judgement, so on a long task it
quits too generously.

**Fix.** A `Stop` hook (`scripts/overnight-guard.sh`) that, **only while an
overnight run is armed**, refuses every attempt to end the turn and feeds back
"resume — you have not confirmed completion." Claude can only stop by proving
it: writing a `done` sentinel (after the done-definition is met), flagging a
real `blocked`, or exhausting a bounded continuation cap.

This is the same hook _type_ as `auto-push-on-stop.sh`, which already pushes
`claude/*` commits when a turn ends. Both are wired in `.claude/settings.json`.

## Use it

```bash
# 1. Arm the run (note the `--`, and bake in YOUR definition of done):
npm run overnight -- "Finish ENG-997 frost migration. Done = implemented, tests pass, docs updated, web/mobile parity checked, npm run ci green, committed."

# 2. Paste the SAME task into the Claude Code desktop app and let it run.
```

In the morning, check `.claude/overnight/`:

| File             | Meaning                                                            |
| ---------------- | ----------------------------------------------------------------- |
| `done`           | Finished and confirmed against the done-definition.               |
| `blocked`        | Hit something only you can decide — the reason is inside.         |
| `INCOMPLETE.txt` | Ran out of continuations. Raise the cap and re-run.               |
| _(none)_         | Still running, or you closed the app / the Mac slept.             |

Disarm early at any time:

```bash
npm run overnight:stop      # or:  rm -f .claude/overnight/active
```

## Knobs

- **Continuation cap** — default `8`. Raise for very long tasks:
  ```bash
  CLAUDE_CODE_OVERNIGHT_CAP=16 npm run overnight -- "…"
  ```
  Claude Code may also enforce its own built-in cap on consecutive stop-hook
  blocks; if runs still stop after ~8 continuations, also set
  `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` in your environment.
- **Mac stays awake** — `overnight` runs `caffeinate` for up to 10h so a
  sleeping laptop can't freeze the run. `overnight:stop` releases it.

## Safety design

- **Inert unless armed.** No `active` sentinel → the hook exits 0 immediately.
  Normal interactive sessions are completely unaffected.
- **Fails open.** Every uncertain path (missing dir, unreadable counter, no
  `python3`) exits 0 — i.e. _lets Claude stop_. A bug in the guard can never
  trap you in a session that refuses to end.
- **Bounded.** The cap caps token spend; it can't loop forever.
- **Never silent.** Running out of continuations writes `INCOMPLETE.txt` with
  the original task, so the morning always has a record.

## When to reach for something else

- **`/loop` (self-paced)** — for very long multi-hour grinds. Each loop tick is
  a fresh turn (not subject to the stop-block cap), but it needs the app open
  and the Mac awake. Good companion to the guard, not a replacement.
- **Cloud routine / scheduled remote agent** (`/schedule`) — the most robust
  for _truly_ unattended work: it runs on Anthropic's infrastructure, so your
  machine can be asleep or off entirely. Bigger workflow change; reach for it
  when babysitting a local run stops being worth it.

## State directory

`.claude/overnight/` is gitignored (machine-/run-specific). Files: `active`
(armed + task text), `iter` (continuation counter), `caffeinate.pid`, and the
breadcrumbs above.
