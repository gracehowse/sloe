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
# Exit code: 0 if at least ONE section captured anything; non-zero only
# if NOTHING captured (Maestro/sim entirely broken).

set -u

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

# Exit zero if anything captured. Non-zero only if EVERYTHING failed.
if [ $PASSED -eq 0 ]; then
  exit 1
fi
exit 0
