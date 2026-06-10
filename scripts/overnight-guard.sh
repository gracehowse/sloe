#!/usr/bin/env bash
# Stop-hook: keep an UNATTENDED OVERNIGHT run going until the work is actually
# finished — instead of letting Claude quit early with a tidy summary.
#
# Why: the common overnight failure is NOT a crash, a sleep, or a permission
# prompt — it is Claude deciding it is "done" three steps early and ending the
# turn. By morning a half-done run looks identical to a finished one. This hook
# makes "done" an EXTERNAL gate: while a run is armed (scripts/overnight.sh),
# every attempt to stop is refused and fed back as "resume — you have not
# confirmed completion", until Claude either
#   (a) writes the done sentinel    -> it asserts completion against the contract,
#   (b) writes the blocked sentinel -> it genuinely needs a human decision, or
#   (c) hits the continuation cap   -> bounded, so it can never loop forever.
#
# Safety design (mirrors auto-push-on-stop.sh — never get in Claude's way):
# - Does NOTHING unless a run is explicitly armed (no `active` sentinel ->
#   exit 0). Normal interactive sessions are entirely unaffected.
# - Fails OPEN on every uncertain path (missing dir, unreadable counter, no
#   python, anything odd) -> exit 0 -> Claude is allowed to stop. A bug here
#   can never trap you in a session that refuses to end.
# - Hard continuation cap (CLAUDE_CODE_OVERNIGHT_CAP, default 8) bounds the
#   token blast radius.
# - On the final allowed stop it disarms itself and releases the awake-lock,
#   but KEEPS any breadcrumb (done / blocked / INCOMPLETE.txt) for the morning.

set -uo pipefail

# Drain stdin (the hook is fed JSON) so we never SIGPIPE the caller.
cat >/dev/null 2>&1 || true

PROJECT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
[ -n "${PROJECT:-}" ] || exit 0
STATE="$PROJECT/.claude/overnight"

# Not armed -> never interfere.
[ -f "$STATE/active" ] || exit 0

disarm() {
  # Release the awake-lock if we started one, then stop the guard firing.
  # We remove ONLY `active` (+ the pid file) so breadcrumbs survive the night.
  if [ -f "$STATE/caffeinate.pid" ]; then
    kill "$(cat "$STATE/caffeinate.pid" 2>/dev/null)" >/dev/null 2>&1 || true
    rm -f "$STATE/caffeinate.pid" >/dev/null 2>&1 || true
  fi
  rm -f "$STATE/active" >/dev/null 2>&1 || true
}

# Claude declared completion, or flagged a genuine human-needed blocker.
if [ -f "$STATE/done" ] || [ -f "$STATE/blocked" ]; then
  disarm
  exit 0
fi

CAP="${CLAUDE_CODE_OVERNIGHT_CAP:-8}"
case "$CAP" in (*[!0-9]*|'') CAP=8 ;; esac

ITER=0
[ -f "$STATE/iter" ] && ITER="$(cat "$STATE/iter" 2>/dev/null || echo 0)"
case "$ITER" in (*[!0-9]*|'') ITER=0 ;; esac   # corrupt counter -> fail open-ish

if [ "$ITER" -ge "$CAP" ]; then
  # Out of continuations. Leave a breadcrumb so the morning is never silent.
  {
    echo "Overnight run stopped after $ITER continuations (cap $CAP) WITHOUT"
    echo "writing the done sentinel — the task was NOT confirmed complete."
    echo
    echo "Task was:"
    cat "$STATE/active" 2>/dev/null || true
  } > "$STATE/INCOMPLETE.txt" 2>/dev/null || true
  disarm
  exit 0
fi

ITER=$((ITER + 1))
echo "$ITER" > "$STATE/iter" 2>/dev/null || true

TASK="$(cat "$STATE/active" 2>/dev/null || echo '(task text unavailable)')"

REASON="UNATTENDED OVERNIGHT RUN — do not stop yet (continuation ${ITER}/${CAP}).

You tried to end the turn. Resume and carry the task FULLY to completion.

If the TASK below states its own definition of done (e.g. a 'Done =' line), that is authoritative — satisfy exactly that. Otherwise the standard Suppr bar applies, and the task is complete only when ALL are true:
  1. Implementation done.
  2. Tests written/updated and passing.
  3. Documentation updated.
  4. Web/mobile parity checked.
  5. \`npm run ci\` passes.
  6. Work committed (the Stop hook auto-pushes claude/* branches).

When ALL are true, run this then stop:   touch \"${STATE}/done\"
If you are GENUINELY blocked and cannot proceed without a human decision, write the reason then stop:   echo 'why' > \"${STATE}/blocked\"
Do NOT invent a blocker to escape early — only a real one counts.

TASK:
${TASK}"

# JSON-encode the reason safely (python3 ships on macOS). Fall back to a plain
# block instruction if python is somehow unavailable — still keeps Claude going.
python3 - "$REASON" <<'PY' 2>/dev/null || printf '%s' '{"decision":"block","reason":"Resume the overnight task — you have not confirmed completion. Write the done sentinel in .claude/overnight/done when truly finished."}'
import json, sys
print(json.dumps({"decision": "block", "reason": sys.argv[1]}))
PY

exit 0
