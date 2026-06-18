# Claude + Linear — what exists today (2026-06-18)

**Correction:** Codex delegate (`@codex` in Linear) is **not** set up via a hand-built OAuth app + authorize URL. It uses the **Codex cloud connector** (see below). This doc replaces the earlier wrong OAuth-app-first guide.

---

## Codex model (what you already did)

| Step | Where |
|------|--------|
| 1. Codex cloud + GitHub environment | [chatgpt.com/codex](https://chatgpt.com/codex) |
| 2. Install **Codex for Linear** | [chatgpt.com/codex/settings/connectors](https://chatgpt.com/codex/settings/connectors) (Enterprise: workspace admin enables connector first) |
| 3. Link Linear account | Mention **`@Codex`** on any issue comment |
| 4. Delegate work | Assign to **Codex** or `@Codex` in comments; optional triage rule **Delegate → Codex** |

Docs: [OpenAI — Use Codex in Linear](https://developers.openai.com/codex/integrations/linear) · [Linear — Codex integration](https://linear.app/integrations/codex)

**Separate (local only):** `codex mcp add linear --url https://mcp.linear.app/mcp` — MCP as **you**, not `@codex` cloud delegate.

---

## Claude — there is **no** equivalent “Claude for Linear” cloud connector (yet)

Anthropic has **not** shipped a first-party Linear cloud agent like Codex/Cursor. Linear’s official Claude page is **MCP only** (Claude reads/writes Linear **as the logged-in human**):

- [Linear — Claude integration](https://linear.app/integrations/claude) → MCP server `https://mcp.linear.app/mcp`
- Open feature request: [anthropics/claude-code#12925](https://github.com/anthropics/claude-code/issues/12925) (123+ 👍)

So there is **no** “Claude connector settings → Install Claude for Linear → mention @Claude” flow today.

---

## What you *can* do for Claude today

### A. Linear MCP (Claude ↔ Linear as Grace) — **not** `@claude` delegate

Use when Claude Code / Claude desktop should **manage issues as you**, same pattern as Codex MCP:

**Claude Code (terminal):**
```bash
claude mcp add --scope user --transport http linear-server https://mcp.linear.app/mcp
```
Then in a session: `/mcp` → complete OAuth in browser.

**Claude desktop / web:** [claude.ai → Settings → Connectors → Linear](https://claude.ai/settings/connectors)

This does **not** add `@claude` to the delegate dropdown.

### B. `@claude`-style delegate in Linear (third-party bridges)

Until Anthropic ships native integration, community tools use Linear’s **Agent SDK** (webhooks + agent sessions):

| Option | Notes |
|--------|--------|
| [Cyrus](https://www.atcyrus.com/) | OSS / hosted; Claude Code as assignable Linear agent |
| [claude-linear-agent](https://github.com/ian-klopper/claude-linear-agent) | Community bridge → Claude Code Routines + optional MCP |
| [linear/claude-managed-agents-demo](https://github.com/linear/claude-managed-agents-demo) | Linear’s reference bridge (self-host) |

These require OAuth app + webhooks — different from Codex’s one-click connector.

### C. Label-only routing (repo workflow, no `@claude` in Linear)

Use **`label:agent/claude`** + **`ready-for-agent`** + our branch rules (`docs/planning/linear-agent-workflow.md`) when Claude runs locally in terminal — no Linear cloud agent.

---

## Recommendation for Suppr

| Agent | Linear delegate | Setup |
|-------|-----------------|--------|
| **Cursor** | `@cursor` | Cursor cloud agent install ([Linear ↔ Cursor](https://linear.app/integrations/cursor)) |
| **Codex** | `@codex` | [Codex connectors](https://chatgpt.com/codex/settings/connectors) → **Codex for Linear** (done) |
| **Claude** | ❌ no native `@claude` | **MCP** for issue access as Grace; **`agent/claude` labels** for routing; watch #12925 or evaluate **Cyrus** if you need true delegate |

When Anthropic ships “Claude for Linear”, update this doc and `linear-agent-ownership.md` with the connector URL (expected to mirror Codex: [chatgpt.com/codex/settings/connectors](https://chatgpt.com/codex/settings/connectors) → **Codex for Linear**; Claude equivalent likely [claude.ai/settings/connectors](https://claude.ai/settings/connectors) → mention `@Claude`).
