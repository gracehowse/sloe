# Single-region / single-instance SPOF topology

**Date:** 2026-06-14  
**Area:** Operations / Platform foundations  
**Status:** Resolved — documented and staged  
**Linear:** ENG-1114  
**Decision:** Do not move production compute regions yet. Keep the current single-region topology visible, add Upstash monitoring now, measure real UK/EU latency, and gate any EU region move on material EU growth plus database co-location planning.

## Current topology

Suppr is intentionally simple pre-launch:

- **Web/API compute:** Vercel project default region. Treat as US-East unless the Vercel project setting says otherwise; no committed `vercel.json` region override exists today.
- **Database/auth/storage:** one Supabase project (`fnfgxsignmuepshbebrl`) in `us-west-2`; see the PITR posture decision for the current project and backup stance.
- **Redis:** one Upstash Redis instance backs multiple subsystems:
  - rate limiting (`src/lib/server/rateLimit.ts`), which fails closed in production per ENG-668;
  - AI budget enforcement (`src/lib/server/aiBudget.ts`), which fails open for five minutes and then closed;
  - vendor search/detail cache plus vendor quota counters (`src/lib/server/vendorSearchCache.ts`), which fail soft/open so food search does not brown out on cache loss;
  - FatSecret token caching after ENG-1120, increasing the same Redis instance's blast radius.

This is acceptable for the current solo-tester / pre-launch scale, but it is a known SPOF and latency risk, not a buried implementation detail.

## Failure modes that matter

1. **UK/EU latency:** if Vercel compute is in US-East and Supabase is in `us-west-2`, UK/EU users can pay one or more transatlantic round trips on request paths. Moving only Vercel compute to Europe would not automatically fix this; it may simply move the long hop from user→compute to compute→database.
2. **Redis blast radius:** a single Upstash outage can simultaneously affect rate limiting, AI budget enforcement, vendor-cache hit rate, vendor quota protection, and FatSecret token fetches. Because the fail behaviour differs by subsystem, an outage can look like a mix of 429s, 503s, degraded cache performance, and extra vendor traffic.
3. **Supabase single-project outage:** one Supabase project/region is the data-plane SPOF. Pre-scale mitigation is backup/PITR discipline and recovery runbooks, not premature multi-region Postgres.

## Decision

### Region move is staged, not immediate

Do **not** flip the whole Vercel project to Europe in this ticket. The correct sequence is:

1. record the current topology and risk;
2. measure production p50/p95 request latency for UK/EU traffic once there is real traffic;
3. decide whether compute-only EU placement helps or whether the database must move / be co-located first;
4. only then apply a region change.

Confidence: **8/10**. Multi-region or an immediate EU move is premature at N≈1 and risks adding cost, replication complexity, and a relocated database round trip without evidence that it improves user experience.

### Ready-to-pull Vercel levers

When the trigger condition is met, the implementation levers are:

```jsonc
// vercel.json
{
  "regions": ["lhr1"]
}
```

or, for route-level pinning in a Next.js route segment:

```ts
export const preferredRegion = "lhr1";
```

Use route-level `preferredRegion` first for latency-sensitive read/API paths if only a subset benefits. Use project-level / `vercel.json` `regions` only after the Supabase co-location caveat has been resolved.

## Trigger condition for acting

Act when either condition is true:

- UK/EU traffic becomes material (for example, sustained meaningful daily active usage from UK/EU users rather than founder-only testing), **and** measured p95 latency on authenticated API paths is materially user-visible; or
- a launch/growth plan deliberately targets UK/EU users at a scale where the current transatlantic topology is likely to hurt activation or retention.

Before acting, capture a baseline for at least:

- authenticated route p50/p95 by country/region;
- Supabase query timing on the same paths;
- Upstash command latency and error rate.

## Mitigations shipped now

Upstash is now on the monitoring set:

- `recordUpstashFailure` emits a Sentry message tagged `dependency=upstash` with a stable fingerprint, so Sentry alert rules can page/count by subsystem and mode.
- The same hook emits the PostHog `upstash_dependency_failure` metric with `distinct_id=system:upstash`, so failures can be trended next to product events.
- The rate-limit fail-closed path, rate-limit Upstash exceptions, AI-budget Upstash failure path, and vendor-cache/quota failure paths call the hook.

## Alternatives considered

- **Move Vercel to EU now:** rejected. Supabase remains in the US, so this can preserve or worsen the critical round trip while adding operational churn.
- **Add multi-region Supabase / Redis now:** rejected. Correct long-term direction if scale warrants it, but too much cost and replication complexity before launch traffic proves the need.
- **Leave as console logs only:** rejected. Upstash has cross-subsystem blast radius, and ENG-668 means rate limiting can fail closed; operators need an alertable signal, not scattered logs.

## Follow-up

- Configure Sentry alerting on messages with `dependency=upstash`, grouped by `subsystem` and `mode`.
- Add the same PostHog event to an ops dashboard / insight for count-over-time.
- When ENG-1120 lands, ensure FatSecret token-cache errors call `recordUpstashFailure({ subsystem: "fatsecret_token", ... })`.
- Revisit Vercel region placement only after UK/EU growth and latency measurement justify it.
