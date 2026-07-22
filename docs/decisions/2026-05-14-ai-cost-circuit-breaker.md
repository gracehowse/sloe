# AI cost circuit-breaker (Blocker 3)

**Date:** 2026-05-14
**Status:** Resolved
**Area:** Server / cost control / launch readiness

## Problem

`src/lib/server/aiProvider.ts` enforces per-call `max_tokens` but had
**no per-user daily budget and no global spend ceiling**. Every AI
call (Anthropic Claude Sonnet 4.5 for vision + text, OpenAI fallback)
went through with no global brake.

Phase 1 viral launch is 2026-07-01. A single TikTok moment that
routes thousands of photo-log + recipe-import-image requests to Claude
Sonnet is a **four-figure overnight bill** with no kill-switch. That
is unacceptable risk for a pre-revenue product on a finite runway.

Heaviest AI consumers, ranked:

1. `/api/nutrition/photo-log` — Sonnet vision, `max_tokens=2500`.
2. `/api/recipe-import/image` — Sonnet vision, `max_tokens=2000`.
3. `/api/recipe-import` (social-caption branch) — Sonnet vision OR text.
4. `/api/recipe-import/caption` — Sonnet text via `parseCaption`.
5. `/api/nutrition/scan-label` — Sonnet vision, `max_tokens=800`.
6. `/api/nutrition/voice-log` — Sonnet text, `max_tokens=1000`.

## Decision

Two-layer Upstash-backed daily budget, fail-closed at 100% of cap,
alarmed at 70% of cap.

### Layer A — per-user daily call cap

- Default: **50 AI calls / 24h per `user_id`** (env override:
  `AI_BUDGET_PER_USER_DAILY_CALLS`).
- Resets on UTC day boundary.
- Counter: `ai_budget:user_calls:{userId}:{YYYY-MM-DD}`.

Sizing: a heavy legitimate user does maybe 5-10 photo-logs + 5 recipe
imports + a handful of voice-logs per day = ~20 calls. 50 leaves
headroom for power users (and tester sessions where Grace
hammers a feature) without leaving the door open for a runaway loop on
one account.

### Layer B — global daily spend cap (£)

- Default: **£50 / 24h across all users** (env override:
  `AI_BUDGET_GLOBAL_DAILY_GBP`).
- Resets on UTC day boundary.
- Counter: `ai_budget:global:{YYYY-MM-DD}` (pence, integer).

Sizing: Phase 0 has N=1 (Grace). Phase 1 viral spike is the risk. £50/day
is "enough headroom for legitimate use while we scale, low enough that
a single bad night doesn't bleed the runway". At expected per-day
Phase 1 cohort (1k DAU × 5 calls × ~£0.005/call ≈ £25/day), £50 gives
2× headroom. The cap is **lifted by env var**, not by a code deploy,
so a real viral spike can be widened in 90 seconds and re-tightened the
next morning.

### Price table

Hard-coded in `src/lib/server/aiBudget.ts` (`PRICE_TABLE`). Sourced from
published vendor pricing as of 2026-01:

| Model                          | Input $/1M | Output $/1M | Input p/1M (×0.85) | Output p/1M (×0.85) |
| ------------------------------ | ---------- | ----------- | ------------------ | ------------------- |
| `claude-sonnet-4-5(*)`         | $3.00      | $15.00      | 255p               | 1275p               |
| `claude-haiku-4-5`             | $1.00      | $5.00       | 85p                | 425p                |
| `gpt-4o`                       | $2.50      | $10.00      | 213p               | 850p                |
| `gpt-4o-mini`                  | $0.15      | $0.60       | 13p                | 51p                 |
| `gpt-5`                        | $5.00      | $25.00      | 425p               | 2125p               |

USD → GBP at a conservative **0.85 GBP/USD** rate (i.e. $1 = £0.85). This
deliberately over-estimates spend in pounds so the cap is hit a touch
earlier than the wallet truth. Re-verify the rate when FX drifts more
than 10% from 0.85 — a `// FX 2026-01` comment in the code marks the
audit point.

Unknown models fall through to a **conservative fallback** priced as
Sonnet 4.5 — missing-entry → over-count, not under-count — and emit a
`[ai-budget] unknown model` warn log so the table can be updated.

### Reserve / commit / release lifecycle

Each AI call:

1. **`reserveBudget(userId, modelId, maxOutputTokens, maxInputTokens?)`**
   computes worst-case cost from `max_tokens` (defaulting `maxInputTokens`
   to `4 × maxOutputTokens` for vision-heavy calls), reserves it against
   both counters. Returns `BudgetGrant` (with `grantId`) on success, or
   throws `AiBudgetExceededError` from the provider helper when
   enforcement is on and a cap was hit.

