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
import {
  shoppingScopeFor,
  shoppingScopeRealtimeFilter,
  type ShoppingScope,
} from "../../lib/household/shoppingScope.ts";

type ShoppingItemRow = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  source: string;
  /**
   * Honeydew parity (2026-04-30): the userId of the household member
   * that toggled the row last. Null for legacy rows + anything not yet
   * checked. UIs surface a coloured initials chip when the household
   * has multiple members; solo lists don't render the chip.
   */
  checked_by?: string | null;
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
    checkedBy: row.checked_by ?? null,
  } as ShoppingItem;
}

export function useShoppingListState(opts: {
  authedUserId: string | null;
  initialItems: ShoppingItem[];
  /**
   * Active household id, or null if the user is solo. Drives both the
   * read filter and the INSERT `household_id` stamp. Solo users still
   * benefit from the cross-device real-time subscription (iPhone +
   * iPad sync).
   */
  activeHouseholdId?: string | null;
}) {
  const { authedUserId, initialItems, activeHouseholdId = null } = opts;
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => initialItems);
  const [dbShoppingEnabled, setDbShoppingEnabled] = useState(true);
  const [dbShoppingWarned, setDbShoppingWarned] = useState(false);

  const scope: ShoppingScope | null = authedUserId
    ? shoppingScopeFor({ userId: authedUserId, householdId: activeHouseholdId })
    : null;

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

  // Load from DB whenever the scope changes (auth, schema-enable, or
  // household join/leave). Solo: `user_id = me AND household_id IS
  // NULL`. Household: `household_id = active`.
  useEffect(() => {
    if (!authedUserId || !scope) return;
    let cancelled = false;
    (async () => {
      if (!dbShoppingEnabled) return;

      let q = supabase
        .from("shopping_items")
        .select("id, name, amount, unit, category, checked, source, checked_by")
        .order("created_at", { ascending: true });

      if (scope.kind === "household") {
        q = q.eq("household_id", scope.householdId);
      } else {
        q = q.eq("user_id", scope.userId).is("household_id", null);
      }

      const { data, error } = await q;

      if (cancelled) return;

      if (error) {
        if (looksLikeMissingTableError(error.message ?? "")) {
          // Legacy fallback only handles the per-user JSONB blob —
          // household lists require the relational schema.
          if (scope.kind === "solo") {
            const { items } = await fetchShoppingListJsonItems(supabase, scope.userId);
            if (!cancelled && Array.isArray(items)) {
              setShoppingItems(items as ShoppingItem[]);
            }
          }
          return;
        }
        if (!dbShoppingWarned) {
          setDbShoppingWarned(true);
          toast.warning(syncDisabledBecauseSchemaMessage("Shopping list"));
        }
        return;
      }

      if (data) {
        // Replace — household lists can shrink (member removed an item)
        // so we always trust the server snapshot over the previous
        // local list.
        setShoppingItems((data as ShoppingItemRow[]).map(rowToShoppingItem));
      }
    })();
    return () => { cancelled = true; };
  }, [authedUserId, dbShoppingEnabled, dbShoppingWarned, scope]);

  // Honeydew parity (2026-04-30): real-time subscription so checks /
  // adds / removes from another device or another member propagate
  // within ~1s. The channel name is keyed on scope so a household
  // join/leave cleanly resubscribes.
  useEffect(() => {
    if (!authedUserId || !scope || !dbShoppingEnabled) return;
    const filter = shoppingScopeRealtimeFilter(scope);
    const channelName =
      scope.kind === "household"
        ? `web:shopping:hh:${scope.householdId}`
        : `web:shopping:user:${scope.userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items", filter },
        () => {
          // Refetch in scope. Cheap (one indexed query) and avoids
          // per-event reconciliation on three event types.
          let q = supabase
            .from("shopping_items")
            .select("id, name, amount, unit, category, checked, source, checked_by")
            .order("created_at", { ascending: true });
          if (scope.kind === "household") {
            q = q.eq("household_id", scope.householdId);
          } else {
            q = q.eq("user_id", scope.userId).is("household_id", null);
          }
          void q.then(({ data, error }) => {
            if (!error && data) {
              setShoppingItems((data as ShoppingItemRow[]).map(rowToShoppingItem));
            }
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authedUserId, dbShoppingEnabled, scope]);

  const toggleShoppingChecked = useCallback((itemId: string) => {
    setShoppingItems((prev) => {
      const updated = prev.map((item) =>
        item.id === itemId
          ? ({
              ...item,
              checked: !item.checked,
              checkedBy: !item.checked ? authedUserId : null,
            } as ShoppingItem)
          : item,
      );
      const target = updated.find((i) => i.id === itemId);
      if (authedUserId && dbShoppingEnabled && target) {
        supabase
          .from("shopping_items")
          .update({
            checked: target.checked,
            checked_by: target.checked ? authedUserId : null,
            checked_at: target.checked ? new Date().toISOString() : null,
          })
          .eq("id", itemId)
          .then(() => {});
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
      const row: ShoppingItem = { ...item, id: newId("shop"), checked: item.checked ?? false } as ShoppingItem;
      setShoppingItems((prev) => [...prev, row]);

      if (authedUserId && dbShoppingEnabled && scope) {
        // Honeydew parity (2026-04-30): stamp household_id when in a
        // household so the addition shows up for every member instantly.
        supabase.from("shopping_items").insert({
          id: row.id,
          user_id: authedUserId,
          household_id: scope.kind === "household" ? scope.householdId : null,
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
    [authedUserId, dbShoppingEnabled, scope],
  );

  return {
    shoppingItems,
    setShoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    addShoppingItem,
  };
}
