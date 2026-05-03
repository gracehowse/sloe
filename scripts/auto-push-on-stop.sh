#!/usr/bin/env bash
# Stop-hook: push committed work to origin when Claude finishes a turn.
#
# Why: prevents the failure mode where a chat closes (or its background
# tasks die) before commits get pushed, stranding work on a local
# worktree that nobody finds again. The 14-PRs-stuck-41-commits-behind
# graveyard cleaned up on 2026-05-02 was the cost of that.
#
# Safety guards:
# - Only operates on branches matching `claude/*` (Claude-owned).
# - Never commits — only pushes commits that ALREADY exist locally.
#   Half-finished code stays uncommitted; this hook does not paper over
#   that.
# - Uses --force-with-lease (not --force) so concurrent pushes from
#   another worktree on the same branch are not silently overwritten.
# - Exits 0 on every path so it never blocks Claude.

set -uo pipefail

# We are typically run from a worktree; resolve the repo and branch.
git_dir="$(git rev-parse --git-common-dir 2>/dev/null)" || exit 0
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || exit 0

# Only act on claude/* branches.
case "$branch" in
  claude/*) ;;
  *) exit 0 ;;
esac

# Anything to push?
upstream="origin/$branch"
if ! git rev-parse --verify --quiet "$upstream" >/dev/null; then
  # First push — set upstream.
  git push -u origin "$branch" >/dev/null 2>&1 || true
  exit 0
fi

ahead="$(git rev-list --count "$upstream..HEAD" 2>/dev/null || echo 0)"
if [ "$ahead" -gt 0 ]; then
  git push --force-with-lease origin "$branch" >/dev/null 2>&1 || true
fi

exit 0
