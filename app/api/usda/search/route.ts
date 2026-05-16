import { NextResponse } from "next/server";
import { fdcConfigFromEnv, fdcFoodsSearch } from "@/lib/usda/fdcClient";
import { rateLimit } from "@/lib/server/rateLimit";
import { misconfiguredUsdaResponse } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";

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

  const usdaMissing = misconfiguredUsdaResponse();
  if (usdaMissing) return usdaMissing;

  const cfg = fdcConfigFromEnv();

  try {
    const hits = await fdcFoodsSearch(cfg, q, { pageNumber });
    return NextResponse.json({ ok: true, hits, page: pageNumber });
  } catch (e) {
    captureRouteError(e, "/api/usda/search");
    return NextResponse.json(
      { ok: false, error: "usda_failed", message: e instanceof Error ? e.message : "USDA request failed" },
      { status: 502 },
    );
  }
}

