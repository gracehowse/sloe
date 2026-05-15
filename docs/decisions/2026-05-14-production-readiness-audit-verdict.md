# Production-readiness audit verdict — 2026-05-14

**Status:** Resolved (verdict issued; remediation in flight)
**Area:** Ops
**Owner:** Grace
**Re-audit date:** 2026-06-25 (5 days before Phase 1 cut-over)

---

## Context

Phase 1 public launch (TikTok + Instagram viral push) is scheduled for **2026-07-01** — ~7 weeks out as of this verdict. The first run of the new `production-readiness` agent (10-dimension operational fitness audit) was executed against the whole product on 2026-05-14.

This is the first time Suppr's operational posture has been judged against a public-traffic bar rather than the N=1 TestFlight bar.

## Verdict

**Overall: NOT READY** at confidence Medium.

Dimension matrix (worst-dimension rolls up):

| # | Dimension | Status |
|---|---|---|
| 1 | Observability | Operationally Soft |
| 2 | Alerting | **Not Ready** |
| 3 | Resilience and recovery | **Not Ready** |
| 4 | Secrets and access | Operationally Soft |
| 5 | Scaling headroom | Operationally Soft |
| 6 | Cost guardrails | **Not Ready** |
| 7 | Dependency posture | Operationally Soft |
| 8 | Compliance and trust | **Not Ready** |
| 9 | Critical-journey readiness | Operationally Soft |
| 10 | Solo-founder safety net | **Not Ready** |

## Blockers (must close before public traffic)

1. **Alerting — none wired.** Zero alarms route to Grace. (Deadline 2026-06-15)
2. **Backup / PITR / DR — unverified, no runbook.** (Deadline 2026-06-01)
3. **AI cost circuit-breaker — none.** Uncapped Anthropic exposure. (Deadline 2026-06-22)
4. **Pre-consent crash visibility — Sentry drops everything.** (Deadline 2026-06-15)
5. **Phase 2 compliance chain — frozen on Cayman immigration row.** (Row 1 by 2026-05-21; chain by 2026-06-22)
6. **Solo-founder safety net — undocumented.** (Deadline 2026-06-15)

## Soft spots (close before 1k MAU)

1. CI source-map upload verification
2. PostHog session-replay sample-rate ramp not wired
3. Supabase pooler sizing UNVERIFIED in production
4. `captureException` surface sparse (only 9 sites)
5. No journey kill-switches (`isFeatureEnabled` wrapper exists but unused on critical paths)
6. CI `npm audit` not enforced
7. CI secret scan (gitleaks) not enforced
8. `STRIPE_TAX_ENABLED=false` ships VAT-exclusive copy to UK/EU

## Tail risks (track)

1. Trademark forced rename mid-Phase-1 (HIGH-risk per project memory)
2. 6-hour Anthropic outage (need documented OpenAI fallback)
3. Supabase regional outage (single-region today)
4. PostHog ingestion silently dead (regression of 2026-04-21)
5. TestFlight build expires unnoticed
6. Vercel function timeout / concurrency caps unverified

## Remediation (this session)

Started in parallel under this verdict:

- **Blocker 1** — `docs/operations/alerting.md` + CI hardening (gitleaks, npm audit, sourcemap verify, dependabot)
- **Blocker 2** — shipped 2026-05-14: [`docs/runbooks/disaster-recovery.md`](../runbooks/disaster-recovery.md) + [`docs/operations/stripe-webhook-replay-runbook.md`](../operations/stripe-webhook-replay-runbook.md) + [`scripts/replay-stripe-event.mjs`](../../scripts/replay-stripe-event.mjs). Documentation closes the runbook gap; Grace must complete the Pre-Phase-1 checklist in the DR runbook (Supabase plan + PITR verification + first rehearsal) before Blocker 2 can flip to Closed.
- **Blocker 3** — `src/lib/server/aiBudget.ts` + Upstash counters + 503 fail-closed + flag-gated enforcement (see `docs/decisions/2026-05-14-ai-cost-circuit-breaker.md`)
- **Blocker 4** — `sentry.client.config.ts` redacted-core pre-consent capture (see `docs/decisions/2026-05-14-sentry-pre-consent-capture.md`)

Blocker 5 (compliance chain) and Blocker 6 (solo-founder safety net) require Grace's personal action — no in-repo work closes them.

## Reversibility

The Blocker 3 and Blocker 4 changes are feature-flagged. The Blocker 1 / Blocker 2 deliverables are documentation and CI gates — additive, reversible by revert.

## Re-audit

The production-readiness agent re-runs **2026-06-25** (5 days before Phase 1). Any "Not Ready" row at that date forces Phase 1 slip.
