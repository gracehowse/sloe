# Referral Rewards

**Owner:** Growth / Platform  
**Last updated:** 2026-07-01  
**Linear:** ENG-1236

## User Flow

Signed-in users can generate a personal invite link from the household invite
surface on web and mobile. The link points to `/g/<code>`, stores the referral
code locally, and sends the invitee into onboarding. After the invitee finishes
setup with a real Supabase session, onboarding redeems the pending code.

## Backend Contract

`supabase/migrations/20260701103000_eng1236_referral_reward_loop.sql` owns the
referral contract:

- `referrals`: one code per referrer.
- `referral_credits`: immutable redemption ledger with `referrer_days` and
  `referee_days`, currently 30 each.
- `get_or_create_referral_code()`: authenticated RPC for creating/reading the
  caller's code.
- `redeem_referral_code(code)`: authenticated RPC that rejects self-referral,
  invalid codes, flagged codes, and duplicate referee redemptions.

Clients never insert referral rows directly.

## Rollout

The visual invite card is gated by `referral_invite_loop_v1`, default-on for the
beta growth build on both web and mobile. Turning the flag off hides only the
referral card; the existing household email invite and join-code fallback remain
live.

## Entitlement Boundary

The referral ledger is the server-owned reward source. Billing/provider surfaces
must continue to read Stripe, RevenueCat, and tier state truthfully; do not imply
a Stripe or App Store subscription exists from referral credits alone.
