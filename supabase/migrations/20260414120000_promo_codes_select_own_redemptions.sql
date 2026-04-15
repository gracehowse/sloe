-- Allow users to read promo_codes rows they have redeemed (tier merge with RevenueCat sync).
-- Without this, embedded selects from promo_redemptions return null for promo_codes.

drop policy if exists "promo_codes_select_own_redemptions" on public.promo_codes;

create policy "promo_codes_select_own_redemptions"
on public.promo_codes
for select
to authenticated
using (
  exists (
    select 1
    from public.promo_redemptions r
    where r.promo_code_id = promo_codes.id
      and r.user_id = auth.uid()
  )
);
