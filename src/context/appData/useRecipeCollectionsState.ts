import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase/browserClient.ts";
import type { RecipeCollection } from "../../lib/recipes/recipeCollections.ts";
import {
  addRecipeToCollection as addRecipeToCollectionShared,
  createRecipeCollection as createRecipeCollectionShared,
  deleteRecipeCollection as deleteRecipeCollectionShared,
  fetchCollectionMembership,
  fetchRecipeCollections,
  removeRecipeFromCollection as removeRecipeFromCollectionShared,
  renameRecipeCollection as renameRecipeCollectionShared,
} from "../../lib/recipes/recipeCollections.ts";
import { looksLikeMissingTableError, syncDisabledBecauseSchemaMessage } from "./supabaseErrors.ts";
import { useRetryEnableDbTable } from "./useRetryEnableDbTable.ts";

/**
 * ENG-1126 — recipe collections state, composed into `AppDataContext`.
 * Extracted into its own hook (mirroring `useShoppingListState.ts`) rather
 * than inlined, since `AppDataContext.tsx` is already well over the
 * 400-line screen budget.
 */
export function useRecipeCollectionsState(opts: { authedUserId: string | null }) {
  const { authedUserId } = opts;
  const [recipeCollections, setRecipeCollections] = useState<RecipeCollection[]>([]);
  const [collectionMembershipByRecipeId, setCollectionMembershipByRecipeId] = useState<
    Record<string, string[]>
  >({});
  const [dbCollectionsEnabled, setDbCollectionsEnabled] = useState(true);
  const [dbCollectionsWarned, setDbCollectionsWarned] = useState(false);

  const tryEnableDbCollections = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("recipe_collections").select("id").limit(1);
    if (error) return false;
    setDbCollectionsEnabled(true);
    return true;
  }, [authedUserId]);

  useRetryEnableDbTable(authedUserId, dbCollectionsEnabled, tryEnableDbCollections);

  const refresh = useCallback(async () => {
    if (!authedUserId || !dbCollectionsEnabled) return;
    const [collections, membership] = await Promise.all([
      fetchRecipeCollections(supabase),
      fetchCollectionMembership(supabase),
    ]);
    setRecipeCollections(collections);
    setCollectionMembershipByRecipeId(membership);
  }, [authedUserId, dbCollectionsEnabled]);

  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase.from("recipe_collections").select("id").limit(1);
      if (cancelled) return;
      if (error) {
        if (looksLikeMissingTableError(error.message ?? "")) {
          setDbCollectionsEnabled(false);
          if (!dbCollectionsWarned) {
            setDbCollectionsWarned(true);
            toast.warning(syncDisabledBecauseSchemaMessage("Recipe collections"));
          }
        }
        return;
      }
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately does not depend on `refresh` (a fresh callback identity
    // every render would refetch in a loop) — this effect owns the initial
    // load; CRUD callbacks below re-run `refresh()` explicitly after writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedUserId]);

  const createCollection = useCallback(
    async (name: string): Promise<boolean> => {
      if (!authedUserId) return false;
      const result = await createRecipeCollectionShared(supabase, authedUserId, name);
      if ("error" in result) {
        toast.error(result.error);
        return false;
      }
      setRecipeCollections((prev) => [...prev, result.collection]);
      return true;
    },
    [authedUserId],
  );

  const renameCollection = useCallback(async (collectionId: string, name: string): Promise<boolean> => {
    const result = await renameRecipeCollectionShared(supabase, collectionId, name);
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    setRecipeCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, name: name.trim() } : c)),
    );
    return true;
  }, []);

  const deleteCollection = useCallback(async (collectionId: string): Promise<boolean> => {
    const result = await deleteRecipeCollectionShared(supabase, collectionId);
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    setRecipeCollections((prev) => prev.filter((c) => c.id !== collectionId));
    setCollectionMembershipByRecipeId((prev) => {
      const next: Record<string, string[]> = {};
      for (const [recipeId, ids] of Object.entries(prev)) {
        const filtered = ids.filter((id) => id !== collectionId);
        if (filtered.length > 0) next[recipeId] = filtered;
      }
      return next;
    });
    return true;
  }, []);

  const addRecipeToCollection = useCallback(
    async (collectionId: string, recipeId: string): Promise<boolean> => {
      setCollectionMembershipByRecipeId((prev) => {
        const existing = prev[recipeId] ?? [];
        if (existing.includes(collectionId)) return prev;
        return { ...prev, [recipeId]: [...existing, collectionId] };
      });
      const result = await addRecipeToCollectionShared(supabase, collectionId, recipeId);
      if ("error" in result) {
        toast.error(result.error);
        setCollectionMembershipByRecipeId((prev) => ({
          ...prev,
          [recipeId]: (prev[recipeId] ?? []).filter((id) => id !== collectionId),
        }));
        return false;
      }
      return true;
    },
    [],
  );

  const removeRecipeFromCollection = useCallback(
    async (collectionId: string, recipeId: string): Promise<boolean> => {
      const previousIds = collectionMembershipByRecipeId[recipeId] ?? [];
      setCollectionMembershipByRecipeId((prev) => ({
        ...prev,
        [recipeId]: (prev[recipeId] ?? []).filter((id) => id !== collectionId),
      }));
      const result = await removeRecipeFromCollectionShared(supabase, collectionId, recipeId);
      if ("error" in result) {
        toast.error(result.error);
        setCollectionMembershipByRecipeId((prev) => ({ ...prev, [recipeId]: previousIds }));
        return false;
      }
      return true;
    },
    [collectionMembershipByRecipeId],
  );

  return {
    recipeCollections,
    collectionMembershipByRecipeId,
    createCollection,
    renameCollection,
    deleteCollection,
    addRecipeToCollection,
    removeRecipeFromCollection,
  };
}
