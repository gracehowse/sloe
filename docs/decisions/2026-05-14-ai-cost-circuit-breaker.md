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

Three-layer Upstash-backed daily budget, fail-closed at 100% of cap,
alarmed at 70% of cap. (Layer C added 2026-07-09, ENG-1395.)

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

### Layer C — per-IP daily call cap (ENG-1395, 2026-07-09)

**The gap Layer C closes.** Layer A is keyed by `user_id`, so it resets
per fresh account. Account-farming — spinning up many throwaway accounts
behind one shared IP — defeats it: each new account gets its own clean
50-call quota. Layer B (global spend) is a blunt aggregate that only
trips once the *whole product's* daily spend is exhausted, long after a
single farmer has extracted real cost. Neither layer is keyed by the one
thing farmed accounts genuinely share: **the client IP**.

- Default: **200 AI calls / 24h per hashed client IP** (env override:
  `AI_BUDGET_PER_IP_DAILY_CALLS`). 200 = 4× the per-user cap — generous
  for a shared NAT / office / campus gateway (many legitimate users
  behind one address) while capping a farmer at roughly 4 accounts'
  worth of daily calls.
- Resets on UTC day boundary.
- Counter: `ai_budget:ip_calls:{ipHash}:{YYYY-MM-DD}`.

**Hashed, never raw.** The IP is derived from `getTrustedClientIp()`
(ENG-1226 — the non-forgeable client IP from `x-vercel-forwarded-for` /
`x-real-ip` / rightmost XFF, resolved in `aiProvider.ts`) and then
SHA-256-hashed with the `AI_BUDGET_IP_SALT` salt (default `suppr-ip-v1`),
truncated to 32 hex chars, **before** it reaches the budget module. A raw
IP never lands in the 36h Upstash counter — the counter only ever sees
the hash. Rotating the salt invalidates every existing per-IP bucket in
one move.

**System/cron callers skip it.** `resolveTrustedIpHash()` calls
`next/headers` inside a try/catch: outside a request scope (cron jobs,
system tasks) `headers()` throws and the helper returns `null`.
`reserveBudget`'s 5th `ipHash` param defaults to `null`, and a `null`
`ipHash` skips Layer C's increment, cap check, alarm, and refund
entirely — the `ipHash=null` path is byte-identical to the pre-ENG-1395
two-layer behaviour.

**Structural mirror of Layer A.** Layer C is the per-user block with the
IP hash substituted for the user id: same increment-then-check ordering,
same shadow-vs-enforce semantics (shadow mode grants but keeps the
counter so the shape shows up in the trace before enforcement flips on),
same refund-on-denial (a denied IP-cap call rolls back *all* its
increments: user calls, global spend, per-user spend, and the ip_calls
bump), and `releaseBudget` refunds the ip_calls counter on a failed call
exactly as it refunds the per-user call count. Ships behind the same
`AI_BUDGET_ENFORCEMENT_ENABLED` flag (default off) as Layers A/B.

**The 70% IP alarm is the spend-anomaly signal.** A single IP
approaching 200 calls/day is the *shape* of an account-farming run, not
a legitimate gateway's daily traffic. The per-IP 70% alarm (`scope=ip`,
`tag=ip:{ipHash}`, unit "calls") therefore doubles as the spend-anomaly
alert asked for in ENG-1395 — it surfaces the farming pattern in the ops
log + Sentry the moment an IP crosses the threshold, de-duped once per
UTC day per IP via `ai_budget:alarm_fired:ip:{ipHash}:{YYYY-MM-DD}`.

**Complements, not replaces, the signup-hardening posture.** The proper
long-term defence against account-farming is email-confirmation on
signup (GoTrue `mailer_autoconfirm=false`) — but flipping that naively
breaks the instant-session signup the web/cloud-dev and MFP-refugee
funnel rely on, so it needs its own scoped rollout (spec:
`docs/planning/2026-07-09-email-confirmation-flow-spec.md`). Layer C is
the **code backstop** that lands now, independent of that founder /
dashboard action, so farming is capped even while confirmation is still
instant-session.

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

1. **`reserveBudget(userId, modelId, maxOutputTokens, maxInputTokens?, ipHash?)`**
   computes worst-case cost from `max_tokens` (defaulting `maxInputTokens`
   to `4 × maxOutputTokens` for vision-heavy calls), reserves it against
   all counters (the optional 5th `ipHash` param drives Layer C — pass
   `null`/omit for system calls). Returns `BudgetGrant` (with `grantId`)
   on success, or throws `AiBudgetExceededError` from the provider helper
   when enforcement is on and a cap was hit. `BudgetDenied.reason` is one
   of `per_user_calls` | `global_spend` | `per_ip_calls`.

