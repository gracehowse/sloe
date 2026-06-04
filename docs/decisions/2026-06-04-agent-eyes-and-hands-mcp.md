# Agent eyes and hands — iOS Simulator + Playwright MCP (2026-06-04)

**Status:** Resolved  
**Area:** Engineering / agent workflow  
**Owner:** Grace  

## Context

[Give Claude Eyes and Hands on Your App](https://www.zerotopete.com/p/give-claude-eyes-and-hands-on-your) describes giving coding agents direct simulator and browser control via MCP instead of manual screenshot drag-and-drop. Suppr already had Maestro E2E, `simctl` capture scripts, and partial `CLAUDE.md` notes, but **no `ios-simulator` MCP**, no `sitemap.md`, and idb was not in the standard setup path.

## Decision

Adopt the article’s stack for Cursor agents on this repo:

1. **IDB** — `idb-companion` (Homebrew) + `fb-idb` CLI via **pipx + Python 3.12** (3.14 breaks `fb-idb`).
2. **MCP `ios-simulator`** — `npx ios-simulator-mcp` in `.cursor/mcp.json`.
3. **MCP `playwright`** — `npx @playwright/mcp@latest` for localhost web/mobile-web checks.
4. **`sitemap.md`** — deep links and tab map for navigation.
5. **`docs/testing/agent-eyes-and-hands.md`** — install, verify, troubleshooting.
6. **`npm run agent:verify-tools`** — prerequisite smoke script.
7. **Cursor rules** — `agent-simulator-mcp.mdc` + visual-check rule updated to require MCP-first verification.

Maestro and `capture-every-route.sh` remain for CI and batch captures; MCP is for **interactive agent verification** during implementation.

## User-level Cursor config

Merge `.cursor/mcp.json` entries into `~/.cursor/mcp.json` alongside existing servers (Sentry, Supabase) if project-level MCP is not picked up — then restart Cursor.

## Verification

```bash
npm run agent:verify-tools
# In Cursor: confirm ios-simulator + playwright MCP enabled
# Prompt: "Take a screenshot of the booted simulator and launch com.supprclub.supprapp"
```
