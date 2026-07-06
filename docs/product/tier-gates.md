# Tier gates — server-side enforcement points

Canonical list of every place a tier entitlement is enforced **server-side**
(database or API route). Client-side gates (paywalls, locked chips, clamps)
are UX, not enforcement — anything gated only on the client is a paywall
bypass waiting to be filed (three have been found and fixed to date:
saves cap, publish gate, meal-plan day cap — all the same bug class).

**Rule:** a new tier-gated feature is not done until it appears in this
table with a database or API enforcement point.

## Database layer (RLS / RPC)

| Entitlement | Free | Base/Pro | Enforcement | Migration | Error contract |
| --- | --- | --- | --- | --- | --- |
| Recipe saves cap | 10 saves | Unlimited | `saves_insert_own` RLS WITH CHECK via `auth_profile_user_tier()` + `auth_user_save_count()` | `20260426100000` (original), `20260520100000` (recursion fix, helpers) | 42501 / "row-level security"; clients toast/alert "Free plan is limited to 10 saved recipes." |
| Publish recipe | No | Yes | `recipes_insert_own` + `recipes_update_own` RLS WITH CHECK (`published = true` requires base/pro) | `20260426100100` | 42501 / RLS message |
| Meal-plan day count | 1 day | Up to 7 days | `save_meal_plan` RPC rejects `day > 1` when `auth_profile_user_tier() = 'free'` (ENG-1387; the RPC is the only write path into `meal_plan_days`/`meal_plan_meals`) | `20260706090000` | 42501 + message containing `limited to 1-day plans` (shared client predicate: `src/lib/mealPlan/planPersistError.ts`). Rejection is atomic — the existing cloud plan survives, so a Pro→Free downgrade's multi-day plan becomes read-only, not truncated. |

Notes on the meal-plan gate:

- Client mirrors: web `MealPlanner.tsx` (`days = isFree ? 1 : planDays`),
  mobile `planner.tsx` (locked day chips + clamp-to-1 effect). Normal flows
  never hit the server rejection; it fires on stale-cached-tier desync or a
  downgrade holding a multi-day plan (web toasts, mobile alerts — see
  `apps/mobile/lib/mealPlanErrors.ts`).
- Interaction with the onboarding first-week seeder (D-2026-04-27-14): the
  seeder would persist 7 days for Free signups through this RPC, but the
  chain has never succeeded in production (ENG-1388 — 0 seeds resolve, and
  its null `slotId` hit a NOT NULL before the gate existed). Whoever repairs
  ENG-1388 must decide the taster-week tier semantics against this gate.

## API-route layer

| Entitlement | Gate | Route | Decision |
| --- | --- | --- | --- |
| Voice logging | Pro-only, 100 req/day | `app/api/nutrition/voice-log/route.ts` (403 `upgrade_required` for `tier !== "pro"`) | `docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md` |
| Cookbook import (PDF/image parse) | Paid-only | `app/api/cookbook-import/parse/route.ts` (rejects `tier === "free"`) | — |
| Recipe import from image | Paid-only | `app/api/recipe-import/image/route.ts` (rejects `tier === "free"`) | — |

Tier itself is written only via server-trusted paths (Stripe webhook,
RevenueCat webhook, promo redemption RPCs) — see
`docs/product/subscriptions-stripe-and-iap.md` and the persistence-path
guardrails (never write entitlement columns client-side).
