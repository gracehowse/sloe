import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { verifyIngredients, type IngredientOverride } from "@/lib/nutrition/verifyIngredients";

type VerifyRequest = {
  ingredients: { name: string; amount: string; unit: string }[];
  servings: number;
  provider?: "auto" | "fatsecret" | "usda";
  overrides?: IngredientOverride[];
};

export async function POST(req: Request) {
  const rl = await rateLimit({ keyPrefix: "api:verify-recipe", limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many verification requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<VerifyRequest>;
  const ingredients = Array.isArray(b.ingredients) ? b.ingredients : [];
  const servings = Number.isFinite(b.servings) ? Math.max(1, Math.round(b.servings as number)) : 1;
  const provider = b.provider ?? "auto";
  const overrides = Array.isArray(b.overrides) ? b.overrides : [];

  if (ingredients.length === 0) {
    return NextResponse.json({ ok: false, error: "no_ingredients" }, { status: 400 });
  }

  try {
    const result = await verifyIngredients({ ingredients, servings, provider, overrides });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "verify_failed",
        provider,
        message: e instanceof Error ? e.message : "Verification request failed",
      },
      { status: 502 },
    );
  }
}
