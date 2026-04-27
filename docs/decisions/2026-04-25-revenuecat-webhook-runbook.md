# Decision log: RevenueCat webhook ops runbook (P0-7, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved (runbook shipped; ops actions remain for Grace)
**Trigger:** P0 #7 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). The RevenueCat webhook code shipped on 2026-04-24 (T6, commit `dbdbe27`) but the production dashboard wiring + Vercel env secret are ops actions that have not yet been completed.

---

## Decision

Ship a step-by-step ops runbook at `docs/operations/revenuecat-webhook-runbook.md` covering: secret generation, RC dashboard webhook configuration, Vercel env wiring, redeploy, test-event verification, real-user validation, and a failure-mode → fix table.

The runbook is the deliverable for P0-7. Grace executes the steps when ready (recommended timing: same session as P0-1 schema-drift apply and the P0-4 lockdown forward-compat migration).

## Rationale

The webhook code is correct, signature-verified, idempotent, and persisted. Without the dashboard + env wiring, every mobile cancellation, refund, billing-issue, or expiration event silently drops on the floor — Pro entitlement leaks indefinitely. That single gap negates the security work done in T2 (column lockdown), T20 (household), T21 (push), T22 (paywall dark patterns), T23 (Stripe dedup), and T24 (renewal disclosure).

The runbook gives Grace a checklist that's resilient to context loss between sessions: secret generation → dashboard fields → env var → redeploy → two verification queries → failure-mode table. Following it gates Pro-tier integrity for the entire mobile cohort.

## Alternatives considered

- **Stage RC dashboard config via Terraform / IaC.** Rejected for now. RC's API doesn't expose webhook configuration; click-ops in the dashboard is the only path. Worth revisiting if RC ships a config API.
- **Auto-test the webhook from `prelaunch:checklist`.** Tracked as P1-14 (RevenueCat live-replay test in `prelaunch:checklist`). Today's runbook is the manual verification path; the automated version is the next-level safety net.
- **Skip the runbook and document inline in the route.ts header.** Rejected. The route header already lists the steps; converting them to a runbook makes them discoverable from `docs/operations/` (where ops people look) and from the audit trail.

## Implementation

- `docs/operations/revenuecat-webhook-runbook.md` — new. Six-step setup, two verification queries, an eight-row failure-mode table, and security notes.
- No code changes — webhook + persistence + dispatch shipped on 2026-04-24.

## Platforms affected

- **Ops (Grace):** RC dashboard + Vercel env. ~10 minutes when ready.
- **Mobile users:** none until Grace runs the steps; on completion, every Pro subscriber's tier reconciles correctly across the full event lifecycle.

## Verification

- Runbook is self-validating: step 5 SQL (`select … from revenuecat_events`) confirms the test event landed; step 6 SQL (`select user_tier from profiles`) confirms a real subscription writes the right row.
- After Grace runs the steps, link the runbook completion in the [P0 end-of-band review](#p0-end-of-band) and tick P0-7 closed.

## Related artefacts

- Runbook: [docs/operations/revenuecat-webhook-runbook.md](../operations/revenuecat-webhook-runbook.md)
- Webhook code: `app/api/revenuecat/webhook/route.ts`
- Webhook tests: `tests/integration/revenuecat-webhook-process.test.ts`

## Revisit when

- RC ships HMAC-signed webhooks → upgrade to signature verification (Stripe pattern).
- A new event type is observed in production that the dispatch table doesn't handle → extend `webhookProcess.ts` and the runbook.
