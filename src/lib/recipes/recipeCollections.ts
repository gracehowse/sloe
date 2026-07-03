import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ENG-1126 — recipe collections/folders (Paprika/Plan To Eat parity).
 *
 * Shared, pure Supabase-taking-a-param functions so web (`AppDataContext.tsx`)
 * and mobile (`apps/mobile/lib/recipes.ts`) call the exact same query logic
 * instead of two hand-mirrored implementations that can drift — same
 * pattern as `persistImportedRecipe.ts`.
 *
 * Membership (`recipe_collection_items`) is keyed on `recipe_id`, not on a
 * `saves` row, so created/imported recipes (no `saves` row) can be filed.
 * Pro-gating on collection creation is an explicitly deferred decision
 * (ENG-1126's own dependency note) — not implemented here.
 */

export type RecipeCollection = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

type RecipeCollectionRow = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

function rowToCollection(row: RecipeCollectionRow): RecipeCollection {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

/** True when the error is a Postgres unique-violation (dup collection name). */
function isDuplicateNameError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const msg = String((err as { message?: string }).message ?? "").toLowerCase();
  return code === "23505" || msg.includes("duplicate") || msg.includes("unique");
}

export async function fetchRecipeCollections(
  supabase: SupabaseClient,
): Promise<RecipeCollection[]> {
  const { data, error } = await supabase
    .from("recipe_collections")
    .select("id, name, sort_order, created_at")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as RecipeCollectionRow[]).map(rowToCollection);
}

/**
 * Membership as `{ [recipeId]: collectionId[] }` for O(1) UI lookups. A
 * recipe absent from the map belongs to no collection.
 */
export async function fetchCollectionMembership(
  supabase: SupabaseClient,
): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from("recipe_collection_items")
    .select("collection_id, recipe_id");
  if (error || !data) return {};
  const out: Record<string, string[]> = {};
  for (const row of data as { collection_id: string; recipe_id: string }[]) {
    (out[row.recipe_id] ??= []).push(row.collection_id);
  }
  return out;
}

export async function createRecipeCollection(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<{ collection: RecipeCollection } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Collection name can't be empty." };
  const { data, error } = await supabase
    .from("recipe_collections")
    .insert({ user_id: userId, name: trimmed })
    .select("id, name, sort_order, created_at")
    .single();
  if (error || !data) {
    if (isDuplicateNameError(error)) {
      return { error: `You already have a collection named "${trimmed}".` };
    }
    return { error: error?.message ?? "Couldn't create the collection." };
  }
  return { collection: rowToCollection(data as RecipeCollectionRow) };
}

export async function renameRecipeCollection(
  supabase: SupabaseClient,
  collectionId: string,
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Collection name can't be empty." };
  const { error } = await supabase
    .from("recipe_collections")
    .update({ name: trimmed })
    .eq("id", collectionId);
  if (error) {
    if (isDuplicateNameError(error)) {
      return { error: `You already have a collection named "${trimmed}".` };
    }
    return { error: error.message ?? "Couldn't rename the collection." };
  }
  return { ok: true };
}

/** Removes the collection + its membership rows (cascade); recipes themselves are untouched. */
export async function deleteRecipeCollection(
  supabase: SupabaseClient,
  collectionId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("recipe_collections")
    .delete()
    .eq("id", collectionId);
  if (error) return { error: error.message ?? "Couldn't delete the collection." };
  return { ok: true };
}

export async function addRecipeToCollection(
  supabase: SupabaseClient,
  collectionId: string,
  recipeId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("recipe_collection_items")
    .upsert({ collection_id: collectionId, recipe_id: recipeId }, { onConflict: "collection_id,recipe_id" });
  if (error) return { error: error.message ?? "Couldn't add the recipe to that collection." };
  return { ok: true };
}

export async function removeRecipeFromCollection(
  supabase: SupabaseClient,
  collectionId: string,
  recipeId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("recipe_collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("recipe_id", recipeId);
  if (error) return { error: error.message ?? "Couldn't remove the recipe from that collection." };
  return { ok: true };
}
