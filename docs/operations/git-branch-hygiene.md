# Git branch hygiene (Suppr)

**Goal:** One long-lived line of development (`main`), short-lived topic branches, and no accumulation of agent or worktree cruft.

## Defaults (already configured)

- **GitHub — “Automatically delete head branches”** is enabled for this repo. When a PR merges, GitHub removes the remote PR branch so it cannot linger.
- **Default branch:** `main` only as the integration branch.

## When you finish a PR

1. Merge via GitHub (squash or merge commit — either is fine).
2. Let GitHub delete the remote head (automatic).
3. Locally: `git checkout main && git pull` then run **`npm run git:prune-locals`** to drop local copies whose work is already on `main`.

## Claude Code / Cursor worktrees

- Linked checkouts under `.claude/worktrees/` should be removed when the task ends:

  `git worktree remove --force .claude/worktrees/<name>`

- Avoid creating dozens of parallel `claude/*` remote branches; prefer **one PR branch per feature** and merge it.

## Optional audit

To see remote branch count (should stay small):

`gh api repos/gracehowse/Suppr/branches --jq 'length'`

(Requires `gh` CLI and repo access.)
