/**
 * Server-side PostHog event emit (Sunday push rewrite — T6, 2026-04-19).
 *
 * Reason this exists separately from `track.ts`:
 *   - `track.ts` is `"use client"`. It imports `posthog-js`, which is a
 *     browser SDK that no-ops in a Node route handler.
 *   - We need to fire `weekly_recap_push_sent` from the server cron
 *     route immediately after a successful Expo ticket. Per-user
 *     attribution is the whole point of T6 — it lets us join sent ↔
 *     opened on `(distinct_id=userId, weekKey)`.
 *
 * Design:
 *   - Direct POST to PostHog's `/capture/` ingest endpoint. No SDK
 *     dependency on the server (the official `posthog-node` package
 *     was avoided to keep the route handler's cold-start fast — one
 *     fetch, no library).
 *   - Reads the project key from `NEXT_PUBLIC_POSTHOG_KEY` (the same
 *     key the client uses; PostHog ingest is project-scoped, not
 *     secret-scoped).
 *   - Host can be overridden via `POSTHOG_HOST`; defaults to the EU
 *     region used by the rest of the project (matches mobile, see
 *     `apps/mobile/lib/analytics.ts:18`). [Correction: mobile defaults
 *     to `https://us.i.posthog.com`. Web `posthog-js` is initialised
 *     in `src/app/components/AnalyticsProvider.tsx`; this server
 *     helper inherits the same default to stay aligned.]
 *   - `userId` becomes `distinct_id` so opens (mobile-side, attributed
 *     to the same Supabase user via `posthog.identify(userId)`) line
 *     up with sends.
 *   - Fire-and-forget: returns a `Promise<void>` that resolves on
 *     success and silently swallows errors. The push delivery is the
 *     load-bearing side-effect; analytics MUST NOT block the cron.
 *   - Injectable `fetch` for tests.
 */

import type { AnalyticsEventName } from "./events";

export type ServerTrackOptions = {
  /** Defaults to `globalThis.fetch`. Tests can inject a mock. */
  fetchImpl?: typeof fetch;
  /** Override for the PostHog API host. */
  host?: string;
  /** Override for the project key. Defaults to the env var. */
  projectKey?: string;
};

/**
 * Default PostHog host. Matches `apps/mobile/lib/analytics.ts` so a
 * given Supabase user lands on the same project from server + client.
 */
export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/**
 * POST a single event to PostHog's `/capture/` endpoint.
 *
 * Returns `{ ok: true }` on a 2xx response, `{ ok: false, reason }`
 * otherwise. The route caller treats both as fire-and-forget — the
 * return shape exists only for tests + structured logging.
 */
export async function serverTrack(
  event: AnalyticsEventName,
  distinctId: string,
  properties: Record<string, unknown> = {},
  options: ServerTrackOptions = {},
): Promise<{ ok: boolean; reason?: string }> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable" };
  }
  const projectKey = options.projectKey ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  if (!projectKey) {
    // No key configured — silently no-op. This is the same behaviour
    // as the client `track()` (see `src/lib/analytics/track.ts:8`).
    // Explicitly returning `{ ok: false }` so tests can assert "no
    // network call when key is missing".
    return { ok: false, reason: "no_project_key" };
  }
  const host = (options.host ?? process.env.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST).replace(
    /\/+$/,
    "",
  );
  if (typeof distinctId !== "string" || distinctId.length === 0) {
    return { ok: false, reason: "invalid_distinct_id" };
  }
  try {
    const res = await fetchImpl(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: projectKey,
        event,
        distinct_id: distinctId,
        properties,
        // PostHog ingest accepts an explicit timestamp. Letting the
        // server stamp it at fire-time gives us correct ordering even
        // if a batch of users takes seconds to fan out.
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      return { ok: false, reason: `status_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: `fetch_error:${(err as Error)?.message ?? "unknown"}`,
    };
  }
}
