import type { ImportClassification } from "./classifyImport";
import { setPendingImportText } from "./pendingImportText";

/**
 * routeImport (web, ENG-1225 #3) — WEB twin of `apps/mobile/lib/importRouting.ts`.
 *
 * Maps a classified paste to the existing web import flow it belongs in, so the
 * unified Import sheet is a single front door over the (previously fragmented)
 * `/import`, `/create`, `/plan-import` routes. Returns `{ routed }`; when a kind
 * has no destination yet (CSV — the MyFitnessPal flow is Settings-embedded, #7),
 * it returns a `hint` instead of navigating, so the sheet can explain rather
 * than dead-end.
 *
 * Web routes are URL-based (Next router + `RecipeUpload`'s `useSearchParams`), so
 * a social / recipe URL prefills the import field via `?importUrl=` (the web
 * analogue of mobile's `/import-shared?url=`). Pasted RECIPE text is threaded
 * via `setPendingImportText` (a transient store — text can be long, so not a URL
 * param) and consumed at the destination on arrival, so the user doesn't
 * re-paste: recipe text by RecipeUpload's paste dialog, plan text by
 * `usePlanImport` on mount. (CSV still routes to the Settings hint — ENG-1245.)
 */
export type ImportRouteResult = { routed: boolean; hint?: string };

type Pushable = { push: (target: string) => void };

export function routeImport(
  c: ImportClassification,
  raw: string,
  router: Pushable,
): ImportRouteResult {
  switch (c.kind) {
    case "social":
    case "recipe-url":
      // The proven URL/social import flow — prefill the import field.
      router.push(`/import?importUrl=${encodeURIComponent(c.url ?? raw.trim())}`);
      return { routed: true };
    case "plan-text":
      // Thread the pasted plan text to the plan-import paste step (consumed
      // once on mount) so the user doesn't re-paste it.
      setPendingImportText(raw);
      router.push("/plan-import");
      return { routed: true };
    case "recipe-text":
      // Thread the pasted recipe text to the create paste dialog (consumed once
      // on arrival) so the user doesn't re-paste it.
      setPendingImportText(raw);
      router.push("/create?autoPaste=1");
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
