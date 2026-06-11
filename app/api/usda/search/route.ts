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

  try {
    // Consume one quota unit immediately before the live call (atomic).
    await consumeQuota("usda");
    const hits = await fdcFoodsSearch(cfg, q, { pageNumber });
    // Cache only the genuine, successful response — never an error/degraded.
    await setCachedSearch("usda", q, hits, { locale, page: pageNumber });
    return NextResponse.json({ ok: true, hits, page: pageNumber });
  } catch (e) {
    captureRouteError(e, "/api/usda/search");
    return NextResponse.json(
      { ok: false, error: "usda_failed", message: e instanceof Error ? e.message : "USDA request failed" },
      { status: 502 },
    );
  }
}

