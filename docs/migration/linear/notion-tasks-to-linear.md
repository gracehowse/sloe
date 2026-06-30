# Linear workspace blueprint + Notion Tasks migration plan

**Date:** 2026-05-13
**Status:** Workspace live (teams ENG/GROW, initiatives, projects, labels). Notion migration largely complete. Custom views: `npm run linear:create-dashboard-views` (optional `linear:create-dashboard-views:all-teams` for GROW-sidebar copies with `[GROW]` suffix). Rotate any API keys used for GraphQL scripts after one-off runs.

## Workspace blueprint (Grace clicks once)

### Teams (free-tier cap = 2)

| Team | Slug | Owns |
|---|---|---|
| **Engineering** | `ENG` | **Will produce a PR** — features, bugs, polish, tests, repo docs, infra-as-code (CI, scripts, verify-production-env). Legal/compliance UI+copy in code (counsel approves). Product decisions stay ENG with `needs/decision` until Grace resolves, then child issues get `ready-for-agent`. |
| **Growth** | `GROW` | **Grace-only; no PR** — vendor dashboard clicks, filings, counsel/CPA, creator outreach, filming, content calendar execution, beta/ratings campaigns, PostHog/Sentry dashboard alerts. Label: `grace-only`. |

> **Routing rule (2026-06-18):** AC = "Grace clicks vendor UI" or "Grace talks to counsel" → **GROW**. AC = "merged to main" → **ENG**. Full spec: `docs/decisions/2026-06-18-linear-team-routing-by-executability.md`.

> Why not 3 teams: free tier caps at 2. The old "ENG catch-all for ops/legal/finance" split collapsed everything onto Engineering; executability routing fixes agent mispicks without adding a third team.

### Workflow states

Keep Linear's default workflow on both teams, plus add one custom state to match the Notion `Blocked` value:

```
Backlog  →  Todo  →  In Progress  →  Blocked  →  In Review  →  Done  →  Cancelled
```

Add `Blocked` via Settings → Workflow → New state, group = "Unstarted" or "Started" (preference; Started is closer to current Notion semantics).

### Priority mapping (Notion → Linear)

| Notion | Linear |
|---|---|
| P0 | Urgent |
| P1 | High |
| P2 | Medium |
| P3 | Low |
| (none) | No priority |

Linear's built-in priorities are 1:1 — nothing to configure.

### Cycles

- **Cadence:** 2 weeks
- **Start day:** Monday
- **First cycle start:** 2026-05-18 (next Monday)
- **Auto-add issues:** **Off**. Grace manually pulls each cycle's scope from the backlog on Sun/Mon. Auto-add is for teams with steady throughput we don't have yet.

### Labels (start with 8, add later as needs emerge)

| Label | Colour | Used for |
|---|---|---|
| `bug` | red | Defects, regressions, broken UX |
| `feature` | green | New capability |
| `polish` | blue | Visual / micro-UX improvement |
| `infra` | gray | DB / CI / deploy / observability |
| `platform/web` | purple | Web-only or web-first |
| `platform/mobile` | pink | iOS-only or iOS-first |
| `auto/sentry` | orange | Auto-created by Sentry → Linear integration |
| `from-tf` | yellow | From TestFlight feedback (`scripts/fetch-testflight-feedback.mjs`) |

Avoid premature label sprawl. Add `surface/*` labels (today / planner / library / etc) only after we have ~50 issues and filtering by title isn't enough.

### Projects (Linear "Projects" group multi-cycle initiatives)

Create three to start, matching active multi-week work:

| Project | Target | Status |
|---|---|---|
| **Phase 0 — Viral push prep** | 2026-06-30 | In progress (10 P0 blockers, per `docs/growth/tiktok-instagram-viral-plan.md`) |
| **Schema refactor** | TBD | In progress (Phase 1–3 from Notion Tasks) |
| **MFP-refugee capture** | 2026-08-31 | In progress (time-bound, May–Aug window) |

Adding more projects later is one click; don't pre-create.

### GitHub integration (already done)

Confirmed by Grace 2026-05-13. PR description syntax `Fixes ENG-123` will auto-close issue ENG-123 on merge. Use this in every PR.

## Property mapping (Notion Tasks → Linear)

| Notion property | Linear field | Notes |
|---|---|---|
| Task (title) | Title | 1:1 |
| Notes | Description | Markdown carries over |
| Status | State | Backlog / Next→Todo / In progress / Blocked / Done |
| Priority | Priority | P0–P3 → Urgent / High / Medium / Low |
| Area | Team + label | Engineering/Growth → team; Product/Ops/Finance/Legal → ENG team + (no label day 1) |
| Platform | Label | Web → `platform/web`, iOS → `platform/mobile`, Cross-platform → both labels |
| Due | Due date | 1:1 |
| Created | (drop) | Linear auto-tracks; Notion timestamp not worth preserving |

## Migration strategy

### What ports to Linear

- Every Notion Tasks row where Status ≠ `Done`. ~all open work.
- Done items: **leave in Notion as historical**. No value porting closed tickets.

### How it runs (after next session start, when Linear MCP is live)

1. Fetch all open Notion Tasks rows (Linear MCP can read Notion via its own connector, OR I fetch via Notion MCP and pipe).
2. For each row, create a Linear issue with mapped fields above.
3. Assign team based on Area:
   - `Growth` → GROW
   - everything else → ENG
4. Apply labels for platform.
5. Set priority + state + due date.
6. Add a Notion-source URL to the description footer (`Migrated from <notion-page-url>`).
7. Tag the original Notion row with a `migrated-to-linear` flag (new property on the Notion Tasks DB) so we don't double-port.

### Post-migration

- **CLAUDE.md mirror rules** update: Tasks DB and Roadmap DB sections re-point at Linear. Notion-side rules for Decisions, Content, Vendors stay.
- **Notion Tasks DB** doesn't get deleted — it stays as the historical archive. New tasks land in Linear only.
- **Notion Roadmap DB**: separate migration pass once Linear Projects are populated. The 3 projects above seed it.

## What Grace needs to do *right now* (before next session)

1. **Open Linear → Switch teams panel** → confirm `ENG` and `GROW` exist (rename if defaults differ).
2. **Settings → Workflow** (per team) → add `Blocked` state.
3. **Settings → Cycles** (per team) → set 2-week cadence, Monday start, first cycle 2026-05-18, auto-add OFF.
4. **Settings → Labels** → create the 8 labels above. (Linear's label UI accepts colours; pick anything close.)
5. **Projects → New project** ×3 — create the three named above.

Total time: ~5 min if no distractions.

## What happens after that

Restart this Claude session so the Linear MCP loads. Then say "run the migration" and I'll port every open Notion Tasks row into Linear with the mapping above, in one batch, with no CSV gymnastics.
