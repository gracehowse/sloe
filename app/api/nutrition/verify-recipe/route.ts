import { NextResponse } from "next/server";
import { fatSecretConfigFromEnv, fatSecretFoodGet, fatSecretFoodSearch } from "@/lib/fatsecret/client";
import { parseIngredientLine } from "@/lib/recipe-ingredients/parseIngredientLine";
import { measureToGrams } from "@/lib/nutrition/measureToGrams";
import { normalizeServingToMacros, pickBestServing, servingMassGrams, type VerifiedMacros } from "@/lib/nutrition/fatsecretNormalize";
import { fdcConfigFromEnv, fdcFoodGet, fdcFoodsSearch } from "@/lib/usda/fdcClient";
import { fdcFoodMacrosPer100g } from "@/lib/nutrition/usdaNormalize";
import { fetchProductByBarcode } from "@/lib/openFoodFacts/fetchProductByBarcode";
import { rateLimit } from "@/lib/server/rateLimit";
import {
  hasFatSecretConfig,
  hasUsdaConfig,
  misconfiguredFatSecretResponse,
  misconfiguredUsdaResponse,
} from "@/lib/server/serverEnv";

type VerifyRequest = {
  ingredients: { name: string; amount: string; unit: string }[];
  servings: number;
  provider?: "auto" | "fatsecret" | "usda";
  // Optional per-line USDA override (manual “swap”).
  overrides?: { index: number; fdcId?: number; barcode?: string; description?: string }[];
};

type VerifiedIngredient = {
  input: { name: string; amount: string; unit: string };
  resolved: { name: string; amount: string; unit: string };
  fatSecretFoodId: string | null;
  matchedName: string | null;
  confidence: number;
  source: "USDA" | "OFF" | "FatSecret" | "Unverified";
  macros: VerifiedMacros | null;
};

function resolveLine(i: { name: string; amount: string; unit: string }) {
  const trimmed = { name: i.name.trim(), amount: i.amount.trim(), unit: i.unit.trim() };
  if (!trimmed.amount) {
    const p = parseIngredientLine(trimmed.name);
    if (p.amount && p.name.trim()) {
      return { name: p.name.trim(), amount: p.amount, unit: p.unit || trimmed.unit };
    }
  }
  return trimmed;
}

function confidenceForMatch(query: string, candidateName: string): number {
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const c = candidateName.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) return 0.85;
  const qTokens = new Set(q.split(" ").filter(Boolean));
  const cTokens = new Set(c.split(" ").filter(Boolean));
  let inter = 0;
  for (const t of qTokens) if (cTokens.has(t)) inter += 1;
  const denom = Math.max(1, qTokens.size);
  return Math.min(0.8, inter / denom);
}

