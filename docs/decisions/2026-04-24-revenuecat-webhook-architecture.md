# Decision log: RevenueCat webhook architecture (T6, retroactive 2026-04-25)

**Date:** 2026-04-24 (decision); 2026-04-25 (doc backfilled per P1-17)
**Status:** Resolved (shipped as commit `dbdbe27`)
**Trigger:** T6 / Phase 2 condition #6 of [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md). Mobile cancellations, refunds, billing-issue holds, and grace-period transitions never reached Supabase; the `syncTierToSupabase` client path refused tier downgrades by design. Net effect: a Pro user who cancelled on-device retained Pro entitlement in Supabase indefinitely.

---

## Decision

**INSERT-then-process pattern with `revenuecat_events` as the dedup primary-key table** (sister to `stripe_webhook_events`, T23).

The route at `app/api/revenuecat/webhook/route.ts`:
1. Verifies `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH>` with constant-time compare.
2. Resolves `app_user_id` to a Supabase auth uuid when it parses as one; null otherwise.
3. INSERTs into `revenuecat_events` keyed on `event_id`. PG error 23505 (duplicate key) → return early with `outcome: "skipped_duplicate"`. Other INSERT errors → fail-safe-process (duplicate processing of an idempotent tier write is strictly better than dropping a real event).
4. Dispatches by `event_type` and writes `profiles.user_tier` via service role for the relevant types.

`processRevenueCatEvent` lives in `src/lib/revenuecat/webhookProcess.ts` so the dispatch is unit-testable without HTTP.

## Rationale

Two competing architectures were on the table:

- **A. Direct tier write** — webhook receives event, writes `profiles.user_tier` directly via service role, returns. No persistence layer.
- **B. Append-only events table + reducer** — webhook persists every event, a separate scheduled job rebuilds entitlement state from the event log.

We chose **A with persistence sidecar** — the practical hybrid. The webhook does direct tier writes, but every event is also persisted in `revenuecat_events.payload` (jsonb) for forensic replay. If we ever need a reducer (e.g. "rebuild tier from scratch after a downstream bug"), the events are there. We don't run the reducer today.

Why the hybrid:
- **A's downside** (no audit trail) is closed by persisting the payload.
- **B's downside** (added complexity, scheduled-job operational burden, potential for tier-state lag during reducer runs) isn't justified at current scale.
- Stripe's T23 webhook already uses the persistence-sidecar pattern; matching it keeps the two webhooks debuggable with the same SQL queries.

Idempotency comes from the `event_id` PK + the 23505 check, not from the reducer pattern. RC delivers at-least-once; the dedup guarantees once-only tier writes.

## Alternatives considered

- **Pure direct-write (A) without persistence.** Rejected. Forensic replay matters when a billing-issue user files a chargeback dispute and we need to prove what RC told us and when.
- **Pure events + reducer (B).** Rejected. Operational complexity beyond what current scale justifies. Can adopt later from the persisted payload if needed.
- **Use Supabase Realtime to stream events to a worker.** Rejected. Adds infrastructure for no scale benefit; Vercel functions handle the throughput trivially.

## Implementation

- Route: [`app/api/revenuecat/webhook/route.ts`](../../app/api/revenuecat/webhook/route.ts).
- Logic: [`src/lib/revenuecat/webhookProcess.ts`](../../src/lib/revenuecat/webhookProcess.ts).
- Persistence: [`supabase/migrations/20260503100800_revenuecat_events.sql`](../../supabase/migrations/20260503100800_revenuecat_events.sql).
- Helpers: [`src/lib/revenuecat/tierFromEntitlements.ts`](../../src/lib/revenuecat/tierFromEntitlements.ts).
- Tests: `tests/integration/revenuecat-webhook-process.test.ts` (11 tests).
- Live-replay smoke (P1-14): `scripts/test-revenuecat-replay.mjs`.
- Ops runbook (P0-7): [`docs/operations/revenuecat-webhook-runbook.md`](../operations/revenuecat-webhook-runbook.md).

## Platforms affected

- **Web:** new route + persistence table. Mobile doesn't call this directly — RC posts to the route, the route writes via service role.
- **Mobile:** unchanged at the code level; tier flips correctly when RC posts a CANCELLATION / EXPIRATION event.
- **Supabase:** new `revenuecat_events` table, RLS-enabled with no public policies (service role only).

## Revisit when

- Event volume grows enough that the in-line dispatch becomes a bottleneck (today: <100 events/day expected). Then move dispatch to a queue; the event payload table is already there to read from.
- A new event type appears in production that the dispatch doesn't handle. Add to `src/lib/revenuecat/tierFromEntitlements.ts` and the route's payload normalizer.
- RevenueCat ships HMAC-signed webhooks. Migrate from bearer-secret to signature verification (Stripe pattern).
