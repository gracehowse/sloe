#!/usr/bin/env bash
# maestro-worktree-up.sh — bring this worktree's Metro online for Maestro.
#
# Why: agents work in git worktrees so branches stay isolated. Metro
# can only watch ONE working tree at a time. If the agent edits the
# worktree but Metro is watching the main clone, the sim runs JS that
# doesn't have the agent's changes — and Maestro flows fail at
# `assertVisible` / `scrollUntilVisible` for the elements under test
# even though the source has them.
#
# This script makes each worktree run its own Metro on a deterministic
# port, so the worktree IS the source of truth for the running JS.
#
# What it does:
#   1. Locates the worktree root (script lives at scripts/, so root is
#      one level up).
#   2. Computes a stable port from the worktree path hash so multiple
#      worktrees can have concurrent Metro instances. Main clone
#      remains on default 8081.
#   3. Ensures `apps/mobile/node_modules` exists in the worktree. If
#      missing and the worktree's `apps/mobile/package.json` matches
#      the main clone's, symlinks from main clone for speed (~1s).
#      Otherwise runs `npm install --prefer-offline` (~30s+).
#   4. Kills any process holding the target port.
#   5. Starts `npx expo start --port <port>` in background, redirected
#      to .maestro/.metro.log.
#   6. Polls /status until ready, then writes `.maestro/.metro-state`
#      with port + PID + URL for downstream scripts.
#   7. Prints `READY METRO_PORT=<port> METRO_URL=exp://127.0.0.1:<port>`
#      so callers can grep.
#
# Reusable: re-running the script when Metro is already up on the
# right port is a no-op (detects existing PID via state file).

set -euo pipefail

# Resolve worktree root (one level up from scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKTREE_ROOT"

MAIN_CLONE="${MAIN_CLONE:-/Users/graceturner/Suppr-1}"
MOBILE_DIR="$WORKTREE_ROOT/apps/mobile"
STATE_DIR="$WORKTREE_ROOT/.maestro"
STATE_FILE="$STATE_DIR/.metro-state"
LOG_FILE="$STATE_DIR/.metro.log"

mkdir -p "$STATE_DIR"

# 1. Port: deterministic from worktree path. Main clone (WORKTREE_ROOT
#    == MAIN_CLONE) keeps the standard 8081 so existing flows / sim
#    history work; worktrees pick a port in 8082-8131.
if [[ "$WORKTREE_ROOT" == "$MAIN_CLONE" ]]; then
  METRO_PORT=8081
