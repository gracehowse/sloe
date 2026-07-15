# PostHog flags stay behind first-party proxy

Date: 2026-06-19
Status: Resolved
Area: Security / analytics
Issue: ENG-993

## Context

The 2026-06-08 competitor teardown showed that feature-flag and experiment payloads can expose roadmap intent when an app talks directly to a third-party analytics host. Suppr already shipped a PostHog reverse proxy on 2026-05-14 for network resilience: web uses `/ingest`, and mobile defaults to `https://suppr-club.com/ingest`.

## Decision

Keep PostHog analytics and flag evaluation on first-party origins:

- Web `posthog-js` must use `/ingest`; `next.config.ts` rewrites `/ingest/decide` and the rest of `/ingest/*` to PostHog server-side.
- Mobile must default to `https://suppr-club.com/ingest`, with no committed Expo config pointing at `*.posthog.com`.
- Direct PostHog hosts are allowed only in server-side code and Next.js rewrites, not in client-reachable bundles/config.
- Roadmap-sensitive entitlement and kill-switch decisions should stay server-side via `src/lib/server/featureFlags.ts`; client-side flags remain acceptable only for low-sensitivity visual rollout/kill-switch gates where the residual flag-name exposure is documented by this decision.

## Enforcement

`npm run check:posthog-proxy` scans the built web client output (`.next/static`), web's own committed source (`src/`, `app/`, excluding the documented server-only modules and `app/api/**` route handlers), and committed mobile config/source for direct PostHog host literals. `.github/workflows/ci.yml` runs it as an explicit step immediately after `Build`, so a future SDK/config change that reintroduces `*.posthog.com` into client-reachable assets fails CI before merge (ENG-1559 — previously this only ran in the local `npm run ci` chain and did not gate merges).

## Alternatives considered

- **Build a new proxy.** Rejected because the first-party rewrite already exists and covers `/decide`; duplicating it would add moving parts without reducing exposure.
- **Move every client visual flag server-side.** Rejected for now: most visible flags are design-system rollout/kill-switch toggles, not entitlements. Moving all of them would add latency and complexity while still requiring client UI branches. Sensitive unlocks and kill switches remain the server-side boundary.
- **Allow direct PostHog UI host literals for dashboard links.** Rejected in source/bundle because the defensive goal is to remove obvious PostHog fingerprints from client-reachable assets. Operators can provide a UI host via build env if dashboard deep-links become more valuable than the fingerprint reduction.

## Verification

Run:

```bash
npm run check:posthog-proxy
```

For full web coverage, run it after:

```bash
npm run build
```
