# Supabase migration drift — inventory

## Status (linked project **Suppr**)

**Resolved on production (2026-04-18):** `supabase db push --linked` completed through **`20260421180000`**. **`supabase migration list --linked`** now shows **Remote** populated for every local version (no empty middle column).

**What we changed in-repo to unblock push:**

1. **`20260418120000_realtime_notification_tables.sql`** — `to_regclass(...)` guards before `ALTER PUBLICATION … ADD TABLE` (prod had missed `creator_publish_notifications` while history looked healthy).
2. **`supabase/scripts/ensure_creator_publish_notifications.sql`** — run once via `supabase db query --linked -f …` before push so the table + trigger exist.
3. **`20260419100000_recipes_rls_published_only.sql`** — `DROP POLICY IF EXISTS` for **`recipes_select_published_or_own`** before `CREATE` (policy already existed on prod).
4. **`20260420100000_household_planning.sql`** — `create extension if not exists pgcrypto` and **`encode(extensions.gen_random_bytes(6), 'hex')`** for `invite_code` (extension lived in `extensions` schema; unqualified `gen_random_bytes` failed).

**Historical capture:** first inventory commit **`d3cdc3d`**; interim notes **`61e4425`** / **`c07c667`** (known-debt docs).

---

## Previously pending (now applied on remote)

These were the gap **after `20260418100000`** before reconcile:

| Version | Migration file |
|---------|----------------|
| `20260418120000` | `20260418120000_realtime_notification_tables.sql` |
| `20260419100000` | `20260419100000_recipes_rls_published_only.sql` |
| `20260419100001` | `20260419100001_profiles_delete_own.sql` |
| `20260419100002` | `20260419100002_nutrition_entries_user_date_index.sql` |
| `20260420100000` | `20260420100000_household_planning.sql` |
| `20260421100000` | `20260421100000_user_favorite_foods.sql` |
| `20260421110000` | `20260421110000_caffeine_alcohol_tracking.sql` |
| `20260421120000` | `20260421120000_user_saved_meals.sql` |
| `20260421130000` | `20260421130000_recipe_ingredients_overrides.sql` |
| `20260421140000` | `20260421140000_user_recipe_notes_ratings.sql` |
| `20260421150000` | `20260421150000_user_custom_foods.sql` |
| `20260421160000` | `20260421160000_plan_templates_and_leftovers.sql` |
| `20260421170000` | `20260421170000_streak_freeze_weekly_recap.sql` |
| `20260421180000` | `20260421180000_remove_all_seeded_recipes.sql` |

**Earlier manual hotfix:** caffeine / alcohol `profiles` columns were applied before history caught up (`supabase/scripts/apply_caffeine_alcohol_columns.sql`); migration **`20260421110000`** then ran cleanly with `IF NOT EXISTS` notices.

---

## Pending after 2026-04-18 push (not yet on remote)

| Version | Migration file | Notes |
|---------|----------------|-------|
| `20260424100000` | `20260424100000_custom_foods_servings_micros_barcode.sql` | Five optional columns + partial unique barcode index on `user_custom_foods`. |
| `20260424110000` | `20260424110000_weekly_recap_push_last_sent.sql` | `profiles.last_weekly_recap_push_sent_at timestamptz`, dedupe column for the weekly-recap cron. |
| `20260424120000` | `20260424120000_household_members_unique_user.sql` | Dedupe + add `UNIQUE (user_id)` on `household_members`. Closes the AB75VswC "Couldn't load household" crash. |

Apply with `supabase db push --linked` once per new file. Each migration is idempotent (`DO $$ ... IF NOT EXISTS`, `add column if not exists`, dedupe-before-constraint) so repeated pushes are safe.

---

## Playbook — if drift happens again

1. **`supabase migration list --linked`** — find first row with empty **Remote**.
2. **`supabase db push --linked`** (or SQL editor for surgical fixes), fix idempotency in the failing migration file if prod already partially matches.
3. **`migration repair`** only when you applied SQL **outside** the tracked migration and need history to match.
4. Re-list until no gaps.

