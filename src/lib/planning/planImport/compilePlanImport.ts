import { parseRawIngredients } from "../../recipe-ingredients/parseRawIngredients";
import type {
  PlanImportAuthorNutrition,
  PlanImportCompiledSlot,
  PlanImportConfidence,
  PlanImportLinkStatus,
  PlanImportParsedRecipe,
  PlanImportScheduleDay,
  PlanImportVerifiedRecipe,
} from "./types";

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const aw = new Set(na.split(/\s+/));
  const bw = new Set(nb.split(/\s+/));
  let inter = 0;
  for (const w of aw) {
    if (bw.has(w)) inter++;
  }
  const union = aw.size + bw.size - inter;
  return union > 0 ? inter / union : 0;
}

/** Resolve recipe keys from slot label when LLM omitted explicit keys. */
export function inferRecipeKeysForLabel(
  label: string,
  recipes: readonly PlanImportParsedRecipe[],
): string[] {
  const explicit = label
    .split(/[+&,/]|(?:\s+and\s+)/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const parts = explicit.length > 1 ? explicit : [label];
  const keys: string[] = [];
  for (const part of parts) {
    let best: { key: string; score: number } | null = null;
    for (const r of recipes) {
      const score = Math.max(titleSimilarity(part, r.title), titleSimilarity(part, r.key));
      if (score >= 0.45 && (!best || score > best.score)) {
        best = { key: r.key, score };
      }
    }
    if (best) keys.push(best.key);
  }
  return [...new Set(keys)];
}

function sumNutrition(
  keys: string[],
  recipeByKey: Map<string, PlanImportVerifiedRecipe>,
  portion: number,
): PlanImportAuthorNutrition {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiberG = 0;
  for (const key of keys) {
    const r = recipeByKey.get(key);
    if (!r) continue;
    const p = portion > 0 ? portion : 1;
    calories += r.supprNutrition.calories * p;
    protein += r.supprNutrition.protein * p;
    carbs += r.supprNutrition.carbs * p;
    fat += r.supprNutrition.fat * p;
    fiberG += r.supprNutrition.fiberG * p;
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiberG: Math.round(fiberG * 10) / 10,
  };
}

function slotConfidence(
  keys: string[],
  recipeByKey: Map<string, PlanImportVerifiedRecipe>,
): PlanImportConfidence {
  if (keys.length === 0) return "low";
  const tiers = keys.map((k) => recipeByKey.get(k)?.confidence ?? "low");
  if (tiers.includes("low")) return "low";
  if (tiers.includes("medium")) return "medium";
  return "high";
}

function linkStatusForSlot(
  keys: string[],
  recipeByKey: Map<string, PlanImportVerifiedRecipe>,
  claimedKcal: number | null,
): PlanImportLinkStatus {
  const linked = keys.length > 0 && keys.every((k) => recipeByKey.has(k));
  if (linked) return "linked";
  if (claimedKcal != null && claimedKcal > 0) return "kcal_only";
  return "blocked";
}

export function compilePlanImportSlots(input: {
  schedule: readonly PlanImportScheduleDay[];
  recipes: readonly PlanImportVerifiedRecipe[];
}): PlanImportCompiledSlot[] {
  const recipeByKey = new Map(input.recipes.map((r) => [r.key, r]));
  const out: PlanImportCompiledSlot[] = [];

  for (const day of input.schedule) {
    for (const slot of day.slots) {
      let keys = slot.recipeKeys.length > 0 ? [...slot.recipeKeys] : inferRecipeKeysForLabel(slot.label, input.recipes);
      const claimedKcal = slot.claimedKcal ?? null;
      const linkStatus = linkStatusForSlot(keys, recipeByKey, claimedKcal);
      if (linkStatus === "blocked") keys = [];

      const portion = slot.portionMultiplier && slot.portionMultiplier > 0 ? slot.portionMultiplier : 1;
      const supprNutrition =
        linkStatus === "linked"
          ? sumNutrition(keys, recipeByKey, portion)
          : linkStatus === "kcal_only" && claimedKcal
            ? { calories: Math.round(claimedKcal), protein: 0, carbs: 0, fat: 0, fiberG: 0 }
            : { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0 };

      let authorNutrition: PlanImportAuthorNutrition | null = null;
      if (keys.length === 1) {
        authorNutrition = recipeByKey.get(keys[0]!)?.authorNutrition ?? null;
      }
      if (claimedKcal != null && claimedKcal > 0) {
        authorNutrition = { ...(authorNutrition ?? {}), calories: claimedKcal };
      }

      out.push({
        dayIndex: day.dayIndex,
        dayLabel: day.dayLabel,
        slot: slot.slot,
        title: slot.label,
        recipeKeys: keys,
        linkStatus,
        portionMultiplier: portion,
        supprNutrition,
        authorNutrition,
        claimedKcal,
        confidence: slotConfidence(keys, recipeByKey),
      });
    }
  }
  return out;
}

export function planImportStats(
  slots: readonly PlanImportCompiledSlot[],
  /**
   * ENG-1422 — the verified recipes behind the slots. Passed so `excludedLineCount`
   * (lines dropped below the accept floor) can be summed ONCE per recipe rather
   * than per-slot (a recipe referenced by several slots must count once). Optional
   * for legacy callers that only need the slot-derived counts; excluded count is 0
   * when omitted.
   */
  recipes: readonly PlanImportVerifiedRecipe[] = [],
): {
  recipeCount: number;
  slotCount: number;
  linkedCount: number;
  blockedCount: number;
  avgKcalPerDay: number;
  excludedLineCount: number;
} {
  const slotCount = slots.length;
  const linkedCount = slots.filter((s) => s.linkStatus === "linked" || s.linkStatus === "kcal_only").length;
  const blockedCount = slots.filter((s) => s.linkStatus === "blocked").length;
  const byDay = new Map<number, number>();
  for (const s of slots) {
    byDay.set(s.dayIndex, (byDay.get(s.dayIndex) ?? 0) + (s.supprNutrition.calories ?? 0));
  }
  const dayTotals = [...byDay.values()];
  const avgKcalPerDay =
    dayTotals.length > 0
      ? Math.round(dayTotals.reduce((a, b) => a + b, 0) / dayTotals.length)
      : 0;
  const recipeKeys = new Set<string>();
  for (const s of slots) {
    for (const k of s.recipeKeys) recipeKeys.add(k);
  }
  const excludedLineCount = recipes.reduce((sum, r) => sum + (r.excludedLineCount ?? 0), 0);
  return {
    recipeCount: recipeKeys.size,
    slotCount,
    linkedCount,
    blockedCount,
    avgKcalPerDay,
    excludedLineCount,
  };
}

/** Parse ingredient lines into verify-ingredients shape. */
export function ingredientRowsFromRecipe(recipe: PlanImportParsedRecipe) {
  const lines = recipe.ingredients.length > 0 ? recipe.ingredients : [];
  const parsed = parseRawIngredients(lines);
  return parsed.map((p) => ({
    name: p.name,
    amount: p.amount || "1",
    unit: p.unit || "",
  }));
}
