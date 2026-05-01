#!/bin/bash
# Run all interactive-states + fixture sub-flows independently. Each
# runs in its own Maestro session so an XCUITest crash in one (notably
# iOS 26's kAXErrorInvalidUIElement on RN modal hierarchy probes)
# doesn't kill the others.
#
# 2026-04-30 (audit comprehensive coverage 100% pass).

set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

# Metro-up guard.
if ! lsof -nP -i :8081 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ Metro is not listening on :8081. Start it first:" >&2
  echo "    (cd apps/mobile && npx expo start --port 8081 --dev-client &)" >&2
  exit 2
fi

mkdir -p screenshots/latest

# Each entry is a flow file. Order matters: capture flows run before
# cleanup flows (00d4b ends the fast started by 00d4).
FLOWS=(
  ".maestro/00d1_settings_destructive.yaml"
  ".maestro/00d2_settings_delete_account.yaml"
  ".maestro/00d3_today_fab_log_sheet.yaml"
  ".maestro/00d5_tabs_populated.yaml"
  ".maestro/00d6_targets_edit.yaml"
  ".maestro/00d7_macro_drill.yaml"
  ".maestro/00d4_fasting.yaml"
  ".maestro/00d4b_end_fast.yaml"
  ".maestro/00e1_recipe_detail.yaml"
  ".maestro/00e2_plan_move_meal.yaml"
  ".maestro/00e3_cook_active.yaml"
  ".maestro/00e4_shopping_populated.yaml"
)

PASS=0
FAIL=0
LOG_DIR="/tmp/maestro-int-suite-$(date +%H%M%S)"
mkdir -p "$LOG_DIR"

for flow in "${FLOWS[@]}"; do
  name=$(basename "$flow" .yaml)
  before=$(ls screenshots/latest/state-*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "▶ $name"
  maestro test "$flow" >"$LOG_DIR/$name.log" 2>&1
  rc=$?
  after=$(ls screenshots/latest/state-*.png 2>/dev/null | wc -l | tr -d ' ')
  delta=$((after - before))
  if [ $rc -eq 0 ]; then
    echo "  ✓ pass (+${delta} captures)"
    PASS=$((PASS + 1))
  else
    if [ "$delta" -gt 0 ]; then
      echo "  ✗ fail (rc=$rc) but +${delta} captures landed before crash — see $LOG_DIR/$name.log"
    else
      echo "  ✗ fail (rc=$rc, no captures) — see $LOG_DIR/$name.log"
    fi
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "Suite complete: $PASS pass / $FAIL fail"
echo "Total state-* captures: $(ls screenshots/latest/state-*.png 2>/dev/null | wc -l | tr -d ' ')"
echo "Per-flow logs: $LOG_DIR"
