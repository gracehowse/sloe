-- ENG-1637 (secondary finding, same lint run as the allergens cast fix) —
-- get_or_create_referral_code: plpgsql_check flags "control reached end of
-- function without RETURN" (sqlState 2F005), WARNING level, does not fail
-- the dep-audit-style gate.
--
-- Not a real bug: every path through the retry loop either `return`s
-- (existing code found, or a successful insert) or `raise`s (unique_violation
-- after 8 attempts) — this is a plpgsql_check false positive on an infinite
-- `loop`/`end loop` with no statically-provable exit. Adding a trailing
-- `return null;` after the loop is dead code at runtime (unreachable — the
-- loop only exits via return or raise) but silences the lint noise for
-- future `supabase db lint --linked` runs.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration — CLAUDE.md rule).

set search_path = public;

create or replace function public.get_or_create_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_attempt integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select code into v_code
    from public.referrals
   where referrer_id = v_uid
   limit 1;

  if v_code is not null then
    return upper(v_code);
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    begin
      insert into public.referrals (referrer_id, code)
      values (v_uid, v_code)
      returning code into v_code;
      return upper(v_code);
    exception
      when unique_violation then
        if v_attempt >= 8 then
          raise;
        end if;
    end;
  end loop;

  -- ENG-1637: unreachable — the loop above only exits via return or raise.
  -- Silences a plpgsql_check false positive ("control reached end of
  -- function without RETURN") on infinite loop/end loop with no static exit.
  return null;
end;
$$;

comment on function public.get_or_create_referral_code is
  'ENG-1236: authenticated referral-code mint/read RPC. Security definer so clients cannot insert arbitrary referral rows. ENG-1637 (2026-07-21): added an unreachable trailing return to silence a plpgsql_check lint false-positive; no behavior change.';

notify pgrst, 'reload schema';
