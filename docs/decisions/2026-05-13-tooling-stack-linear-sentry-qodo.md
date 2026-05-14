# Tooling stack upgrade — Linear + Sentry auto-PBI + Qodo (2026-05-13)

**Area:** Engineering / Ops
**Status:** Resolved
**Date:** 2026-05-13

## Decision

Adopt a three-tool automation stack on top of the existing Notion operating layer:

1. **Linear (free tier)** — PBI spine. Replaces Notion Tasks DB + Roadmap DB once migrated. Free tier covers 250 issues / 10 users / 2 teams, which is years of headroom at solo scale.
2. **Sentry → Linear integration** — auto-creates Linear issues from prod errors. Sentry is already wired in repo on both web and mobile (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `apps/mobile/lib/errorTracking.ts`); remaining work is the Linear integration + alert rules + DSN env in Vercel/EAS.
3. **Qodo** (formerly Codium) — IDE-side AI test generation on new code, free tier. Pairs with the existing vitest + Maestro suites; does not replace them.

## Why

Solo founder pre-launch (TestFlight, N=1 tester, viral push starting 2026-07-01). The bottleneck is bandwidth, not features. The stack solves three concrete bandwidth drains:

- Manual PBI filing for prod crashes → Sentry → Linear auto-files with stack trace + user id (we already stamp user id via `syncObservabilityUser`).
- Notion dashboards for roadmap state → Linear cycles / projects / roadmap views beat Notion's out of the box.
- Hand-writing every test for new code → Qodo proposes them in the IDE.

## Considered and rejected

- **Qase** — test case management. Overkill for solo + N=1; the real bottleneck is coverage, not organisation of test cases.
- **Height / Cosine / other "AI-native" PBI tools** — the wave mostly flamed out or pivoted in 2024–25; no Linear-killer exists.
- **Jira + Atlassian Intelligence** — bloat without proportional value at solo scale.
- **GitHub Projects v2** — viable free alternative. Kept as a documented fallback if Linear's free tier ever becomes restrictive; loses today on UX + native insights dashboards.

## How to apply

### Notion operating layer split

- **Keeps in Notion:** Decisions log, Content calendar, Vendors & subscriptions, runway / finance docs.
- **Migrates to Linear:** Tasks DB → Linear Issues + Cycles. Roadmap DB → Linear Projects + Roadmap view.

### CLAUDE.md mirror rules

The current Notion mirror rules in CLAUDE.md remain authoritative **until** the Linear migration is complete (Tasks + Roadmap actually moved, not just signed up). After migration, the mirror rules update to:

- New decision → Notion Decisions log (unchanged)
- New roadmap state change → Linear project / status (new)
- New shipped feature → close matching Linear issue + mark Linear project Done (new)
- New vendor → Notion Vendors (unchanged)
- New content asset → Notion Content calendar (unchanged)

Until the migration is complete, continue mirroring to the existing Notion DBs.

### Sentry → Linear

- Configure via Sentry → Settings → Integrations → Linear.
- Auto-create Linear issue on issue level `error` or `fatal` only (skip warnings — too noisy at solo scale).
- Target team: `Engineering` (or whichever team owns prod). Map Sentry environment → Linear label (`prod`, `preview`, `dev`).
- Confirm by triggering a deliberate test error from a dev-only API route after the integration is live.

### Qodo

- Install the IDE extension (Cursor / VS Code).
- Use it for new modules only at first; do not bulk-generate tests over existing code (noise > value).
- Generated tests must pass `npm run ci` like any other test — no special-casing.

## Cost

All three on free tier for current usage. Re-evaluate at:

- Linear: approaching 250 open issues, or hiring a second seat-needing collaborator.
- Sentry: approaching 5k events/month, or needing >7-day retention.
- Qodo: at first paid feature blocker.

## Open follow-ups

- [ ] Grace: sign up Linear (suppr.club email), create `Engineering` + `Growth` teams, install Cursor MCP.
- [ ] Grace: install Sentry → Linear integration, set alert rules.
- [ ] Grace: install Qodo IDE extension.
- [ ] Claude (after migration): update CLAUDE.md mirror rules section to point Tasks + Roadmap at Linear.
- [ ] Claude (after migration): port the open rows of Notion Tasks DB into Linear (or close stale ones).
