# Decision log: RevenueCat live-replay smoke in prelaunch:checklist (P1-14, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P1 #14 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit asked for a replay test that asserts the deployed webhook is idempotent — same event posted twice should produce one persisted row, one tier change.

---

## Decision

New script `scripts/test-revenuecat-replay.mjs` posts a synthetic event to the deployed `/api/revenuecat/webhook` endpoint twice and asserts:

1. First POST → 200.
2. Second POST → 200 with `outcome: "skipped_duplicate"` (proves the `revenuecat_events.event_id` PK dedup fired and the route did not double-write tier).
3. (Optional) `revenuecat_events` row count for the synthetic `event_id` is exactly 1, when `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` are loaded locally.
4. Cleanup deletes the synthetic row when service-role access is available; otherwise the row stays in `revenuecat_events` as a forensic crumb.

The synthetic `app_user_id` is the literal `"replay-smoke-<event-id>"` — **not** a real Supabase auth UUID — so `userIdFromAppUserId` returns `null` and **no `profiles` row is touched**. Safe to run repeatedly against production.

Wired into `scripts/prelaunch-checklist.ts` as a new section after the migration-drift check. Skips with a clear `REVENUECAT_WEBHOOK_AUTH unset` message when production env isn't loaded — the prelaunch checklist itself stays useful in CI / first-time setup. New `npm run smoke:revenuecat` shortcut runs the script standalone.

## Rationale

The webhook integration tests (`tests/integration/revenuecat-webhook-process.test.ts`, 11 tests) exercise the dedup logic via a mocked Supabase client. They prove the algorithm is correct. They do **not** prove that the deployed function:

- Authenticates with the production `REVENUECAT_WEBHOOK_AUTH` secret (vs the test fixture).
- Connects to the linked Supabase project's `revenuecat_events` table (vs a mock).
- Returns the right shape under real network conditions (vs an in-process call).

A single 2-POST smoke against the deployed URL closes all three gaps in <2 seconds. It's the cheapest possible "did Grace's RevenueCat dashboard config + Vercel env var match each other?" check, runnable on demand from a TestFlight-prep session.

The synthetic-app-user-id pattern is the safety guarantee. Every test event:
- has a unique `event_id` (timestamp + random suffix) so it never collides with real RC events,
- has an `app_user_id` that is structurally not a UUID, so `userIdFromAppUserId` returns null,
- triggers the persistence path but skips the tier-write path (because `user_id` is null → `eventTypeIsTierGrant` early-returns the no-op outcome),
- is cleaned up when service-role is available.

## Alternatives considered

- **Hit `/api/revenuecat/webhook` against a local dev server.** Rejected. Doesn't prove the production secret + dashboard wiring is correct. The bug class we want to catch (mismatched secret between RC dashboard and Vercel env) only exists in production.
- **Use a test RC dashboard project + production app.** Rejected. RC's test events always carry `RCBilling_test_user` style IDs that match the synthetic-app-user-id behaviour anyway. The script reproduces the test event structurally without depending on the dashboard test-event UI being clicked at the right moment.
- **Add this to CI.** Rejected. CI doesn't have production secrets (and shouldn't). This belongs in the prelaunch checklist where the maintainer with secrets is already present.

## Implementation

- `scripts/test-revenuecat-replay.mjs` — new. Pure ESM, no TypeScript, no extra deps (uses native `fetch`). Reads `REVENUECAT_WEBHOOK_AUTH` + `REVENUECAT_WEBHOOK_URL` (or falls back to `NEXT_PUBLIC_APP_URL + /api/revenuecat/webhook`). Optional DB verification when `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` are present. Always cleans up the synthetic row when service-role access is available.
- `package.json` — new shortcut `"smoke:revenuecat": "node scripts/test-revenuecat-replay.mjs"`.
- `scripts/prelaunch-checklist.ts` — new section "RevenueCat webhook idempotency (live replay smoke)". Spawns the smoke script, reports `[OK]` / `[!!]`. Gracefully skips with a clear message when env is unset.

Verified locally: script with no env exits 1 with "REVENUECAT_WEBHOOK_AUTH is unset". Prelaunch checklist with no env shows the section as `[!!] RevenueCat replay smoke skipped — REVENUECAT_WEBHOOK_AUTH unset + REVENUECAT_WEBHOOK_URL / NEXT_PUBLIC_APP_URL unset; load production env and rerun, or run \`npm run smoke:revenuecat\` directly.`

## Platforms affected

- **Ops (Grace):** new `npm run smoke:revenuecat` available locally with prod env loaded; runs as part of `npm run prelaunch:checklist`.
- **Web / Mobile / Supabase:** no behavioural change. The script reads from the deployed webhook + persistence layer; doesn't change either.
- **Risk surface:** synthetic events land in `revenuecat_events` with non-UUID `app_user_id`; row count grows by one per smoke run if cleanup can't run (service-role unavailable). Operator can `DELETE FROM revenuecat_events WHERE app_user_id LIKE 'replay-smoke-%'` to bulk-clean.

## Verification

- `node --check scripts/test-revenuecat-replay.mjs` — clean.
- `node scripts/test-revenuecat-replay.mjs` (no env) — exits 1 with the expected error.
- `npm run prelaunch:checklist` — RevenueCat section renders correctly, gracefully skips when env unset.
- Production smoke (when Grace runs it) — both POSTs return 200; second has `outcome: "skipped_duplicate"`; (optional) row count = 1; cleanup removes the synthetic row.

## Related artefacts

- [Opus 4.7 codebase review §3.4](../audits/2026-04-25-opus47-codebase-review.md#34-web-e2e-and-migration-drift-checks-not-in-ci) (also called out webhook live-replay)
- [P0-7 RevenueCat webhook ops runbook](./2026-04-25-revenuecat-webhook-runbook.md) — manual setup; this script is the automated verification.
- Webhook code: `app/api/revenuecat/webhook/route.ts`
- Process logic: `src/lib/revenuecat/webhookProcess.ts`
- Persistence: `supabase/migrations/20260503100800_revenuecat_events.sql`

## Revisit when

- The webhook signature method changes (e.g. RC ships HMAC-signed webhooks). Update the script's auth header.
- A new `outcome` value is added to `processRevenueCatEvent` for duplicates (e.g. split into `dup_event_id` vs `dup_user_id`). Update the second-POST assertion.
- Cleanup pattern fails (e.g. PostgREST 401 because the service-role token is wrong). Surface a louder warning.
