# Referral Rewards

**Audience:** Product / Design / Engineering

## Why this exists

A referral programme turns existing users into an acquisition channel that
costs nothing until it actually works — a personal invite from someone you
know converts far better than an ad, and rewarding both sides (the person
who invites, and the friend who joins) gives an existing user an actual
reason to bother sharing. For Suppr, referrals sit alongside organic
word-of-mouth as a low-cost way for new users to arrive: any signed-in user
can generate a personal invite link, and when someone new joins through it,
both people are meant to earn 30 days of Pro.

## Current status: switched off

As of 2026-07-12, the referral invite card and the whole redemption loop are
turned off by default on both web and mobile. The household invite flow it
normally sits alongside (see below) is unaffected and stays live.

The loop was turned off because it makes a promise — "you'll both get 30
days of Pro" — that the product can't yet keep automatically. Suppr can
record that a referral happened, but nothing currently turns that record
into an actual Pro-tier grant; that grant logic depends on the same
paid-checkout pipeline (real payment in, real entitlement out) that the rest
of monetisation was paused on. Rather than leave the referral card live and
let people believe they'd earned a reward that never actually lands,
product turned the whole loop off until that pipeline is finished. Full
context: [Launch is blocked until a working paid rail is
live](../decisions/2026-07-12-launch-blocked-on-paid-rail.md).

**"Off" means the whole loop, including the public landing page (ENG-1541,
2026-07-20).** The invite-generation card was flag-gated from day one, but
the initial fix only removed the flag from the default-on list — the public
`/g/<code>` landing page itself has no server-side gate on the URL (it's a
real route) and kept showing the "30 Pro reward days" promise, capturing the
code, and calling the redeem RPC to any visitor regardless of the flag.
ENG-1541 closed that gap: the landing page now reads the flag and shows
neutral "you've been invited" copy with no code capture when off, and the
capture/redemption pipeline checks the same flag before writing to
`localStorage` or calling the redeem RPC — so a code from before the flag
flipped off sits inert rather than being silently redeemed. Re-enable
alongside the entitlement-grant wiring (ENG-1487).

## How the loop works, once it's switched back on

1. A signed-in user opens the invite screen — the same screen used to
   invite someone into a household — and generates a personal link.
2. Anyone who opens that link and doesn't already have an account is walked
   into onboarding, with their pending invite remembered for the rest of
   sign-up.
3. Once the new person finishes onboarding and has a real account, the
   invite is redeemed automatically — both the inviter and the new user are
   meant to receive 30 days of Pro.

This is a separate system from a household invite, even though the two
share a screen. Inviting someone into your household — so you can plan
meals and shop together — doesn't earn anyone a referral reward on its own,
and redeeming a referral link doesn't add you to anyone's household. See
[Household sharing](../journeys/household-sharing.md) for the household
side of that same screen.

## The reward is recorded server-side, not decided by the app

Every referral redemption is written once, by the server, to a permanent
record — the app itself never gets to decide "this counts, grant the
reward." That record rejects the obviously-wrong cases outright: someone
trying to redeem their own link, a code that's invalid or has been frozen,
and a second redemption from someone who's already used a code once.

## Guarding against abuse

A reward loop that pays out real product value for a signup is worth
gaming, so redemption has a few built-in checks:

- **A reward cap per referrer.** The first ten people someone successfully
  refers earn that person their reward; anyone referred after that still
  gets the new-user reward, but the referrer stops earning more days — so
  spinning up fake accounts to farm free Pro time doesn't pay off past a
  point.
- **A velocity check.** A code redeemed more than five times within 24
  hours is treated as a sign of abuse rather than organic sharing — the
  next attempt is rejected and the code is automatically frozen until
  someone reviews it.
- **A same-person check.** Beyond blocking someone from redeeming their own
  code directly, the system also recognises common ways people alias their
  own email address (plus-tagging, dot variants) and blocks those too.

## Known limitations

- **No automatic path from "redeemed" to "Pro" yet.** The system can record
  that a referral happened, but nothing yet converts that record into an
  actual subscription grant — this is the reason the whole loop is switched
  off (see Current status above).
- **Mobile can't complete a redemption yet.** Both platforms can generate
  an invite link, but only the web sign-up flow actually redeems one today.
  Someone who opens an invite link, installs the iOS app, and finishes
  onboarding inside the app won't have their referral counted — redemption
  only completes if the new person finishes onboarding on the web.
- **The reward-amount copy isn't wired to the underlying number.** The
  "30 days" language shown on the invite landing page is written by hand
  rather than pulled from wherever the actual reward amount is defined — if
  that number ever changes, the headline copy needs a manual update to
  match it.

## Related documents

- [Household sharing](../journeys/household-sharing.md) — the household
  invite flow that shares a screen with the referral card, and why the two
  are separate systems.
- [Marketing → signup journey](../journeys/marketing-to-signup.md) — the
  full walk from someone opening an invite link through to onboarding and
  redemption, including the mobile redemption gap above.
- [Subscriptions: Stripe (web) and IAP
  (mobile)](./subscriptions-stripe-and-iap.md) — how a real purchase
  becomes a Pro entitlement; referral credit is meant to plug into that
  same entitlement once the grant path exists.
- [Launch is blocked until a working paid rail is
  live](../decisions/2026-07-12-launch-blocked-on-paid-rail.md) — why the
  referral loop specifically, and monetisation more broadly, is paused.
