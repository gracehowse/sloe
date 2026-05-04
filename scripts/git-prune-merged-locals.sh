#!/usr/bin/env bash
# Delete local topic branches whose tips are already contained in origin/main.
# Safe after squash merges: uses merge-base (tip must be an ancestor of main).
# Never deletes `main`. Run from repo root: npm run git:prune-locals
set -euo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "error: not inside a git repository" >&2
  exit 1
}
cd "$root"

if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
  echo "error: origin/main not found — run: git fetch origin main" >&2
  exit 1
fi

git fetch origin --prune

pruned=0
while IFS= read -r b; do
  [[ -z "$b" || "$b" == "main" ]] && continue
  if git merge-base --is-ancestor "$b" origin/main 2>/dev/null; then
    git branch -D "$b"
    echo "pruned local: $b"
    pruned=$((pruned + 1))
  fi
done < <(git for-each-ref refs/heads --format '%(refname:short)')

if [[ "$pruned" -eq 0 ]]; then
  echo "No extra local branches to prune (all remaining tips are not ancestors of origin/main)."
fi
