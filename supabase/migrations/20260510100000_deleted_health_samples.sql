-- 20260510100000_deleted_health_samples.sql
--
-- F-130 cross-device — server-side tombstone for HealthKit sample IDs
-- the user has explicitly deleted from their journal.
--
-- Local AsyncStorage tombstone shipped in PR #137
-- (apps/mobile/lib/deletedHealthSamples.ts). This makes it survive
-- reinstall + sync to a future second device.
--
-- WHY A TABLE NOT A JSONB COLUMN ON profiles:
--   The set grows monotonically over a user's lifetime. Rewriting an
--   array on `profiles` per delete is wasteful and contends with the
--   rest of the profile row. A table gives us a real unique constraint
--   (user_id + health_sample_id) and cheap indexed reads.
--
-- LOCK SAFETY:
--   CREATE TABLE + indexes on a brand-new relation. No existing rows,
--   no locks on hot tables.
--
-- DOWN SQL:
--   DROP TABLE IF EXISTS public.deleted_health_samples;

CREATE TABLE IF NOT EXISTS public.deleted_health_samples (
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  health_sample_id  text        NOT NULL,
  deleted_at        timestamptz NOT NULL DEFAULT now(),
  source            text        NOT NULL DEFAULT 'apple_health',
  PRIMARY KEY (user_id, health_sample_id)
);

CREATE INDEX IF NOT EXISTS deleted_health_samples_user_idx
  ON public.deleted_health_samples (user_id);

ALTER TABLE public.deleted_health_samples ENABLE ROW LEVEL SECURITY;

-- RLS: users see + write their own tombstones only. Append-only (no
-- UPDATE policy); a future "Re-import all from Apple Health"
-- affordance will use DELETE.
CREATE POLICY "deleted_health_samples_select_own"
  ON public.deleted_health_samples FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "deleted_health_samples_insert_own"
  ON public.deleted_health_samples FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "deleted_health_samples_delete_own"
  ON public.deleted_health_samples FOR DELETE
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
