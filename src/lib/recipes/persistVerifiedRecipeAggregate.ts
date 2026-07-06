import type { SupabaseClient } from "@supabase/supabase-js";
import { saveVerifiedIngredientsRpc } from "../nutrition/saveVerifiedIngredientsRpc";
import { roundCalories, roundMacro } from "./createRecipeWizard";

type PerServing = { calories: number; protein: number; carbs: number; fat: number };
type VerifiedTotals = {
  perServing: { fiberG: number; sugarG: number; sodiumMg: number };
  microsPerServing?: Record<string, number>;
};
type AggregateScrub = { calories: number; protein: number; carbs: number; fat: number; fiber_g: number; sugar_g: number; sodium_mg: number } | null;
type IngredientInsertRow = {
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  nutrition_micros: Record<string, number>;
  is_verified: boolean;
  source: string;
  confidence: number | null;
};

/**
 * ENG-1415/1417 — the initial recipes upsert can't set
 * is_verified/verified_confidence/verified_source directly (client writes to
 * those columns are rejected by recipes_trust_column_lockdown_trg, ENG-1244).
 * When verify resolved for every line, follow up with the atomic
 * `save_verified_ingredients` RPC — it recomputes the trust columns
 * server-side from the same ingredient rows (worst-case-wins), the only
 * legitimate write path. No-ops when verify didn't resolve. Non-fatal on RPC
 * failure: the recipe + ingredients are already saved; only the trust flag
 * missed, logged for visibility rather than blocking the save.
 */
export async function persistVerifiedRecipeAggregate(args: {
  supabase: SupabaseClient;
  recipeId: string;
  verifiedOk: boolean;
  chosenPerServing: PerServing | null;
  verifiedTotals: VerifiedTotals | null;
  aggregateScrub: AggregateScrub;
  allergensPayload: unknown;
  existingCaffeineMg: number | null;
  existingAlcoholG: number | null;
  insertedIds: { id: string }[];
  insertRows: IngredientInsertRow[];
}): Promise<void> {
  const { verifiedOk, insertedIds, insertRows } = args;
  if (!verifiedOk || insertedIds.length !== insertRows.length) return;
  const { chosenPerServing, verifiedTotals, aggregateScrub } = args;

  const rpcResult = await saveVerifiedIngredientsRpc(
    args.supabase,
    args.recipeId,
    {
      calories: aggregateScrub ? aggregateScrub.calories : roundCalories(chosenPerServing!.calories),
      protein: aggregateScrub ? aggregateScrub.protein : roundMacro(chosenPerServing!.protein),
      carbs: aggregateScrub ? aggregateScrub.carbs : roundMacro(chosenPerServing!.carbs),
      fat: aggregateScrub ? aggregateScrub.fat : roundMacro(chosenPerServing!.fat),
      fiber_g: aggregateScrub ? aggregateScrub.fiber_g : roundMacro(verifiedTotals!.perServing.fiberG),
      sugar_g: aggregateScrub ? aggregateScrub.sugar_g : roundMacro(verifiedTotals!.perServing.sugarG),
      sodium_mg: aggregateScrub ? aggregateScrub.sodium_mg : roundMacro(verifiedTotals!.perServing.sodiumMg),
      caffeine_mg: args.existingCaffeineMg ?? 0,
      alcohol_g: args.existingAlcoholG ?? 0,
      nutrition_micros: !aggregateScrub ? (verifiedTotals!.microsPerServing ?? {}) : {},
      allergens: args.allergensPayload,
    },
    insertRows.map((row, idx) => ({ id: insertedIds[idx]!.id, ...row })),
  );
  if ("error" in rpcResult) {
    console.error("[persistVerifiedRecipeAggregate] save_verified_ingredients RPC failed:", rpcResult.error);
  }
}