2. **`commitBudget(grantId, actualUsage)`** runs on success. Reconciles
   the worst-case reservation against actual token usage from the vendor
   response. If actual was below reserved, refunds the diff. If above
   (shouldn't happen given `max_tokens`), accepts the over-spend.

3. **`releaseBudget(grantId)`** runs on AI-call failure (network error,
   vendor 5xx, timeout). Fully refunds the reservation AND refunds the
   per-user call count — we shouldn't charge a user for a call we never
   completed.

All amounts in **pence (integer)** internally to avoid float drift
across thousands of small calls. Conversion to £ happens only at the
log-message boundary.

### Fail-open-then-closed on Upstash unreachable

Upstash is a single point of failure. Two failure modes:

- **First 5 minutes after the first failure → fail-OPEN.** Calls proceed.
  Rationale: Upstash blips happen (cold starts, edge replication lag);
  taking the entire product down for a 30-second outage would be a
  worse outcome than the marginal extra spend during the blip.
- **After 5 minutes of sustained failure → fail-CLOSED.** Calls denied
  with `ai_capacity_reached`. Rationale: a sustained outage shouldn't
  be a free pass for runaway spend.

Local state tracked in a module-scope `globalThis` object so the timer
survives within one Node worker. On a fresh worker, the first failure
restarts the 5-minute clock — acceptable because each worker has its
own traffic share and the global counter (when Upstash recovers) still
catches any pent-up overspend at next-call time.

**Mirrored onto `falBudget.ts` (2026-07-22, ENG-1411).** The fal.ai
image-spend guardrail is a second, independent Upstash-backed budget
module that originally had no fail-policy at all on its Redis calls — a
throw would propagate as an unhandled rejection instead of degrading.
It now runs the identical fail-open-then-closed policy (own
`globalThis` state, own 5-minute window, same `recordUpstashFailure`
alerting shape, tagged `subsystem: "fal_budget"`). See
`docs/decisions/2026-06-08-recipe-ingredient-image-system.md`'s "Redis
fail-policy on Upstash unreachable" section for the fal-specific
detail.

### Enforcement flag (dark-launch path)

Enforcement (the actual HTTP 503) is gated behind the env flag
**`AI_BUDGET_ENFORCEMENT_ENABLED`** (default `false`). Tracking
(counter increments + 70% alarms) runs ALWAYS.

This is the explicit CLAUDE.md feature-flag rule applied to a
behaviour-change: Grace dark-launches the counters, watches real spend
for a week to confirm the cap values are right-sized, then flips the
flag in production. If the cap turns out to be too tight, the flag goes
back off in 90 seconds.

PostHog flag-id needed in dashboard: `ai-budget-enforcement` (created
manually — env var is the source of truth; PostHog flag exists for
visibility + operations review only).

### 70%-of-cap alarm

A structured log line fires the first time **either** counter crosses
70% of its cap on a given day:

```
[ai-budget] ALARM 70% — scope=global_spend date=2026-05-14 used=£35.10 cap=£50.00 pct=70%
```

The alarm also captures a `Sentry.captureMessage(..., 'warning')` so it
shows up alongside other ops events. De-duped per UTC day per scope via
`ai_budget:alarm_fired:{scope}:{id}:{YYYY-MM-DD}` (Upstash NX-SET).

When the runbook at `docs/operations/alerting.md` is created
(Executor B in this audit), it should append an "AI budget — 70%
global daily cap" section pointing at this design doc.

## Reversibility

- **Off-switch:** set `AI_BUDGET_ENFORCEMENT_ENABLED=false`. Counters
  keep running; no 503s returned. Same code path; zero deploy.
- **Cap widening:** bump `AI_BUDGET_GLOBAL_DAILY_GBP` env var. Effective
  immediately on the next request — no deploy.
- **Counter reset:** delete the Upstash key
  `ai_budget:global:{YYYY-MM-DD}`. UTC midnight handles this
  automatically; manual deletion is the escape hatch for the rare
  "we tripped at 06:00 UTC, give us six more hours" case.

## Rejected alternatives

- **Vendor-side spend caps** (Anthropic dashboard).
  Rejected: granularity is per-day per-org, no per-user attribution, no
  way to soft-warn before hard-cut, and the lag from dashboard event to
  enforcement is unpredictable. Suppr-side counters are 50ms of code on
  the hot path and give us per-user attribution for free.
- **Per-call hard token caps tightened to "average".**
  Rejected: `max_tokens` is already set at the request level. Tightening
  to "average" trades correctness for cost — recipe imports legitimately
  need 2000 tokens to extract a 30-ingredient recipe. The right axis to
  enforce on is calls × cost, not max output size.
- **Token bucket instead of fixed window.**
  Rejected: a fixed UTC-day window is easier to reason about in support
  ("I hit the cap at 18:00, when does it reset?" → "midnight UTC") and
  the 36h TTL on counter keys covers any clock skew.

## File map

- `src/lib/server/aiBudget.ts` — new module (counters, price table,
  reserve/commit/release, fail-open state, alarm).
- `src/lib/server/aiProvider.ts` — wired into all 4 entry-point functions
  (`callClaudeVision`, `callOpenAIVision`, `callClaudeText`,
  `callOpenAIText`). Re-exports `AiBudgetExceededError`.
- `src/lib/recipes/importErrorCopy.ts` — added `ai_capacity_reached`
  error code + copy.
- `src/lib/recipe-import/extractSocialRecipe.ts` — `extractRecipeFromCaption`
  takes optional `userId` for attribution.
- `src/lib/recipes/parseCaption.ts` — same, threaded into the route.
- Route handlers updated to pass `userId` + catch `AiBudgetExceededError`:
  - `app/api/nutrition/photo-log/route.ts`
  - `app/api/nutrition/scan-label/route.ts`
  - `app/api/nutrition/voice-log/route.ts`
  - `app/api/recipe-import/image/route.ts`
  - `app/api/recipe-import/caption/route.ts`
  - `app/api/recipe-import/route.ts`
- `tests/unit/server/aiBudget.test.ts` — pin behaviour.
- `.env.example` — 3 new vars documented.

## Mobile

No changes. All AI calls are server-side. Mobile clients see the 503
response and surface "AI is temporarily at capacity. Try again in a
few hours or log manually." through the existing `ai_capacity_reached`
error-copy entry.

## Decision: enforcement enabled in production (2026-06-17, ENG-1158)

Founder-approved. `AI_BUDGET_ENFORCEMENT_ENABLED=true` set in Vercel
production + redeployed — the breaker now **enforces** (was monitoring-only).

- **Caps at flip:** 50 calls/user/day (`AI_BUDGET_PER_USER_DAILY_CALLS`),
  £50/day global (`AI_BUDGET_GLOBAL_DAILY_GBP`). Both widenable via env in ~90s.
- **Safe-to-enable checks:** `UPSTASH_REDIS_REST_*` confirmed present in prod;
  the breaker fails open for 5 min before closing on a sustained Redis outage,
  so a brief Upstash blip can't cause a full AI outage.
- **Deferred (post-launch):** right-sizing the caps against real shadow-mode
  spend needs live traffic (pre-launch is effectively N=1). Revisit the cap
  values once the acquisition wave produces a real spend curve.

## Layer C — per-IP daily call cap (2026-07-09, ENG-1395)

### Problem

The 2026-07-05 deep audit (SEC-01/DI-04) flagged an account-farming vector:
signup runs with GoTrue email confirmation off (instant client-direct
session), and Layer A's per-user call cap resets for every fresh account. A
script farming accounts from one IP gets a clean 50-call quota per account —
Layer A does nothing to stop it. Layer B (the global £/day cap) does bound
the *aggregate* damage (a farmer cycling 1,000 accounts still can't exceed
£50/day of total spend), but it's a blunt, shared instrument: tripping it
denies AI to every legitimate user at once, and it gives no signal for
*which* IP is farming.

### Decision

Add Layer C: a per-IP daily call cap, mirroring Layer A's mechanics exactly
(Upstash counter, cap check, 70%-of-cap alarm, shadow/enforce gate,
refund-on-deny/release) but keyed by a **hashed** trusted client IP instead
of a user id.

- **Cap:** `AI_BUDGET_PER_IP_DAILY_CALLS`, default **200** — 4× the per-user
  default. This is a defence-in-depth **cost bound**, not a tight quota per
  IP. Suppr is an iOS-primary app; cellular users sit behind carrier CGNAT,
  where hundreds-to-thousands of genuine users can share one egress IP. A
  tight per-IP cap would 429 real cellular cohorts — a worse launch bug than
  the farming it's meant to catch (see the design-note thread on ENG-1395:
  the existing `rateLimit.ts` P0-6 comment made the identical call for
  request-rate limiting, choosing per-user-scoped buckets over IP-only for
  exactly this reason). 200 is deliberately generous; right-size it against
  a week of real shadow-mode data before tightening.
