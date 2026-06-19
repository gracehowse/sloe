import { NextResponse } from "next/server";
import { fdcConfigFromEnv, fdcFoodsSearch } from "@/lib/usda/fdcClient";
import { rateLimit } from "@/lib/server/rateLimit";
import { misconfiguredUsdaResponse } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import {
  checkQuota,
  consumeQuota,
  getCachedSearch,
  setCachedSearch,
} from "@/lib/server/vendorSearchCache";

/**
 * ENG-1119 — USDA search resilience.
 *
 * `fdcFoodsSearch` throws `Error("USDA FDC HTTP <status> …")` on a non-ok
 * upstream response. A transient 5xx is exactly the case worth one bounded
 * retry: USDA's FDC endpoint occasionally returns a 502/503/504 under load,
 * and a second attempt a few hundred ms later usually succeeds. We classify
 * the failure from the thrown message and retry ONCE on a 5xx (or a thrown
 * network/timeout error, which `AbortSignal.timeout` surfaces) — never on a
 * 4xx / 429, which won't recover and would only burn the next request's
 * headroom. This mirrors the Supadata client's "transient-only" retry policy
 * (`src/lib/server/supadata/client.ts`).
 */
const USDA_RETRY_BACKOFF_MS = 300;

/**
 * True when the upstream failure looks transient and worth one retry: a 5xx
 * from FDC, or a thrown fetch/timeout error (no HTTP status surfaced). A 4xx
 * (including 429 rate-limit) is treated as non-transient — retrying it just
 * wastes the route's budget on a request that will fail the same way.
 */
function isTransientUsdaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const httpMatch = /USDA FDC HTTP (\d{3})/.exec(msg);
  if (httpMatch) {
    const status = Number(httpMatch[1]);
    return status >= 500 && status <= 599;
  }
  // No HTTP status in the message → fetch threw (DNS, connection reset) or the
  // 5s AbortSignal.timeout fired. Both are transient; one retry is safe.
  return true;
}

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // P0-6 (2026-04-25): per-user scoping (parity with /api/usda/food).
  const rl = await rateLimit({ keyPrefix: "api:usda-search", userId, limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: false, error: "missing_q" }, { status: 400 });

  // Pagination — defaults preserve historical single-page behaviour for
  // callers that omit `page`. TestFlight F-10 (`AHnI_fIc7SKbaRcdd5SZB9Q`,
  // 2026-04-19) asked for infinite scroll in food search; USDA is the
  // primary paginator here.
  const rawPage = Number(searchParams.get("page") ?? "1");
  const pageNumber = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  // ENG-1038 — cache + account-level quota guard share the same vendor
  // chokepoint across web + mobile. `locale` partitions the cache by region.
  const locale = searchParams.get("locale");

  // 1) Cache hit — serve without touching USDA (no quota spend).
  const cached = await getCachedSearch<unknown>("usda", q, { locale, page: pageNumber });
  if (cached) {
    return NextResponse.json({ ok: true, hits: cached, page: pageNumber, cached: true });
  }

  // 2) Account-wide quota exhausted — skip USDA, return a DEGRADED envelope
  //    so the client falls through to the next source + shows an honest
  //    "saved results" notice instead of a silent empty.
  const quota = await checkQuota("usda");
  if (!quota.allowed) {
    return NextResponse.json({
      ok: true,
      hits: [],
      page: pageNumber,
      degraded: true,
      degradedReason: "quota_exhausted",
    });
  }

  const usdaMissing = misconfiguredUsdaResponse();
  if (usdaMissing) return usdaMissing;

  const cfg = fdcConfigFromEnv();

  // Consume one quota unit for this logical search BEFORE the live call
  // (atomic). The retry below re-issues the same search on a transient 5xx but
  // does NOT spend a second quota unit — a single user search is one quota
  // unit regardless of how many internal HTTP attempts it takes. (Parity with
  // the OFF degraded-on-failure path, which also spends quota exactly once.)
  await consumeQuota("usda");

  try {
    let hits;
    try {
      hits = await fdcFoodsSearch(cfg, q, { pageNumber });
    } catch (e) {
      // ENG-1119 — one bounded retry on a transient 5xx (or thrown
      // network/timeout). A 4xx / 429 is not retried (see isTransientUsdaError).
      if (!isTransientUsdaError(e)) throw e;
      await new Promise((r) => setTimeout(r, USDA_RETRY_BACKOFF_MS));
      hits = await fdcFoodsSearch(cfg, q, { pageNumber });
    }
    // Cache only the genuine, successful response — never an error/degraded.
    await setCachedSearch("usda", q, hits, { locale, page: pageNumber });
    return NextResponse.json({ ok: true, hits, page: pageNumber });
  } catch (e) {
    // ENG-1119 — a hard USDA failure (post-retry, or a non-transient 4xx) no
    // longer 502s and breaks the food-search merge. It degrades HONESTLY with
    // the SAME envelope shape as quota exhaustion / the OFF route (HTTP 200,
    // ok:true, hits:[], degraded:true) so both clients' `responseIsDegraded`
    // notice fires (web FoodSearchPanel; mobile verifyRecipe) and the other
    // three sources keep rendering — instead of the whole pipeline erroring.
    // Static reason only — no raw upstream message leaks to the client.
    // The failure is NOT cached (setCachedSearch only runs on success above),
    // so a later request can still hit a recovered USDA.
    captureRouteError(e, "/api/usda/search");
    return NextResponse.json({
      ok: true,
      hits: [],
      page: pageNumber,
      degraded: true,
      degradedReason: "usda_unavailable",
    });
  }
}

