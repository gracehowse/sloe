# Linear agent workflow — pickup, branch, PR

**Updated:** 2026-06-18 (peer-review model)

Canonical rules for **Cursor**, **Codex**, and **Claude** when executing from Linear.
Ownership model (assignee vs delegate vs labels): `docs/planning/linear-agent-ownership.md`.
Decision: `docs/decisions/2026-06-18-agent-peer-review-model.md`.

## Role split (Grace, 2026-06-18)

| Agent | Build | QA | Direct / review |
|-------|-------|-----|-----------------|
| **Claude** | Rare — spikes only when Grace asks | Triage only | Architecture, roadmap, backlog, standards, **PR review**, **release approval** |
| **Cursor** | ✅ Primary | **User lens** — onboarding, recipes, plan, visual/copy, conversion, empty states | Creates issues; does not assign QA to Codex |
| **Codex** | ✅ Primary | **Engineer lens** — edge cases, sync, perf, errors, API nonsense, coverage | Creates issues; does not assign QA to Cursor |

Claude: **Observe → Prioritise → Review → Direct**. Cursor/Codex: **Build → Test**.

## QA finding triage (non-negotiable)

**Never** ping-pong QA between Cursor and Codex.

```text
Finding (Cursor or Codex QA)
  → New issue OR comment on suspected duplicate
  → labels: agent/claude + qa-finding
  → assignee: Grace, delegate: null, state: Todo
  → Claude: fix now | combine | defer (Linear ID) | reject
  → Then: delegate Cursor OR Codex + agent/cursor|codex + ready-for-agent
```

Cursor/Codex **must not** delegate a QA finding to the other implementer.

### Cursor QA lens (user)

Would a real user understand this? Would I abandon this screen? Surfaces: onboarding, recipes, meal plan, visual consistency, mobile-web, empty states, copy, paywall/conversion.

### Codex QA lens (engineer)

Can I break this? Backend nonsense? Surfaces: edge cases, data integrity, web↔mobile sync, performance, error handling, API failures, missing tests.

## Pickup rule (non-negotiable)

**Work only from Linear.** Pick tickets that are explicitly queued for you:

| Agent | Filter (Linear) |
|-------|-----------------|
| **Cursor** | `delegate:Cursor` — assignee Grace — `label:agent/cursor` — **In Progress** or **Todo** + `ready-for-agent` |
| **Codex** | `delegate:Codex` — assignee Grace — `label:agent/codex` + `label:ready-for-agent` + **Todo** |
| **Claude** | **No delegate** — assignee Grace — `label:agent/claude` — **triage/review/planning**; `label:qa-finding` = awaiting triage |

Do **not** pick unlabeled issues, Grace-only ops tickets, or another agent's **In Progress** parent unless Grace reassigns.

**Assignee stays Grace Howse** (accountable human). **Delegate** = Cursor or Codex app user when that agent executes. **Claude:** labels only — do not set delegate.

## Status mapping

The ENG team does not yet have custom states **Ready for agent** / **PR open** in workflow. Until Grace adds them in **Team settings → Workflow**:

| Intent | Use today |
|--------|-----------|
| Queued for agent pickup | **Todo** + label **`ready-for-agent`** |
| Agent actively coding | **In Progress** |
| PR opened, awaiting review | **In Review** (= “PR open”) |
| Shipped | **Done** |

After Grace adds custom states, migrate: Todo+`ready-for-agent` → **Ready for agent**; In Review → **PR open** (optional rename).

## Before coding

1. **Read the ticket** — description, acceptance, blockers, linked docs.
2. **Identify files** you expect to touch; note them in a short Linear comment before the first commit.
3. **Sync with main:** `git fetch origin main && git rebase origin/main` (or merge if rebase is blocked — fix, don't force-push main).
4. **Create branch:** `agent/<agent>/<linear-id>-short-name`  
   Examples: `agent/cursor/ENG-898-recent-imports`, `agent/codex/ENG-1090-storybook-eexist`
5. **Scope discipline** — do not modify files outside the ticket unless required for tests/types; if scope expands, comment on Linear first.
6. **Move ticket** to **In Progress** when you start (clear `ready-for-agent` if you added it at pickup).

## After coding

1. **Run checks** scoped to what you touched (see `AGENTS.md` CI hygiene), at minimum lint + typecheck + relevant tests.
2. **Commit** with message referencing the Linear ID (e.g. `ENG-1090: serialise storybook static copy`).
3. **Open PR** — link the Linear ticket in the PR body (`Closes ENG-XXXX` or `Part of ENG-XXXX` for parent partials).
4. **Move ticket** to **In Review** (PR open).
5. **Linear comment** — summary of changes, risks, and what you tested (web/mobile if UI).

## Conflict avoidance (multi-agent)

| Owner | Current focus (2026-06-18) | Others must avoid |
|-------|---------------------------|-------------------|
| **Cursor** | PR [#476](https://github.com/gracehowse/Suppr/pull/476) — ENG-901 trust strip + Sloe upgrade dialog; ENG-889 coach-in-hero. Next: mobile paywall shell, ENG-889 TD partials | `PaywallTrustStrip.tsx`, `upgrade-paywall-dialog.tsx`, `TodayHeroRing.tsx`, `NutritionTracker.tsx` until #476 merges |
| **Codex** | ENG-1090 (CI), ENG-848 (web dead code), ENG-1168 (comment audit) | Figma parents, import-shared, TodayHeroRing, RecipeUpload |
| **Claude** | Planning / doc sync / triage (`label:agent/claude` only) | Cursor-delegated Figma files until #476 merges |

**Merged 2026-06-18:** `claude/wave-4-trust-cohesion` → `main` (#472); ENG-1100 (#475). Do not target `claude/wave-4-trust-cohesion` — branch is stale.

When in doubt, pick the ticket with **`label:agent/codex`** only — not Cursor-delegated issues.

## Labels reference

| Label | Meaning |
|-------|---------|
| `agent/cursor` | Cursor owns implementation |
| `agent/codex` | Codex owns implementation |
| `agent/claude` | Claude session — triage, review, planning (no delegate) |
| `qa-finding` | QA-discovered issue; **must** go through Claude triage before implementer assignment |
| `ready-for-agent` | Queued for pickup (Todo); remove when In Progress |

## Grace-only (never auto-assign to agents)

Ops, legal, dashboard, Supabase migrations, credentials, metrics gates, device-only TestFlight — tickets labeled or described as **Grace only**, **grace-only**, or requiring external accounts.
