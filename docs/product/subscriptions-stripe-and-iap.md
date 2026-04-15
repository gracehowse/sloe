# Subscriptions: Stripe (web) and IAP (mobile)

Suppr uses **two purchase systems** by design; they must stay aligned on **entitlements** in Supabase (`profiles.user_tier`), not on a single checkout provider.

## Web (Next.js)

- **Provider:** Stripe Checkout / Customer Portal (see app pricing and webhook handlers).
- **Truth:** Stripe webhook updates `profiles.user_tier` after payment events.
- **Copy:** Pricing page and upgrade modals should describe **card / web** checkout, not App Store or Google Play.

## Mobile (Expo)

- **Provider:** RevenueCat → App Store / Google Play IAP.
- **Truth:** After purchase or restore, the app calls `syncTierToSupabase` so `profiles.user_tier` matches RevenueCat entitlements (`base`, `pro`).
- **Copy:** Paywall and upgrade paths should describe **in-app purchase**, not Stripe.

## User expectations

- A user might subscribe on **web** and use **mobile** (or the reverse). Tier must resolve from **Supabase** for API limits and shared features, with clients refreshing tier after login and after purchase/restore.
- Support flows should ask *where they subscribed* before deep-linking to the wrong billing portal.

## Product / engineering checklist

- [ ] Web upgrade CTAs never imply “manage in App Store” unless the user is on mobile web with an IAP-only path (usually N/A).
- [ ] Mobile paywall explains trial / renewal in store terms; link to Terms / Privacy as needed.
- [ ] Env: RevenueCat API keys and Stripe keys are both documented in `docs/environment.md` and app config (`EXPO_PUBLIC_*` for mobile).
