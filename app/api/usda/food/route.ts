import { NextResponse } from "next/server";
import { fdcConfigFromEnv, fdcFoodGet } from "@/lib/usda/fdcClient";
import { fdcFoodMacrosPer100g } from "@/lib/nutrition/usdaNormalize";
import { rateLimit } from "@/lib/server/rateLimit";
import { misconfiguredUsdaResponse } from "@/lib/server/serverEnv";

export async function GET(req: Request) {
  const rl = await rateLimit({ keyPrefix: "api:usda-food", limit: 60, windowMs: 60_000 });
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

    // Extract portion measures (e.g. "1 medium", "1 cup, sliced") with gram weights
    const portions = (food.foodPortions ?? [])
      .filter((p) => p.gramWeight && p.gramWeight > 0)
      .map((p) => {
        const unit = p.measureUnit?.name ?? p.measureUnit?.abbreviation ?? "";
        const modifier = p.modifier ?? "";
        const desc = p.portionDescription
          ?? [p.amount ?? 1, unit, modifier].filter(Boolean).join(" ").trim();
        return {
          label: desc || `${p.gramWeight}g`,
          gramWeight: p.gramWeight!,
          amount: p.amount ?? 1,
        };
      });

    return NextResponse.json({
      ok: true,
      fdcId,
      description: food.description,
      macrosPer100g,
      portions,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "usda_failed", message: e instanceof Error ? e.message : "USDA request failed" },
      { status: 502 },
    );
  }
}

