# Tier gates — server-side enforcement points

Free and Pro only mean something if the line between them actually holds.
This is the canonical list of every place a tier entitlement is enforced
**server-side** (database or API route) — the layer that makes Pro worth
paying for, and makes the Free plan's limits real rather than cosmetic.

Client-side gates (paywalls, locked chips, clamps) are useful UX — they steer
a user toward the right action — but they are not enforcement. Suppr has
learned this the direct way: recipe saves, recipe publishing, and multi-day
meal plans each originally shipped with only a client-side limit, and each
was quietly usable past the Free tier's boundary until the enforcement moved
server-side. Every row below closes that gap for one entitlement, so a Free
user can never end up with something only Pro pays for.

**Rule:** a new tier-gated feature is not done until it appears in this
table with a database or API enforcement point.

## Database layer (RLS / RPC)

| Entitlement | Free | Base/Pro | Enforcement | Migration | Error contract |
| --- | --- | --- | --- | --- | --- |
| Recipe saves cap | 10 saves | Unlimited | `saves_insert_own` RLS WITH CHECK via `auth_profile_user_tier()` + `auth_user_save_count()` | `20260426100000` (original), `20260520100000` (recursion fix, helpers) | 42501 / "row-level security"; clients toast/alert "Free plan is limited to 10 saved recipes." |
| Publish recipe | No | Yes | `recipes_insert_own` + `recipes_update_own` RLS WITH CHECK (`published = true` requires base/pro) | `20260426100100` | 42501 / RLS message |
| Meal-plan day count | 1 day | Up to 7 days | `save_meal_plan` RPC rejects `day > 1` when `auth_profile_user_tier() = 'free'` (the RPC is the only write path into `meal_plan_days`/`meal_plan_meals`) | `20260706090000` | 42501 + message containing `limited to 1-day plans` (shared client predicate: `src/lib/mealPlan/planPersistError.ts`). Rejection is atomic — the existing cloud plan survives, so a Pro→Free downgrade's multi-day plan becomes read-only, not truncated. |

Notes on the meal-plan gate:

- Client mirrors: web `MealPlanner.tsx` (`days = isFree ? 1 : planDays`),
  mobile `planner.tsx` (locked day chips + clamp-to-1 effect). Normal flows
  never hit the server rejection; it fires on stale-cached-tier desync or a
  downgrade holding a multi-day plan (web toasts, mobile alerts — see
  `apps/mobile/lib/mealPlanErrors.ts`).
- The onboarding first-week seeder respects this same boundary by design:
  `buildFirstWeekFromSeeds` seeds **1 day for Free** signups (default
  `planDays: 1`) and **7 days for paid**. A new Free user still lands on a
  populated Today/Plan on day one — the activation moment survives — but the
  full week stays something Pro unlocks, so onboarding never seeds its way
  around the gate above. See
  [Onboarding seed taster-week tier semantics](../decisions/2026-07-15-onboarding-seed-taster-week-tier.md)
  for the full rationale, including the two data issues (a stale seed-source
  filter, and a missing meal-plan slot defaulting incorrectly) that had to be
  fixed before this behaviour could be trusted.

## API-route layer

| Entitlement | Gate | Route | Decision |
| --- | --- | --- | --- |
| Voice logging | Pro-only, 100 req/day | `app/api/nutrition/voice-log/route.ts` (403 `upgrade_required` for `tier !== "pro"`) | `docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md` |
| Photo logging | Free/base: `FREE_PHOTO_LOG_WEEKLY_LIMIT` (5) analyses per rolling 7-day window (`api:photo-log:free-quota` rate-limit bucket), then 403 `upgrade_required`. Pro: 100/day (`api:photo-log` bucket), then 429 `rate_limited`. | `app/api/nutrition/photo-log/route.ts` | `docs/decisions/2026-05-02-photo-log-free-taster.md` |
| Cookbook import (PDF/image parse) | Paid-only | `app/api/cookbook-import/parse/route.ts` (rejects `tier === "free"`) | — |
| Recipe import from image | Paid-only | `app/api/recipe-import/image/route.ts` (rejects `tier === "free"`) | — |

Notes on the AI logging gates:

- **Client mirrors:** web `src/app/components/suppr/ai-paywall-dialog.tsx`,
  mobile `apps/mobile/components/AiPaywallSheet.tsx` — the in-context
  "Voice logging is a Pro feature" / "Get more photo logs with Pro"
  sheet/dialog, opened via an `onUpgradeRequired` callback the moment the
  client's request to `voice-log`/`photo-log` comes back 403. Neither
  client makes its own gating decision up front (no lock badge, no
  disabled state before the tap) — the copy is driven entirely by the
  server's rejection and, for photo-log, the `freeQuotaRemaining` count
  returned on the last successful 200. That keeps the client from ever
  holding a stale local view of the quota.
- **Voice logging has no free taster** — any non-Pro request is rejected
  outright, first tap included. This is a deliberate contrast with photo
  logging, not an inconsistency left unresolved: see
  `docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md`
  for why voice stayed hard-gated, and
  `docs/decisions/2026-05-02-photo-log-free-taster.md` for why photo
  logging was moved off the same hard gate to a 5/week taster instead
  (Cal AI-style "let them taste it first" reasoning).
- **"Free/base" in the photo-log row:** Free and Base share one taster
  bucket (`base-tier-treated-as-free` is a pinned test case) — Base is an
  internal tier-rank value, never a purchasable product (the Stripe
  checkout route rejects `tier: "base"` with 400 `invalid_tier`). There is
  no user-facing plan between Free and Pro.
- **Known limitation:** the free-quota bucket increments *before* the
  OpenAI call runs, so a transient upstream failure can cost a Free user
  one of their 5 weekly photo logs without giving them a result back — no
  fault of theirs. This is an accepted trade-off, not an open bug. See
  "Quota burn on upstream error" in the photo-log decision doc.

All of this only holds because a user's tier itself can't be set from the
client — it's written exclusively via server-trusted paths (Stripe webhook,
RevenueCat webhook, promo redemption RPCs). If a client could write its own
`user_tier`, every gate in this document would be decorative. See
[Subscriptions — Stripe (web) and IAP (mobile)](./subscriptions-stripe-and-iap.md)
for the full billing-rail contract.
