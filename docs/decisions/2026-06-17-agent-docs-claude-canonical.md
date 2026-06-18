# Agent docs: tracked `AGENTS.md` + `CLAUDE.md` (ENG-1166)

**Date:** 2026-06-17 (Option B) · **Amended:** 2026-06-18 (Option C)  
**Status:** Resolved  
**Area:** Platform / contributor workflow  
**Linear:** ENG-1166

## Decision

**Option C — tracked cross-tool mirror.**

| File | Role |
|------|------|
| `.claude/CLAUDE.md` | **Canonical source** — edit here first |
| `AGENTS.md` (repo root) | **Tracked mirror** — Codex, Cursor, and other agents read this on fresh clone |
| `apps/mobile/CLAUDE.md` | Mobile-scoped conventions (tracked) |
| `apps/**/AGENTS.md` | Still **gitignored** — no nested stubs |

After editing `.claude/CLAUDE.md`, run **`npm run sync:agent-docs`** to refresh root
`AGENTS.md`. CI test `agentDocsCanonical.test.ts` enforces sync.

## Why Option B was amended

Option B (2026-06-17) kept root `AGENTS.md` gitignored as "machine-local Cursor
output." That fixed the missing `apps/mobile/AGENTS.md` path but left **Codex and
other non-Claude agents blind on clone** — they never saw Linear hygiene, visual-check
rules, or other session updates that only landed in Cursor's local file.

## What we did (Option C)

1. Stopped gitignoring root `AGENTS.md`; gitignore nested `apps/**/AGENTS.md` only.
2. Added `scripts/sync-agent-docs.mjs` + `npm run sync:agent-docs`.
3. Synced Linear/agent-ownership updates into `.claude/CLAUDE.md`.
4. Extended `tests/unit/agentDocsCanonical.test.ts` to assert mirror parity.

## Implication for agents

- **All coding agents** (Cursor, Claude Code, Codex, etc.): read **`AGENTS.md`** or
  **`.claude/CLAUDE.md`** — same content after sync.
- **Mobile work:** also read **`apps/mobile/CLAUDE.md`**.
- **Contributors:** never hand-edit `AGENTS.md`; change `.claude/CLAUDE.md` and sync.
