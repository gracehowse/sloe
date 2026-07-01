-- ENG-1235 — idempotent verified recipe-claim audit rows.
-- Stage this migration for `supabase db push --linked`; do not apply via MCP.

create unique index if not exists recipe_claims_verified_recipe_claimant_uidx
  on public.recipe_claims(recipe_id, claimant_id)
  where status = 'verified';

comment on index public.recipe_claims_verified_recipe_claimant_uidx is
  'ENG-1235: retries/races for owner Claim → Official keep one verified audit row per recipe claimant.';
