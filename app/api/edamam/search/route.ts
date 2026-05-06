import { NextResponse } from "next/server";
import {
  edamamConfigFromEnv,
  edamamFoodMacrosPer100g,
  edamamFoodSearch,
} from "@/lib/edamam/client";
import { rateLimit } from "@/lib/server/rateLimit";
import { hasEdamamConfig } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";

/**
 * GET /api/edamam/search?q=<query>&mode=<foods|meals>
 *
 * Wraps Edamam's food-database v2 parser to expose search hits to our
 * authenticated clients. TestFlight build 7 `AOI9xgY88Dx-uphiXI8IzEk`
 * (2026-04-18): tester expected restaurant meals to show up alongside
 * USDA foods when they searched "eggs benedict" — Edamam is our
 * restaurant + branded source.
 *
 * Modes:
 *   - `foods` (default) — general food search; mixes generic + branded + meal results.
 *   - `meals` — restaurant + prepared-meal focus; filters to `Generic meals` /
 *     `Packaged` categories client-side for the Discovery "Eating out" row.
 *
 * Envelope matches `/api/usda/search` so `searchFoods()` can merge hits uniformly.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // P0-6 (2026-04-25): per-user scoping.
  const rl = await rateLimit({ keyPrefix: "api:edamam-search", userId, limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: false, error: "missing_q" }, { status: 400 });
  const mode = searchParams.get("mode") === "meals" ? "meals" : "foods";

  // Pagination — Edamam's `parser` endpoint returns one flat list of
  // `hints`. We short-circuit pages beyond 1 with an empty hits array
  // so USDA carries the load past the first page. TestFlight F-10
  // (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). Defaults preserve
  // historical behaviour.
  const rawPage = Number(searchParams.get("page") ?? "1");
  const pageNumber = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  if (!hasEdamamConfig()) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_misconfigured",
        message: "EDAMAM_APP_ID and EDAMAM_APP_KEY must be set server-side.",
      },
      { status: 503 },
    );
  }

  const cfg = edamamConfigFromEnv();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 503 },
    );
  }

  try {
    if (pageNumber > 1) {
      return NextResponse.json({ ok: true, mode, page: pageNumber, hits: [] });
    }
    const raw = await edamamFoodSearch(cfg, q, { pageSize: mode === "meals" ? 20 : 12 });
    const filtered = mode === "meals"
      ? raw.filter((h) => {
          const cat = h.food.category?.toLowerCase() ?? "";
          return cat.includes("meal") || cat.includes("packaged") || Boolean(h.food.brand);
        })
      : raw;
    const hits = filtered.map((h) => {
      const m = edamamFoodMacrosPer100g(h.food);
      return {
        foodId: h.food.foodId,
        label: h.food.label,
        category: h.food.category,
        categoryLabel: h.food.categoryLabel,
        brand: h.food.brand ?? null,
        imageUrl: h.food.image ?? null,
        /** per 100 g — matches the USDA envelope shape. */
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        fiberG: m.fiberG,
        sugarG: m.sugarG,
        sodiumMg: m.sodiumMg,
        servingSizes: h.food.servingSizes ?? [],
      };
    });
    return NextResponse.json({ ok: true, mode, page: pageNumber, hits });
  } catch (e) {
    // 2026-05-06 (Grace) — log + return ok:true with `_diag` echo so
    // the merge contract is preserved (other 3 sources keep
    // rendering) AND the mobile / web client diagnostic surfaces the
    // upstream cause without having to chase Vercel runtime logs.
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/edamam/search] failed:", msg);
    return NextResponse.json({
      ok: true,
      mode,
      page: pageNumber,
      hits: [],
      _diag: { upstream: "failed", message: msg.slice(0, 200) },
    });
  }
}
