# Migration baseline (ENG-1369)

## The gap

None of the 173 tracked migrations under `supabase/migrations/` contain a
`CREATE TABLE` for the core tables the product runs on — `profiles`,
`recipes`, `nutrition_entries` (the "meals" log), `saves`, `ingredients`,
`user_foods`, and 40+ others. The only tracked `CREATE TABLE` in the entire
migrations directory is
`20260510100000_deleted_health_samples.sql` (one table, added 2026-05-10).

Verified live against the Suppr Supabase project (`fnfgxsignmuepshbebrl`) via
read-only introspection on 2026-07-05: **47 tables exist in `public`**; only
1 has a tracked `CREATE TABLE`. The other 46 — including every core table —
predate the migration history. The schema was stood up before migrations
were adopted as the source of truth, and every migration since has only ever
`ALTER`ed, indexed, or added policies onto tables that were never captured in
files.

Practical effect: **the database cannot be rebuilt from
`supabase/migrations/` alone.** A fresh `supabase db reset` or a new
staging/branch DB replays only the alters — never the base tables — so it
produces an empty, broken schema. The migration chain is only meaningful
*relative to* the already-existing live DB, not as a standalone history.

(`supabase/schema.sql` is a separate, older, hand-maintained "Phase 0"
reference last touched 2026-06-19 — pre-dating dozens of migrations since. It
is not authoritative and should not be treated as a substitute for the
baseline described here; it has the same class of drift problem this ticket
exists to fix, just informally. Out of scope for ENG-1369 to reconcile.)

## The fix: a schema-only baseline dump

A **schema-only** (no data) `pg_dump` of the live database, checked into the
repo as a dated reference file:

```
supabase/schema-baseline-2026-07.sql
```

### What this file is

- A point-in-time snapshot of the **entire live schema** (every table,
  column, default, constraint, index, RLS policy, function, trigger) as of
  its dump date.
- Combined with **every migration file dated after that dump**, it fully
  reproduces the live schema. That's the rebuild contract:

  > `schema-baseline-2026-07.sql` (applied first) + all
  > `supabase/migrations/*.sql` files timestamped after the dump date =
  > the live schema.

### What this file is NOT

- **It is not a migration.** It must never be picked up by
  `supabase migration` tooling, `supabase db push`, or `supabase db reset`.
  This is why it lives at `supabase/schema-baseline-2026-07.sql` — directly
  under `supabase/`, *outside* `supabase/migrations/` — and deliberately does
  not match that directory's naming convention
  (`YYYYMMDDHHMMSS_description.sql`, enforced by every one of the 173 files
  currently there). `supabase/config.toml`'s `[db.migrations] schema_paths`
  is also empty (`schema_paths = []`), so nothing auto-includes it as a
  schema file either. It is inert to every piece of Supabase CLI tooling by
  construction — a reference artifact, read by humans, not executed by
  anything.
- **It is not a substitute for ongoing migrations.** All schema changes
  continue to go through `supabase/migrations/` as normal. This file is
  never re-dumped on every change — only when it's next useful to re-baseline
  (e.g., if the migration count grows unwieldy again, or before a major
  rebuild-tooling investment).
- **It does not replace live-DB verification.** Per
  `project_migration_drift_applied_edit_hazard` — editing an already-applied
  migration is invisible to `db push` (it skips applied versions). RLS and
  schema state must still be verified against the **live DB**, not inferred
  from files. See ENG-1354 (scheduled live-RLS verification / Supabase
  advisors cron) for the complementary periodic-check tooling — same
  tooling family as this ticket, coordinated per the Linear ticket body.

## How to generate it

This dump requires a `pg_dump`-capable environment with the Supabase CLI
linked to the live project (or `psql`/direct DB credentials). The agent
sandbox that authored this doc had neither `pg_dump` nor `psql` installed,
and no `SUPABASE_ACCESS_TOKEN` / linked CLI session — only a read-only MCP
connection that can run individual introspection queries, not a full
`pg_dump`. Hand-assembling full DDL from `information_schema` queries was
deliberately rejected: an incomplete or subtly wrong reconstruction (a missed
constraint, trigger, default expression, or RLS policy) is worse than no
baseline, since it would look authoritative while silently failing to
reproduce the live schema.

Run this locally (or in any environment with the Supabase CLI linked):

```bash
supabase db dump --schema-only -f supabase/schema-baseline-2026-07.sql --linked
```

Then:

1. Confirm the output file contains real DDL (starts with `CREATE TABLE`,
   `CREATE POLICY`, etc.) — not the placeholder banner currently checked in.
2. Commit it as a follow-up to this doc (new commit, same ticket reference:
   `ENG-1369`).
3. If the dump date differs from `2026-07`, rename the file and update this
   doc's filename references to match (keep the `schema-baseline-<YYYY-MM>`
   pattern for future re-baselines).

## Current state as of this change

`supabase/schema-baseline-2026-07.sql` is checked in as an **explicit
placeholder** — it contains only an explanatory banner, no schema content.
It must not be treated as a working baseline until someone with live CLI
credentials runs the command above and replaces it with real `pg_dump`
output. Do not merge a fabricated or hand-assembled substitute in the
meantime.
