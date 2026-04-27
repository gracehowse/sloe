# Decision log: rate-limit per-user scoping (P0-6, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P0 #6 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). The audit reported `/api/household/join` rate-limit was IP-only and that four endpoints (`/api/nutrition/photo-log`, `/api/nutrition/voice-log`, `/api/usda/search`, `/api/stripe/checkout`) were entirely unprotected.

---

## Decision

Two corrections to the audit on inspection:

1. **The four "unprotected" endpoints were already protected.** All sixteen `app/api/**/route.ts` files that call out to external services or perform sensitive writes already invoked `rateLimit()`. The audit's grep missed it. The actual gap was that the helper composed `${keyPrefix}:${ip}` only, so cross-user starvation on shared NATs and IP-rotation bypass were both possible.

2. **`/api/household/join` had its auth check AFTER the rate-limit call.** Even with the helper extension, the userId wasn't available in time. `/api/stripe/checkout` had the same issue.

P0-6 ships:

- **Helper extension** (`src/lib/server/rateLimit.ts`): `RateLimitOptions` now accepts an optional `userId` field. Bucket key composes as `${keyPrefix}:user:${userId}:${ip}` when provided, `${keyPrefix}:anon:${ip}` when omitted (back-compat shape for genuinely anonymous endpoints).
- **Sixteen route updates**: every authenticated endpoint that calls `rateLimit()` now passes `userId` from the existing `getUserIdFromRequest` / `getUserIdFromAuthHeader` result. Two routes (`/api/household/join`, `/api/stripe/checkout`) reordered so auth runs before rate-limit. Two routes (`/api/nutrition/photo-log`, `/api/nutrition/voice-log`) migrated from the older "embed userId in keyPrefix" pattern to the new explicit field.
- **Two pin tests**:
  - `tests/unit/rateLimitKeyComposition.test.ts` — pins the bucket key shape via the test-only `_composeRateLimitKeyForTest` export. **4/4 green.**
  - `tests/unit/rateLimitInventory.test.ts` — walks every `app/api/**/route.ts`, identifies routes that authenticate AND rate-limit, and asserts each `rateLimit()` call object includes `userId`. **1/1 green; surveys all 16 authenticated endpoints.**

## Rationale

The pre-fix bucket key shape (`${prefix}:${ip}`) had two failure modes:

- **Shared-NAT starvation.** A corporate office, school, or coffee shop where multiple Suppr users share an outbound IP. One user (or one bot on that network) drains the bucket; every other user on the same IP gets `429`.
- **IP-rotation bypass.** An attacker targeting a specific user (e.g. brute-forcing an invite code, draining their photo-log quota to push them onto a paid tier) rotates source IPs every request. The 5/min cap on household-join and the 100/day cap on photo-log become unenforceable.

Composing `${prefix}:user:${userId}:${ip}` solves both — buckets are now keyed per (user, IP) tuple, so a single attacker IP can only drain one bucket per target user, and a shared NAT only causes mutual interference within the same user's session.

For genuinely anonymous endpoints (none in the current API surface, but the helper supports them), the back-compat `${prefix}:anon:${ip}` shape preserves the prior IP-only behaviour without a code change at the call site.

## Alternatives considered

- **Two-tier limiter (per-user AND per-IP).** Rejected for now. Adds another Redis hit per request and opens a question on which limit dominates. The single per-(user, IP) bucket already addresses both failure modes; if we ever observe an attacker who owns thousands of compromised user accounts hitting from one IP, we can add an IP-only outer limiter on top.
- **Reorder auth in every route as a separate audit.** Rejected. Two routes were the only ones with auth-after-rate-limit. Fixed inline as part of this work.
- **Drop the `anon:` namespace and just use bare `${prefix}:${ip}`.** Rejected. The `anon:` segment makes it explicit which buckets are unauthenticated when reading Redis or memory dumps; one extra colon-segment is free.

## Implementation

- `src/lib/server/rateLimit.ts` — added `userId?: string | null` to `RateLimitOptions`; rewrote `rateLimit()` key composition; added test-only `_composeRateLimitKeyForTest` export. Existing `getIpFromHeaders`, in-memory + Upstash backends untouched.
- `app/api/household/join/route.ts` — moved `getUserIdFromRequest` above the `rateLimit` call; passed `userId`; renamed prefix from `household_join` → `api:household-join` for naming-convention parity.
- `app/api/stripe/checkout/route.ts` — same reorder; renamed prefix from `stripe_checkout` → `api:stripe-checkout`.
- `app/api/nutrition/photo-log/route.ts` — migrated from `keyPrefix: "photo_log_${userId}"` to explicit `userId` field with prefix `api:photo-log`.
- `app/api/nutrition/voice-log/route.ts` — same migration; prefix `api:voice-log`.
- `app/api/recipe-import/image/route.ts` — migrated; prefix renamed `recipe_import_image` → `api:recipe-import-image`.
- `app/api/usda/food/route.ts`, `app/api/usda/search/route.ts`, `app/api/edamam/search/route.ts`, `app/api/recipe-import/route.ts`, `app/api/household/meals/route.ts`, `app/api/user-foods/route.ts`, `app/api/user-foods/vote/route.ts`, `app/api/barcode-mapping/route.ts`, `app/api/off/barcode/route.ts`, `app/api/nutrition/verify-recipe/route.ts`, `app/api/nutrition/analyze-recipe/route.ts` — passed `userId` to existing `rateLimit()` calls. No prefix renames where the prefix was already in the `api:*` convention.
- `tests/unit/rateLimitKeyComposition.test.ts` — new. **4/4 green.**
- `tests/unit/rateLimitInventory.test.ts` — new meta-test. **1/1 green.** Will fail in CI when a future authenticated route adds `rateLimit()` without `userId`.

## Migration impact

The bucket key shape changes at deploy. Existing in-flight buckets reset to fresh quotas on first request after deploy. Worst case: an attacker mid-attack gets one extra rate-limit window of headroom. Acceptable.

The Upstash key-prefix on the `Ratelimit` instance (`pm_rl_${limit}_${windowSec}`) is unchanged, so different `(limit, windowMs)` pairs still share the limiter cache as before.

## Platforms affected

- **Web + Mobile:** all callers of the listed API routes will see `429` responses scoped per-(user, IP) tuple instead of per-IP only. No client change required.
- **Supabase:** none.
- **Upstash Redis:** key cardinality grows by ~one segment per request; bucket TTL unchanged. Negligible storage cost.

## Verification

- `tests/unit/rateLimitKeyComposition.test.ts` — 4/4 green.
- `tests/unit/rateLimitInventory.test.ts` — 1/1 green; surveys all 16 authenticated endpoints.

## Related artefacts

- [P0 punch list](../audits/2026-04-25-opus47-codebase-review.md#7-prioritized-punch-list)
- [src/lib/server/rateLimit.ts](../../src/lib/server/rateLimit.ts)

## Revisit when

- A new authenticated `app/api/**/route.ts` lands. Inventory test will fail unless `userId` is passed.
- Sentry observes a class of `429` events that look like attacker IP rotation succeeding (i.e. multiple distinct IPs hitting one user's bucket). Investigate; may justify a second per-IP outer limiter.
- Upstash latency becomes a problem (per-request RTT to Redis). Today it's <10ms in production; if it climbs we may need a local LRU cache layer in front.
