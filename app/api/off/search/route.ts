import { NextResponse } from "next/server";
import { searchOffProducts } from "@/lib/openFoodFacts/searchProducts";
import { rateLimit } from "@/lib/server/rateLimit";
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

  const rl = await rateLimit({ keyPrefix: "api:off-search", userId, limit: 60, windowMs: 60_000 });
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
  const locale = searchParams.get("locale");

  const cached = await getCachedSearch<unknown>("off", q, { locale, page: pageNumber });
  if (cached) {
    return NextResponse.json({ ok: true, hits: cached, page: pageNumber, cached: true });
  }

  const quota = await checkQuota("off");
  if (!quota.allowed) {
    return NextResponse.json({
      ok: true,
      hits: [],
      page: pageNumber,
      degraded: true,
      degradedReason: "quota_exhausted",
    });
  }

  try {
    await consumeQuota("off");
    const hits = await searchOffProducts(q, { page: pageNumber, pageSize: 10 });
    await setCachedSearch("off", q, hits, { locale, page: pageNumber });
    return NextResponse.json({ ok: true, hits, page: pageNumber });
  } catch (e) {
    captureRouteError(e, "/api/off/search");
    return NextResponse.json(
      { ok: false, error: "off_failed", message: e instanceof Error ? e.message : "OFF request failed" },
      { status: 502 },
    );
  }
}
