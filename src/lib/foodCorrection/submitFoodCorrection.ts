import { checkSubmissionPlausibility } from "./plausibility";

/**
 * Web `submitFoodCorrection` — the parity twin of mobile's
 * `apps/mobile/lib/verifyRecipe.ts#submitFoodCorrection` (ENG-1247). Writes a
 * user's barcode nutrition contribution to the shared `user_foods` store, gated
 * by the SAME shared plausibility check (`checkSubmissionPlausibility`).
 *
 * Uses the caller's authenticated browser Supabase client so RLS scopes the write
 * to `submitted_by = auth.uid()` (the row lands `pending` until consensus
 * promotes it — see `docs/decisions/2026-06-27-shared-food-db-contribution-opt-in.md`).
 * A `block`-tier plausibility result returns `{ ok: false, error:
 * "plausibility_blocked", reasons }` WITHOUT writing — the opt-in UI then shows
 * the reasons, never a success card.
 */
type SupabaseLike = {
  from: (table: string) => {
    // PromiseLike (not Promise) — the real Supabase client returns an awaitable
    // PostgrestFilterBuilder, which is thenable but not a full Promise.
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

export interface FoodCorrectionInput {
  barcode: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  saturatedFatG?: number;
  servingSizeG?: number;
}

export async function submitFoodCorrection(
  supabase: SupabaseLike,
  userId: string,
  input: FoodCorrectionInput,
): Promise<{ ok: boolean; error?: string; reasons?: string[] }> {
  // Server-side plausibility gate (same shared check as mobile) — catches typos
  // and unit errors before they pollute user_foods. Block-tier fails fast.
  const plausibility = checkSubmissionPlausibility({
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    fiber: input.fiberG ?? 0,
    sugar: input.sugarG ?? 0,
    satFat: input.saturatedFatG ?? 0,
    sodium: input.sodiumMg ?? 0,
  });
  if (plausibility.verdict === "block") {
    return { ok: false, error: "plausibility_blocked", reasons: plausibility.reasons };
  }

  try {
    // Spread-conditional micro keys keep writes compatible with older DB schemas
    // (mirrors mobile). `onConflict: barcode,submitted_by` → one row per user.
    const payload: Record<string, unknown> = {
      barcode: input.barcode,
      name: input.name,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      fiber_g: input.fiberG ?? 0,
      serving_size_g: input.servingSizeG ?? 100,
      submitted_by: userId,
      updated_at: new Date().toISOString(),
    };
    if (input.sugarG != null && input.sugarG > 0) payload.sugar_g = input.sugarG;
    if (input.sodiumMg != null && input.sodiumMg > 0) payload.sodium_mg = input.sodiumMg;
    if (input.saturatedFatG != null && input.saturatedFatG > 0)
      payload.saturated_fat_g = input.saturatedFatG;

    const { error } = await supabase
      .from("user_foods")
      .upsert(payload, { onConflict: "barcode,submitted_by" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
