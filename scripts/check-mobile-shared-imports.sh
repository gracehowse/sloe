#!/usr/bin/env bash
#
# ENG-1074 — mobile @suppr/shared boundary check (local ⇄ CI parity).
#
# Mirrors the three former inline mobile-job steps in .github/workflows/ci.yml
# ("Shared classifyMealType re-export path", "Shared refreshAdaptiveTdee
# re-export path", "Verify all cross-boundary imports from shared lib resolve")
# as ONE script both `npm run ci` (locally) and CI call — so a bad
# `@suppr/shared/*` import path is caught before push, not only on CI.
#
# Fixes a latent bug in the old inline CI version: it ran the resolve loop as
# `grep … | while …; do FAIL=1; done`, where the `while` executes in a pipe
# subshell, so `FAIL=1` never escaped and the final `exit 1` was unreachable —
# i.e. a missing import would print MISSING but still pass CI. This version uses
# process substitution so the loop runs in the main shell and the failure
# propagates.
#
# Runs against apps/mobile regardless of the caller's cwd.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/mobile"

# 1. Leaf re-export files must use the `@suppr/shared` path alias (ENG-551),
#    not a relative `../../../src/lib/...` chain.
grep -q 'from "@suppr/shared/recipe-import/classifyMealType"' lib/classifyMealType.ts \
  || { echo "FAIL: lib/classifyMealType.ts must re-export from @suppr/shared/recipe-import/classifyMealType"; exit 1; }
grep -q 'from "@suppr/shared/nutrition/refreshAdaptiveTdee"' lib/refreshAdaptiveTdee.ts \
  || { echo "FAIL: lib/refreshAdaptiveTdee.ts must re-export from @suppr/shared/nutrition/refreshAdaptiveTdee"; exit 1; }

# 2. Every `@suppr/shared/*` import in mobile must resolve to a real file under
#    src/lib (the alias maps `@suppr/shared/X` → `../../src/lib/X`).
fail=0
while read -r imp; do
  [ -z "$imp" ] && continue
  file="../../src/lib/${imp#@suppr/shared/}"
  if [ ! -f "${file}.ts" ] && [ ! -f "${file}.tsx" ] \
     && [ ! -f "${file}/index.ts" ] && [ ! -f "${file}/index.tsx" ] \
     && [ ! -f "${file}" ]; then
    echo "MISSING: $imp (resolved to $file)"
    fail=1
  fi
done < <(grep -roh 'from "@suppr/shared/[^"]*"' app/ lib/ components/ hooks/ context/ \
           --include='*.ts' --include='*.tsx' 2>/dev/null \
           | sed 's/from "//;s/"//' | sort -u)

if [ "$fail" = "1" ]; then
  echo "FAIL: unresolved @suppr/shared import(s) above — fix the path or add the file."
  exit 1
fi

echo "OK — mobile @suppr/shared re-exports + cross-boundary imports resolve."
