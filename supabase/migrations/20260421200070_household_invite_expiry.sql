-- Security audit M1 (2026-04-21): invite code expiry.
--
-- Before: `households.invite_code` was static for the lifetime of the
-- household. If a code leaked (screenshot in chat, email forward,
-- ex-member retaining knowledge) there was no mechanism short of the
-- owner deleting the household to invalidate it.
--
-- After: an optional `invite_code_expires_at` timestamp. The join route
-- rejects codes whose expiry has passed. NULL is allowed (legacy rows
-- are treated as non-expiring until the owner rotates) but newly
-- created households stamp 7-day expiry at insert time, and any
-- membership churn (owner reset, member leave, owner leave-delete)
-- rotates the code and re-stamps the expiry.

alter table public.households
  add column if not exists invite_code_expires_at timestamptz;

-- Partial index for the join-route predicate: we look up by code and
-- want to short-circuit expired rows cheaply. The base unique index on
-- `invite_code` already makes the equality lookup O(log n); this
-- secondary index keeps the expiry filter indexed.
create index if not exists idx_households_invite_expiry
  on public.households (invite_code, invite_code_expires_at);

NOTIFY pgrst, 'reload schema';
