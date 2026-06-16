/**
 * /import — canonical recipe import path (ENG-608, ENG-669).
 *
 * Like every route in the `(product)` group, this `page.tsx` renders
 * `null` on purpose. The shared shell at `app/(product)/layout.tsx`
 * mounts `<HomePageClient />` (→ `src/app/App.tsx`) once for the whole
 * group; the App reads `usePathname()` and derives the active view from
 * the path. For `/import` the path-derived view is `"import"`, which
 * `App.tsx#renderView()` renders as `<RecipeUpload mode="import" />` —
 * the canonical paste-a-link / photo → parse → review → save-to-library
 * flow (see also `/today`, `/library`, `/plan`, all same pattern).
 *
 * ENG-669 (launch-blocker): `/import` rendered a blank white page because
 * the `pathDerivedView` map in `App.tsx` was missing the `import` (and
 * `create`) segments. With no path-derived view the URL never switched
 * `currentView` to `"import"`, so the import UI — already built and wired
 * into `renderView()`'s `case "import"` — was unreachable from the
 * `/import` URL. The fix adds those segments to the path→view map. The
 * regression is pinned by `tests/unit/webRouteCompletion.test.ts`
 * (path→view map + `case "import"` render wiring) and
 * `tests/unit/recipeImportSurface.test.tsx` (the rendered import UI).
 *
 * Auth gating is handled inside HomePageClient + middleware (the path is
 * not in `PUBLIC_ROUTES`, so unauthed access 307s to /login before any
 * client JS runs).
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import recipe — Sloe",
  description: "Import a recipe from a link or photo.",
};

/** UI shell: `app/(product)/layout.tsx` → HomePageClient → App `case "import"`. */
export default function ImportRecipePage() {
  return null;
}
