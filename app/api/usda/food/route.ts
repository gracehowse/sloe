import { NextResponse } from "next/server";
import { fdcConfigFromEnv, fdcFoodGet } from "@/lib/usda/fdcClient";
import { fdcFoodMacrosPer100g, fdcFoodMicrosPer100g } from "@/lib/nutrition/usdaNormalize";
import { rateLimit } from "@/lib/server/rateLimit";
import { misconfiguredUsdaResponse } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { pickUsdaFoodPortionsPrimaryServing } from "@/lib/nutrition/primaryServing";
import { captureRouteError } from "@/lib/observability/captureRouteError";

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // P0-6 (2026-04-25): per-user scoping closes the shared-NAT starvation
  // case and IP-rotation bypass for this authenticated route.
  const rl = await rateLimit({ keyPrefix: "api:usda-food", userId, limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("fdcId") ?? "").trim();
  const fdcId = Number.parseInt(raw, 10);
  if (!Number.isFinite(fdcId) || fdcId <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_fdcId" }, { status: 400 });
  }

  const usdaMissing = misconfiguredUsdaResponse();
  if (usdaMissing) return usdaMissing;

  try {
    const cfg = fdcConfigFromEnv();
    const food = await fdcFoodGet(cfg, fdcId);
    if (!food) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Food not found." }, { status: 404 });
    }
    const macrosPer100g = fdcFoodMacrosPer100g(food);
    // 2026-05-06: extract the wider micro panel so the meal-detail
    // "Vitamins, minerals & more" surface populates for USDA-sourced
    // logs. Empty object → caller treats as "USDA didn't publish".
    const microsPer100g = fdcFoodMicrosPer100g(food);

    // F-88 (2026-04-25) — strip out USDA "standard serving" rows
    // (NLEA / household reference / undetermined) that look like
    // jargon to a user, and clean up the label assembly so an
    // "undetermined" measureUnit doesn't leak into the chip text.
    // Result: a tester searching "banana" gets "1 medium" (118g) /
    // "1 large" (136g) / "1 small" (101g) chips, not "1 undetermined
    // NLEA serving".
    const cleanUnit = (u: string | null | undefined): string => {
      const s = (u ?? "").trim().toLowerCase();
      if (!s || s === "undetermined" || s === "n/a" || s === "not specified") return "";
      return s;
    };
    const NLEA_OR_BLOCK = (mod: string, desc: string): boolean => {
      const m = (mod ?? "").trim().toLowerCase();
      const d = (desc ?? "").trim().toLowerCase();
      const blocked = new Set(["quantity not specified", "undetermined", "1 g", "1g", "100 g", "100g", "not specified", "nlea serving", "household reference"]);
      return blocked.has(m) || blocked.has(d);
    };

    const portions = (food.foodPortions ?? [])
      .filter((p) => p.gramWeight && p.gramWeight > 0)
      .filter((p) => !NLEA_OR_BLOCK(p.modifier ?? "", p.portionDescription ?? ""))
      .map((p) => {
        const unit = cleanUnit(p.measureUnit?.name ?? p.measureUnit?.abbreviation ?? "");
        const modifier = (p.modifier ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
        const desc = (p.portionDescription ?? "").trim();
        const label = desc
          || [p.amount ?? 1, unit, modifier].filter(Boolean).join(" ").trim()
          || `${p.gramWeight}g`;
        return {
          label: label.toLowerCase(),
          gramWeight: p.gramWeight!,
          amount: p.amount ?? 1,
        };
      });

    // F-88 — pick the best primary portion using the shared scoring
    // helper (medium/large/whole > generic > NLEA). The client uses
    // this as the default chip when the search-stage primaryServing
    // wasn't set (USDA's search endpoint doesn't ship foodPortions
    // on non-branded hits, so the search hit had no primary serving
    // until the food detail loaded).
    const primaryPortion = pickUsdaFoodPortionsPrimaryServing(macrosPer100g, food.foodPortions ?? null);

    return NextResponse.json({
      ok: true,
      fdcId,
      description: food.description,
      macrosPer100g,
      ...(Object.keys(microsPer100g).length > 0 ? { microsPer100g } : {}),
      portions,
      ...(primaryPortion ? { primaryPortion } : {}),
    });
  } catch (e) {
    captureRouteError(e, "/api/usda/food");
    return NextResponse.json(
      { ok: false, error: "usda_failed", message: e instanceof Error ? e.message : "USDA request failed" },
      { status: 502 },
    );
  }
}

