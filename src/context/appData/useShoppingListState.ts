import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase/browserClient.ts";
import type { ShoppingItem } from "../../types/recipe.ts";
import { looksLikeMissingTableError, syncDisabledBecauseSchemaMessage, syncFailedRetryMessage } from "./supabaseErrors.ts";
import {
  fetchShoppingListJsonItems,
  probeAnyShoppingListJsonTable,
} from "../../lib/supabase/shoppingJsonFallback.ts";
import { newId } from "./persistence.ts";
import { useRetryEnableDbTable } from "./useRetryEnableDbTable.ts";

type ShoppingItemRow = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  source: string;
};

function rowToShoppingItem(row: ShoppingItemRow): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    unit: row.unit,
    category: row.category,
    checked: row.checked,
    from: row.source,
  };
}

export function useShoppingListState(opts: { authedUserId: string | null; initialItems: ShoppingItem[] }) {
  const { authedUserId, initialItems } = opts;
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => initialItems);
  const [dbShoppingEnabled, setDbShoppingEnabled] = useState(true);
  const [dbShoppingWarned, setDbShoppingWarned] = useState(false);

  const tryEnableDbShopping = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("shopping_items").select("id").limit(1);
    if (error) {
      if (looksLikeMissingTableError(error.message ?? "")) {
        const legacyOk = await probeAnyShoppingListJsonTable(supabase);
        if (legacyOk) {
          setDbShoppingEnabled(true);
          return true;
        }
      }
      return false;
    }
    setDbShoppingEnabled(true);
    return true;
  }, [authedUserId]);

  useRetryEnableDbTable(authedUserId, dbShoppingEnabled, tryEnableDbShopping);

  // Load from DB on mount
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    (async () => {
      if (!dbShoppingEnabled) return;

      const { data, error } = await supabase
        .from("shopping_items")
        .select("id, name, amount, unit, category, checked, source")
        .eq("user_id", authedUserId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        if (looksLikeMissingTableError(error.message ?? "")) {
          const { items } = await fetchShoppingListJsonItems(supabase, authedUserId);
          if (!cancelled && Array.isArray(items)) {
            setShoppingItems(items as ShoppingItem[]);
          }
          return;
        }
        if (!dbShoppingWarned) {
          setDbShoppingWarned(true);
          toast.warning(syncDisabledBecauseSchemaMessage("Shopping list"));
        }
        return;
      }

      if (data && data.length > 0) {
        setShoppingItems((data as ShoppingItemRow[]).map(rowToShoppingItem));
      }
    })();
    return () => { cancelled = true; };
  }, [authedUserId, dbShoppingEnabled, dbShoppingWarned]);

  const toggleShoppingChecked = useCallback((itemId: string) => {
    setShoppingItems((prev) => {
      const updated = prev.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item));
      const target = updated.find((i) => i.id === itemId);
      if (authedUserId && dbShoppingEnabled && target) {
        supabase.from("shopping_items").update({ checked: target.checked }).eq("id", itemId).then(() => {});
      }
      return updated;
    });
  }, [authedUserId, dbShoppingEnabled]);

  const removeShoppingItem = useCallback((itemId: string) => {
    setShoppingItems((prev) => prev.filter((item) => item.id !== itemId));
    if (authedUserId && dbShoppingEnabled) {
      supabase.from("shopping_items").delete().eq("id", itemId).then(() => {});
    }
  }, [authedUserId, dbShoppingEnabled]);

  const addShoppingItem = useCallback(
    (item: Omit<ShoppingItem, "id" | "checked"> & { checked?: boolean }) => {
      const row: ShoppingItem = { ...item, id: newId("shop"), checked: item.checked ?? false };
      setShoppingItems((prev) => [...prev, row]);

      if (authedUserId && dbShoppingEnabled) {
        supabase.from("shopping_items").insert({
          id: row.id,
          user_id: authedUserId,
          name: row.name,
          amount: row.amount,
          unit: row.unit,
          category: row.category,
          checked: row.checked,
          source: row.from,
        }).then(({ error }) => {
          if (error && !looksLikeMissingTableError(error.message ?? "")) {
            toast.error(syncFailedRetryMessage("shopping list", error.message ?? ""));
          }
        });
      }
    },
    [authedUserId, dbShoppingEnabled],
  );

  return {
    shoppingItems,
    setShoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    addShoppingItem,
  };
}
