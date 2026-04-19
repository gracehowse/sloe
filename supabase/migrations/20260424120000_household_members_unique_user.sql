-- Prevent the multi-membership data corruption surfaced by
-- TestFlight feedback AB75VswC (2026-04-19). A user should have
-- at most one active household_members row at any time. The client
-- was already written as if this were true; formalising the
-- guarantee in the DB prevents regressions.

-- First, clean up any existing duplicates by keeping only the most
-- recently joined row per user. Older rows are discarded — safe
-- because the client was already picking one-of-many at random.
DELETE FROM public.household_members
WHERE id IN (
  SELECT id FROM (
    SELECT id, user_id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY joined_at DESC NULLS LAST, id DESC) AS rn
    FROM public.household_members
  ) ranked
  WHERE ranked.rn > 1
);

-- Then add the constraint. Idempotent guard in case it already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'household_members_user_id_unique'
  ) THEN
    ALTER TABLE public.household_members
      ADD CONSTRAINT household_members_user_id_unique UNIQUE (user_id);
  END IF;
END$$;

NOTIFY pgrst, 'reload schema';
