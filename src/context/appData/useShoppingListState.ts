import { useCallback, useEffect, useRef, useState } from "react";
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
// PR3 (Honeydew parity, 2026-04-30 competitor audit gap #8): realtime
// shared shopping cart. Subscribes to a Supabase Realtime channel
// scoped to the active household so INSERT / UPDATE / DELETE from any
// member shows up in <1s with a "Sam added milk" toast.
import {
  formatShoppingChangeToast,
  subscribeShoppingItemsChannel,
  type ShoppingChangeEvent,
} from "../../lib/household/shoppingRealtime.ts";
import { shoppingScopeFor } from "../../lib/household/shoppingScope.ts";
import { getMyHousehold } from "../../lib/household/householdClient.ts";

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
  // PR3: active household + member-name lookup table for the
  // realtime toast. Both nullable until the membership query
  // resolves; solo users skip household resolution entirely.
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<Map<string, string>>(
    () => new Map(),
  );
  const householdMembersRef = useRef(householdMembers);
  useEffect(() => {
    householdMembersRef.current = householdMembers;
  }, [householdMembers]);

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

  // PR3 (2026-04-30 Honeydew parity): resolve household + member
  // names for the realtime toast. Solo users land with householdId
  // null; the realtime channel still subscribes (per-user filter)
  // so future device-sync hooks land without a re-wire.
  useEffect(() => {
    if (!authedUserId) {
      setHouseholdId(null);
      setHouseholdMembers(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await getMyHousehold(supabase as any, authedUserId);
        if (cancelled) return;
        if (result.error || !result.data) {
          setHouseholdId(null);
          setHouseholdMembers(new Map());
          return;
        }
        const hh = result.data.household ?? null;
        if (!hh) {
          setHouseholdId(null);
          setHouseholdMembers(new Map());
          return;
        }
        setHouseholdId(hh.id);
        const map = new Map<string, string>();
        for (const m of result.data.members ?? []) {
          if (m.userId && m.displayName) {
            map.set(m.userId, m.displayName);
          }
        }
        setHouseholdMembers(map);
      } catch {
        setHouseholdId(null);
        setHouseholdMembers(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  // PR3: subscribe to realtime change events. Mutations from any
  // household member surface as a sonner toast + as a local-state
  // patch so the UI reflects the change without a re-fetch.
  useEffect(() => {
    if (!authedUserId) return;
    const scope = shoppingScopeFor({ userId: authedUserId, householdId });
    const handle = (event: ShoppingChangeEvent) => {
      const message = formatShoppingChangeToast({
        event,
        members: householdMembersRef.current,
        ownUserId: authedUserId,
      });
      if (message) {
        toast(message, { duration: 4000 });
      }
      if (event.kind === "insert") {
        const r = event.row;
        setShoppingItems((prev) => {
          if (prev.some((p) => p.id === r.id)) return prev;
          return [
            ...prev,
            {
              id: r.id,
              name: r.name,
              amount: r.amount ?? "",
              unit: r.unit ?? "",
              category: r.category ?? "Other",
              checked: r.checked,
              from: r.source ?? "",
            },
          ];
        });
      } else if (event.kind === "update") {
        const r = event.row;
        setShoppingItems((prev) =>
          prev.map((p) =>
            p.id === r.id
              ? {
                  ...p,
                  name: r.name,
                  amount: r.amount ?? "",
                  unit: r.unit ?? "",
                  category: r.category ?? p.category,
                  checked: r.checked,
                }
              : p,
          ),
        );
      } else if (event.kind === "delete") {
        const id = event.row.id;
        setShoppingItems((prev) => prev.filter((p) => p.id !== id));
      }
    };
    const unsub = subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange: handle,
    });
    return unsub;
  }, [authedUserId, householdId]);

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
