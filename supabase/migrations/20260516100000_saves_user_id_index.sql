-- 2026-05-16: ensure `saves(user_id)` has an explicit index.
--
-- Per-row FK constraints don't create child-side indexes automatically.
-- The saves table free-tier RLS policy (migration
-- 20260426100000_saves_free_tier_cap.sql) does:
--
--   WITH CHECK (
--     ... OR
--     (SELECT COUNT(*) FROM public.saves WHERE user_id = auth.uid()) < 10
--   )
--
-- Every save attempt pays a COUNT(*) filtered by `user_id`. Without an
-- explicit index, a power user with 1000+ saves runs a sequential scan
-- on every insert. The audit (2026-05-15 perf review) flagged this as
-- unverified — adding it idempotently here so the index is asserted in
-- the tracked migration set regardless of what an earlier untracked
-- migration may or may not have done.
--
-- The `if not exists` guard makes this safe whether prod already has
-- the index (most likely — the table predates the tracked migration
-- set) or not. CONCURRENTLY would be ideal but can't run inside
-- the implicit transaction `supabase db push` uses; the table is
-- small relative to a write-locked seq-scan-build, so non-concurrent
-- is acceptable for this column.

create index if not exists saves_user_id_idx
  on public.saves (user_id);

-- 2026-05-16: same logic for the related `recipe_id` lookup used by
-- `public.public_recipe_save_count(p_recipe_id)` and the batch
-- save-count RPC. The recipes-side FK doesn't index the saves-side
-- column.

create index if not exists saves_recipe_id_idx
  on public.saves (recipe_id);
