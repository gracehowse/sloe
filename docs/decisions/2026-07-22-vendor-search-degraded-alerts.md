# Vendor search degraded alerts (ENG-1412)

- **Date:** 2026-07-22
- **Area:** Operations / food-search vendor quotas
- **Status:** Implemented (agent slice); Edamam buy/drop is Grace's call
- **Linear:** ENG-1412
- **Finding:** PRA-011 / IM-11

## Problem

Keyed food vendors (USDA, Edamam, FatSecret) share account-wide free-tier
quotas. When `vendorSearchCache` trips its 90% guard, routes return a
degraded envelope and the client falls through to the next source — but
until ENG-1412 there was no alertable signal, so match quality could narrow
silently during a viral spike.

## Agent slice (shipped)

1. **USDA FDC limit re-verified** against the official API guide
   (2026-07-22): **1,000 requests / hour / IP** for a registered
   api.data.gov key (`DEMO_KEY` is 30/hr). Documented in
   `src/lib/usda/fdcClient.ts`, `src/lib/server/vendorSearchCache.ts`, and
   `docs/operations/posthog-rollout.md`. `VENDOR_QUOTAS.usda` unchanged at
   1,000/hour — the prior ~1,000 estimate was correct.

2. **`vendor_search_degraded` PostHog event** — fired from
   `src/lib/server/vendorSearchMonitoring.ts` when `checkQuota` or
   `consumeQuota` returns `quota_exhausted`. De-duped once per vendor per
   quota window (Redis `SET NX` / in-memory fallback). Also emits a Sentry
   warning for operational dashboards.

## Grace slice (open — product / money)

Per the [2026-07-22 full backlog decision pack](./2026-07-22-full-backlog-decision-pack.md):

- **Recommend drop Edamam** if FatSecret + USDA cover match quality at
  current scale (Edamam free 1k/day is decorative at viral load).
- **Buy Edamam Pro** ($0.00003/request, no daily cap — see
  `src/lib/edamam/client.ts`) only if ingredient-verify quality measurably
  depends on Edamam hits once `vendor_search_degraded` telemetry is live.

Agents do not remove Edamam from the source chain without an explicit Grace
override on ENG-1412.

## Alternatives considered

| Option | Why not (for the alert) |
| --- | --- |
| Client-side event only | Quota trips server-side before any client-visible hit; server capture is the only reliable chokepoint. |
| Fire on every degraded request | Would spam PostHog at viral scale; per-window dedup matches the `aiBudget` 70% alarm pattern. |
| Sentry-only | PostHog lets Grace build a simple count > 0 email alert without Sentry project access for every reviewer. |

## Confidence

9/10 on USDA limit (official docs). 8/10 that per-window dedup is the right
noise/coverage tradeoff — tune alert threshold after first live spike.
