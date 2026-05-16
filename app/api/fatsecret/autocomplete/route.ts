import { NextResponse } from "next/server";
import {
  FatSecretTierError,
  fatSecretConfigFromEnv,
  fatSecretFoodsAutocomplete,
  fatSecretTierFromEnv,
} from "@/lib/fatsecret/client";
import { rateLimit } from "@/lib/server/rateLimit";
import { hasFatSecretConfig, misconfiguredFatSecretResponse } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";

/**
 * GET /api/fatsecret/autocomplete?q=<query>&max=<n>
 *
 * Premier-only typeahead suggestion endpoint
 * (2026-04-26 — FatSecret Premier Free upgrade).
 *
 * Behaviour:
 *   - On Premier tier (`FATSECRET_TIER=premier`): proxies
 *     `foods.autocomplete.v2` and returns
 *     `{ ok: true, tier: "premier", suggestions: string[] }`.
 *   - On Basic tier (or `FATSECRET_TIER` unset): returns
 *     `{ ok: true, tier: "basic", suggestions: [] }` with a 200 so
 *     callers can opportunistically render or skip the typeahead row
 *     without conditional UI on a 4xx.
 *   - When the FatSecret credentials are missing entirely, returns
 *     503 (matches `/api/usda/*` shape).
 *
 * Auth: same per-user rate-limited shape as the other nutrition routes.
 *
 * Decision doc: `docs/decisions/2026-04-26-fatsecret-upgrade.md`.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Tighter rate limit than full search — autocomplete fires per
  // keypress (debounced). 120/min ≈ 2/s headroom.
  const rl = await rateLimit({
    keyPrefix: "api:fatsecret-autocomplete",
    userId,
    limit: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: false, error: "missing_q" }, { status: 400 });

  // Short-circuit Basic tier without opening a network call. The client
  // is expected to call the full search anyway; this stays cheap on
  // Basic and lets the same client code work across tiers.
  if (fatSecretTierFromEnv() !== "premier") {
    return NextResponse.json({ ok: true, tier: "basic", suggestions: [] });
  }

  if (!hasFatSecretConfig()) {
    const missing = misconfiguredFatSecretResponse();
    if (missing) return missing;
  }

  const cfg = fatSecretConfigFromEnv();
  const rawMax = Number(searchParams.get("max") ?? "4");
  const maxResults = Number.isFinite(rawMax) && rawMax >= 1 ? Math.min(10, Math.floor(rawMax)) : 4;

  try {
    const suggestions = await fatSecretFoodsAutocomplete(cfg, q, { maxResults });
    return NextResponse.json({
      ok: true,
      tier: "premier",
      suggestions: suggestions.map((s) => s.suggestion),
    });
  } catch (e) {
    if (e instanceof FatSecretTierError) {
      // Tier mismatch at runtime (e.g. env var says premier but the
      // account doesn't have it). Treat as Basic so the client falls
      // back gracefully instead of surfacing a 502.
      return NextResponse.json({ ok: true, tier: "basic", suggestions: [] });
    }
    captureRouteError(e, "/api/fatsecret/autocomplete");
    return NextResponse.json(
      {
        ok: false,
        error: "fatsecret_failed",
        message: e instanceof Error ? e.message : "FatSecret request failed",
      },
      { status: 502 },
    );
  }
}