2. **`commitBudget(grantId, actualUsage)`** runs on success. Reconciles
   the worst-case reservation against actual token usage from the vendor
   response. If actual was below reserved, refunds the diff. If above
   (shouldn't happen given `max_tokens`), accepts the over-spend.

3. **`releaseBudget(grantId)`** runs on AI-call failure (network error,
   vendor 5xx, timeout). Fully refunds the reservation AND refunds the
   per-user call count AND (Layer C) the per-IP call count — we shouldn't
   charge a user or an IP for a call we never completed.

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

A structured log line fires the first time **any** counter crosses 70%
of its cap on a given day (`scope` ∈ `global` | `user` | `ip`):

```
[ai-budget] ALARM 70% — scope=global_spend date=2026-05-14 used=£35.10 cap=£50.00 pct=70%
[ai-budget] ALARM 70% — scope=ip:9f8e…  date=2026-07-09 used=140 cap=200 pct=70%
```

The `ip`-scope alarm (ENG-1395) is the **spend-anomaly signal**: a single
IP nearing its daily cap is the shape of account-farming. The alarm also
captures a `Sentry.captureMessage(..., 'warning')` so it shows up
alongside other ops events. De-duped per UTC day per scope via
`ai_budget:alarm_fired:{scope}:{id}:{YYYY-MM-DD}` (Upstash NX-SET) —
so the IP alarm fires at most once per day per IP.

When the runbook at `docs/operations/alerting.md` is created
(Executor B in this audit), it should append an "AI budget — 70%
global daily cap" section pointing at this design doc.

## Reversibility

- **Off-switch:** set `AI_BUDGET_ENFORCEMENT_ENABLED=false`. Counters
  keep running; no 503s returned. Same code path; zero deploy.
- **Cap widening:** bump `AI_BUDGET_GLOBAL_DAILY_GBP` (or
  `AI_BUDGET_PER_IP_DAILY_CALLS` for Layer C — e.g. if a large shared NAT
  legitimately trips it) env var. Effective immediately on the next
  request — no deploy.
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
  reserve/commit/release, fail-open state, alarm). Layer C (ENG-1395)
  adds `perIpDailyCallCap()`, `ipCallsKey()`, the `ip` alarm scope, the
  `per_ip_calls` denial reason, the `ipHash` 5th `reserveBudget` param,
  and the ip_calls refund in `releaseBudget`.
- `src/lib/server/aiProvider.ts` — wired into all 4 entry-point functions
  (`callClaudeVision`, `callOpenAIVision`, `callClaudeText`,
  `callOpenAIText`). Re-exports `AiBudgetExceededError`. Layer C
  (ENG-1395) adds `resolveTrustedIpHash()` (hashes `getTrustedClientIp`
  at the public `callAiVision`/`callAiText` boundary) and threads the
  hash into each vendor call's `reserveBudget`.
- `src/lib/server/clientIp.ts` — the non-forgeable IP source Layer C
  hashes (ENG-1226; unchanged by ENG-1395).
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
- `tests/unit/server/aiBudget.test.ts` — pin behaviour (Layer C tests
  added under ENG-1395).
- `.env.example` — original 3 vars + `AI_BUDGET_PER_IP_DAILY_CALLS` and
  `AI_BUDGET_IP_SALT` (ENG-1395) documented.

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

## Decision: Layer C — per-IP daily call cap added (2026-07-09, ENG-1395)

Added the per-IP daily call cap (details in the **Layer C** section
above) as the account-farming backstop. Rationale: Layer A resets per
fresh account, so a farmer rotating throwaway accounts behind one shared
IP kept getting a clean 50-call quota each time; Layer B only trips at
the whole-product aggregate. Layer C keys on the hashed client IP those
accounts share.

- **New env:** `AI_BUDGET_PER_IP_DAILY_CALLS` (default 200 = 4× per-user)
  and optional `AI_BUDGET_IP_SALT` (default `suppr-ip-v1`). Both widenable
  / rotatable via env in ~90s.
- **Ships default-OFF** via the existing `AI_BUDGET_ENFORCEMENT_ENABLED`
  flag — same dark-launch-then-enforce path as Layers A/B. In shadow mode
  the counter + 70% IP alarm run so Grace can eyeball the real per-IP
  distribution before flipping enforcement on (the default 200 may need
  right-sizing once real shared-NAT traffic shows up).
- **Privacy:** the raw IP is SHA-256-hashed (salted, 32-hex-truncated)
  before it reaches the counter — no raw IP is stored in the 36h Upstash
  key or in the alarm/Sentry payloads (the tag carries the hash only).
- **The 70% IP alarm is the spend-anomaly signal** ENG-1395 asked for —
  it fires the moment a single IP crosses 70% of its daily cap.
- **Relationship to signup hardening:** this is the code backstop; the
  founder/dashboard action (re-enabling GoTrue email confirmation) is
  spec'd separately in
  `docs/planning/2026-07-09-email-confirmation-flow-spec.md`. The two are
  complementary — Layer C caps farming even while signup stays
  instant-session.
