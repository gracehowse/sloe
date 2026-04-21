# Pro cancel downgrade path — Free, not Base

**Date:** 2026-04-21
**Area:** Billing / paywall copy
**Status:** Resolved
**Related:** docs/decisions/2026-04-21-upgrade-dialog-dynamic-upsell.md §4

## Question

When a Pro subscriber cancels, does our Stripe + webhook config return
them to Base tier or to Free tier? The Variant B renewal-note copy
("You keep Base if you downgrade.") only ships if the answer is Base.

## Verdict

**NO — Pro cancel resolves to Free, not Base.**

The Variant B copy as written is incorrect and must not ship. Change
to neutral copy: **"Manage your plan at any time."**

Flag to product-lead for sign-off on the replacement string.

## Evidence

### 1. Webhook cancel handler hard-codes `free`

`src/lib/stripe/webhookProcess.ts:144-151`

```ts
case "customer.subscription.deleted": {
  const sub = event.data.object as Stripe.Subscription;
  const userId = resolveUserIdFromSubscription(sub);
  if (userId) {
    await updateProfileTierServiceRole(userId, "free");
  }
  break;
}
```

On `customer.subscription.deleted` we unconditionally write
`profiles.user_tier = 'free'`. There is no logic that inspects whether
the user holds a second (Base) subscription and re-resolves.

The `applyTierForSubscription` helper (same file, lines 61-87) also
maps `status === "canceled"` directly to `free`.

### 2. There is no "downgrade Pro → Base" path

`src/lib/stripe/tierFromPrice.ts:26-34` picks the **highest** tier
from price IDs on a single subscription (pro beats base). This only
matters if both prices sit on the same subscription, which is not how
our checkout wires them — `app/api/stripe/checkout/route.ts` creates a
single-price subscription per checkout session.

There is no handler anywhere that, on Pro cancel, looks up an
independently-active Base subscription and demotes the tier to `base`.
The tier write is a pure function of the event currently being
processed.

### 3. Tier persistence is single-column

`src/lib/stripe/updateProfileTier.ts:5-11` writes a single
`profiles.user_tier` column. There is no notion of "primary" vs
"fallback" tier, and no mechanism for Stripe to express "this user
lost Pro but retains Base" in our data model.

### 4. Supabase RPC / schema confirms

`supabase/migrations/20260407220000_redeem_promo_idempotent.sql` and
`src/lib/supabase/database.types.ts` expose `user_tier` as a single
enum (`'free' | 'base' | 'pro'`). No history/stack table, no
"entitlements" join — tier is whatever the latest webhook wrote.

## Implication for upgrade-dialog copy

Variant B "You keep Base if you downgrade" is factually wrong against
current Stripe config. Either:

1. **(Recommended, ship now)** Replace renewal-note copy with the
   neutral **"Manage your plan at any time."**
2. **(Deferred, not in scope)** Build a real downgrade flow — on Pro
   cancel, offer a Base checkout; or move to a single subscription
   with tier upgrades/downgrades handled via `items` swaps plus a
   proration policy. Requires schema + webhook changes and is a
   separate decision.

## Next steps

- [ ] product-lead sign-off on the neutral-copy replacement
- [ ] Update upgrade-dialog Variant B string in web + mobile parity pass
- [ ] Update docs/decisions/2026-04-21-upgrade-dialog-dynamic-upsell.md §4 to note the copy fix and link this memo
