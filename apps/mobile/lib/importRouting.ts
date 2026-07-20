import {
  COLLECTION_IMPORT_HINT,
  type ImportClassification,
} from "@suppr/shared/recipe-import/classifyImport";
import { setPendingImportText } from "@suppr/shared/recipe-import/pendingImportText";

/**
 * routeImport (ENG-1225 #3) — maps a classified paste to the existing import
 * flow it belongs in, so the unified Import entry is a single front door over
 * the (previously fragmented) screens. Returns `{ routed }`; when a kind has no
 * destination yet (CSV — the MyFitnessPal flow is Settings-embedded, #7), it
 * returns a `hint` instead of navigating, so the sheet can explain rather than
 * dead-end.
 *
 * Pasted RECIPE/PLAN text is threaded via `setPendingImportText` (a transient
 * store — text can be long, so not a route param) and consumed once at the
 * destination on arrival, so the user doesn't re-paste: recipe text by
 * create-recipe's paste modal, plan text by the plan-import screen on mount.
 * (CSV still routes to the Settings hint — ENG-1245.)
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
      // Thread the pasted plan text to the plan-import paste step (consumed
      // once on mount) so the user doesn't re-paste it.
      setPendingImportText(raw);
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
    case "collection":
      return { routed: false, hint: COLLECTION_IMPORT_HINT };
    case "empty":
      return { routed: false };
    default: {
      const _exhaustive: never = c.kind;
      return _exhaustive;
    }
  }
}
