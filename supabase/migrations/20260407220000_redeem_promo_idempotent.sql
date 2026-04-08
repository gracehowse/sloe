-- Idempotent promo redemption: if the user already redeemed, re-apply tier instead of error.
-- Run in Supabase SQL editor if your project was created before this fix.

create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.promo_codes%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_row
  from public.promo_codes
  where code = upper(trim(p_code))
    and active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses_count < max_uses);

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  end if;

  if exists (
    select 1 from public.promo_redemptions r
    where r.user_id = v_uid and r.promo_code_id = v_row.id
  ) then
    insert into public.profiles (id, user_tier)
    values (v_uid, v_row.tier)
    on conflict (id) do update set user_tier = excluded.user_tier;
    return jsonb_build_object('ok', true, 'tier', v_row.tier, 'already_redeemed', true);
  end if;

  insert into public.profiles (id, user_tier)
  values (v_uid, v_row.tier)
  on conflict (id) do update set user_tier = excluded.user_tier;

  insert into public.promo_redemptions (user_id, promo_code_id)
  values (v_uid, v_row.id);

  update public.promo_codes
  set uses_count = uses_count + 1
  where id = v_row.id;

  return jsonb_build_object('ok', true, 'tier', v_row.tier, 'already_redeemed', false);
end;
$$;
