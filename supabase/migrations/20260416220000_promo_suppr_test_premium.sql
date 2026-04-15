-- Testing / QA: Pro tier via Settings promo redeem (web + mobile). Deactivate row in prod if undesired.
insert into public.promo_codes (code, tier, max_uses)
values ('SUPPR_TEST_PREMIUM', 'pro', 100000)
on conflict (code) do nothing;
