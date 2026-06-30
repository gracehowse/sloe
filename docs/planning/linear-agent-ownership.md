# Linear agent ownership — Cursor, Claude, Codex

**Updated:** 2026-06-18 (peer-review model)

Linear does not let you invent workspace members via API. Agent identities are either **OAuth app users** (installed by a workspace admin) or **labels** for routing/filtering.

**Decision:** `docs/decisions/2026-06-18-agent-peer-review-model.md` — Claude directs/reviews; Cursor + Codex implement + QA (split lenses). QA findings triage through Claude; no Cursor↔Codex assign loops.

**Pickup & delivery rules:** `docs/planning/linear-agent-workflow.md` (branch naming, Todo + `ready-for-agent`, In Review = PR open).

**Team routing (2026-06-18):** `docs/planning/linear-team-routing.md` — **Engineering** = merged-to-main work; **Growth** = Grace-only (`grace-only`). Agents pick up **`team:Engineering`** only.

## Role matrix (Grace, 2026-06-18)

| | Claude | Cursor | Codex |
|--|--------|--------|-------|
| Architecture / roadmap / backlog | ✅ | — | — |
| Ticket creation | ✅ | creates issues | creates issues |
| Implementation | spikes only | ✅ | ✅ |
| User QA | triage | ✅ | — |
| Engineer QA | triage | — | ✅ |
| PR review / release approval | ✅ | — | — |
| Linear delegate | never | `@cursor` | `@codex` |

## Routing policy (Grace, 2026-06-18)

| Agent | Assignee | Delegate | Labels |
|-------|----------|----------|--------|
| **Cursor** | Grace Howse | **Cursor** (required) | `agent/cursor` |
| **Codex** | Grace Howse | **Codex** (required) | `agent/codex` + `ready-for-agent` when queued |
| **Claude** | Grace Howse | **None** — never set delegate | `agent/claude` + `ready-for-agent` when queued |

Claude has no cloud connector → label routing only until Anthropic ships one.

## Current workspace state

| Agent | Linear app user? | ID | How to assign |
|-------|------------------|-----|---------------|
| **Cursor** | Yes — `@cursor` | `62ca9601-dc98-46b1-a58b-82faabeac628` | `delegate: "Cursor"` on issues (Grace stays assignee) + `label:agent/cursor` |
| **Codex** | Yes — `@codex` | `6d9d3531-e32a-413c-9104-2a2b5f34e9b4` | `delegate: "Codex"` on issues (Grace stays assignee) + `label:agent/codex` |
| **Claude** | ❌ No native cloud connector yet | — | **Labels only:** `agent/claude` (+ `ready-for-agent` when queued). Assignee Grace. **Do not set delegate.** See `docs/planning/linear-claude-oauth-setup.md` |
| **Linear** (built-in) | Yes — `@linear` | Built-in agent; not used for Suppr coding |

Also present: **Grace Howse** (`gracehowse@outlook.com`) — human assignee of record.

## Linear’s ownership model (important)

Linear separates **assignee** (accountable human) from **delegate** (agent doing the work):

- **Assignee** — one person; shows in My Issues; owns delivery.
- **Delegate** — app user (@Cursor, @Codex, etc.); agent works on the issue; assignee unchanged.

Agents posting via MCP should set:

```text
assignee: "Grace Howse"   # or "me" when Grace is driving
delegate: "Cursor"        # or "Codex" when that agent is executing
labels: ["agent/cursor"]  # or agent/codex — redundant but filter-friendly
```

For Claude sessions (no cloud delegate), use labels only — **never** set `delegate`:

```text
assignee: "Grace Howse"
delegate: null
labels: ["agent/claude", "ready-for-agent"]
```

Filter: `label:agent/claude`, `label:agent/cursor`, `label:agent/codex`.

## Labels (shipped)

| Label | Use |
|-------|-----|
| `agent/cursor` | Cursor-driven implementation |
| `agent/claude` | Claude Code / Claude web sessions |
| `agent/codex` | Codex sessions |
| `qa-finding` | QA-discovered; route to Claude triage before assigning Cursor/Codex |
| `ready-for-agent` | Queued for agent pickup (Todo); remove when In Progress — **Engineering team only** |
| `grace-only` | **Growth team** — Grace-only; agents must not pick up |