else
  # md5 the path, take first 4 hex chars → 16-bit number → mod 50.
  HASH_HEX=$(printf '%s' "$WORKTREE_ROOT" | md5 | cut -c1-4)
  HASH_NUM=$((16#$HASH_HEX))
  METRO_PORT=$((8082 + HASH_NUM % 50))
fi
METRO_URL="exp://127.0.0.1:$METRO_PORT"
echo "[worktree-up] worktree=$WORKTREE_ROOT port=$METRO_PORT"

# 2a. .env.local (worktree root): secrets-bearing file (Supabase URL +
#     service role key, E2E creds). Worktrees don't get it from git
#     checkout. Symlink it from the main clone so the seed script + the
#     web dev server pick it up.
if [[ "$WORKTREE_ROOT" != "$MAIN_CLONE" ]] && [[ ! -e "$WORKTREE_ROOT/.env.local" ]] && [[ -f "$MAIN_CLONE/.env.local" ]]; then
  echo "[worktree-up] no .env.local in worktree — symlinking from main clone"
  ln -s "$MAIN_CLONE/.env.local" "$WORKTREE_ROOT/.env.local"
fi

# 2a-bis. EXPO_PUBLIC_FLAG_FORCE_* overrides live in repo-root `.env.local`
#         only (apps/mobile loads it via scripts/load-repo-env.cjs).
#         Do not create apps/mobile/.env.local — npm run env:doctor fails if present.

# 2b. node_modules: needs to be REAL (not a symlink) AND bit-identical
#     to main clone's tree. Two facts forced this approach:
#       (a) Metro's default resolver doesn't follow symlinks — errors
#           with "Unable to resolve module ./apps/mobile/node_modules
#           /expo-router/entry" if node_modules is a symlink.
#       (b) The Suppr.app binary on the sim was built against main
#           clone's exact dep versions. `npm install --prefer-offline`
#           may resolve transitive deps slightly differently than the
#           lockfile, producing a JS bundle whose codegen expectations
#           mismatch the binary — e.g. "Unable to determine event
#           arguments for 'onModeChange'" on VirtualViewNativeComponent
#           (RN New Architecture codegen). Even `npm ci` can drift
#           because npm cache and registry indexes shift over time.
#     The most reliable + fastest answer is `cp -R` from main clone.
#     ~5–10s on SSD, guaranteed byte-identical, no network. Disk cost
#     ~760MB per worktree, which is acceptable for the agent loop.
if [[ -L "$MOBILE_DIR/node_modules" ]]; then
  echo "[worktree-up] node_modules is a symlink — removing (Metro can't resolve through it)"
  rm "$MOBILE_DIR/node_modules"
fi
if [[ ! -d "$MOBILE_DIR/node_modules" ]]; then
  if [[ ! -d "$MAIN_CLONE/apps/mobile/node_modules" ]]; then
    echo "[worktree-up] FATAL: main clone has no node_modules — run 'npm install' in $MAIN_CLONE/apps/mobile first"
    exit 1
  fi
  echo "[worktree-up] copying apps/mobile/node_modules from main clone (~5–10s, ~760MB)…"
  cp -R "$MAIN_CLONE/apps/mobile/node_modules" "$MOBILE_DIR/node_modules"
fi

# 3. Kill existing Metro on this port (if any) — only $USER processes.
EXISTING_PID=$(lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN -t -u "$USER" 2>/dev/null | head -1 || true)
if [[ -n "$EXISTING_PID" ]]; then
  # Reuse if the existing process belongs to this worktree.
  if [[ -f "$STATE_FILE" ]] && grep -q "^PID=$EXISTING_PID$" "$STATE_FILE" 2>/dev/null; then
    echo "[worktree-up] reusing existing Metro PID=$EXISTING_PID on :$METRO_PORT"
    echo "READY METRO_PORT=$METRO_PORT METRO_URL=$METRO_URL"
    exit 0
  fi
  echo "[worktree-up] port :$METRO_PORT held by PID=$EXISTING_PID owned by other worktree — terminating"
  kill "$EXISTING_PID" 2>/dev/null || true
  sleep 2
fi

# 4. Start Metro in background.
echo "[worktree-up] starting Metro on :$METRO_PORT (logs → $LOG_FILE)"
(
  cd "$MOBILE_DIR"
  # `nohup` keeps Metro alive after this script returns; redirect both
  # stdout + stderr to the log so we don't pollute the terminal.
  nohup npx expo start --port "$METRO_PORT" >"$LOG_FILE" 2>&1 &
  echo $! > "$STATE_DIR/.metro.pid.tmp"
)
METRO_PID=$(cat "$STATE_DIR/.metro.pid.tmp")
rm -f "$STATE_DIR/.metro.pid.tmp"

# 5. Wait for /status.
echo "[worktree-up] waiting for Metro to be ready…"
for i in $(seq 1 60); do
  if curl -s --max-time 2 "http://localhost:$METRO_PORT/status" 2>/dev/null | grep -q "packager-status:running"; then
    READY=1
    break
  fi
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    echo "[worktree-up] FATAL: Metro process $METRO_PID died — last 30 log lines:"
    tail -30 "$LOG_FILE"
    exit 1
  fi
  sleep 1
done

if [[ "${READY:-0}" != "1" ]]; then
  echo "[worktree-up] FATAL: Metro did not become ready in 60s — last 30 log lines:"
  tail -30 "$LOG_FILE"
  kill "$METRO_PID" 2>/dev/null || true
  exit 1
fi

# 6. Persist state.
cat > "$STATE_FILE" <<EOF
PORT=$METRO_PORT
PID=$METRO_PID
URL=$METRO_URL
WORKTREE=$WORKTREE_ROOT
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
echo "[worktree-up] state → $STATE_FILE"
echo "READY METRO_PORT=$METRO_PORT METRO_URL=$METRO_URL"
