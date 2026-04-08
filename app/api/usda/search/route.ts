import { NextResponse } from "next/server";
import { fdcConfigFromEnv, fdcFoodsSearch } from "@/lib/usda/fdcClient";
import { rateLimit } from "@/lib/server/rateLimit";
import { misconfiguredUsdaResponse } from "@/lib/server/serverEnv";

export async function GET(req: Request) {
  const rl = await rateLimit({ keyPrefix: "api:usda-search", limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: false, error: "missing_q" }, { status: 400 });

  const usdaMissing = misconfiguredUsdaResponse();
  if (usdaMissing) return usdaMissing;

  const cfg = fdcConfigFromEnv();

  try {
    const hits = await fdcFoodsSearch(cfg, q);
    return NextResponse.json({ ok: true, hits });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "usda_failed", message: e instanceof Error ? e.message : "USDA request failed" },
      { status: 502 },
    );
  }
}

