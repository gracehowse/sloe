import { useCallback } from "react";
import type { Href, Router } from "expo-router";
import { alertOrToast } from "@/lib/alertOrToast";
import type { UseToastResult } from "@/hooks/useToast";

type GenerateResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * ENG-1668 — Plan "Shopping list" must generate then navigate (web
 * `handleShoppingList` parity). Pre-fix mobile only pushed `/shopping`.
 */
export function useOpenShoppingList<T>(input: {
  plan: T[] | null;
  generateShoppingListFromPlan: (plan: T[]) => Promise<GenerateResult>;
  showToast: UseToastResult["showToast"];
  router: Router;
}): () => void {
  const { plan, generateShoppingListFromPlan, showToast, router } = input;
  return useCallback(() => {
    void (async () => {
      if (plan && plan.length > 0) {
        const res = await generateShoppingListFromPlan(plan);
        if (!res.ok) {
          alertOrToast(showToast, "Couldn't build shopping list", res.error, "error");
        }
      }
      router.push("/shopping" as Href);
    })();
  }, [plan, generateShoppingListFromPlan, showToast, router]);
}
