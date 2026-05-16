import { NextResponse } from "next/server";
import {
  fatSecretConfigFromEnv,
  fatSecretFoodGet,
  type FatSecretServing,
} from "@/lib/fatsecret/client";
import {
  fatSecretServingMicrosAbsolute,
  fatSecretServingMicrosPer100g,
  normalizeServingToMacros,
  pickBestServing,
  servingMassGrams,
} from "@/lib/nutrition/fatsecretNormalize";
import { rateLimit } from "@/lib/server/rateLimit";
import { hasFatSecretConfig, misconfiguredFatSecretResponse } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";

/**
 * GET /api/fatsecret/food?foodId=<id>
 *
 * Returns the full per-100g macro panel + selectable portions for a
 * FatSecret food. Mirrors the shape of `/api/usda/food` so the
 * food-search panel can rehydrate a tapped row uniformly.
 *
 * Response shape (success):
 *   {
 *     ok: true,
 *     macrosPer100g: { calories, protein, carbs, fat, fiberG, sugarG, sodiumMg },
 *     portions: FoodPortion[],          // FatSecret named servings + base 'g'
 *     primaryPortion: PrimaryServing | null,
 *   }
 *
 * Per-serving FatSecret rows surface in `/api/fatsecret/search` with a
 * null `macrosPer100g` (we never invent per-100g values on the
 * server). The UI calls THIS route on tap to land the canonical panel
 * before opening the preview.
 *
 * Why not `food.v3`? FatSecret's `food.get` already returns every
 * serving FatSecret has on file (metric + named portions); the
 * normalisers here scale to per 100 g without a Premier-only call.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Match /api/usda/food rate limit (60/min/user). Each tap fires one
  // detail request; 60 covers normal scrolling + retries.
  const rl = await rateLimit({
    keyPrefix: "api:fatsecret-food",
    userId,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const foodId = (searchParams.get("foodId") ?? "").trim();
  if (!foodId) {
    return NextResponse.json({ ok: false, error: "missing_food_id" }, { status: 400 });
  }

  if (!hasFatSecretConfig()) {
    const missing = misconfiguredFatSecretResponse();
    if (missing) return missing;
  }

  const cfg = fatSecretConfigFromEnv();

  try {
    const food = await fatSecretFoodGet(cfg, foodId);
    if (!food || !food.servings?.serving) {
      // 2026-05-06 audit (C1): user-facing message stays vendor-
      // neutral. Internal `error` code retains the vendor reference
      // for log-correlation. The mobile client (`getFatSecretFood`)
      // currently swallows this on `!ok` so this string never reaches
      // a user — but defensive against any future caller that
      // surfaces `result.message` directly.
      return NextResponse.json(
        {
          ok: false,
          error: "not_found",
          message: "Couldn't load nutrition for this item.",
        },
        { status: 404 },
      );
    }

    const servingNode = food.servings.serving;
    const list: FatSecretServing[] = Array.isArray(servingNode) ? servingNode : [servingNode];

    // Pick the best metric-grounded serving as the basis for per-100g
    // scaling. Same helper used by verifyIngredients.
    const best = pickBestServing(servingNode);
    const perServing = normalizeServingToMacros(best);
    const grams = servingMassGrams(best) ?? 0;

    // 2026-05-06: previously returned 422 here when FatSecret didn't
    // publish a metric-grounded serving (e.g. McDonald's Big Mac:
    // food.get returns "1 serving" with no `metric_serving_amount`).
    // The 422 made every per-serving-only FatSecret entry silently
    // un-tappable from the search panel. Now we surface a
    // per-serving-only response shape so the client can render a
    // "1 serving = 580 kcal" preview without trying to scale by grams.
    const isPerServingOnly = grams <= 0;

    const macrosPer100g = isPerServingOnly
      ? null
      : {
          calories: Math.max(0, Math.round(perServing.calories * (100 / grams))),
          protein: Math.max(0, Math.round(perServing.protein * (100 / grams) * 10) / 10),
          carbs: Math.max(0, Math.round(perServing.carbs * (100 / grams) * 10) / 10),
          fat: Math.max(0, Math.round(perServing.fat * (100 / grams) * 10) / 10),
          fiberG: Math.max(0, Math.round(perServing.fiberG * (100 / grams) * 10) / 10),
          sugarG: Math.max(0, Math.round(perServing.sugarG * (100 / grams) * 10) / 10),
          sodiumMg: Math.max(0, Math.round(perServing.sodiumMg * (100 / grams))),
        };

    // 2026-05-06: also pull the wider Premier panel (sat/poly/mono fat,
    // cholesterol, calcium, iron, potassium) so the meal-detail
    // "Vitamins, minerals & more" surface populates for FatSecret-
    // sourced logs. Empty object on Basic-tier responses, OR when
    // there's no metric grounding to scale by (per-serving-only path).
    const microsPer100g = isPerServingOnly
      ? {}
      : fatSecretServingMicrosPer100g(best, grams);

    // Build a portion list from FatSecret's serving rows. Each named
    // serving becomes a portion option (e.g. "1 sandwich (240 g)") so
    // the user can pick "1 sandwich" without manually entering grams.
    // For per-serving-only foods, also include an entry with
    // gramWeight: 0 (sentinel meaning "no metric — log as-is").
    //
    // 2026-05-15: `servingFraction` is added per-portion so the client
    // can scale `macrosPerServing` correctly. Default 1 (this portion =
    // one whole FatSecret serving). When a compound primary serving
    // like "8 pieces" is detected, we ALSO emit a derived "1 piece"
    // portion with servingFraction = 1/N so a user logging individual
    // pieces doesn't have to do 0.625-pack arithmetic.
    type PortionOption = {
      label: string;
      gramWeight: number;
      amount: number;
      servingFraction?: number;
    };
    const portions: PortionOption[] = [];
    const seen = new Set<string>();
    for (const s of list) {
      const g = servingMassGrams(s);
      const label = (s.serving_description ?? "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      portions.push({ label, gramWeight: g ?? 0, amount: 1, servingFraction: 1 });
    }
    // Make sure there's always at least one entry for per-serving-only
    // foods so the preview portion picker has something to render.
    if (portions.length === 0 && isPerServingOnly) {
      const label = (best.serving_description ?? "").trim() || "1 serving";
      portions.push({ label, gramWeight: 0, amount: 1, servingFraction: 1 });
    }

    // 2026-05-15: derive a "1 <unit-singular>" portion when the primary
    // serving is a compound count like "8 pieces", "12 chips", "10
    // crackers". FatSecret often ships these as a single per-pack
    // serving, leaving users stuck logging in multiples of the pack
    // count (or falling back to grams that don't exist for per-piece-
    // only foods). The derived portion's servingFraction = 1/N so
    // `macrosPerServing × quantity × servingFraction` produces the
    // correct per-piece macros.
    const primaryServingDesc = (best.serving_description ?? "").trim();
    const countedMatch = primaryServingDesc.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (countedMatch) {
      const n = parseFloat(countedMatch[1]);
      const rest = countedMatch[2].trim();
      // Only derive when N > 1 and the unit is a countable noun (not
      // "100 g" / "2 oz" / "1.5 cups" — those have meaningful gram
      // weights and the user can already enter fractional amounts).
      const COUNTABLE = /^(pieces?|pcs?|slices?|crackers?|chips?|cookies?|wings?|nuggets?|rolls?|servings?|sandwiches?|burgers?|pizzas?|wraps?|tacos?|bars?|sticks?|bites?|patties?|cubes?|squares?|balls?|chunks?|strips?)$/i;
      if (n > 1 && COUNTABLE.test(rest)) {
        // Singularise: strip trailing "s" (or "es" for sandwich/burrito/wedge edge cases)
        const singular = rest.endsWith("ies")
          ? rest.slice(0, -3) + "y"
          : rest.endsWith("ches") || rest.endsWith("shes")
            ? rest.slice(0, -2)
            : rest.endsWith("s") && !rest.endsWith("ss")
              ? rest.slice(0, -1)
              : rest;
        const derivedLabel = `1 ${singular}`;
        // Insert at front so it's the FIRST option after the user opens
        // the preview — singular is the more intuitive default for
        // ad-hoc logging. Keep the original N-count option in the list.
        if (!portions.some((p) => p.label.toLowerCase() === derivedLabel.toLowerCase())) {
          portions.unshift({
            label: derivedLabel,
            gramWeight: 0, // unknown per-piece weight (same as parent)
            amount: 1,
            servingFraction: 1 / n,
          });
        }
      }
    }

    // Primary portion: surface the best metric-grounded serving so the
    // preview defaults to "1 sandwich" rather than "100 g" when the user
    // taps a per-serving FatSecret row. For per-serving-only foods the
    // grams field is set to 0 (sentinel) and the client is expected to
    // skip gram-based scaling and use `macrosPerServing` directly.
    const primaryLabel = (best.serving_description ?? "").trim();
    const primaryPortion = primaryLabel
      ? {
          label: primaryLabel,
          grams,
          kcal: perServing.calories,
          protein: Math.round(perServing.protein * 10) / 10,
          carbs: Math.round(perServing.carbs * 10) / 10,
          fat: Math.round(perServing.fat * 10) / 10,
        }
      : null;

    // Per-serving payload — always populated when `perServing` is
    // computable from the primary serving's absolute values, not just
    // when the food is per-serving-only.
    //
    // 2026-05-14 fix (ENG bug — Marketside Spicy Tuna Roll surfaced
    // 0 kcal in preview): mixed-grounding foods (primary serving like
    // "8 pieces" with NO metric, plus other servings WITH metric) hit
    // the gap. `isPerServingOnly = false` (a metric serving exists),
    // so `macrosPer100g` was populated and `macrosPerServing` was
    // null. The client picked the "8 pieces" portion with gramWeight 0
    // (sentinel from line 149 above) and the previewMacros branch
    // computed `0 × per-100g = 0` macros across the board, even though
    // the "If you log this" footer correctly carried the macros from
    // the metric serving. Populating `macrosPerServing` for every
    // FatSecret food lets the client switch to per-serving math
    // whenever the chosen portion has gramWeight 0, regardless of
    // whether other portions have metric.
    const macrosPerServing =
      Number.isFinite(perServing.calories)
        ? {
            calories: Math.max(0, Math.round(perServing.calories)),
            protein: Math.max(0, Math.round(perServing.protein * 10) / 10),
            carbs: Math.max(0, Math.round(perServing.carbs * 10) / 10),
            fat: Math.max(0, Math.round(perServing.fat * 10) / 10),
          }
        : null;

    // 2026-05-06 (extended 2026-05-14): per-serving micros (absolute,
    // not per-100g). Same widening as `macrosPerServing` above — fire
    // whenever we have the data, not just on the per-serving-only path,
    // so the client can render fibre/sugar/sodium correctly when the
    // user picks a gramWeight-0 portion.
    const microsPerServing = fatSecretServingMicrosAbsolute(best);

    return NextResponse.json({
      ok: true,
      macrosPer100g,
      ...(macrosPerServing ? { macrosPerServing } : {}),
      ...(Object.keys(microsPer100g).length > 0 ? { microsPer100g } : {}),
      ...(Object.keys(microsPerServing).length > 0 ? { microsPerServing } : {}),
      portions,
      primaryPortion,
    });
  } catch (e) {
    console.error(
      "[/api/fatsecret/food] failed:",
      e instanceof Error ? e.message : e,
    );
    captureRouteError(e, "/api/fatsecret/food");
    // 2026-05-06 audit (C1): user-facing message stays vendor-
    // neutral; the upstream error.message is logged server-side
    // only. Internal `error` code retains the vendor reference for
    // log-correlation.
    return NextResponse.json(
      {
        ok: false,
        error: "fatsecret_failed",
        message: "Couldn't load nutrition for this item.",
      },
      { status: 502 },
    );
  }
}
