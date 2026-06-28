#!/usr/bin/env bash
# Apply ENG backlog migrations to the linked Supabase prod project.
#
# Canonical path per CLAUDE.md — NEVER use MCP apply_migration for tracked files.
#
# Prerequisites:
#   export SUPABASE_ACCESS_TOKEN='sbp_…'   # https://supabase.com/dashboard/account/tokens
#   npx supabase link --project-ref fnfgxsignmuepshbebrl   # once per machine
#
# Usage:
#   ./scripts/apply-eng-backlog-migrations.sh
#   ./scripts/apply-eng-backlog-migrations.sh --dry-run
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "error: SUPABASE_ACCESS_TOKEN is not set" >&2
  echo "Create a token at https://supabase.com/dashboard/account/tokens" >&2
  exit 1
fi

echo "== Pending migrations (2026070212*) =="
ls -1 supabase/migrations/2026070212*.sql

echo ""
echo "== Remote state before push =="
npx supabase migration list --linked | tail -20

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo "[dry-run] Would run: npx supabase db push --linked"
  exit 0
fi

echo ""
echo "== Applying migrations =="
npx supabase db push --linked

echo ""
echo "== Remote state after push =="
npx supabase migration list --linked | tail -20

echo ""
echo "== Post-apply verification (ENG-1244 / ENG-870) =="
VERIFY_SQL="
select relname, relrowsecurity
from pg_class
where relname in ('recipe_claims', 'recipes')
  and relnamespace = 'public'::regnamespace;

select policyname, cmd, qual, with_check
from pg_policy
where tablename = 'recipes' and policyname = 'recipes_update_own';

select conname
from pg_constraint
where conname = 'recipes_claimed_requires_verified_claim';

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in (
    'community_food_share_consent',
    'community_food_share_consent_at',
    'body_fat_pct_by_day'
  );

select proname
from pg_proc
where proname = 'mark_recipe_macros_official';
"

npx supabase db query --linked "$VERIFY_SQL"

echo ""
echo "Done. Re-run launch-readiness recipe_claims advisor check in Supabase dashboard."
