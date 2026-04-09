import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase/browserClient.ts";
import type { ShoppingItem } from "../../types/recipe.ts";
import { looksLikeMissingTableError, syncDisabledBecauseSchemaMessage, syncFailedRetryMessage } from "./supabaseErrors.ts";
import { newId } from "./persistence.ts";
import { useRetryEnableDbTable } from "./useRetryEnableDbTable.ts";

export function useShoppingListState(opts: { authedUserId: string | null; initialItems: ShoppingItem[] }) {
  const { authedUserId, initialItems } = opts;
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => initialItems);
  const [dbShoppingEnabled, setDbShoppingEnabled] = useState(true);
  const [dbShoppingWarned, setDbShoppingWarned] = useState(false);

  const tryEnableDbShopping = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("shopping_lists").select("user_id").limit(1);
    if (error) {
      return false;
    }
    setDbShoppingEnabled(true);
    return true;
  }, [authedUserId]);

  useRetryEnableDbTable(authedUserId, dbShoppingEnabled, tryEnableDbShopping);

  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    (async () => {
      if (!dbShoppingEnabled) return;
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("items")
        .eq("user_id", authedUserId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        if (looksLikeMissingTableError(error.message ?? "")) {
          setDbShoppingEnabled(false);
          if (!dbShoppingWarned) {
            setDbShoppingWarned(true);
            toast.warning(syncDisabledBecauseSchemaMessage("Shopping list"));
          }
        }
        return;
      }
      if (Array.isArray(data?.items)) {
        setShoppingItems(data.items as ShoppingItem[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbShoppingEnabled, dbShoppingWarned]);

  useEffect(() => {
    if (!authedUserId || !dbShoppingEnabled) return;
    const t = setTimeout(() => {
      supabase
        .from("shopping_lists")
        .upsert(
          { user_id: authedUserId, updated_at: new Date().toISOString(), items: shoppingItems },
          { onConflict: "user_id" },
        )
        .then(({ error }) => {
          if (error) {
            const msg = error.message ?? "";
            if (looksLikeMissingTableError(msg)) {
              setDbShoppingEnabled(false);
              if (!dbShoppingWarned) {
                setDbShoppingWarned(true);
                toast.warning(syncDisabledBecauseSchemaMessage("Shopping list"));
              }
              return;
            }
            toast.error(syncFailedRetryMessage("shopping list", msg));
          }
        });
    }, 600);
    return () => clearTimeout(t);
  }, [authedUserId, dbShoppingEnabled, dbShoppingWarned, shoppingItems]);

  const toggleShoppingChecked = useCallback((itemId: string) => {
    setShoppingItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
    );
  }, []);

  const removeShoppingItem = useCallback((itemId: string) => {
    setShoppingItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const addShoppingItem = useCallback(
    (item: Omit<ShoppingItem, "id" | "checked"> & { checked?: boolean }) => {
      const row: ShoppingItem = {
        ...item,
        id: newId("shop"),
        checked: item.checked ?? false,
      };
      setShoppingItems((prev) => [...prev, row]);
    },
    [],
  );

  return {
    shoppingItems,
    setShoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    addShoppingItem,
  };
}
