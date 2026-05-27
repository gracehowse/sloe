# Referral mechanic (ENG-5)

**Shipped:** 2026-05-27  
**Goal:** k-factor ≥ 0.5 — every paying user brings 0.5 more users on average  
**Reward:** both referrer and referee get 30 days Pro free (60 if referee is already paid)  
**Feature flag:** `referral-mechanic` (PostHog) — gate UI on web + mobile; ramp gradually post-launch

---

## Architecture

### Database schema (`supabase/migrations/20260527100000_referrals.sql`)

| Table | Purpose |
|---|---|
| `referrals` | One row per user who has generated a code. Holds 8-char unique code, `total_redeemed`, `total_reward_days_granted`, fraud flags. |
| `referral_credits` | One row per (referrer, referee) pair. `reward_granted_at` stays NULL until ENG-198 (RevenueCat) wires the Pro grant. |

RLS: users can SELECT their own rows; no client INSERT/UPDATE (service-role only via API routes).

### Shared lib (`src/lib/referral/referralLib.ts`)

Server-side only (Node.js API routes). Functions:
- `generateCode()` — 8-char from unambiguous alphabet (no 0/O/1/I/l)
- `createOrGetReferralCode(userId)` — idempotent; enforces 7-day account age before first code
- `redeemReferralCode(code, refereeId)` — validates + inserts credit row
- `getReferralStatus(userId)` — stats for the share panel

### API routes (`app/api/referral/`)

| Route | Method | Purpose |
|---|---|---|
| `generate` | GET | Idempotent — returns existing code or creates one |
| `redeem` | POST | `{ code }` — validates + records redemption |
| `status` | GET | Returns referrer stats (code, redeemed count, pending credits) |

All routes require `Authorization: Bearer <token>` or session cookie.

---

## User journeys

### Sharing a link (referrer)

**Web:**
1. Settings → "Earn free Pro" card (behind `referral-mechanic` flag)
2. Tap "Share invite link" → calls `GET /api/referral/generate` (creates code on first tap)
3. Web Share API opens share sheet; if unavailable, shows copy-link row
4. Fires `referral.link_generated` (first time) + `referral.link_shared`

**Mobile:**
1. Settings → Membership section → "Earn free Pro" row (behind flag)
2. Tap → calls `GET /api/referral/generate` → opens system share sheet with `Share.share()`
3. Fires same two events

### Installing via a referral link (referee, web)

1. Friend shares `suppr.app/i/<code>`
2. Landing page (`app/i/[code]/ReferralLanding.tsx`) verifies code + sets `suppr_ref=<code>` cookie
3. User taps "Claim your free month" → `/signup?ref=<code>`
4. Signup page echoes `ref` param back into `suppr_ref` cookie (in case they navigate from here)
5. User signs up → completes onboarding → redirects to `/home?onboarding_complete=1`
6. `ReferralRedeemer` component (mounted in `App.tsx`) reads cookie, calls `POST /api/referral/redeem`
7. Fires `referral.install_attributed` on success
8. Cookie cleared

### Installing via a referral code (referee, mobile)

1. Friend shares link → referee sees code on the web landing page
2. Referee installs app, reaches the data-bridges onboarding step
3. "Have a referral code?" card → taps "Enter code" → types code
4. `state.referralCode` stored in onboarding context
5. `handleComplete` fires `POST /api/referral/redeem` after onboarding persists
6. Fires `referral.install_attributed` on success

---

## Anti-abuse

- No self-referral (DB CHECK constraint)
- One redemption per referee (UNIQUE on `referral_credits.referee_id`)
- Max 365 reward days per referrer lifetime (`total_reward_days_granted` cap)
- 7-day account age before code generation (`REFERRAL_MINIMUM_ACCOUNT_AGE_DAYS`)
- Fraud flag (`referrals.flagged_at`) blocks a code from being redeemed

---

## Reward granting (ENG-198 stub)

`referral_credits.reward_granted_at` stays NULL until ENG-198 (RevenueCat provisioning) is complete. The rows are created immediately so no referral is lost. When ENG-198 ships:
1. On new `SUBSCRIPTION_PURCHASE` RC webhook, check `referral_credits` for matching `referee_id`
2. If found and `reward_granted_at IS NULL`, apply 30-day Pro entitlement extension
3. Write `reward_granted_at = now()`, fire `referral.reward_granted` event

---

## Analytics events

| Event | Payload |
|---|---|
| `referral.link_generated` | `{ userId }` |
| `referral.link_shared` | `{ userId, channel }` |
| `referral.install_attributed` | `{ referrerId, refereeId, code }` |
| `referral.reward_granted` | `{ userId, daysCredited }` — stubbed until ENG-198 |

---

## Files changed

- `supabase/migrations/20260527100000_referrals.sql` — schema
- `src/lib/referral/referralLib.ts` — server logic
- `src/lib/analytics/events.ts` — 4 new events
- `app/api/referral/generate/route.ts`
- `app/api/referral/redeem/route.ts`
- `app/api/referral/status/route.ts`
- `app/i/[code]/page.tsx` + `ReferralLanding.tsx` — web landing
- `app/signup/page.tsx` — echoes `?ref` into cookie
- `src/app/App.tsx` — mounts `ReferralRedeemer`
- `src/app/components/ReferralRedeemer.tsx` — post-onboarding cookie redemption
- `src/app/components/Settings.tsx` — "Earn free Pro" row
- `apps/mobile/components/settings/SettingsBundleContent.tsx` — "Earn free Pro" row
- `apps/mobile/components/onboarding/steps/data-bridges.tsx` — `ReferralCodeCard`
- `apps/mobile/components/onboarding/mobile-flow.tsx` — redeem after handleComplete
- `src/lib/onboarding/state.ts` — `referralCode` field
- `tests/unit/referralLib.test.ts`
- `apps/mobile/tests/unit/referralLib.test.ts`
