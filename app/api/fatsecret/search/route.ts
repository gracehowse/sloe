import { NextResponse } from "next/server";
import {
  fatSecretConfigFromEnv,
  fatSecretFoodSearch,
} from "@/lib/fatsecret/client";
import { parseFatSecretFoodDescription } from "@/lib/fatsecret/parseFoodDescription";
import { rateLimit } from "@/lib/server/rateLimit";
import { hasFatSecretConfig, misconfiguredFatSecretResponse } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import {
  checkQuota,
  consumeQuota,
  getCachedSearch,
  setCachedSearch,
} from "@/lib/server/vendorSearchCache";

/**
 * GET /api/fatsecret/search?q=<query>&page=<n>
 *
 * FatSecret is the 4th source in the food-search merge alongside USDA,
 * Open Food Facts and Edamam. Lane-A wire-up (2026-04-30) — Premier
 * Free credentials are valid in production but no full-search route
 * existed, so the merge pipeline never carried FatSecret hits and every
 * tested query (`salmon`, `Big Mac`, `Starbucks`, etc) surfaced as
 * USDA-only.
 *
 * Tier behaviour:
 *   - `foods.search` works on Basic AND Premier — both tiers benefit
 *     from FatSecret being merged into search results. Premier just
 *     adds the wider nutrient panel to detail-view (`food.get`); the
 *     search hits themselves are identical across tiers.
 *
 * Behaviour:
 *   - Empty query → 400 `missing_q` (matches /api/usda/search shape).
 *   - Missing creds → 503 `server_misconfigured` via the shared helper.
 *   - Upstream failure (network, OAuth, rate limit) → 200 with
 *     `{ ok: true, hits: [], page }` so the merge pipeline keeps the
 *     other three sources rendering. Diagnostic detail surfaces in
 *     server logs only.
 *   - Per-row macros come from `food_description`; rows that don't parse
 *     are still returned (with `macrosPer100g: null`) so the merge can
 *     still show the title and trigger a `food.get` detail fetch on tap.
 *
 * Pagination: `page` is 1-indexed; FatSecret's API takes a 0-indexed
 * `page_number`, which is mapped server-side. `max_results=25` aligns
 * with the merge pipeline's per-page slice.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // FatSecret search is heavier than autocomplete (full payload). Match
  // the USDA search rate limit (60/min/user).
  const rl = await rateLimit({
    keyPrefix: "api:fatsecret-search",
    userId,
    limit: 60,
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

  const rawPage = Number(searchParams.get("page") ?? "1");
  const pageNumber = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  // ENG-1038 — cross-request cache + account-level quota guard.
  const locale = searchParams.get("locale");

  // 1) Cache hit — no FatSecret call, no quota spend.
  const cached = await getCachedSearch<unknown>("fatsecret", q, { locale, page: pageNumber });
  if (cached) {
    return NextResponse.json({ ok: true, hits: cached, page: pageNumber, cached: true });
  }

  // 2) Account-wide quota exhausted — skip FatSecret, return DEGRADED so the
  //    merge falls through to the next source + the UI shows an honest notice.
  const quota = await checkQuota("fatsecret");
  if (!quota.allowed) {
    return NextResponse.json({
      ok: true,
      hits: [],
      page: pageNumber,
      degraded: true,
      degradedReason: "quota_exhausted",
    });
  }

  if (!hasFatSecretConfig()) {
    const missing = misconfiguredFatSecretResponse();
    if (missing) return missing;
  }

  const cfg = fatSecretConfigFromEnv();

  try {
    // Consume one quota unit immediately before the live call (atomic).
    await consumeQuota("fatsecret");
    // FatSecret's `page_number` is 0-indexed; map from the 1-indexed
    // `page` we accept on the API surface so it lines up with USDA / OFF.
    const results = await fatSecretFoodSearch(cfg, q, {
      maxResults: 25,
      pageNumber: pageNumber - 1,
    });

    // 2026-05-06: log search returns when hits are zero so we can
    // distinguish "FatSecret API rejected our IP and returned empty"
    // from "the query genuinely had no matches". Vercel's egress IPs
    // are rotating AWS lambda IPs that may not be on FatSecret's
    // allowlist for the data endpoint (separate from the token
    // endpoint).
    if (results.length === 0) {
      console.warn(
        `[/api/fatsecret/search] empty result — q="${q.slice(0, 40)}" page=${pageNumber}`,
      );
    }

    const hits = results.map((r) => {
      const parsed = parseFatSecretFoodDescription(r.food_description);
      const brand = (r.brand_name ?? "").trim();
      const name = (r.food_name ?? "Unknown").trim();
      const displayName = brand ? `${brand} · ${name}` : name;
      return {
        foodId: r.food_id,
        label: displayName,
        brand: brand || null,
        // Per-100g macros only when FatSecret returned a "Per 100g"
        // basis. Per-serving rows surface with null per-100g macros —
        // the client fetches the full detail on tap before scaling.
        // Never invent: if FatSecret didn't ship macros, we don't either.
        macrosPer100g:
          parsed && parsed.basis === "100g"
            ? {
                calories: parsed.calories,
                protein: parsed.protein,
                carbs: parsed.carbs,
                fat: parsed.fat,
              }
            : null,
        servingLabel: parsed?.servingLabel ?? null,
        servingGrams: parsed?.servingGrams ?? null,
        // Per-serving inline payload — used by the search UI to render
        // an honest "per serving" headline before the on-tap detail
        // fetch. Null when basis is 100g (already covered by macrosPer100g).
        macrosPerServing:
          parsed && parsed.basis === "serving"
            ? {
                calories: parsed.calories,
                protein: parsed.protein,
                carbs: parsed.carbs,
                fat: parsed.fat,
              }
            : null,
      };
    });

    // Cache only the genuine successful response. The catch block below
    // returns ok+empty on upstream failure (OAuth, IP block, 502) — that
    // must NOT be cached as a real empty, or a transient FatSecret blip
    // would suppress all FatSecret hits for 24h.
    await setCachedSearch("fatsecret", q, hits, { locale, page: pageNumber });
    return NextResponse.json({ ok: true, hits, page: pageNumber });
  } catch (e) {
    // Log + return empty so the merge pipeline keeps USDA / OFF / Edamam
    // rendering. FatSecret outages must never break food search overall.
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      "[/api/fatsecret/search] failed:",
      msg,
    );
    captureRouteError(e, "/api/fatsecret/search");
    // 2026-05-06 (Grace) — also surface a non-fatal `_diag` token on the
    // empty response so the mobile client diagnostic
    // (`searchFatSecret`) can log it. Keeps `ok: true` and `hits: []` so
    // the merge contract is unchanged. Truncate to avoid leaking long
    // upstream payloads.
    //
    // 2026-05-06 audit (B3): gate `_diag` on `SUPPR_DEBUG=1` so authed
    // users in production can't read upstream FatSecret payloads from
    // the Network panel. Server logs still carry the full message via
    // the console.error above. Tests stub the env to keep the existing
    // assertions passing.
    const includeDiag = process.env.SUPPR_DEBUG === "1";
    return NextResponse.json({
      ok: true,
      hits: [],
      page: pageNumber,
      ...(includeDiag
        ? { _diag: { upstream: "failed", message: msg.slice(0, 200) } }
        : {}),
    });
  }
}
