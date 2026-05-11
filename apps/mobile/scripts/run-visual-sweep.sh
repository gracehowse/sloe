#!/usr/bin/env bash
# Visual sweep runner — runs each Maestro section independently so a
# single missing route doesn't kill the whole sweep.
#
# Sections (each a separate .yaml so failures don't cascade):
#   00z_sweep_tabs.yaml      — Today / Recipes / Plan / Shopping / You
#   00z_sweep_deeplinks.yaml — Profile / Fasting / Barcode / Create /
#                              Burn / Macro / Meal-nutrition /
#                              Health-sync / Household / Nutrition-sources / Paywall
#
# Pre-reqs:
#   - iOS sim booted with Suppr installed
#   - Metro running (npx expo start --dev-client from apps/mobile/)
#   - User signed in on the sim
#
# Output: docs/audits/visual-sweep-expanded/<NN>-<name>.png
#
# Flags:
#   --with-web   Also run the Playwright web sweep against production
#   --with-diff  Run baseline diff after capture (exit non-zero on regression)
#
# Exit code: 0 if at least ONE section captured anything (or --with-diff
# clean); non-zero only if NOTHING captured or --with-diff found
# regressions.

set -u

WITH_WEB=0
WITH_DIFF=0
for arg in "$@"; do
  case "$arg" in
    --with-web)  WITH_WEB=1 ;;
    --with-diff) WITH_DIFF=1 ;;
  esac
done

MOBILE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$MOBILE_DIR/../.." && pwd)"
OUT_DIR="$REPO_ROOT/docs/audits/visual-sweep-expanded"

mkdir -p "$OUT_DIR"

SECTIONS=(
  "00z_sweep_tabs"
  "00z_sweep_deeplinks"
)

PASSED=0
FAILED=()

for s in "${SECTIONS[@]}"; do
  echo ""
  echo "─── Section: $s ───"
  if (cd "$MOBILE_DIR" && maestro test ".maestro/$s.yaml" 2>&1 | tail -5); then
    PASSED=$((PASSED + 1))
  else
    FAILED+=("$s")
  fi
done

echo ""
echo "═══ Visual sweep complete ═══"
echo "  Sections passed: $PASSED / ${#SECTIONS[@]}"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "  Sections failed: ${FAILED[*]}"
fi
echo "  Output dir: $OUT_DIR"
ls "$OUT_DIR" | grep -E '\.png$' | wc -l | xargs -I{} echo "  PNGs in output: {}"

# Optional: web sweep
if [ $WITH_WEB -eq 1 ]; then
  echo ""
  echo "─── Section: web Playwright sweep ───"
  (
    cd "$REPO_ROOT"
    PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-https://suppr-club.com}" \
      PLAYWRIGHT_SKIP_WEB_SERVER=1 \
      npx playwright test tests/e2e/screenshots/web-screenshot-tour.spec.ts --reporter=list 2>&1 | tail -5
  )
fi

# Optional: baseline diff
if [ $WITH_DIFF -eq 1 ]; then
  echo ""
  echo "─── Baseline diff ───"
  if ! node "$MOBILE_DIR/scripts/diff-visual-sweep.mjs"; then
    echo "  ✗ Baseline diff reported regressions or missing baselines."
    exit 1
  fi
fi

# Exit zero if anything captured. Non-zero only if EVERYTHING failed.
if [ $PASSED -eq 0 ]; then
  exit 1
fi
exit 0
