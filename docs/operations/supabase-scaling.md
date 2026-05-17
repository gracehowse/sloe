# Supabase scaling — connections, pooler, compute

Operator playbook for Suppr's production Postgres + Supavisor (pooler)
sizing. Closes ENG-517 (production-readiness audit Soft Spot 3).

## TL;DR — what to do today vs Phase 1

| Phase | Compute tier | `max_connections` | Pooler size | Action |
| --- | --- | --- | --- | --- |
| **Today (N=1 TestFlight)** | Micro (default) | 60 | 200 client conns / 15 pool | None. Current usage ~11/60 (18%). |
| **Pre-Phase 1 (2026-06-15)** | Small | 90 | ≥500 client conns / 25-30 pool | Grace: upgrade compute in Supabase dashboard before 2026-06-30. |
| **Phase 1 active (2026-07-01)** | Watch — escalate to Medium if needed | 120 if Medium | ≥1000 client conns / 60 pool | Alarm 4 (`/api/healthz` latency p99) catches connection-pool exhaustion. |

Reference: [Supabase compute sizing](https://supabase.com/docs/guides/platform/compute-add-ons).

## Production config (verified 2026-05-16)

Read via Supabase MCP `execute_sql` against
`db.fnfgxsignmuepshbebrl.supabase.co`:

| Setting | Value | Notes |
| --- | --- | --- |
| `max_connections` | 60 | Direct Postgres connections cap. |
| `superuser_reserved_connections` | 3 | Reserved for `postgres` superuser. |
| `reserved_connections` | 0 | No additional reserved pool. |
| **Effective available to app** | **57** | `max_connections - superuser_reserved_connections`. |
| `shared_buffers` | 224 MB | 28672 × 8 kB. Matches Micro compute (1 GB RAM). |
| `effective_cache_size` | 384 MB | Postgres' OS-cache estimate. |
| `work_mem` | 2.1 MB | Per-sort/hash-op memory. |

The Micro compute tier specs (per Supabase docs) are:
- 0.25 vCPU
- 1 GB RAM
- 60 `max_connections`
- Supavisor pooler: default 200 client connections, pool_size 15 in
  transaction mode.

**The Supavisor pooler config (`pool_size`, `max_client_conn`) is
NOT readable via SQL** — it lives at the Supabase platform layer.
Verify in dashboard at:
`Project → Database → Connection pooling → Configuration`.

## Current usage baseline (N=1)

```
total_connections: 11
       active:      1
       idle:        8
       idle_in_tx:  0
distinct_users:     3
distinct_apps:      6
```

At 11/60 connections used, we're at 18% of cap with one tester. Plenty
of headroom today.

## Phase 1 headroom analysis

Conservative assumption: 10,000 monthly viral-spike users → ~1,000
concurrent during peak hour → ~100 RPS to Supabase via the API.

**Two paths to Postgres in production:**

1. **Direct connection (port 5432)** — used by long-lived servers
   (e.g. background workers, cron jobs). Max 57 concurrent.
2. **Supavisor pooler (port 6543, transaction mode)** — used by
   serverless functions (Vercel API routes, Edge functions). The
   pooler maintains a pool of N database connections and lets up to
   M client connections share them. Defaults: M=200, N=15 on Micro.

Suppr is mostly serverless (Vercel + Supabase Edge functions), so
the pooler path is the hot path. The math:

- 200 client connections / 100 RPS = 2 seconds of average client-side
  budget before queue. Fine for sub-second API calls; tight for the
  AI-suggestion endpoints (3-5s).
- 15 transaction-mode pool / 100 RPS = each backend connection sees
  ~7 queries/sec. Postgres can handle that on Micro.

**Verdict:** Micro is borderline at 1,000 concurrent users.

**Recommendation:** upgrade to **Pro plan + Small compute** before
Phase 1 launch (2026-06-30). Specs:
- 1 vCPU (4× Micro)
- 2 GB RAM (2× Micro)
- 90 `max_connections`
- Supavisor pooler default ~500 client connections, pool_size 25-30.

That gives ~5× the headroom on direct connections and ~2.5× on
pooler client connections, comfortably above the 10× p99 target in
the Linear ENG-517 done criteria (current p99 is roughly 10 concurrent
on N=1 — Pro Small handles 100+ comfortably).

## How to verify pooler sizing in the dashboard

(Grace action, ~5 minutes.)

1. Open [the project dashboard](https://supabase.com/dashboard/project/fnfgxsignmuepshbebrl/database/pooler).
2. Read off:
   - **Mode** — should be `Transaction` (the serverless-friendly mode).
   - **Pool size** — number of backend connections the pooler holds.
   - **Max client connections** — number of simultaneous clients the
     pooler accepts.
3. Cross-check the values against the table at the top of this doc
   for the current compute tier.
4. If sizing is below the "Pre-Phase 1" row before 2026-06-30,
   upgrade compute (Project → Settings → Compute & Disk → Upgrade).

## How to monitor in production

Two metrics tell you the pool is saturated:

1. **`pg_stat_activity` total connections** — if regularly > 80% of
   `max_connections`, upgrade compute. Query:
   ```sql
   SELECT count(*) AS total FROM pg_stat_activity
   WHERE datname = current_database();
   ```
2. **`/api/healthz` p99 latency** — Alarm 4 in
   `docs/operations/alerting.md` watches this. A connection-starved
   pool surfaces as healthz-failure-rate spike before queries start
   erroring.

If either threshold is hit during Phase 1, the fastest mitigation
is an in-place compute upgrade (no downtime — Supabase swaps the
underlying VM and re-routes traffic).

## Audit history

| Date | Tier | `max_connections` | Notes |
| --- | --- | --- | --- |
| 2026-05-16 | Micro | 60 | Initial production-readiness verification. N=1 traffic, 18% utilisation. |

Update this table whenever the compute tier changes.

## Related

- `supabase/config.toml` lines 18-20 — local-dev pooler config
  (`pool_size = 20`, `max_client_conn = 100`). These are LOCAL ONLY
  and do NOT affect production. Production sizing is governed by the
  Supabase dashboard.
- `docs/operations/alerting.md` — Alarm 4 (healthz p99) catches
  pool exhaustion at runtime.
- `docs/runbooks/disaster-recovery.md` — restore procedures if
  the database itself fails.