- **IP resolution:** `getTrustedClientIp` (ENG-1226) — never the
  client-forgeable leftmost `x-forwarded-for` hop. Resolved once per public
  dispatcher call in `aiProvider.ts` via `await headers()`, wrapped in
  try/catch so a call resolved outside a request context (cron) degrades to
  `ipHash = null` and Layer C is simply skipped for that call, rather than
  bucketing every non-request caller into one shared counter.
- **Hashing, not raw IP:** `hashClientIp` (SHA-256, optionally salted via
  `AI_BUDGET_IP_SALT`) — the counter key never contains a raw IP, so an
  Upstash keyspace leak doesn't hand out a client IP list. Salt is optional
  pre-launch; blank is fine, a random string is stronger.
- **Own enforcement flag — NOT the shared master flag.** This is the one
  place Layer C deliberately diverges from "mirrors Layer A": Layer A/B's
  master flag (`AI_BUDGET_ENFORCEMENT_ENABLED`) has been `true` in
  production since 2026-06-17 (ENG-1158) for caps that are long-proven at
  their current values. Layer C's cap is brand new and has never seen real
  traffic. If it shared the master flag, deploying this change would start
  503ing on an untested per-IP cap the moment it ships — precisely the
  CGNAT-outage risk described above, and not a dark launch at all. Layer C
  therefore gets its own flag, `AI_BUDGET_PER_IP_ENFORCEMENT_ENABLED`,
  default `false`, completely independent of the master flag. Tracking and
  the 70% alarm run unconditionally regardless of either flag — only the
  503-on-deny path is gated.