## Refresh

```bash
supabase migration list --linked
```

For a name-joined drift report (matched / drifted / local-only / remote-only), use the in-repo
script which queries `supabase_migrations.schema_migrations` directly:

```bash
npm run check:migrations            # informational (exit 0)
npm run check:migrations -- --strict # fail (exit 1) when there are local-only migrations
```

This is also wired into `npm run prelaunch:checklist` as a non-failing summary step.

---

## Why drift recurs

Drift in `supabase_migrations.schema_migrations.version` is **not** caused by `supabase db push`.
It comes from two paths that both call the Supabase Management API without a `version` parameter,
which makes the API stamp the row with wall-clock `NOW()`:

- **Supabase MCP `apply_migration`** — verified from the open-source MCP server source
  (`supabase-community/supabase-mcp`):
  - `packages/mcp-server-supabase/src/tools/database-operation-tools.ts` (lines 84–96, 332–347)
    builds the request without a `version` field.
  - `packages/mcp-server-supabase/src/platform/api-platform.ts` (lines 214–237) `POST`s to the
    `/v1/projects/{ref}/database/migrations` Management API endpoint. With no `version` in the body,
    the platform inserts `to_char(now(), 'YYYYMMDDHH24MISS')` as the row's version.
- **Supabase Dashboard SQL editor "Save as migration"** — same Management API endpoint, same
  behaviour. Treat it identically to MCP `apply_migration`.

**Canonical apply path: `supabase db push --linked` only.** It preserves the timestamp encoded in
the local filename, so `version` matches `<14-digit prefix>` and the row stays in lockstep with the
file you committed.

**Current state (2026-04-20):** zero drift. `npm run check:migrations` reports
64 rows matched cleanly, 0 drifted, 0 local-only, 0 remote-only.

**How it was resolved.** Grace attempted `supabase db push --linked` on 2026-04-20
to apply three new migrations (`profiles_stripe_customer_id`, `web_push_subscriptions`,
`profiles_tz_iana`). The CLI refused because of the 12-row drift catalogued above.
Rather than run `supabase migration repair --status reverted ...` followed by a
re-push — which would have re-executed the drifted migrations' SQL and failed on
non-idempotent `CREATE POLICY` statements like
`20260419100001_profiles_delete_own.sql` — the resolution was:

1. `UPDATE supabase_migrations.schema_migrations SET version = '<local-version>'
   WHERE version = '<drifted-version>'` for each of the 12 drifted rows. Pure
   bookkeeping: keeps the existing `statements`/`name` payload, swaps only the
   version text. No schema changes, no risk of non-idempotent SQL re-running.
2. Executed each of the 3 new migrations' SQL directly via `execute_sql`, then
   inserted matching `schema_migrations` rows.

Both steps used the Supabase MCP `execute_sql` tool (NOT `apply_migration`, which
is the tool that caused the original drift by stamping rows with wall-clock NOW()).
`execute_sql` runs raw SQL without touching `schema_migrations` automatically, so
we control exactly what version goes in.

**Note for future drift.** This inventory used to recommend leaving drifted rows
as-is on the theory that future pushes would "skip them by name match". That held
for older CLI versions but breaks on current ones — the CLI now rejects drifted
state and blocks `db push` until resolved. If drift recurs, the in-place UPDATE
pattern above is the safest resolution; `migration repair --status reverted` + push
is only safe when every drifted migration is genuinely idempotent.

If you need to apply a SQL change in production:

- **Always**: write the file under `supabase/migrations/<timestamp>_<name>.sql`, commit, then
  `supabase db push --linked`.
- **Never**: paste into the Dashboard SQL editor's "Save as migration" or call the MCP
  `apply_migration` for any SQL that lives (or will live) in `supabase/migrations/`. Use the
  Dashboard SQL editor's plain "Run" mode for one-off ad-hoc reads, never for schema changes.

