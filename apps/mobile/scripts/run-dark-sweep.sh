#!/bin/bash
# Wrapper for the premium-bar dark sweep that ENFORCES the two prerequisites
# the flow needs to actually capture in dark mode.
#
# Two layers of "dark" need to be true simultaneously for captures to come
# out dark:
#
#   1. The iOS sim's system appearance must be dark.
#      Set via `xcrun simctl ui booted appearance dark`.
#
#   2. The Suppr app's stored theme preference (AsyncStorage key
#      `suppr_theme`) must be `"auto"` or `"dark"` — NOT `"light"`. The
#      app's ThemeProvider (apps/mobile/context/theme.tsx) overrides
#      system appearance when the stored preference is explicit.
#
# Pre-fix history:
#   - 2026-05-17 morning: ran the flow without prep — captures came out
#     light, saved as dark-*.png, audited as "done". 5 Linear issues
#     had to be re-opened.
#   - 2026-05-17 afternoon (v1 of this wrapper): handled #1 but missed
#     #2. Captures still came out light because the app had a stored
#     `suppr_theme=light` preference from prior testing.
#   - 2026-05-17 evening (this version): handles both layers, restores
#     both on exit.
#
# Usage (from repo root):
#   npm run mobile:test:dark-sweep
#
# Or directly:
#   apps/mobile/scripts/run-dark-sweep.sh
#
# Requirements: a booted iOS sim with the Suppr app installed + Metro
# running. The wrapper does not start them — it only handles appearance
# and AsyncStorage state.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
FLOW=".maestro/00z_premium_bar_dark.yaml"
APP_BUNDLE_ID="com.supprclub.supprapp"

# ─── Locate maestro binary ───────────────────────────────────────────
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

# ─── Verify sim booted ───────────────────────────────────────────────
BOOTED_COUNT=$(xcrun simctl list devices booted 2>/dev/null | grep -c "Booted" || true)
if [ "$BOOTED_COUNT" -lt 1 ]; then
  echo "ERROR: no iOS simulator booted. Boot one first (open Xcode → Simulator, or 'npm run ios:simulator')." >&2
  exit 1
fi

# ─── Layer 2: AsyncStorage suppr_theme — must be auto or dark ────────
APP_DATA="$(xcrun simctl get_app_container booted "$APP_BUNDLE_ID" data 2>/dev/null || true)"
if [ -z "$APP_DATA" ] || [ ! -d "$APP_DATA" ]; then
  echo "ERROR: Suppr app data container not found. Is the app installed on the booted sim?" >&2
  exit 1
fi

MANIFEST="$APP_DATA/Library/Application Support/$APP_BUNDLE_ID/RCTAsyncLocalStorage_V1/manifest.json"
ORIGINAL_THEME=""
MANIFEST_BACKED_UP=0

if [ -f "$MANIFEST" ]; then
  # Read the current value (or empty if not set). Strip surrounding quotes.
  ORIGINAL_THEME="$(python3 -c "
import json
try:
    d = json.load(open('$MANIFEST'))
    print(d.get('suppr_theme', ''))
except Exception:
    pass
" 2>/dev/null || true)"

  echo "[dark-sweep] AsyncStorage suppr_theme currently: '${ORIGINAL_THEME:-<not set>}'"

  if [ "$ORIGINAL_THEME" = "light" ]; then
    # Need to force it to auto so the sim appearance takes effect.
    cp "$MANIFEST" "$MANIFEST.dark-sweep-backup"
    MANIFEST_BACKED_UP=1
    python3 -c "
import json
d = json.load(open('$MANIFEST'))
d['suppr_theme'] = 'auto'
json.dump(d, open('$MANIFEST', 'w'))
"
    echo "[dark-sweep] Wrote suppr_theme=auto to AsyncStorage manifest (will restore '$ORIGINAL_THEME' on exit)."
  elif [ "$ORIGINAL_THEME" = "dark" ] || [ "$ORIGINAL_THEME" = "auto" ] || [ -z "$ORIGINAL_THEME" ]; then
    # Already in a state that respects sim appearance — no manifest change needed.
    echo "[dark-sweep] No manifest change needed (preference already respects system)."
  else
    echo "[dark-sweep] Unexpected suppr_theme value '$ORIGINAL_THEME'; not touching manifest."
  fi
else
  echo "[dark-sweep] No AsyncStorage manifest found yet (fresh install?) — relying on app default 'auto'."
fi

# ─── Layer 1: sim appearance ─────────────────────────────────────────
echo "[dark-sweep] Setting sim appearance to dark..."
xcrun simctl ui booted appearance dark

# ─── Restoration trap (runs in BOTH error + success exits) ───────────
restore() {
  echo "[dark-sweep] Restoring sim appearance to light..."
  xcrun simctl ui booted appearance light || true
  if [ "$MANIFEST_BACKED_UP" = "1" ] && [ -f "$MANIFEST.dark-sweep-backup" ]; then
    echo "[dark-sweep] Restoring AsyncStorage manifest (suppr_theme='$ORIGINAL_THEME')..."
    mv "$MANIFEST.dark-sweep-backup" "$MANIFEST"
  fi
}
trap restore EXIT

# ─── Force a fresh app launch so AsyncStorage is re-read ─────────────
# If the app is currently running with the old preference cached in
# memory, our manifest tweak won't take effect until next launch. Kill
# and let the Maestro flow's launchApp do the cold start.
echo "[dark-sweep] Terminating app for fresh AsyncStorage read on next launch..."
xcrun simctl terminate booted "$APP_BUNDLE_ID" 2>/dev/null || true

# ─── Run the flow ────────────────────────────────────────────────────
echo "[dark-sweep] Running Maestro flow: $FLOW"
cd "$MOBILE_DIR"
"$MAESTRO_BIN" test "$FLOW"

echo "[dark-sweep] Done. Captures in apps/mobile/screenshots/latest/dark-*.png"
echo "[dark-sweep] VERIFY: open one capture (e.g. dark-01-today-default.png) and confirm it's actually dark before declaring success."
