#!/usr/bin/env bash
# Disarm an overnight run early: stop the Stop-hook guard from blocking and
# release the Mac awake-lock. Safe to run any time; a no-op if nothing is armed.
set -uo pipefail
PROJECT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE="$PROJECT/.claude/overnight"

if [ -f "$STATE/caffeinate.pid" ]; then
  kill "$(cat "$STATE/caffeinate.pid" 2>/dev/null)" >/dev/null 2>&1 || true
  rm -f "$STATE/caffeinate.pid"
fi
rm -f "$STATE/active"
echo "Overnight guard disarmed. (Any breadcrumbs are kept in $STATE)"
