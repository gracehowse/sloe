/**
 * Lookup user-contributed foods from the Suppr custom food database.
 * Verified entries are prioritised. Falls back to pending entries with high upvotes.
 *
 * This is step 0 in the verification cascade — checked before any external API.
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { hasSupabaseServiceConfig } from "@/lib/server/serverEnv";

export type UserFoodMatch = {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  servingSizeG: number;
  verificationStatus: "pending" | "verified" | "rejected";
  upvotes: number;
  downvotes: number;
  source: string;
};

/**
 * Search the user_foods table by name (text search).
 * Returns verified entries first, then high-upvote pending entries.
 */
export async function searchUserFoods(
  query: string,
  opts?: { limit?: number },
): Promise<UserFoodMatch[]> {
  if (!hasSupabaseServiceConfig()) return [];

  const limit = opts?.limit ?? 5;
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return [];

  // Search by name with ilike for flexible matching
  const searchTerm = `%${query.replace(/[%_]/g, "\\$&")}%`;

  const { data, error } = await supabase
    .from("user_foods")
    .select(
      "id, barcode, name, brand, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, serving_size_g, verification_status, upvotes, downvotes, source",
    )
    .or(`verification_status.eq.verified,and(verification_status.eq.pending,upvotes.gte.3)`)
    .ilike("name", searchTerm)
    .order("verification_status", { ascending: true }) // verified before pending
    .order("upvotes", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    barcode: row.barcode as string,
    name: row.name as string,
    brand: (row.brand as string) ?? null,
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
    fiberG: Number(row.fiber_g) || 0,
    sugarG: Number(row.sugar_g) || 0,
    sodiumMg: Number(row.sodium_mg) || 0,
    servingSizeG: Number(row.serving_size_g) || 100,
    verificationStatus: row.verification_status as "pending" | "verified" | "rejected",
    upvotes: Number(row.upvotes) || 0,
    downvotes: Number(row.downvotes) || 0,
    source: (row.source as string) ?? "user",
  }));
}

/**
 * Look up a user food by exact barcode.
 * Returns the best verified entry, or highest-upvoted pending entry.
 */
export async function lookupUserFoodByBarcode(
  barcode: string,
): Promise<UserFoodMatch | null> {
  if (!hasSupabaseServiceConfig()) return null;

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_foods")
    .select(
      "id, barcode, name, brand, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, serving_size_g, verification_status, upvotes, downvotes, source",
    )
    .eq("barcode", barcode)
    .neq("verification_status", "rejected")
    .order("verification_status", { ascending: true })
    .order("upvotes", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;

  const row = data[0];
  return {
    id: row.id as string,
    barcode: row.barcode as string,
    name: row.name as string,
    brand: (row.brand as string) ?? null,
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
    fiberG: Number(row.fiber_g) || 0,
    sugarG: Number(row.sugar_g) || 0,
    sodiumMg: Number(row.sodium_mg) || 0,
    servingSizeG: Number(row.serving_size_g) || 100,
    verificationStatus: row.verification_status as "pending" | "verified" | "rejected",
    upvotes: Number(row.upvotes) || 0,
    downvotes: Number(row.downvotes) || 0,
    source: (row.source as string) ?? "user",
  };
}
