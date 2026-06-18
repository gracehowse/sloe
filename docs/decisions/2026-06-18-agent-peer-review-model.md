# Agent peer-review model — Claude directs, Cursor + Codex build

**Date:** 2026-06-18  
**Status:** Resolved (Grace)  
**Area:** Operations / agent workflow

## Decision

Suppr runs a **peer-review org**, not three independent implementers chewing the same backlog.

| Agent | Role | Does **not** |
|-------|------|----------------|
| **Claude** | Architecture, roadmap, backlog, ticket creation, technical standards, **PR review**, **release approval**, **QA finding triage** | Primary implementation (except Grace-directed spikes) |
| **Cursor** | Feature implementation, bug fixes, **user-facing QA**, creates issues | Assign QA findings directly to Codex |
| **Codex** | Feature implementation, bug fixes, **engineering QA**, creates issues | Assign QA findings directly to Cursor |

Claude’s highest leverage: **Observe → Prioritise → Review → Direct**.  
Cursor and Codex: **Build → Test → Build → Test**.

## QA finding flow (non-negotiable)

Prevents Cursor ↔ Codex ping-pong loops that inflate backlog faster than burn-down.

```text
Cursor or Codex finds issue during QA
        ↓
Create Linear ticket (or comment + link if duplicate suspected)
        ↓
label: agent/claude  +  label: qa-finding  +  assignee: Grace  +  NO delegate
        ↓
Claude triages: fix now | combine with existing | defer (Linear ID) | reject
        ↓
Claude assigns implementation: delegate Cursor OR delegate Codex + agent label + ready-for-agent
```

**Banned:** Cursor finding → delegate Codex → Codex finding → delegate Cursor without Claude triage.

## Split QA perspectives (complementary, not redundant)

### Cursor — think like a user

Onboarding, recipes, meal planning, visual consistency, mobile responsiveness, empty states, copy, conversion.

> Would a real user understand this? Would I abandon this screen?

### Codex — think like an engineer

Edge cases, data corruption, sync, performance, error handling, API failures, test coverage.

> Can I break this? What if the backend returns nonsense?

## Linear labels

| Label | Use |
|-------|-----|
| `qa-finding` | Issue created from QA; awaits Claude triage |
| `agent/claude` | Claude session (triage, review, planning — not cloud delegate) |
| `agent/cursor` / `agent/codex` | Implementation owner after triage |

Full pickup rules: `docs/planning/linear-agent-workflow.md`.

## Repo slug reminder

Cloud agents must target **`gracehowse/Suppr`**, not local folder `Suppr-1`. See `docs/planning/linear-agent-ownership.md`.
