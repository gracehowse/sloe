# Quick-wins backlog — triage queue (2026-06-17)

**Strategy:** Burn down **small, agent-buildable** items across the open ENG backlog instead of strict gate-only sequencing. See `docs/planning/2026-06-17-gate-0-1-agent-audit.md`.

## Scoring (pick next)

| Signal | Ship? |
|--------|-------|
| Test pin / CI mock fix | Yes — first |
| Copy / string web↔mobile parity | Yes |
| Single-component token/spacing | Yes |
| Dead import / unused helper + test | Yes |
| Grace-ops, legal, migration, billing | No |
| Multi-surface refactor | No |

## Triage table (populate as items close)

| Issue | Title | Effort | Agent? | Status | Notes |
|-------|-------|--------|--------|--------|-------|
| ENG-901 M6 | Import-success sheet (web) | S | Yes | **Done** | `import-success-sheet.tsx` |
| ENG-897 | Auth signup email-step pixel | S | Yes | **Done** | `app/login/ui.tsx` email heading |
| ENG-896 | Discover desktop slab cards | S | Yes | **Done** | `DiscoverFeed.tsx` desktop grid |
| ENG-898 | Import recent imports / caption card | S | Yes | Partial | WORKS WITH shipped `4c4459bb` |
| ENG-889 S5 | Fresh start verify | S | Yes | Open | Today partial |
| ENG-859 | DMCA agent | — | No | Open | Grace ops |
| ENG-1060 | TF57 smoke | — | No | Open | Grace device |
| ENG-874 | Health sync verify | — | No | Open | Grace device |

*Triage pass in progress — extend this table as quick wins ship.*
