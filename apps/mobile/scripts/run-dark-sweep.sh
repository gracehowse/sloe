#!/bin/bash
# Wrapper for the premium-bar dark sweep that ENFORCES the prerequisite
# the flow's header comment describes (set sim appearance to dark before
# running, restore light after).
#
# Background: the flow `apps/mobile/.maestro/00z_premium_bar_dark.yaml`
# relies on `xcrun simctl ui booted appearance dark` having been run
# first — Mobile Suppr's ThemeProvider defaults to `auto` and follows
# the sim appearance. If a runner forgets that prep step (as happened
# 2026-05-17), the flow runs without erroring and captures LIGHT-mode
# screenshots into files named `dark-*.png`. Silent failure.
#
# This wrapper makes the prep step part of the run.
#
# Usage (from repo root):
#   npm run mobile:test:dark-sweep
#
# Or directly:
#   apps/mobile/scripts/run-dark-sweep.sh
#
# Requirements: a booted iOS sim with the Suppr app installed + Metro
# running. The wrapper does not start them — it only handles appearance.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
FLOW=".maestro/00z_premium_bar_dark.yaml"

# Locate maestro binary — common install path is ~/.maestro/bin/maestro,
# may also be on PATH.
MAESTRO_BIN="${MAESTRO_BIN:-}"
if [ -z "$MAESTRO_BIN" ]; then
  if command -v maestro >/dev/null 2>&1; then
    MAESTRO_BIN="$(command -v maestro)"
  elif [ -x "$HOME/.maestro/bin/maestro" ]; then
    MAESTRO_BIN="$HOME/.maestro/bin/maestro"
  else
    echo "ERROR: maestro CLI not found. Install via curl -Ls 'https://get.maestro.mobile.dev' | bash" >&2
    exit 1
  fi
fi

# Verify a sim is booted.
BOOTED=$(xcrun simctl list devices booted 2>/dev/null | grep -c "Booted" || true)
if [ "$BOOTED" -lt 1 ]; then
  echo "ERROR: no iOS simulator booted. Boot one first (open Xcode → Simulator, or 'npm run ios:simulator')." >&2
  exit 1
fi

echo "[dark-sweep] Setting sim appearance to dark..."
xcrun simctl ui booted appearance dark

# Restore light on exit so the next test run isn't surprised.
trap 'echo "[dark-sweep] Restoring sim appearance to light..."; xcrun simctl ui booted appearance light' EXIT

echo "[dark-sweep] Running Maestro flow: $FLOW"
cd "$MOBILE_DIR"
"$MAESTRO_BIN" test "$FLOW"

echo "[dark-sweep] Done. Captures in apps/mobile/screenshots/latest/dark-*.png"