function normalizeQueryForUsda(name: string): string {
  // Reduce “2 medium carrots, diced” → “carrots”
  let t = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/[,，].*$/g, " ")
    .replace(/\b(finely|roughly)\b/gi, " ")
    .replace(/\b(chopped|diced|minced|sliced|grated|peeled|crushed|trimmed|rinsed|drained)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > 120) t = t.slice(0, 120).trim();
  return t;
}

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

  const wantUsda = provider === "usda" || provider === "auto";
  const wantFatSecret = provider === "fatsecret" || provider === "auto";

  let usdaCfg: ReturnType<typeof fdcConfigFromEnv> | null = null;
  let fatsecretCfg: ReturnType<typeof fatSecretConfigFromEnv> | null = null;

  if (wantUsda) {
    if (!hasUsdaConfig()) {
      if (provider === "usda") {
        const r = misconfiguredUsdaResponse();
        if (r) return r;
      }
      usdaCfg = null;
    } else {
      usdaCfg = fdcConfigFromEnv();
    }
  }

  if (wantFatSecret) {
    if (!hasFatSecretConfig()) {
      if (provider === "fatsecret") {
        const r = misconfiguredFatSecretResponse();
        if (r) return r;
      }
      fatsecretCfg = null;
    } else {
      fatsecretCfg = fatSecretConfigFromEnv();
    }
  }

  const verified: VerifiedIngredient[] = [];

  try {
    for (let idx = 0; idx < ingredients.length; idx++) {
      const raw = ingredients[idx]!;
      const resolved = resolveLine(raw);
      const query = resolved.name;
      if (!query) {
        verified.push({
          input: raw,
          resolved,
          fatSecretFoodId: null,
          matchedName: null,
          confidence: 0,
          source: "Unverified",
          macros: null,
        });
        continue;
      }

      const amt = Number.parseFloat(resolved.amount) || 1;
      const grams = measureToGrams({ name: resolved.name, amount: amt, unit: resolved.unit || "", gPerMl: 1 });

      // Barcode override (Open Food Facts) wins for packaged foods.
      const override = overrides.find((o) => o && o.index === idx);
      if (override?.barcode) {
        const off = await fetchProductByBarcode(override.barcode);
        if (off.ok) {
          // Prefer serving size grams when user entered "count" (1 bar, 1 packet).
          let gramsToUse = grams;
          if ((resolved.unit === "" || resolved.unit === "count") && off.product.servingSizeG) {
            gramsToUse = off.product.servingSizeG * (Number.parseFloat(resolved.amount) || 1);
          }
          const factor = gramsToUse / 100;
          const scaled: VerifiedMacros = {
            calories: Math.max(0, Math.round(off.product.calories * factor)),
            protein: Math.max(0, Math.round(off.product.protein * factor * 10) / 10),
            carbs: Math.max(0, Math.round(off.product.carbs * factor * 10) / 10),
            fat: Math.max(0, Math.round(off.product.fat * factor * 10) / 10),
            fiberG: Math.max(0, Math.round(off.product.fiberG * factor * 10) / 10),
            sugarG: 0,
            sodiumMg: 0,
          };
          verified.push({
            input: raw,
            resolved,
            fatSecretFoodId: override.barcode,
            matchedName: override.description ?? off.product.name,
            confidence: 1,
            source: "OFF",
            macros: scaled,
          });
          continue;
        }
      }

      if (wantUsda && usdaCfg) {
        const usdaOverride = overrides.find((o) => o && o.index === idx && typeof o.fdcId === "number" && !o.barcode);
        if (usdaOverride) {
          const food = await fdcFoodGet(usdaCfg, usdaOverride.fdcId as number);
          if (food?.foodNutrients?.length) {
            const per100g = fdcFoodMacrosPer100g(food);
            const factor = grams / 100;
            const scaled: VerifiedMacros = {
              calories: Math.max(0, Math.round(per100g.calories * factor)),
              protein: Math.max(0, Math.round(per100g.protein * factor * 10) / 10),
              carbs: Math.max(0, Math.round(per100g.carbs * factor * 10) / 10),
              fat: Math.max(0, Math.round(per100g.fat * factor * 10) / 10),
              fiberG: Math.max(0, Math.round(per100g.fiberG * factor * 10) / 10),
              sugarG: Math.max(0, Math.round(per100g.sugarG * factor * 10) / 10),
              sodiumMg: Math.max(0, Math.round(per100g.sodiumMg * factor)),
            };
            verified.push({
              input: raw,
              resolved,
              fatSecretFoodId: String(usdaOverride.fdcId),
              matchedName: usdaOverride.description ?? food.description,
              confidence: 1,
              source: "USDA",
              macros: scaled,
            });
            continue;
          }
        }

        const hits = await fdcFoodsSearch(usdaCfg, normalizeQueryForUsda(query));
        const ranked = [
          ...hits.filter((h) => (h.dataType ?? "").toLowerCase().includes("foundation")),
          ...hits.filter((h) => !(h.dataType ?? "").toLowerCase().includes("foundation")),
        ].slice(0, 5);

        for (const hit of ranked) {
          try {
            const food = await fdcFoodGet(usdaCfg, hit.fdcId);
            if (!food?.foodNutrients?.length) continue;
            const per100g = fdcFoodMacrosPer100g(food);
            const factor = grams / 100;
            const scaled: VerifiedMacros = {
              calories: Math.max(0, Math.round(per100g.calories * factor)),
              protein: Math.max(0, Math.round(per100g.protein * factor * 10) / 10),
              carbs: Math.max(0, Math.round(per100g.carbs * factor * 10) / 10),
              fat: Math.max(0, Math.round(per100g.fat * factor * 10) / 10),
              fiberG: Math.max(0, Math.round(per100g.fiberG * factor * 10) / 10),
              sugarG: Math.max(0, Math.round(per100g.sugarG * factor * 10) / 10),
              sodiumMg: Math.max(0, Math.round(per100g.sodiumMg * factor)),
            };
            verified.push({
              input: raw,
              resolved,
              fatSecretFoodId: String(hit.fdcId),
              matchedName: hit.description,
              confidence: 0.9,
              source: "USDA",
              macros: scaled,
            });
            // USDA is our highest-accuracy source for ingredients; stop here.
            break;
          } catch (e) {
            // USDA sometimes returns 404 for individual fdcIds; try the next hit.
            const msg = e instanceof Error ? e.message : "";
            if (msg.includes("HTTP 404")) continue;
            throw e;
          }
        }
        if (verified.length && verified[verified.length - 1]?.input === raw && verified[verified.length - 1]?.macros) {
          continue;
        }
      }

      if (wantFatSecret && fatsecretCfg) {
        const results = await fatSecretFoodSearch(fatsecretCfg, query);
        const best = results[0] ?? null;
        const conf = best ? confidenceForMatch(query, best.food_name) : 0;
        if (!best) {
          verified.push({
            input: raw,
            resolved,
            fatSecretFoodId: null,
            matchedName: null,
            confidence: 0,
            source: "Unverified",
            macros: null,
          });
          continue;
        }

        const food = await fatSecretFoodGet(fatsecretCfg, best.food_id);
        const servingNode = food?.servings?.serving;
        if (!food || !servingNode) {
          verified.push({
            input: raw,
            resolved,
            fatSecretFoodId: best.food_id,
            matchedName: best.food_name,
            confidence: conf,
            source: "Unverified",
            macros: null,
          });
          continue;
        }

        const serving = pickBestServing(servingNode);
        const perServing = normalizeServingToMacros(serving);
        const servingG = servingMassGrams(serving) ?? 100;
        const perGram = {
          calories: perServing.calories / servingG,
          protein: perServing.protein / servingG,
          carbs: perServing.carbs / servingG,
          fat: perServing.fat / servingG,
          fiberG: perServing.fiberG / servingG,
          sugarG: perServing.sugarG / servingG,
          sodiumMg: perServing.sodiumMg / servingG,
        };
        const scaled: VerifiedMacros = {
          calories: Math.max(0, Math.round(perGram.calories * grams)),
          protein: Math.max(0, Math.round(perGram.protein * grams * 10) / 10),
          carbs: Math.max(0, Math.round(perGram.carbs * grams * 10) / 10),
          fat: Math.max(0, Math.round(perGram.fat * grams * 10) / 10),
          fiberG: Math.max(0, Math.round(perGram.fiberG * grams * 10) / 10),
          sugarG: Math.max(0, Math.round(perGram.sugarG * grams * 10) / 10),
          sodiumMg: Math.max(0, Math.round(perGram.sodiumMg * grams)),
        };
        verified.push({
          input: raw,
          resolved,
          fatSecretFoodId: best.food_id,
          matchedName: best.food_name,
          confidence: conf,
          source: "FatSecret",
          macros: scaled,
        });
        continue;
      }

      verified.push({
        input: raw,
        resolved,
        fatSecretFoodId: null,
        matchedName: null,
        confidence: 0,
        source: "Unverified",
        macros: null,
      });
    }
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

  const totals = verified.reduce(
    (acc, v) => {
      if (!v.macros) return acc;
      acc.calories += v.macros.calories;
      acc.protein += v.macros.protein;
      acc.carbs += v.macros.carbs;
      acc.fat += v.macros.fat;
      acc.fiberG += v.macros.fiberG;
      acc.sugarG += v.macros.sugarG;
      acc.sodiumMg += v.macros.sodiumMg;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
  );

  const sourceCounts = verified.reduce(
    (acc, v) => {
      acc[v.source] = (acc[v.source] ?? 0) + 1;
      return acc;
    },
    {} as Record<VerifiedIngredient["source"], number>,
  );
  const primarySource =
    sourceCounts.USDA >= (sourceCounts.FatSecret ?? 0) && sourceCounts.USDA > 0
      ? "USDA"
      : sourceCounts.FatSecret > 0
        ? "FatSecret"
        : "Unverified";

  const perServing = {
    calories: Math.max(0, Math.round(totals.calories / servings)),
    protein: Math.max(0, Math.round((totals.protein / servings) * 10) / 10),
    carbs: Math.max(0, Math.round((totals.carbs / servings) * 10) / 10),
    fat: Math.max(0, Math.round((totals.fat / servings) * 10) / 10),
    fiberG: Math.max(0, Math.round((totals.fiberG / servings) * 10) / 10),
    sugarG: Math.max(0, Math.round((totals.sugarG / servings) * 10) / 10),
    sodiumMg: Math.max(0, Math.round(totals.sodiumMg / servings)),
  };

  return NextResponse.json({ ok: true, verified, totals, perServing, primarySource, sourceCounts });
}

