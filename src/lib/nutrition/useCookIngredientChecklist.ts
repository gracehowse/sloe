"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getCookIngredientCheckedSet,
  subscribeCookIngredientChecklist,
  toggleCookIngredientChecked,
} from "./cookIngredientChecklist.ts";

/** React binding for the per-recipe in-memory ingredient checklist (ENG-946). */
export function useCookIngredientChecklist(recipeId: string) {
  const key = recipeId.trim() || "unknown";

  const checked = useSyncExternalStore(
    (onStoreChange) => subscribeCookIngredientChecklist(key, onStoreChange),
    () => getCookIngredientCheckedSet(key),
    () => getCookIngredientCheckedSet(key),
  );

  const toggle = useCallback(
    (index: number) => toggleCookIngredientChecked(key, index),
    [key],
  );

  const isChecked = useCallback((index: number) => checked.has(index), [checked]);

  return { checked, toggle, isChecked };
}
