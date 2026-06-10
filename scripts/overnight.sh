#!/usr/bin/env bash
# Arm an unattended overnight Claude Code run.
#
# After this, the Stop-hook guard (scripts/overnight-guard.sh) refuses to let
# Claude quit until it confirms completion (writes the done sentinel), flags a
# real blocker, or exhausts the continuation cap. It also keeps the Mac awake
# so a sleeping laptop can't freeze the run.
#
# Usage (note the `--` so npm passes the task through):
#   npm run overnight -- "Finish ENG-997 frost migration. Done = implemented, \
#       tests pass, docs updated, web/mobile parity checked, npm run ci green, committed."
#
# Then paste the SAME task into the Claude Code desktop app and let it run.
#
# Disarm early at any time:   npm run overnight:stop
#
# See docs/runbooks/overnight-unattended-runs.md for the full picture.

set -uo pipefail

PROJECT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE="$PROJECT/.claude/overnight"

TASK="$*"
if [ -z "${TASK// /}" ]; then
  echo "usage: npm run overnight -- \"<task description, including your definition of done>\"" >&2
  exit 1
fi

mkdir -p "$STATE"
printf '%s\n' "$TASK" > "$STATE/active"
echo 0 > "$STATE/iter"
rm -f "$STATE/done" "$STATE/blocked" "$STATE/INCOMPLETE.txt"

CAP="${CLAUDE_CODE_OVERNIGHT_CAP:-8}"

# Keep the Mac awake for up to 10h (idle + disk + system-on-AC), backgrounded.
AWAKE="caffeinate not found — set System Settings > Energy to never sleep"
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -i -m -s -t 36000 &
  echo $! > "$STATE/caffeinate.pid"
  AWAKE="yes, up to 10h (pid $(cat "$STATE/caffeinate.pid"))"
fi

cat <<EOF
────────────────────────────────────────────────────────────
 Overnight guard ARMED  ✔
   • Continuation cap : ${CAP}   (override with CLAUDE_CODE_OVERNIGHT_CAP)
   • Mac kept awake   : ${AWAKE}
   • State dir        : ${STATE}

 NEXT → paste the SAME task into the Claude Code desktop app and let it run.
 The guard refuses every early stop until Claude writes:
     ${STATE}/done

 In the morning, check ${STATE} :
   • done            → finished and confirmed against the done-definition
   • blocked         → it hit something only you can decide (reason inside)
   • INCOMPLETE.txt  → it ran out of continuations (raise the cap & re-run)

 Disarm any time:   npm run overnight:stop
────────────────────────────────────────────────────────────
EOF
