/**
 * 2026-05-16 (ENG-519) — server-side PostHog feature-flag check.
 *
 * The web client uses `isFeatureEnabled` from `@/lib/analytics/track`
 * which wraps `posthog-js`. That SDK is browser-only and no-ops in a
 * Node API route. This module is the server-side counterpart: it
 * reaches into `posthog-node` so route handlers can gate themselves on
 * the same PostHog flag system the client already uses.
 *
 * Primary use case: **kill switches** for the AI-heavy critical paths
 * (`/api/recipe-import`, `/api/nutrition/photo-log`, etc.). If a
 * provider misbehaves — bad prompt rollout, runaway cost, vendor
 * outage — flipping a single PostHog flag turns the route off without
 * a redeploy.
 *
 * ## Semantics: stable system distinct_id
 *
 * PostHog flags are evaluated **per-user** by default. Kill switches
 * are inherently **global** — flipping it should affect every request,
 * not roll out per percentile of users. We solve this by using a
 * stable system `distinct_id` (`SYSTEM_DISTINCT_ID` below) for every
 * server-side check. That distinct_id only ever appears in PostHog as
 * a single "user" whose flag values are evaluated once and then cached.
 *
 * Result: flag at 100% rollout = killed for everyone; 0% = enabled.
 * Natural reading: `kill_recipe_import = ON` means recipe-import is
 * killed.
 *
 * ## Fail-safe: false on any error
 *
 * If PostHog can't be reached (network failure, key misconfigured,
 * etc.), we return `false` — meaning the kill switch reads as "not
 * killed" and the route continues to serve. This is the right failure
 * mode: a degraded PostHog connection shouldn't accidentally kill
 * every route on the platform.
 *
 * ## In-process cache
 *
 * `posthog-node` polls flag definitions periodically (default 30s).
 * We cache the client at module scope so cold-start cost is paid once
 * per Lambda container. Tests can inject a stub via `__setFeatureFlagsClientForTesting`.
 */

import { PostHog } from "posthog-node";

const SYSTEM_DISTINCT_ID = "system:killswitch";

/**
 * Default PostHog host. Matches `src/lib/analytics/serverTrack.ts` so
 * a single project key reaches the same instance from both surfaces.
 */
const DEFAULT_HOST = "https://us.i.posthog.com";

type PostHogLike = Pick<PostHog, "isFeatureEnabled" | "shutdown">;

let cachedClient: PostHogLike | null = null;
let cachedClientError: Error | null = null;

function getClient(): PostHogLike | null {
  if (cachedClient) return cachedClient;
  if (cachedClientError) return null;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) {
    // Not an error — local dev without PostHog wired. Routes default
    // to "not killed" and continue serving.
    cachedClientError = new Error("NEXT_PUBLIC_POSTHOG_KEY missing");
    return null;
  }

  try {
    cachedClient = new PostHog(key, {
      host: process.env.POSTHOG_HOST?.trim() || DEFAULT_HOST,
      // Flush every 30s — kill switches don't need real-time event
      // ingestion (we don't track events here, only read flags). Keeps
      // the Lambda cold-start cheap.
      flushAt: 1,
      flushInterval: 30_000,
    });
    return cachedClient;
  } catch (err) {
    cachedClientError = err instanceof Error ? err : new Error(String(err));
    return null;
  }
}

/**
 * Check whether a PostHog feature flag is enabled for the system
 * distinct_id. Used to gate critical routes on kill-switch flags.
 *
 * Returns `false` on any error (missing env var, PostHog unreachable,
 * flag not yet defined). Routes treat `true` as "killed".
 *
 * @example
 *   if (await isServerFeatureEnabled("kill_recipe_import")) {
 *     return NextResponse.json(
 *       { ok: false, error: "service_unavailable", retryAfterSec: 300 },
 *       { status: 503, headers: { "Retry-After": "300" } },
 *     );
 *   }
 */
export async function isServerFeatureEnabled(
  flagKey: string,
  distinctId: string = SYSTEM_DISTINCT_ID,
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    const result = await client.isFeatureEnabled(flagKey, distinctId);
    return result === true;
  } catch {
    return false;
  }
}

/**
 * Test hook — inject a mock client. The caller is responsible for
 * resetting state between tests via `null` and the matching `clearCache`
 * call.
 *
 * @internal
 */
export function __setFeatureFlagsClientForTesting(client: PostHogLike | null): void {
  cachedClient = client;
  cachedClientError = null;
}

/**
 * Test hook — clear the cached client + error. Required between tests
 * that toggle env vars.
 *
 * @internal
 */
export function __clearFeatureFlagsCacheForTesting(): void {
  cachedClient = null;
  cachedClientError = null;
}
