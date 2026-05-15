# Decision — Align web Sentry setup with the official `sentry-nextjs-sdk` skill

**Date:** 2026-05-15
**Author:** Grace (with Claude)
**Status:** Resolved
**Area:** Observability / build
**Skill referenced:** [getsentry/sentry-for-ai → `skills/sentry-nextjs-sdk/SKILL.md`](https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-nextjs-sdk/SKILL.md)
**Related decision:** [2026-05-14 — Sentry redacted-core capture pre-consent](2026-05-14-sentry-pre-consent-capture.md)

## Context

Yesterday's decision (`2026-05-14`) wired the consent-gated redaction
posture but left the web SDK on the **legacy file layout**:
`sentry.client.config.ts`, `sentry.server.config.ts`,
`sentry.edge.config.ts` at the project root with no
`instrumentation.ts` hook. That layout was correct for `@sentry/nextjs`
≤ 7 and Next.js ≤ 13 but the modern pattern for Next.js 15 +
`@sentry/nextjs` 10 (our stack) requires:

1. A root-level `instrumentation.ts` that loads the server / edge
   configs by `NEXT_RUNTIME`. Without this, server-side `Sentry.init()`
   was likely never running — captures from server actions, route
   handlers, and middleware would silently drop.
2. `withSentryConfig` to receive `org` / `project` / `authToken`
   explicitly so source maps upload at build time.
3. `tunnelRoute` for ad-blocker bypass — the most stakes-y bit for
   Phase 1 (TikTok+IG, 2026-07-01) because paid-acquisition cohorts
   skew higher on ad-blocker adoption than the general population.

Today's session aligned the codebase to that skill while preserving
yesterday's consent posture.

## Decision

### Changes shipped

