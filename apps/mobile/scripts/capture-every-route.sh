#!/bin/bash
# Capture every deeplinkable mobile route via simctl. No maestro
# dependency, no testID brittleness — just openURL + screenshot.
#
# 2026-04-30 (audit comprehensive coverage). Use this when the
# canonical maestro tour hangs on a missing testID, or to capture
# routes the maestro tour doesn't enumerate.
#
# Output: apps/mobile/screenshots/latest/route-*.png

set -e
SCREENSHOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/screenshots/latest"
mkdir -p "$SCREENSHOT_DIR"

# Guardrail (added 2026-04-30 after a silent failure): without Metro on
# :8081 the dev-client app sits on the Expo Dev Launcher and every
# `simctl openurl` lands on the launcher menu, not the real Suppr UI.
# Captures look populated but show identical launcher screens. Fail fast
# instead of producing 35 useless PNGs.
if ! lsof -nP -i :8081 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ Metro is not listening on :8081." >&2
  echo "  Start it before running this script:" >&2
  echo "    (cd apps/mobile && npx expo start --port 8081 --dev-client &)" >&2
  echo "  Then deeplink the dev client to localhost:" >&2
  echo "    xcrun simctl openurl booted 'exp+suppr://expo-development-client/?url=http://localhost:8081'" >&2
  exit 2
fi

# Lock status bar so captures stay deterministic
xcrun simctl status_bar booted override \
  --time "9:41" \
  --dataNetwork wifi \
  --wifiMode active \
  --wifiBars 3 \
  --cellularMode notSupported \
  --batteryState charged \
  --batteryLevel 100 2>/dev/null || true

cap() {
  local route="$1"
  local name="$2"
  echo "→ $name ($route)"
  xcrun simctl openurl booted "$route" 2>/dev/null
  sleep 2
  xcrun simctl io booted screenshot "$SCREENSHOT_DIR/route-$name.png" 2>/dev/null
}

# Tab roots
cap "suppr:///(tabs)" "tabs-today"
cap "suppr:///(tabs)/library" "tabs-library"
cap "suppr:///(tabs)/discover" "tabs-discover"
cap "suppr:///(tabs)/planner" "tabs-planner"
cap "suppr:///(tabs)/progress" "tabs-progress"
cap "suppr:///(tabs)/settings" "tabs-settings"
cap "suppr:///(tabs)/notifications" "tabs-notifications"
cap "suppr:///(tabs)/search" "tabs-search"

# Stack routes — top-level
cap "suppr:///shopping" "shopping"
cap "suppr:///profile" "profile"
cap "suppr:///targets" "targets"
cap "suppr:///weight-tracker" "weight-tracker"
cap "suppr:///fasting" "fasting"
cap "suppr:///health-sync" "health-sync"
cap "suppr:///household-settings" "household-settings"
cap "suppr:///cook" "cook"
cap "suppr:///create-recipe" "create-recipe"
cap "suppr:///import-shared" "import-shared"
cap "suppr:///nutrition-sources" "nutrition-sources"
cap "suppr:///paywall" "paywall"
cap "suppr:///whats-new" "whats-new"
cap "suppr:///burn-detail" "burn-detail"
cap "suppr:///meal-nutrition" "meal-nutrition"
cap "suppr:///notifications-prompt" "notifications-prompt"
cap "suppr:///recipe/verify" "recipe-verify"
cap "suppr:///login" "login"
cap "suppr:///onboarding-v2" "onboarding-v2-entry"
cap "suppr:///onboarding" "onboarding-legacy-entry"

# Macro detail per macro
cap "suppr:///macro-detail?macro=protein" "macro-detail-protein"
cap "suppr:///macro-detail?macro=carbs" "macro-detail-carbs"
cap "suppr:///macro-detail?macro=fat" "macro-detail-fat"
cap "suppr:///macro-detail?macro=fiber" "macro-detail-fiber"

# Progress metric per metric
cap "suppr:///progress-metric?metric=weight" "progress-metric-weight"
cap "suppr:///progress-metric?metric=calories" "progress-metric-calories"

# Return to a known shell
cap "suppr:///(tabs)" "final-tabs-shell"

echo ""
echo "Captures complete: $SCREENSHOT_DIR/route-*.png"
ls "$SCREENSHOT_DIR"/route-*.png | wc -l | xargs echo "Total route-* PNGs:"