Labels work in custom views, triage rules, and Insights immediately — no admin install.

**Codex pickup filter:** `delegate:Codex` or `label:agent/codex label:ready-for-agent state:Todo`  
**Cursor pickup filter:** `delegate:Cursor` or `label:agent/cursor`

## Codex cloud connector (reference — how `@codex` was installed)

Not manual OAuth. Grace installed via:

1. [Codex cloud](https://chatgpt.com/codex) — GitHub + environment for Suppr repo
2. [Codex connectors](https://chatgpt.com/codex/settings/connectors) → install **Codex for Linear**
3. Mention **`@Codex`** on a Linear issue to link account
4. Optional: triage rule **Delegate → Codex**

Docs: [developers.openai.com/codex/integrations/linear](https://developers.openai.com/codex/integrations/linear)

## Cursor cloud agent — repo slug (`Suppr` not `Suppr-1`)

**Symptom:** `@cursor` in Linear replies `Could not find repository gracehowse/Suppr-1`.

**Cause:** Local clone folder is `/Users/graceturner/Suppr-1`, but GitHub is **`gracehowse/Suppr`** only (`origin` → `https://github.com/gracehowse/Suppr.git`). `gracehowse/Suppr-1` does not exist on GitHub (404).

**Not the source:** nothing in this repo configures `gracehowse/Suppr-1` for cloud agents (grep clean). Linear issue attachments correctly link `github.com/gracehowse/Suppr/pull/466`.

**Where cloud Cursor gets the repo (check in order):**

| # | Where | Fix |
|---|--------|-----|
| 1 | **[Cursor Dashboard → Cloud Agents](https://cursor.com/dashboard?tab=cloud-agents)** | Set **default repository** to `gracehowse/Suppr` (not `Suppr-1`). Reconnect GitHub if needed. |
| 2 | **[cursor.com/linear](https://cursor.com/linear)** | Per-user Linear authorize flow — confirm the account that owns the cloud agent. |
| 3 | **Linear → Settings → Integrations → Cursor** | Disconnect + reconnect after dashboard fix if stale binding. |
| 4 | **Linear → Settings → Agents → Additional guidance** (workspace or ENG team) | If guidance mentions a repo, use `gracehowse/Suppr`. [Linear agent guidance docs](https://linear.app/docs/agents-in-linear). |
| 5 | **Per-issue override** | Comment `@Cursor [repo=gracehowse/Suppr]` on the issue ([Cursor forum workaround](https://forum.cursor.com/t/linear-integration-not-working-no-default-repository-configured/146560)). |

**This IDE session** uses the local filesystem at `Suppr-1/` — unaffected by cloud repo resolution.

**Codex cloud** uses [chatgpt.com/codex/settings/connectors](https://chatgpt.com/codex/settings/connectors) → link the **`gracehowse/Suppr`** GitHub environment (same slug rule).

## Claude + Linear

**There is no Anthropic “Claude for Linear” cloud connector** (unlike Codex). Linear’s [Claude integration](https://linear.app/integrations/claude) is **MCP only** — Claude acts as the human user, not `@claude` delegate.

Options: MCP for Claude Code (`claude mcp add … linear-server`), label routing `agent/claude`, or third-party bridges (Cyrus). Full write-up: **`docs/planning/linear-claude-oauth-setup.md`**. Track: [claude-code#12925](https://github.com/anthropics/claude-code/issues/12925).

## Legacy: manual OAuth app (Cursor-style / custom agents only)

Only needed for **custom** agents or bridges — **not** how Codex was installed.

## Code & reviews (separate feature)

**Settings → Code & reviews** can enable **Cursor**, **Claude Code**, and **Codex** for the **Work on issue** launcher (`W` → open in tool). That launches a coding session with issue context; it does **not** create workspace members or replace delegate/labels.

Use **delegate + labels** for “who owns this in Linear”; use **Code & reviews** for “open this issue in my editor.”

## Agent convention (repo)

When an agent picks up or finishes work:

1. Set **delegate** (if app user exists) + **label** `agent/<name>`.
2. Keep **Grace** as assignee unless Grace explicitly self-assigns execution.
3. On close: comment with branch/PR; clear delegate if another agent takes over.

See `AGENTS.md` → Linear updates.
