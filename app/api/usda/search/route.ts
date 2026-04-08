import { NextResponse } from "next/server";
import { fdcConfigFromEnv, fdcFoodsSearch } from "@/lib/usda/fdcClient";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: false, error: "missing_q" }, { status: 400 });

  let cfg;
  try {
    cfg = fdcConfigFromEnv();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "missing_usda_env", message: e instanceof Error ? e.message : "Missing USDA key" },
      { status: 500 },
    );
  }

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

