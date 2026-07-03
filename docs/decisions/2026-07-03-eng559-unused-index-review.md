# ENG-559 - unused index review closeout

- **Date:** 2026-07-03
- **Area:** Postgres performance / Supabase advisor hygiene
- **Status:** Resolved - no index drops staged
- **Linear:** ENG-559

## Summary

ENG-559 was reopened for backlog-zero even though it had been intentionally
deferred. I refreshed the live Supabase performance advisor and classified the
current `public` schema indexes using `pg_stat_user_indexes`, `pg_index`, and
`pg_constraint`.

Current result: do **not** drop indexes from this signal. The advisor still
reports `unused_index` notices, but the underlying data remains sparse enough
that `idx_scan = 0` is weak evidence and the potential gain is negligible.

## Live evidence

Read-only Supabase checks on 2026-07-03:

- Stats window: `pg_stat_database.stats_reset = 2026-03-30 19:02:21.724308+00`.
- Public indexes: 224 total, 3528 kB total footprint.
- Zero-scan indexes: 90, 1104 kB total footprint.
- Zero-scan constraint/unique/primary-key indexes: 54.
- Zero-scan plain secondary indexes: 36, 472 kB total footprint.
- Performance advisor still emits 36 `unused_index` INFO notices, plus unrelated
  RLS policy performance warnings.

The largest plain secondary candidates are 24 kB each
(`idx_recipes_dietary_flags`, `recipes_allergens_gin_idx`). Most are 8-16 kB.
Several flagged tables have zero or single-digit live rows, including
`recipe_reports`, `dmca_takedowns`, `food_sources`, `follows`, and
`referral_credits`, so the planner has little reason to prefer secondary index
access yet.

## Candidate review

The 36 plain secondary candidates fall into these buckets:

| Bucket | Examples | Decision |
|---|---|---|
| FK / cascade support | `app_notifications_recipe_id_idx`, `recipe_ingredients_step_id_idx`, `meal_plan_meals_recipe_id_idx`, `idx_user_food_flags_user_food_id`, `food_sources_food_id_idx` | Keep. These are cheap FK-support indexes and protect deletes/joins when tables grow. |
| Sparse launch/admin paths | `admin_users_granted_by_idx`, `dmca_takedowns_status_submitted_idx`, `recipe_reports_status_submitted_idx`, `recipe_reports_recipe_idx`, `stripe_webhook_events_received_at_idx`, `revenuecat_events_received_at_idx` | Keep. Low scan counts reflect low operational volume, not dead purpose. |
| Household/referral flows | `idx_household_members_household`, `idx_household_members_preset`, `idx_households_invite_expiry`, `idx_households_disbanded`, `referral_credits_referrer_id_idx`, `referral_credits_code_idx` | Keep. These are flow-specific and tiny; removing them would buy bytes while risking slower hot-path cleanup/redeem queries later. |
| Recipe discovery/import filters | `idx_recipes_cuisine`, `idx_recipes_dietary_flags`, `idx_recipes_cook_time_min`, `recipes_lower_title_idx`, `recipes_allergens_gin_idx`, `recipes_claimed_source_url_idx`, `recipe_claims_source_url_idx` | Keep. These support planned/active recipe discovery, onboarding seed lookup, and creator/import moderation flows. Current recipe cardinality is only 37 rows. |
| User food verification/barcode paths | `idx_user_foods_barcode`, `user_foods_submitted_by_idx`, `user_foods_verified_by_idx`, `idx_vfc_source_user_food` | Keep. These support barcode lookup, verification queue, and canonical-food backrefs; current table cardinality is too small to prove disuse. |
| Meal/saved item ordering | `user_saved_meal_items_meal_position_idx`, `meal_plan_meals_leftover_of_idx` | Keep. These are flow-specific ordering/leftover lookup indexes with existing table index activity. |

No candidate is a clear duplicate or redundant prefix where the safer answer is
an unconditional drop. Earlier review on 2026-06-02 also found no duplicate or
redundant indexes.

## Decision

Close ENG-559 as resolved with no migration. Dropping the 36 advisor-reported
plain secondary indexes would save about 472 kB and risks removing support for
foreign-key cleanup, moderation queues, referral/promo flows, household sharing,
recipe discovery, and food verification.

`unused_index` is a blunt INFO-level lint. In this database it is still mostly a
low-cardinality / unexercised-path signal, not a dead-index proof.

Confidence: 8/10. The evidence is strong for "no drop now"; the remaining
uncertainty is normal launch traffic growth, which can change index usefulness
later.

## If revisited

Reopen only when at least one of these is true:

- A table with an advisor-reported secondary index has meaningful cardinality
  and sustained traffic.
- A duplicate-index check finds a true redundant prefix or equivalent predicate.
- Storage/write overhead becomes measurable rather than theoretical.

Then rerun the same classification query, inspect the relevant migration
rationale, and stage any justified drops in a single migration using
`DROP INDEX CONCURRENTLY`. Per project rules, do not apply committed migrations
via Supabase MCP.

## Verification

- Read Supabase changelog on 2026-07-03; no relevant `pg_stat_user_indexes` or
  index DDL breaking change found.
- Ran Supabase performance advisors against project `fnfgxsignmuepshbebrl`.
- Ran read-only index inventory queries against the live database.
- Grepped `supabase/migrations/`, `supabase/schema.sql`, and docs for the 36
  advisor-reported plain secondary index names.

## Cross-platform parity

N/A. This is a database performance review with no schema or app behavior
change. Web and mobile continue to use the same database contract.