- **Spend-anomaly alert = the Layer C 70% alarm.** The audit finding also
  asked for a spend-anomaly alert; rather than build a second mechanism, the
  existing 70%-of-cap alarm (already wired to a Sentry `warning`) gets an
  `ip` scope. An IP crossing 70% of its daily call cap *is* the farming
  signal — no separate anomaly detector needed.
- **Refund symmetry:** `releaseBudget` refunds the per-IP call count on
  AI-call failure, same as it already does for the per-user count — a
  failed call (network error, vendor 5xx, timeout) shouldn't count toward
  either daily cap.

### Rollout

1. **Ships now:** counters + alarm live, `AI_BUDGET_PER_IP_ENFORCEMENT_ENABLED=false`.
   Zero behaviour change — this is pure observability until flipped.
2. **Founder-gated:** Grace reviews a week of shadow-mode per-IP call
   distributions (dashboard/Sentry), confirms 200/day doesn't clip real
   CGNAT cohorts, right-sizes `AI_BUDGET_PER_IP_DAILY_CALLS` if needed, then
   flips `AI_BUDGET_PER_IP_ENFORCEMENT_ENABLED=true`.
3. **Paired, non-code mitigation:** re-enabling GoTrue email confirmation on
   signup (removes the free-account supply at the source) is the primary
   fix for the farming vector; Layer C is the code-side backstop, not a
   substitute. See the email-confirmation flow spec for the mobile
   deep-link + redirect-URL work needed before that flip.

### Rejected alternative

- **Scope Layer C to only the "expensive" AI endpoints** (photo-log,
  recipe-import, refine/voice-log), leaving cheap coach/narrative routes
  uncapped. Rejected for implementation simplicity and consistency: all AI
  routes already funnel through the same 4 `aiProvider.ts` call sites that
  Layer A/B use, and a single shared cap is easier to reason about and
  right-size than a per-route matrix. If shadow data shows the flat cap
  clips legitimate heavy users of the cheap routes specifically, revisit
  with a per-callSite cap at that point — YAGNI until the data says so.

### File map (additions)

- `src/lib/server/aiBudget.ts` — `hashClientIp`, `perIpDailyCallCap`,
  `isIpBudgetEnforcementEnabled`, the `ip_calls` counter + key, the `ip`
  alarm scope, `reserveBudget`'s new `ipHash` param and per-IP cap check,
  `releaseBudget`'s per-IP refund.
- `src/lib/server/aiProvider.ts` — `resolveIpHash()` in the two public
  dispatchers (`callAiVision`, `callAiText`), threaded into the 4 internal
  per-vendor `reserveBudget` calls.
- `tests/unit/server/aiBudget.test.ts` — `hashClientIp` tests, per-IP cap
  trip/isolation/refund/shadow/alarm tests, the master-flag-does-NOT-imply
  Layer-C-enforcement regression pin, key-shape pins.
- `.env.example` — `AI_BUDGET_PER_IP_DAILY_CALLS`, `AI_BUDGET_IP_SALT`,
  `AI_BUDGET_PER_IP_ENFORCEMENT_ENABLED`.
