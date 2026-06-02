# Decision — Postgres backup posture: PITR upgrade vs accept free-tier 24h RPO

**Date:** 2026-06-01
**Status:** OPEN — awaiting Grace's call on spend
**Area:** Operations / production-readiness
**Owner:** Grace (spend decision)
**Blocks:** ENG-510 (B2 — backup posture + DR), production-readiness sign-off, Phase 1 public traffic
**Related:** [`docs/runbooks/disaster-recovery.md`](../runbooks/disaster-recovery.md) · [2026-05-14 production-readiness audit](2026-05-14-production-readiness-audit-verdict.md)

## Verified state (2026-06-01)

Checked via Supabase MCP `get_organization`:

- Production org `pyeqbxhowqljzkzfmhsm` ("suppr") is on the **`free` plan**.
- Single project `fnfgxsignmuepshbebrl` ("Suppr"), region `us-west-2`, Postgres 17, `ACTIVE_HEALTHY`.

What the free plan delivers for the database:

| Property | Free (current) | Pro + PITR add-on |
|---|---|---|
| Backup type | Daily logical backup | Continuous WAL (PITR) |
| RPO (max data loss) | **24 hours** | **≤5 minutes** |
| Retention | 7 days rolling | 7 / 14 / 28 days (add-on tier) |
| Restore granularity | Whole-DB → new project | Any second in window → new project |
| Rehearsal branches (`supabase branches`) | ❌ not available | ✅ available |

## The problem this surfaces

Two things are *not* possible on the free plan, both of which the DR runbook assumes:

1. **PITR recovery** (S1/S2/S4 "with PITR" paths) — anything written between the last nightly backup and a failure is unrecoverable. At Phase 1 public traffic that's potentially a full day of user logs, recipes, and plans gone.
2. **Rehearsing the restore** — the quarterly rehearsal protocol uses `supabase branches create`, a Pro feature. So today the restore is both un-rehearsed *and* un-rehearsable as written. "A restore that has never been rehearsed is a restore that doesn't exist."

## Options

### Option A — Upgrade to Pro + PITR (recommended for Phase 1)
- **Cost:** Pro ~$25/mo + PITR add-on (7-day PITR ~$100/mo at 2026 pricing; confirm live in dashboard — it scales with DB size, currently tiny).
- **Buys:** RPO ≤5min, rehearsal branches, in-place restore options, longer retention.
- **Trade-off:** real recurring cost while pre-revenue. But this is the single load-bearing data-safety control before letting strangers' data into the DB.

### Option B — Accept free-tier 24h RPO until first revenue
- **Cost:** £0.
- **Buys:** nothing changes; document and accept that a disaster loses up to 24h of writes and the restore is un-rehearsed.
- **Trade-off:** acceptable at N=1 TestFlight (today). **Not** acceptable once Phase 1 onboards real users with data they expect to persist. Becomes a reputational + trust risk the moment a restore is actually needed.

### Option C — Upgrade to Pro only (no PITR add-on), interim
- **Cost:** ~$25/mo.
- **Buys:** rehearsal branches (can finally time a restore), longer/configurable backups — but **still daily**, so RPO stays ~24h until the PITR add-on is enabled.
- **Trade-off:** cheap way to make the restore rehearsable and de-risk the *process* without paying for the ≤5min RPO yet. Reasonable stepping-stone.

## Recommendation

**Option A before Phase 1 public traffic; Option C as the minimum if A's monthly cost is unpalatable pre-revenue.** Do not enter Phase 1 on Option B — un-rehearsed + 24h-RPO is the posture the 2026-05-14 audit explicitly flagged as a launch blocker. The cost is small relative to the cost of telling early users their data is gone with no rehearsed recovery.

Timing: this only has to be live **before** Phase 1 onboarding begins (target 2026-07-01), not today. Safe to stay on free through the rest of TestFlight, then upgrade as part of the Phase-0→Phase-1 cutover, immediately followed by the first timed restore rehearsal.

## Decision

_Grace to record: chosen option + date. On choosing A or C, the first action is a timed restore rehearsal recorded in the DR runbook rehearsal log; then ENG-510's remaining checklist boxes can close and Blocker 2 flips to Closed._
