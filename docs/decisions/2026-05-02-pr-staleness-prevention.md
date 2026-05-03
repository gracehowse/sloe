# 2026-05-02 — PR staleness prevention

**Status:** Resolved
**Area:** Operations / engineering hygiene
**Owner:** Grace

## Context

On 2026-05-02, while picking up a queue from a prior chat, we found **14 open PRs all sitting 41 commits behind `main`**, sharing a single fork point that predated commit `9c38512` ("rename onboarding-v2 → canonical (legacy fully replaced)"). Every one of those PRs touched files that had since been deleted on `main` as part of that rename. Even though `git merge-tree` reported zero textual conflicts, merging any of them would have **resurrected ~200 deleted legacy files** — a major regression.

The PRs:

- Stale rebuilds needed (11): `#26 weekly check-in`, `#32 icon sweep`, `#33 servings stepper`, `#34 hex sweep`, `#36 food-search no-result`, `#38 EmptyState`, `#43 cancel touchpoint`, `#45 cook viewServings`, `#46 photo-log free taster`, `#48 MFP CSV import`, `#53 Discover seed`
- Closed as duplicate (1): `#29 cancel-flow export prompt` → superseded by `#43`
- Closed as deferred (2, N=1 cohort rule): `#39 shopping cart realtime`, `#49 plan-realtime sync`

`#23 mobile Settings polish 2` was 33 commits stale; most intent had already shipped via `#67 fasting findable`. Closed and replaced with the 7-line tail in `#71`.

## Root cause

The previous chat session had been running an "audit + fan out + merge" pattern. Specialist agents in parallel worktrees opened a PR each. The merge cadence on `main` was high (PRs #59-#68 all landed in ~80 minutes). The fan-out PRs were never refreshed as `main` advanced, and the v2→canonical rename happened in the middle of that window.

Two structural causes:

1. **No cap on in-flight PRs.** 14 PRs open simultaneously is too many for one developer to keep current.
2. **No automated freshness gate.** A PR could sit 41 commits behind without anyone noticing until merge time, by which point conflict resolution required full intent reconstruction.

## Decision

Three preventative layers added in [PR #70](https://github.com/gracehowse/Suppr/pull/70):

1. **`.github/workflows/auto-rebase-prs.yml`** — daily cron (every 6h) + `workflow_dispatch`. For each open same-repo `claude/*` PR: rebase onto `origin/main`; force-with-lease push if clean; comment + apply `stale-rebase` label if conflict; auto-close PRs stuck on `stale-rebase` for 7+ days.
2. **`scripts/auto-push-on-stop.sh`** — Stop-hook registered in `.claude/settings.json`. Pushes already-committed work on `claude/*` branches at end of every Claude turn so chat closes can never strand local commits. Never commits — only pushes what is already committed locally. Uses `--force-with-lease` for safety.
3. **`.claude/CLAUDE.md` — PR-hygiene section** — cap of 3 open PRs in flight, rebase-before-every-push rule, `stale-rebase` label is P1 to fix or close that day.

## Why this shape

- **Cap of 3 PRs**, not "no cap": Specialist agents working in parallel is still valuable; it's the *open PRs* that need the cap, not the work-in-progress branches. Branches can stack locally; only the tip-3 turn into PRs.
- **6-hour cadence**, not nightly: a 24h cadence would still let a busy day's worth of `main` merges leave PRs stale before the workflow ran. 6h is fast enough that `stale-rebase` flagging happens within one working session.
- **Auto-close at 7 days**, not earlier: a PR can fail to rebase for legitimate reasons (mid-week migration, pending design call). 7 days is enough slack for those without letting a graveyard build.

## Non-goals

- **No auto-rewriting of conflicting PRs.** When auto-rebase fails, it labels and comments. A human or a spawned executor agent rebuilds from intent. Auto-rewriting product features without judgement is the failure mode this whole PR is trying to prevent.
- **No restriction on parallel agent worktrees.** Spinning up 5 agents to work on independent things is fine. Opening 5 PRs immediately is not.

## Follow-ups

- Watch the first scheduled run of `auto-rebase-prs.yml` to confirm the workflow can find + label conflicts correctly.
- Re-evaluate the 3-PR cap after a week of operation. May need to be tighter (2) or looser (5) depending on flow.
- If `stale-rebase` PRs cluster around specific kinds of changes (e.g., always conflict in CHANGELOG.md), consider a structural change to those files (e.g., per-PR changelog stubs).
