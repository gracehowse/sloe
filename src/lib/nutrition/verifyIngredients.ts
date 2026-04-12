/**
 * Shared ingredient verification pipeline.
 * Tries: USDA → FatSecret → local estimation fallback.
 * Used by both /api/nutrition/verify-recipe and /api/recipe-import.
 */

import { fatSecretConfigFromEnv, fatSecretFoodGet, fatSecretFoodSearch } from "@/lib/fatsecret/client";
import { parseIngredientLine } from "@/lib/recipe-ingredients/parseIngredientLine";
import { measureToGrams } from "@/lib/nutrition/measureToGrams";
import {
  normalizeServingToMacros,
  pickBestServing,
  servingMassGrams,
  type VerifiedMacros,
} from "@/lib/nutrition/fatsecretNormalize";
import { fdcConfigFromEnv, fdcFoodGet, fdcFoodsSearch } from "@/lib/usda/fdcClient";
import { fdcFoodMacrosPer100g } from "@/lib/nutrition/usdaNormalize";
import { fetchProductByBarcode } from "@/lib/openFoodFacts/fetchProductByBarcode";
import { hasFatSecretConfig, hasUsdaConfig } from "@/lib/server/serverEnv";
import { estimateLineMacros } from "@/lib/nutrition/estimateIngredientMacros";

export type VerifiedIngredient = {
  input: { name: string; amount: string; unit: string };
  resolved: { name: string; amount: string; unit: string };
  fatSecretFoodId: string | null;
  matchedName: string | null;
  confidence: number;
  source: "USDA" | "OFF" | "FatSecret" | "Estimated" | "Unverified";
  macros: VerifiedMacros | null;
};

export type VerifyResult = {
  verified: VerifiedIngredient[];
  totals: VerifiedMacros;
  perServing: VerifiedMacros;
  primarySource: string;
  sourceCounts: Record<string, number>;
};

export type IngredientOverride = {
  index: number;
  fdcId?: number;
  barcode?: string;
  description?: string;
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
  let t = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/[,，].*$/g, " ")
    // Strip percentages like "0%", "2%" that confuse USDA search
    .replace(/\b\d+%\s*/g, " ")
    // Strip prep technique words but KEEP nutrition-critical state words
    // (cooked, raw, dried, frozen, canned, roasted, smoked, etc.)
    .replace(/\b(finely|roughly|freshly|thinly)\b/gi, " ")
    .replace(/\b(chopped|diced|minced|sliced|grated|peeled|crushed|trimmed|rinsed|drained|deseeded|deboned|pitted|shredded|shelled|julienned|cubed)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > 120) t = t.slice(0, 120).trim();
  return t;
}

/** Parse raw ingredient strings (e.g. "200g chicken breast") into structured input. */
export function parseRawIngredients(lines: string[]): { name: string; amount: string; unit: string }[] {
  return lines.map((line) => {
    const p = parseIngredientLine(line);
    return { name: p.name || line, amount: p.amount || "1", unit: p.unit || "" };
  });
}

/**
 * Verify a list of ingredients against USDA, FatSecret, and local estimation.
 * Returns per-ingredient macros (including micros: fiber, sugar, sodium) and totals.
 */
