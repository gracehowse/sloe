# TestFlight → prod — resolved

Short log of tester-reported issues that were fixed in production (or schema), with enough context for release notes and drift audits.

## 2026-04-18 — Alcohol limit / hydration maps not saving

- **ASC feedback id:** `AF0btCuj90Absuf-5cw2FMc` (screenshot + comment: can’t save alcohol limit).
- **Cause:** Production `public.profiles` was missing columns from migration `20260421110000_caffeine_alcohol_tracking.sql` (`target_alcohol_g_weekly`, `extra_alcohol_g_by_day`, plus caffeine columns shipped in the same migration). App updates failed without obvious schema errors in some paths.
- **Fix:** Applied idempotent DDL on the linked Supabase project via  
  `supabase db query --linked -f supabase/scripts/apply_caffeine_alcohol_columns.sql`  
  (same statements as the migration file), then `NOTIFY pgrst, 'reload schema'`.
- **Verify:** Settings alcohol weekly limit and Today alcohol quick-add persist after force-quit; no client error.
- **Follow-up:** Broader migration drift vs prod remains — see **[supabase-migration-drift-inventory.md](../planning/supabase-migration-drift-inventory.md)** for the current `supabase migration list --linked` tail and reconcile notes. Do **not** `migration repair` only this version until the dependency chain is reconciled.

## 2026-04-18 — “Not intuitive” (open)

- **ASC feedback id:** `AISAWnLgU9cjRBOuEY-HuJU` — triage separately (UX / copy / layout); no prod change yet.
