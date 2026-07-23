"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase/browserClient";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { normalizeRecipeTitle } from "../../../lib/recipes/normalizeRecipeTitle";
import { formatTotalRecipeDuration } from "../../../lib/recipes/totalDuration";
import {
  CREATOR_RECIPES_PAGE_SIZE,
  mergeRecipePage,
  nextPageRange,
  pageHasMore,
} from "../../../lib/recipes/creatorRecipePagination";
// ENG-816 / icon-strategy 2026-05-31 — the no-image branch renders the
// product-wide `RecipeHeroFallback` (Lucide gradient + glyph — the same
// treatment Library/RecipeDetail/Discover use, mirrored on mobile via
// `@suppr/shared/recipe/recipeHeroFallback`). Unconditional since
// `design_system_icons` collapsed (ENG-1651) — it was permanently ON; the
// legacy 🍳 emoji placeholder no longer exists.
import { RecipeHeroFallback } from "../suppr/RecipeHeroFallback";
import { recipeUnderlayColor } from "../../../lib/recipe/recipeHeroFallback";
import { useFallbackScheme } from "../../../lib/theme/useFallbackScheme";
import { SupprCard } from "../ui/suppr-card";

/**
 * ENG-748 #14 (2026-05-27) — Creator profile recipe list with pagination.
 *
 * Previously the creator page rendered a hard-capped 50-recipe list
 * (`.limit(50)`), so creators with >50 published recipes had their older
 * recipes silently invisible. This client component:
 *   - renders the server-fetched first page (good for SEO + fast paint);
 *   - appends subsequent pages via the SAME public recipe query (anon
 *     key, `published = true`, newest-first) using a `.range()` offset;
 *   - exposes a "Load more" button that disappears once the creator's
 *     full back-catalogue is loaded.
 *
 * Mobile parallel: apps/mobile/app/creator/[id].tsx (same page size,
 * same newest-first ordering, same "Load more" affordance).
 *
 * The page size + offset math + de-dupe rule live in the shared
 * `creatorRecipePagination` module so web and mobile stay in lockstep —
 * a "Load more" button only appears when the first page came back full
 * (i.e. there may be more), and the offset assumes a uniform page size.
 */

// Re-export so existing importers (the server page) keep their import
// surface; the constant itself is owned by the shared module.
export { CREATOR_RECIPES_PAGE_SIZE };

export interface CreatorRecipeRow {
  id: string;
  title: string;
  image_url: string | null;
  calories: number;
  protein: number;
  carbs: number;
  cook_time_min: number | null;
  prep_time_min: number | null;
}

export interface CreatorRecipeListProps {
  creatorId: string;
  initialRecipes: CreatorRecipeRow[];
  /** Whether the server's first page came back full — i.e. there may be
   *  more to load. When false we never render the "Load more" button. */
  initialHasMore: boolean;
}

