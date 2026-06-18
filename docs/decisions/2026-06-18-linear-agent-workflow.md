# Linear agent workflow — pickup, branch, PR

**Date:** 2026-06-18  
**Status:** Resolved  
**Area:** Platform / contributor workflow  

## Decision

Agents (Cursor, Codex, Claude) **work from Linear only**, with explicit ownership and a fixed before/after checklist.

- **Queued:** Todo + label `ready-for-agent` (+ `agent/codex` / `agent/claude`; **Cursor** and **Codex** use `delegate:Cursor` / `delegate:Codex` + matching `agent/*` label)
- **Branch:** `agent/<agent>/<linear-id>-short-name`
- **PR open:** **In Review** until custom **PR open** workflow state is added
- **Docs:** `docs/planning/linear-agent-workflow.md`

Grace remains **assignee** on all agent tickets; Cursor uses **delegate**.

## Follow-up for Grace

Add optional custom ENG workflow states **Ready for agent** (unstarted) and **PR open** (started) in Linear **Team settings → Workflow**, then retire the Todo+label shim.