export async function verifyIngredients(opts: {
  ingredients: { name: string; amount: string; unit: string }[];
  servings: number;
  provider?: "auto" | "fatsecret" | "usda";
  overrides?: IngredientOverride[];
}): Promise<VerifyResult> {
  const { ingredients, servings, provider = "auto", overrides = [] } = opts;

  const wantUsda = provider === "usda" || provider === "auto";
  const wantFatSecret = provider === "fatsecret" || provider === "auto";

  const usdaCfg = wantUsda && hasUsdaConfig() ? fdcConfigFromEnv() : null;
  const fatsecretCfg = wantFatSecret && hasFatSecretConfig() ? fatSecretConfigFromEnv() : null;

  const verified: VerifiedIngredient[] = [];

  for (let idx = 0; idx < ingredients.length; idx++) {
    const raw = ingredients[idx]!;
    const resolved = resolveLine(raw);
    const query = resolved.name;

    if (!query) {
      verified.push({
        input: raw, resolved,
        fatSecretFoodId: null, matchedName: null,
        confidence: 0, source: "Unverified", macros: null,
      });
      continue;
    }

    const amt = Number.parseFloat(resolved.amount) || 1;
    const grams = measureToGrams({ name: resolved.name, amount: amt, unit: resolved.unit || "", gPerMl: 1 });

    // 1. Barcode override (Open Food Facts)
    const override = overrides.find((o) => o && o.index === idx);
    if (override?.barcode) {
      const off = await fetchProductByBarcode(override.barcode);
      if (off.ok) {
        let gramsToUse = grams;
        if ((resolved.unit === "" || resolved.unit === "count") && off.product.servingSizeG) {
          gramsToUse = off.product.servingSizeG * (Number.parseFloat(resolved.amount) || 1);
        }
        const factor = gramsToUse / 100;
        verified.push({
          input: raw, resolved,
          fatSecretFoodId: override.barcode,
          matchedName: override.description ?? off.product.name,
          confidence: 1, source: "OFF",
          macros: scaleMacros({ ...off.product, sugarG: 0, sodiumMg: 0 }, factor),
        });
        continue;
      }
    }

    // 2. USDA override or search
    if (usdaCfg) {
      let usdaFound = false;
      try {
        const usdaOverride = overrides.find((o) => o && o.index === idx && typeof o.fdcId === "number" && !o.barcode);
        if (usdaOverride) {
          const food = await fdcFoodGet(usdaCfg, usdaOverride.fdcId as number);
          if (food?.foodNutrients?.length) {
            const per100g = fdcFoodMacrosPer100g(food);
            verified.push({
              input: raw, resolved,
              fatSecretFoodId: String(usdaOverride.fdcId),
              matchedName: usdaOverride.description ?? food.description,
              confidence: 1, source: "USDA",
              macros: scaleMacros(per100g, grams / 100),
            });
            usdaFound = true;
          }
        }

        if (!usdaFound) {
          const usdaQuery = normalizeQueryForUsda(query);

          // Search Foundation/SR Legacy first (generic whole foods — like Google uses),
          // then fall back to all data types if no good match found.
          let hits = await fdcFoodsSearch(usdaCfg, usdaQuery, {
            dataType: ["Foundation", "SR Legacy"],
          });

          if (hits.length === 0) {
            hits = await fdcFoodsSearch(usdaCfg, usdaQuery);
          }

          // Rank by: (1) confidence of name overlap, (2) prefer Foundation > SR Legacy > Survey > Branded
          const dataTypeRank = (dt: string): number => {
            const d = (dt ?? "").toLowerCase();
            if (d.includes("foundation")) return 4;
            if (d.includes("sr legacy")) return 3;
            if (d.includes("survey")) return 2;
            return 1; // Branded
          };
          const ranked = hits
            .map((h) => ({
              hit: h,
              conf: confidenceForMatch(usdaQuery, h.description),
              dtRank: dataTypeRank(h.dataType ?? ""),
            }))
            .sort((a, b) => {
              // High confidence first, then prefer generic data types
              const confDiff = b.conf - a.conf;
              if (Math.abs(confDiff) > 0.1) return confDiff;
              return b.dtRank - a.dtRank;
            })
            .slice(0, 5);

          for (const { hit, conf } of ranked) {
            try {
              const food = await fdcFoodGet(usdaCfg, hit.fdcId);
              if (!food?.foodNutrients?.length) continue;
              const per100g = fdcFoodMacrosPer100g(food);
              verified.push({
                input: raw, resolved,
                fatSecretFoodId: String(hit.fdcId),
                matchedName: hit.description,
                confidence: Math.min(0.95, conf + 0.1), source: "USDA",
                macros: scaleMacros(per100g, grams / 100),
              });
              usdaFound = true;
              break;
            } catch {
              continue;
            }
          }
        }
      } catch (e) {
        console.error("[verifyIngredients] USDA lookup failed for", query, ":", e instanceof Error ? e.message : e);
      }
      if (usdaFound) continue;
    }

    // 3. FatSecret search
    if (fatsecretCfg) {
      let fsFound = false;
      try {
        const results = await fatSecretFoodSearch(fatsecretCfg, query);
        const best = results[0] ?? null;
        if (best) {
          const conf = confidenceForMatch(query, best.food_name);
          const food = await fatSecretFoodGet(fatsecretCfg, best.food_id);
          const servingNode = food?.servings?.serving;
          if (food && servingNode) {
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
            verified.push({
              input: raw, resolved,
              fatSecretFoodId: best.food_id,
              matchedName: best.food_name,
              confidence: conf, source: "FatSecret",
              macros: {
                calories: Math.max(0, Math.round(perGram.calories * grams)),
                protein: Math.max(0, Math.round(perGram.protein * grams * 10) / 10),
                carbs: Math.max(0, Math.round(perGram.carbs * grams * 10) / 10),
                fat: Math.max(0, Math.round(perGram.fat * grams * 10) / 10),
                fiberG: Math.max(0, Math.round(perGram.fiberG * grams * 10) / 10),
                sugarG: Math.max(0, Math.round(perGram.sugarG * grams * 10) / 10),
                sodiumMg: Math.max(0, Math.round(perGram.sodiumMg * grams)),
              },
            });
            fsFound = true;
          }
        }
      } catch (e) {
        console.error("[verifyIngredients] FatSecret lookup failed for", query, ":", e instanceof Error ? e.message : e);
      }
      if (fsFound) continue;
    }

    // 4. Local estimation fallback
    const estimated = estimateLineMacros({
      name: resolved.name,
      amount: resolved.amount || "1",
      unit: resolved.unit || "",
    });
    verified.push({
      input: raw, resolved,
      fatSecretFoodId: null,
      matchedName: resolved.name,
      confidence: 0.3,
      source: "Estimated",
      macros: { ...estimated, fiberG: 0, sugarG: 0, sodiumMg: 0 },
    });
  }

  // Totals
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
    {} as Record<string, number>,
  );

  const primarySource =
    (sourceCounts.USDA ?? 0) >= (sourceCounts.FatSecret ?? 0) && (sourceCounts.USDA ?? 0) > 0
      ? "USDA"
      : (sourceCounts.FatSecret ?? 0) > 0
        ? "FatSecret"
        : (sourceCounts.Estimated ?? 0) > 0
          ? "Estimated"
          : "Unverified";

  const perServing: VerifiedMacros = {
    calories: Math.max(0, Math.round(totals.calories / servings)),
    protein: Math.max(0, Math.round((totals.protein / servings) * 10) / 10),
    carbs: Math.max(0, Math.round((totals.carbs / servings) * 10) / 10),
    fat: Math.max(0, Math.round((totals.fat / servings) * 10) / 10),
    fiberG: Math.max(0, Math.round((totals.fiberG / servings) * 10) / 10),
    sugarG: Math.max(0, Math.round((totals.sugarG / servings) * 10) / 10),
    sodiumMg: Math.max(0, Math.round(totals.sodiumMg / servings)),
  };

  return { verified, totals, perServing, primarySource, sourceCounts };
}

function scaleMacros(
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number },
  factor: number,
): VerifiedMacros {
  return {
    calories: Math.max(0, Math.round(per100g.calories * factor)),
    protein: Math.max(0, Math.round(per100g.protein * factor * 10) / 10),
    carbs: Math.max(0, Math.round(per100g.carbs * factor * 10) / 10),
    fat: Math.max(0, Math.round(per100g.fat * factor * 10) / 10),
    fiberG: Math.max(0, Math.round(per100g.fiberG * factor * 10) / 10),
    sugarG: Math.max(0, Math.round((per100g.sugarG ?? 0) * factor * 10) / 10),
    sodiumMg: Math.max(0, Math.round((per100g.sodiumMg ?? 0) * factor)),
  };
}
