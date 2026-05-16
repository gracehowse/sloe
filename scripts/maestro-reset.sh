#!/usr/bin/env bash
# maestro-reset.sh — bring the iOS sim + Maestro driver to a clean state.
#
# Why: Maestro leaves `maestro-driver-iosUITests-Runner` and an `xcodebuild`
# child running between sessions. Old runs (sometimes days old) hold the
# iOS test driver and silently conflict with new `maestro test` calls —
# steps either hang or skip-with-no-error. Running this at the start of
# every Maestro session guarantees a fresh driver.
#
# What it does:
#   1. Kills stale Maestro Java / driver / xcodebuild processes owned by $USER.
#   2. Terminates the Suppr app on the booted sim.
#   3. Ensures the requested sim is booted (default: iPhone 17 Pro on iOS 26.4).
#   4. Reads `.maestro/.metro-state` (written by `maestro-worktree-up.sh`)
#      to learn the port for THIS worktree's Metro. If no state file is
#      present, falls back to default :8081 (main-clone Metro).
#   5. Verifies Metro is reachable on the resolved port.
#   6. `openurl exp://127.0.0.1:<port>` to make the dev client load JS
#      from THIS worktree's Metro (not whichever was last connected).
#   7. Prints a single READY/NOT_READY line so callers can grep.
#
# Safe to run repeatedly. Does NOT touch processes owned by other users.
# Does NOT uninstall the app (use `xcrun simctl uninstall <udid> <bundle>`
# manually if you need to wipe install state).

set -euo pipefail

SIM_NAME="${MAESTRO_SIM:-iPhone 17 Pro}"
BUNDLE_ID="com.supprclub.supprapp"

# Worktree root = parent of scripts/. Used to find .maestro/.metro-state.
SCRIPT_DIR_RESET="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT_RESET="$(cd "$SCRIPT_DIR_RESET/.." && pwd)"
STATE_FILE_RESET="$WORKTREE_ROOT_RESET/.maestro/.metro-state"

# Resolve Metro port: state file (worktree-up wrote it) > default 8081.
if [[ -f "$STATE_FILE_RESET" ]]; then
  # shellcheck disable=SC1090
  METRO_PORT=$(grep -E "^PORT=" "$STATE_FILE_RESET" | cut -d= -f2)
  METRO_URL=$(grep -E "^URL=" "$STATE_FILE_RESET" | cut -d= -f2)
  echo "[maestro-reset] using worktree Metro state: PORT=$METRO_PORT URL=$METRO_URL"
else
  METRO_PORT=8081
  METRO_URL="exp://127.0.0.1:8081"
  echo "[maestro-reset] no .maestro/.metro-state — defaulting to main-clone Metro on :8081"
fi

echo "[maestro-reset] killing stale Maestro / driver / xcodebuild PIDs owned by $USER…"
# Match only $USER-owned processes. Use pkill with -u to scope.
# -f matches the full command line. Errors (no matches) are silenced.
pkill -u "$USER" -f "maestro-driver-iosUITests-Runner" 2>/dev/null || true
pkill -u "$USER" -f "maestro.cli.AppKt" 2>/dev/null || true
pkill -u "$USER" -f "maestro_xctestrunner_xcodebuild_output" 2>/dev/null || true
# Wait long enough for SIGTERM to propagate (Java + xcodebuild can take
# a couple of seconds to actually exit). 3s empirically clears the
# "leftover PID" false-positive that 1s produced.
sleep 3
LEFTOVER=$(pgrep -u "$USER" -f "maestro-driver-iosUITests-Runner|maestro.cli.AppKt" 2>/dev/null || true)
if [[ -n "$LEFTOVER" ]]; then
  echo "[maestro-reset] WARN: leftover PIDs after pkill+wait: $LEFTOVER"
fi

# Parse the booted device list. BSD awk on macOS doesn't support the
# 3-arg form of match(), so we use grep + sed which work everywhere.
# A booted device line looks like:
#   "    iPhone 17 Pro (29EFB5A5-768B-48E0-A1AA-E9B2D86E2AC4) (Booted)"
# `|| true` on each pipeline keeps `set -e` happy when grep finds nothing.
echo "[maestro-reset] ensuring sim '$SIM_NAME' is booted…"
BOOTED_UDID=$(xcrun simctl list devices booted 2>/dev/null | { grep -F "$SIM_NAME" || true; } | { sed -nE 's/.*\(([0-9A-F-]+)\) \(Booted\).*/\1/p' || true; } | head -1)
if [[ -z "$BOOTED_UDID" ]]; then
  TARGET_UDID=$(xcrun simctl list devices 2>/dev/null | { grep -F "$SIM_NAME" || true; } | { grep -F "Shutdown" || true; } | { sed -nE 's/.*\(([0-9A-F-]+)\) \(Shutdown\).*/\1/p' || true; } | head -1)
  if [[ -z "$TARGET_UDID" ]]; then
    echo "[maestro-reset] FATAL: no sim named '$SIM_NAME' found"
    echo "NOT_READY"
    exit 1
  fi
  echo "[maestro-reset] booting sim $TARGET_UDID…"
  xcrun simctl boot "$TARGET_UDID"
  xcrun simctl bootstatus "$TARGET_UDID" -b
  BOOTED_UDID="$TARGET_UDID"
fi
open -a Simulator >/dev/null 2>&1 || true

echo "[maestro-reset] terminating $BUNDLE_ID on $BOOTED_UDID (if running)…"
xcrun simctl terminate "$BOOTED_UDID" "$BUNDLE_ID" 2>/dev/null || true

echo "[maestro-reset] checking Metro on :$METRO_PORT…"
if curl -s --max-time 2 "http://localhost:$METRO_PORT/status" 2>/dev/null | grep -q "packager-status:running"; then
  METRO_STATE="up"
else
  METRO_STATE="down"
fi
echo "[maestro-reset] metro=$METRO_STATE sim_udid=$BOOTED_UDID bundle=$BUNDLE_ID"

if [[ "$METRO_STATE" != "up" ]]; then
  echo "[maestro-reset] WARN: Metro is not running on :$METRO_PORT — run 'npm run maestro:worktree-up' (or 'npm run mobile:dev') first."
  echo "NOT_READY"
  exit 1
fi

# Point the dev client at THIS Metro before the next launchApp. The
# Expo dev client honours the last-opened URL, but the canonical way
# to load a specific Metro is via the dev-client deep link:
#   exp+<scheme>://expo-development-client/?url=<urlencoded-http-url>
# `exp://127.0.0.1:<port>` lands on the launcher when the URL hasn't
# been opened before; the deep-link form auto-connects. Suppr's
# scheme is `suppr` (apps/mobile/app.json).
DEV_CLIENT_URL="exp+suppr://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A$METRO_PORT"
echo "[maestro-reset] openurl → $DEV_CLIENT_URL"
xcrun simctl openurl "$BOOTED_UDID" "$DEV_CLIENT_URL" 2>/dev/null || true
# The openurl LAUNCHES the app and tells the dev client to connect to
# our Metro. From here, Maestro should NOT call `launchApp stopApp: true`
# (which would kill the dev-client + lose the connection). Use plain
# `launchApp` (no stop) or skip it entirely. Brief settle so the dev
# client has a moment to bundle + render before Maestro proceeds.
sleep 2

echo "READY"
