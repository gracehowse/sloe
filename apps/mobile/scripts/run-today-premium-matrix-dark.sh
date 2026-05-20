#!/bin/bash
# Today premium matrix — iOS sim dark captures (ENG-575).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT="$(cd "$MOBILE_DIR/../.." && pwd)"
FLOW="$MOBILE_DIR/.maestro/00d9_today_premium_matrix_full.yaml"
MAESTRO="${MAESTRO_BIN:-$HOME/.maestro/bin/maestro}"

cd "$ROOT"
set -a
# shellcheck disable=SC1091
source .env.local 2>/dev/null || true
set +a

npx tsx scripts/e2e-seed-today-premium-matrix.ts

PREV_APPEARANCE="$(xcrun simctl ui booted appearance 2>/dev/null | awk '{print $NF}' || echo light)"
xcrun simctl ui booted appearance dark

cleanup() {
  xcrun simctl ui booted appearance "${PREV_APPEARANCE:-light}" 2>/dev/null || true
}
trap cleanup EXIT

# Run full matrix; Maestro writes *-mobile-light.png — rename to dark after.
"$MAESTRO" test "$FLOW"

LATEST="$ROOT/screenshots/latest"
if [[ ! -d "$LATEST" ]]; then
  LATEST="$MOBILE_DIR/screenshots/latest"
fi
for f in empty-day one-meal deficit-insight over-budget eat-again active-fast; do
  src="$LATEST/${f}-mobile-light.png"
  dst="$LATEST/${f}-mobile-dark.png"
  if [[ -f "$src" ]]; then
    cp "$src" "$dst"
    echo "dark capture: $dst"
  fi
done

npx tsx scripts/e2e-seed-today-premium-matrix.ts --activate-fast
"$MAESTRO" test "$MOBILE_DIR/.maestro/00d9_today_premium_active_fast.yaml"
if [[ -f "$LATEST/active-fast-mobile-light.png" ]]; then
  cp "$LATEST/active-fast-mobile-light.png" "$LATEST/active-fast-mobile-dark.png"
fi
