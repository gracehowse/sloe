import type { ImportClassification } from "@suppr/shared/recipe-import/classifyImport";
import { setPendingImportText } from "@suppr/shared/recipe-import/pendingImportText";

/**
 * routeImport (ENG-1225 #3) — maps a classified paste to the existing import
 * flow it belongs in, so the unified Import entry is a single front door over
 * the (previously fragmented) screens. Returns `{ routed }`; when a kind has no
 * destination yet (CSV — the MyFitnessPal flow is Settings-embedded, #7), it
 * returns a `hint` instead of navigating, so the sheet can explain rather than
 * dead-end.
 *
 * Pasted RECIPE text is threaded via `setPendingImportText` (a transient store —
 * text can be long, so not a route param) and consumed once by create-recipe's
 * paste modal on arrival, so the user doesn't re-paste. Plan-text threading is a
 * follow-up (ENG-1245): until `/plan-import` consumes the store, plan-text must
 * NOT set it (stale-leak), so it still opens the flow for a manual paste.
 */
export type ImportRouteResult = { routed: boolean; hint?: string };

type Pushable = {
  push: (
    target: string | { pathname: string; params?: Record<string, string> },
  ) => void;
};

export function routeImport(
  c: ImportClassification,
  raw: string,
  router: Pushable,
): ImportRouteResult {
  switch (c.kind) {
    case "social":
    case "recipe-url":
      // The proven URL/social import flow.
      router.push({ pathname: "/import-shared", params: { url: c.url ?? raw.trim() } });
      return { routed: true };
    case "plan-text":
      router.push("/plan-import");
      return { routed: true };
    case "recipe-text":
      // Thread the pasted recipe text to the create paste modal (consumed once
      // on arrival) so the user doesn't re-paste it.
      setPendingImportText(raw);
      router.push("/create-recipe?autoPaste=1");
      return { routed: true };
    case "csv":
      return {
        routed: false,
        hint: "To import a nutrition export (MyFitnessPal / Cronometer CSV), open Settings → Your data.",
      };
    case "empty":
      return { routed: false };
  }
}
