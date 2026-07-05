-- ENG-1393 (2026-07-05 deep-audit, live-DB security & RLS, finding DI-01) —
-- close the user_foods INSERT verification-escalation hole.
--
-- THE BUG (confirmed against the live DB): "Users can insert user foods"
-- (20260414180000_create_user_foods_table.sql) is `WITH CHECK (submitted_by =
-- auth.uid())` only — no restriction on verification_status, verified_by,
-- verified_at, upvotes, or downvotes. The UPDATE-side state-machine guard
-- (user_foods_guard_status_transition, 20260512100000) is `BEFORE UPDATE`
-- only and never fires on INSERT — exactly the same class of gap ENG-1035
-- closed on `profiles` two months ago. So any authenticated client can:
--     INSERT INTO user_foods (barcode, name, calories, protein, carbs, fat,
--       submitted_by, verification_status, verified_at, upvotes)
--     VALUES ('...', '...', 1, 1, 1, 1, auth.uid(), 'verified', now(), 999);
-- The after-INSERT trigger (user_foods_after_status_change, also 20260512100000)
-- then immediately promotes that row into `verified_food_canonical` — the
-- table every barcode lookup consults FIRST — with zero admin review. One
-- authenticated request poisons a shared corpus every user's calorie
-- tracking reads. Nutrition trust-label integrity is CLAUDE.md's
-- never-defer cluster, so this is a same-day fix, not a backlog item.
--
-- WHY AN INSERT TRIGGER (not a WITH CHECK RLS clause): the votes/verified_by
-- FK columns need clearing, not just rejecting — the client should be able
-- to submit a correction without every field pre-populated by the app being
-- treated as an attack. Mirrors the ENG-1035 approach: compare the inserted
-- value against the ALLOWED DEFAULT (here 'pending', not 'free'), because
-- `OLD` is NULL on INSERT so old-vs-new diffing doesn't apply.
--
-- Verified against actual app write paths before writing this trigger:
-- submitFoodCorrection.ts (the only INSERT/upsert call site, shared by web
-- + mobile) never sets verification_status, verified_by, verified_at,
-- upvotes, or downvotes — they all rely on column DEFAULTs. So this trigger
-- has zero legitimate-traffic impact; it only rejects payloads that
-- deliberately set fields no real client ever sends.
--
-- Service-role writers (the consensus job, admin SQL, any future
-- server-side seeding) bypass via the same auth.role() check ENG-1035 uses.
--
-- FORWARD-ONLY SAFE: adds a function + a BEFORE INSERT trigger; touches no
-- existing column, policy, or trigger.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration — MCP
-- rewrites schema_migrations.version to wall-clock NOW(), drifting from the
-- future-dated filename prefix used for monotonic ordering).

set search_path = public;

create or replace function public.user_foods_insert_lockdown()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Service-role writers (consensus job, admin tooling) bypass entirely.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- verification_status may only ever be inserted as the 'pending' default
  -- from the client. NULL is allowed (the column DEFAULT fills it
  -- post-trigger); comparing the explicit value catches a client that sets
  -- verification_status='verified' directly in the INSERT payload.
  if new.verification_status is not null and new.verification_status is distinct from 'pending' then
    raise exception 'user_foods.verification_status may only be inserted as ''pending'' from the client (ENG-1393: INSERT lockdown). Verification must go through admin review or the service-role consensus job.'
      using errcode = '42501';
  end if;

  -- A client must never pre-stamp its own submission as reviewed or
  -- pre-seed vote counts — all three are admin/consensus-job territory.
  if new.verified_by is not null then
    raise exception 'user_foods.verified_by is not client-writable on INSERT (ENG-1393: INSERT lockdown).'
      using errcode = '42501';
  end if;

  if new.verified_at is not null then
    raise exception 'user_foods.verified_at is not client-writable on INSERT (ENG-1393: INSERT lockdown).'
      using errcode = '42501';
  end if;

  if coalesce(new.upvotes, 0) <> 0 or coalesce(new.downvotes, 0) <> 0 then
    raise exception 'user_foods.upvotes/downvotes must be inserted as 0 from the client (ENG-1393: INSERT lockdown).'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists user_foods_insert_lockdown_trg on public.user_foods;

create trigger user_foods_insert_lockdown_trg
before insert on public.user_foods
for each row
execute function public.user_foods_insert_lockdown();

comment on function public.user_foods_insert_lockdown is
  'ENG-1393 (2026-07-05 deep audit, DI-01): rejects client-side INSERT of user_foods.verification_status != ''pending'', or any non-null verified_by/verified_at, or non-zero upvotes/downvotes. Closes the born-verified corpus-poisoning hole left open because user_foods_guard_status_transition only fires BEFORE UPDATE. Service-role writers bypass via auth.role(). Mirrors profiles_tier_column_insert_lockdown (ENG-1035). See docs/audits/2026-07-05-deep-audits/audit1-live-db-security/findings.json.';

comment on trigger user_foods_insert_lockdown_trg on public.user_foods is
  'Blocks born-verified INSERT into user_foods (ENG-1393 / 2026-07-05 deep audit DI-01). Pairs with user_foods_guard_status_transition (BEFORE UPDATE).';

notify pgrst, 'reload schema';