| File | Change |
|---|---|
| `instrumentation.ts` | **NEW.** Loads `sentry.server.config.ts` / `sentry.edge.config.ts` by `NEXT_RUNTIME` and exports `onRequestError = Sentry.captureRequestError` (catches all unhandled server-side request errors automatically) |
| `instrumentation-client.ts` | **RENAMED from `sentry.client.config.ts`.** On Next.js 15 + `@sentry/nextjs` 10 the legacy filename is no longer auto-loaded by `withSentryConfig` — verified empirically by checking `window.__SENTRY__` after boot (client was un-initialised under the old name). Also added `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart` so client-side `<Link>` navigations get their own trace span. |
| `next.config.ts` | `withSentryConfig` now passes `org` / `project` / `authToken` from env, `tunnelRoute: "/monitoring"`, and `silent: !process.env.CI` (verbose in CI logs, quiet locally) |
| `middleware.ts` | `/monitoring` added to `PUBLIC_ROUTES` so the tunnel isn't 307'd to `/login` |
| `app/global-error.tsx` | Replaced brittle `globalThis.Sentry` lookup with a direct `import * as Sentry from "@sentry/nextjs"` |
| `instrumentation-client.ts` | Added `Sentry.replayIntegration` with strict masking (`maskAllText`, `maskAllInputs`, `blockAllMedia`) and errors-only sampling (`replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 1.0`); `enableLogs: true`; dev `tracesSampleRate: 1.0` |
| `sentry.server.config.ts` | `enableLogs: true`; dev sample rate |
| `sentry.edge.config.ts` | `enableLogs: true`; dev sample rate |
| `app/api/push/weekly-recap/route.ts` | Wrapped `POST` in `Sentry.withMonitor("weekly-recap-push", ..., { schedule: { type: "crontab", value: "0 23 * * *" }, checkinMargin: 5, maxRuntime: 10, timezone: "UTC" })`. Renamed inner handler to `runWeeklyRecapPush`. Schedule must stay in sync with `vercel.json`. |
| `.env.example` + `.env.local` | Added `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (build-time source-map upload creds) |

### Intentional divergences from the skill

The skill is opinionated; some of its defaults conflict with yesterday's
2026-05-14 posture. We diverge in two places:

| Skill recommendation | Our choice | Why |
|---|---|---|
| `sendDefaultPii: true` | `sendDefaultPii: false` (default unset) | We run our own consent-gated `redactPII` + `stripToCore`. Trusting Sentry's default redaction would undo the 2026-05-14 work. |
| `includeLocalVariables: true` (server) | Not enabled | Our `redactPII` walks event keys but does not yet recurse into stack-frame `vars`. Turning this on would attach local-var snapshots (potentially containing email / token-shaped values the redactor missed) to every prod error. Revisit once `redactPII` is extended. |

### Session replay — privacy posture

Sentry Replay (`replayIntegration`) is added with the strictest defaults:

- `maskAllText: true` — every text node masked at the SDK level
- `maskAllInputs: true` — every input value masked
- `blockAllMedia: true` — images/video blocked from the replay
- `networkDetailAllowUrls` — empty (default); no request bodies / headers captured

Sampling:

- `replaysSessionSampleRate: 0` — **no random session capture**. PostHog already records every consented session (`2026-05-13-session-replay-and-feature-flags.md`); duplicating that in Sentry would burn replay quota for no gain.
- `replaysOnErrorSampleRate: 1.0` — 100% of *error* sessions captured. The 30 seconds leading up to a crash attached to the issue — which is what makes Sentry replay valuable. PostHog session replay isn't error-linked, so the two are complementary rather than overlapping.

In-memory replay buffering runs unconditionally; transmission still
passes through the consent-gated `beforeSend`. Pre-consent (and flag-
off) the event is dropped → buffered replay drops with it.

### Tunnel route — ad-blocker bypass

`tunnelRoute: "/monitoring"` creates an auto-generated Next.js API
route that proxies error events to `sentry.io`. Two reasons it matters:

1. **Ad-blocker bypass.** uBlock / Brave / 1Blocker block direct
   requests to `*.sentry.io` (and `/api/sentry`, `/api/error`, etc.).
   `/monitoring` is uncommon enough to evade these lists.
2. **TikTok cold-open cohort.** Paid-acquisition users skew higher
   on mobile + ad-blocker usage. Those are the same cohort the
   2026-05-14 pre-consent capture decision exists to catch.

`middleware.ts` was updated to add `/monitoring` to `PUBLIC_ROUTES`
so the tunnel isn't auth-gated — it has to be reachable without a
session for unauthenticated cold-open crashes to report.

### `instrumentation.ts` — closing the server-side init gap

Pre-today, the codebase had `sentry.server.config.ts` and
`sentry.edge.config.ts` but no `instrumentation.ts`. On Next.js 15 +
`@sentry/nextjs` 10 the runtime no longer auto-discovers those files
— they have to be imported from `instrumentation.ts` based on
`NEXT_RUNTIME`. Without that hook, server-side `Sentry.init()` was
likely never running. Captures from server actions, route handlers,
and middleware would have silently dropped to /dev/null.

`onRequestError = Sentry.captureRequestError` (also exported from
`instrumentation.ts`) automatically captures all unhandled server-side
request errors — server actions, RSC render errors, route handlers,
middleware. Requires `@sentry/nextjs` ≥ 8.28.0; we're on 10.47.

## Verification

End-to-end:

- ✅ `tsc --noEmit` — clean
- ✅ `npx vitest run tests/unit/observability/sentryRedaction.test.ts` — 16/16 pass
- ✅ `sentry-cli info` — auth token resolves with scope `org:ci` (superset of `project:releases` + `org:read`)
- ✅ `sentry-cli send-event` — event id `569e1274-7a3f-4605-8aef-361e6a4fc8d3` dispatched + ingested

Browser-side verification via `npm run dev` + Claude Preview eval:

- ✅ SDK initialised: `window.__SENTRY__['10.47.0']` carries a `BrowserClient` with the correct DSN host (`o4511383114350592.ingest.us.sentry.io`)
- ✅ 14 integrations loaded including `Replay`, `BrowserTracing`, `BrowserSession`, `NextjsClientStackFrameNormalization`
- ✅ Consent gate works (without `localStorage.suppr_cookie_consent = "accepted"`, no events post to the tunnel)
- ✅ Tunnel route URL builds correctly: `/monitoring?o=4511383114350592&p=4511383116316672&r=us`
- ⚠️ **Sentry Relay returns `403 {"detail":"event submission rejected with_reason: ProjectId"}`** for browser-originated events — both via the tunnel AND via direct ingestion. `sentry-cli send-event` (no browser origin) succeeded for the same DSN against the same project. Diagnosis: the `suppr-web` project's "Allowed Domains" list in Sentry doesn't include `localhost` (or anything), and browser-origin events are rejected as a result. **Fix: Sentry → Projects → suppr-web → Settings → Security & Privacy → Allowed Domains → add `localhost:*` for dev, `suppr.club`, `*.suppr.club`, `*.vercel.app` (preview deploys) for prod.** This is dashboard config, not code.

Outstanding (tracked in follow-ups):

- [ ] Update Allowed Domains in Sentry dashboard for `suppr-web` project (see above)
- [ ] First Vercel preview deploy — needed to prove source-map upload runs and prod stack traces unminify
- [ ] First weekly-recap cron firing in production — should auto-register the `weekly-recap-push` monitor in Sentry's Crons dashboard
- [ ] Symlink `.env.local` from the main project root into any new git worktree before running `next dev` (Next.js loads `.env.local` from cwd; worktrees don't inherit it). One-liner: `ln -s /Users/graceturner/Suppr-1/.env.local .env.local`

## Tier C — what we added and what we deliberately skipped

### Added: Sentry Cron monitor for `weekly-recap-push`

`app/api/push/weekly-recap/route.ts` now wraps the cron handler in
`Sentry.withMonitor("weekly-recap-push", ..., monitorConfig)`. The
monitor auto-provisions on first check-in:

- `schedule: { type: "crontab", value: "0 23 * * *" }` — matches `vercel.json`. Change both together.
- `checkinMargin: 5` — alert if no start check-in within 5 min of scheduled time.
- `maxRuntime: 10` — alert if the handler runs longer than 10 min.
- `timezone: "UTC"`.

Why this matters: Vercel doesn't surface missed crons by default. The
weekly recap fires once per day; a quiet failure means a whole week
of users get no recap and we don't notice until someone complains.
PostHog tracks the `weekly_recap_push_sent` event per successful push
— but a zero-count day looks identical to a zero-eligible-users day.
Sentry Cron monitoring is the canonical signal for "did the
infrastructure fire?".

### Skipped: AI Monitoring (`openAIIntegration` / `anthropicAIIntegration`)

Sentry's AI Monitoring integrations work by monkey-patching the
official `openai` / `@anthropic-ai/sdk` clients. Our `aiProvider.ts`
uses **raw `fetch` against `api.anthropic.com` and `api.openai.com`**
(see `callClaudeVision`, `callOpenAIVision`, and their text-mode
equivalents). The integrations would load but instrument nothing — a
silent no-op that misleads anyone reading the config.

We already capture the data Sentry's AI Monitoring view shows:

| Metric | PostHog `$ai_generation` event | Sentry AI Monitoring |
|---|---|---|
| Tokens in / out | ✅ `inputTokens`, `outputTokens` | ✅ |
| Latency by model | ✅ `latencyMs`, `model` | ✅ |
| Error rate by model | ✅ `isError`, `errorCode` | ✅ |
| Cost projection | ✅ derivable from tokens | ✅ |
| Call-site breakdown | ✅ `callSite` | ✅ |

PostHog is already the source of truth (`src/lib/server/aiProvider.ts`
fires `emitAiGeneration` from every code path). Adding Sentry AI
Monitoring on top would duplicate the spend, splinter the dashboard,
and require maintaining two pipelines for one signal. Not worth it.

If we ever migrate `aiProvider.ts` from raw fetch to the official
SDKs (e.g. for streaming, structured outputs, or tool calling), revisit
this decision — at that point the integrations become free
instrumentation and consolidation may make sense.

## Follow-ups

- [ ] Mobile wizard (`npx @sentry/wizard@latest -i reactNative --saas --org suppr-kr --project suppr-mobile`) — rename `super-mobile` → `suppr-mobile` first in Sentry Project Settings, then review the diff and revert any duplicate `Sentry.init()` the wizard inserts (we already have `apps/mobile/lib/errorTracking.ts` with the redaction `beforeSend`)
- [ ] Mirror all 6 Sentry env vars to Vercel for `production` + `preview` environments
- [ ] Mirror `EXPO_PUBLIC_SENTRY_DSN` to EAS secrets (`eas secret:create`)
- [ ] Extend `redactPII` to walk `exception.values[*].stacktrace.frames[*].vars` post-consent → then turn on `includeLocalVariables: true` server-side
- [ ] After two weeks no-regression at 100%, file cleanup PR to remove the `sentry-pre-consent-capture` flag gate (per CLAUDE.md feature-flag-removal rule)
