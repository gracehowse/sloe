#!/usr/bin/env bash
# Copy Maestro sim screenshots into docs/ux/captures/today-premium-2026-05-19/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Maestro resolves `screenshots/latest/` from the cwd used at invoke time (repo root).
SRC="$ROOT/screenshots/latest"
if [[ ! -f "$SRC/empty-day-mobile-light.png" ]]; then
  SRC="$ROOT/apps/mobile/screenshots/latest"
fi
DST="$ROOT/docs/ux/captures/today-premium-2026-05-19"
mkdir -p "$DST"
for state in empty-day one-meal deficit-insight over-budget eat-again active-fast; do
  for theme in light dark; do
    src="$SRC/${state}-mobile-${theme}.png"
    if [[ -f "$src" ]]; then
      cp "$src" "$DST/${state}-mobile-${theme}.png"
      echo "copied ${state}-mobile-${theme}.png"
    fi
  done
done