export function CreatorRecipeList({
  creatorId,
  initialRecipes,
  initialHasMore,
}: CreatorRecipeListProps) {
  const [recipes, setRecipes] = useState<CreatorRecipeRow[]>(initialRecipes);
  const fallbackScheme = useFallbackScheme(); // ENG-1528 — dark ramp underlay on dark cards
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  // Guard against double-fires (rapid taps) and keep the offset stable
  // across renders.
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    const [from, to] = nextPageRange(recipes.length);
    try {
      const { data, error: qErr } = await supabase
        .from("recipes")
        .select(
          "id, title, image_url, calories, protein, carbs, cook_time_min, prep_time_min",
        )
        .eq("creator_id", creatorId)
        .eq("published", true)
        .order("created_at", { ascending: false })
        .range(from, to)
        .returns<CreatorRecipeRow[]>();
      if (qErr) throw qErr;
      const page = data ?? [];
      // De-dupe defensively against any newly published recipe shifting
      // the window (newest-first means a new top row would push the
      // boundary). Keyed by id so a row never renders twice.
      setRecipes((prev) => mergeRecipePage(prev, page));
      setHasMore(pageHasMore(page.length));
    } catch {
      // Surface a retry affordance rather than silently dropping the
      // user's tap. `hasMore` stays true so the button remains.
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [creatorId, hasMore, recipes.length]);

  if (recipes.length === 0) return null;

  const v3Grid = isFeatureEnabled("creator_profile_v3");

  if (v3Grid) {
    return (
      <>
        <div
          data-testid="creator-recipe-grid"
          className="grid grid-cols-2 gap-3"
        >
          {recipes.map((r) => {
            const kcal = Math.round(r.calories ?? 0);
            const timeLabel = formatTotalRecipeDuration(r.prep_time_min, r.cook_time_min);
            return (
              <Link
                key={r.id}
                href={`/recipe/${r.id}`}
                className="overflow-hidden rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors"
              >
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image_url}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                    style={{ backgroundColor: recipeUnderlayColor({ id: r.id, title: r.title }, fallbackScheme) }}
                  />
                ) : (
                  <div
                    className="relative aspect-[4/3] w-full overflow-hidden"
                    style={{ backgroundColor: recipeUnderlayColor({ id: r.id, title: r.title }, fallbackScheme) }}
                  >
                    <RecipeHeroFallback id={r.id} title={r.title} iconSize={24} />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-semibold text-foreground line-clamp-2">
                    {normalizeRecipeTitle(r.title)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {kcal} kcal{timeLabel ? ` · ${timeLabel}` : ""}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
        {hasMore ? (
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className={[
                "inline-flex items-center justify-center min-w-[140px] px-6 py-2.5 rounded-full text-sm font-bold transition-colors",
                "bg-transparent border border-border text-foreground hover:bg-muted/40",
                loading ? "opacity-60 cursor-not-allowed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {loading ? "Loading…" : "Load more"}
            </button>
            {error ? (
              <p className="text-xs text-muted-foreground">
                Couldn&apos;t load more recipes. Tap to try again.
              </p>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {/* Design Direction 2026 — creator recipe list card routed through SupprCard.
          The <ul> wrapper inside preserves list semantics (SupprCard renders a div). */}
      <SupprCard padding="none" radius="lg" className="overflow-hidden">
        <ul>
        {recipes.map((r, idx) => {
          const kcal = Math.round(r.calories ?? 0);
          const protein = Math.round(r.protein ?? 0);
          // ENG-1617 — total (prep + cook), not cook alone.
          const timeLabel = formatTotalRecipeDuration(r.prep_time_min, r.cook_time_min);
          return (
            <li key={r.id} className={idx > 0 ? "border-t border-border" : undefined}>
              <Link
                href={`/recipe/${r.id}`}
                className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors"
              >
                {/* ENG-1374 PR 2 — every branch paints the recipe's opaque
                    §11.4 cuisine tint on the container (replacing frost-grey
                    `bg-muted`, banned under imagery), so a 404 or a failed
                    fallback mount never exposes page white. */}
                {r.image_url ? (
                  // ENG-1623 — decorative alt="" is deliberate: this thumb sits
                  // inside the same <Link> as the visible recipe-title <p>
                  // below, so the link's accessible name already carries the
                  // name. See the decorative-vs-informative rule in
                  // suppr/discover-recipe-image.tsx.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image_url}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover"
                    style={{ backgroundColor: recipeUnderlayColor({ id: r.id, title: r.title }, fallbackScheme) }}
                  />
                ) : (
                  // RecipeHeroFallback is a fill overlay (position:absolute;
                  // inset:0), so it must live inside a relatively-positioned
                  // 56px box — same wrapper shape as Library.tsx call sites.
                  <div
                    className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0"
                    style={{ backgroundColor: recipeUnderlayColor({ id: r.id, title: r.title }, fallbackScheme) }}
                  >
                    <RecipeHeroFallback id={r.id} title={r.title} iconSize={20} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {normalizeRecipeTitle(r.title)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {kcal} kcal · {protein}g protein
                    {timeLabel ? ` · ${timeLabel}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
        </ul>
      </SupprCard>

      {hasMore ? (
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className={[
              "inline-flex items-center justify-center min-w-[140px] px-6 py-2.5 rounded-full text-sm font-bold transition-colors",
              "bg-transparent border border-border text-foreground hover:bg-muted/40",
              loading ? "opacity-60 cursor-not-allowed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
          {error ? (
            <p className="text-xs text-muted-foreground">
              Couldn&apos;t load more recipes. Tap to try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
