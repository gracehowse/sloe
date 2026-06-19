import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { formatRecipeMinutes } from "./formatRecipeMinutes";
import { supabase } from "./supabase";
import {
  cacheDiscoverRecipes,
  getCachedDiscoverRecipes,
  cacheSavedRecipes,
  getCachedSavedRecipes,
} from "./offlineCache";
import type { RecipeCard } from "./types";
import { NEUTRAL_AVATAR_DATA_URI } from "@suppr/shared/ui/neutralAvatar";
import { fetchPublicRecipeSaveCounts } from "@suppr/shared/recipes/fetchPublicRecipeSaveCounts";
import { normalizeRecipeTitle } from "@suppr/shared/recipes/normalizeRecipeTitle";
import { SEED_RECIPES_V2 } from "@suppr/shared/recipes/seedRecipesV2";
import { seedsToRecipeCards } from "@suppr/shared/recipes/seedRecipesToCard";

// F-21 (2026-04-21): when a recipe has no image_url we previously fell back to
// a single shared Unsplash salad, so every placeholder recipe looked identical
// in the Library and Plan views (TestFlight AKhHD-Uv1JWd, ABTpne3YnbHm,
// AGr4EisM3BOC). Rotate across 6 visually distinct stock photos keyed by
// recipe id so recipes without a real photo at least look like different
// recipes. Real imported images (`image_url`) still take priority.
const DEFAULT_IMAGE_POOL = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop", // green bowl
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&h=600&fit=crop", // pasta
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop", // salad
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop", // buddha bowl
  "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800&h=600&fit=crop", // sandwich
  "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&h=600&fit=crop", // breakfast
];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pickDefaultImage(id: string | number | undefined | null): string {
  const idx = id != null ? hashStr(String(id)) % DEFAULT_IMAGE_POOL.length : 0;
  return DEFAULT_IMAGE_POOL[idx];
}
const DEFAULT_AVATAR = NEUTRAL_AVATAR_DATA_URI;

/** Fetch published community recipes for the Discover feed. */
export function useDiscoverRecipes() {
  const [recipes, setRecipes] = useState<RecipeCard[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    // try/finally so loading flips false even if `await supabase`
    // throws (vs just returning `{ data: null, error }`). The error-
    // object branch below is preserved; the wrap is defence against
    // raw rejections too — see useSavedLibraryRecipes for rationale.
    try {
    // 2026-05-03 — hung PostgREST never settles → `await` never returns →
    // `finally` never runs → perpetual "Loading recipes…". Same pattern
    // as Library `useSavedLibraryRecipes`.
    const discoverRaceTimeout = Symbol("discover_fetch_timeout");
    async function raceDiscover<T>(
      p: Promise<T>,
      ms: number,
      label: string,
    ): Promise<T | typeof discoverRaceTimeout> {
      const out = await Promise.race([
        p,
        new Promise<typeof discoverRaceTimeout>((resolve) => {
          setTimeout(() => resolve(discoverRaceTimeout), ms);
        }),
      ]);
      if (out === discoverRaceTimeout) {
        console.warn(`[useDiscoverRecipes] ${label} timed out (${ms}ms)`);
      }
      return out;
    }
    const DISCOVER_QUERY_TIMEOUT_MS = 35_000;
    const DISCOVER_COUNTS_TIMEOUT_MS = 18_000;
    const DISCOVER_CACHE_READ_TIMEOUT_MS = 12_000;

    // GW-03/GW-04 fix (audit 2026-04-28): the prior `.not("author_id",
    // "is", null)` filter was a workaround for a long-resolved
    // tombstoning behaviour. After 2026-04-28 the seeder writes
    // `author_id = NULL` for platform-curated rows (per
    // `supabase/migrations/20260503112000_unpoison_seed_author_ids.sql`
    // + the patched `scripts/seed-discover-recipes.ts`). Keeping the
    // filter would now hide every seeded recipe from Discover.
    const queryOut = await raceDiscover(
      (async () =>
        await supabase
          .from("recipes")
          .select(
            "id, title, image_url, servings, calories, protein, carbs, fat, fiber_g, is_verified, created_at, author_id, creator_id, meal_type, source_url, source_name, content_origin, prep_time_min, cook_time_min, allergens, dietary_flags",
          )
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(200))(),
      DISCOVER_QUERY_TIMEOUT_MS,
      "published recipes",
    );

    if (queryOut === discoverRaceTimeout) {
      const seeds = seedsToRecipeCards(SEED_RECIPES_V2) as unknown as RecipeCard[];
      setRecipes(seeds);
      return;
    }

    const { data, error } = queryOut;

    // F-59 (2026-04-22): TestFlight build-28 AEwoLmeE / AKcZwsip /
    // AJr60qsyV ("recipes still not seeded") despite prod having 20
    // discoverable seeded rows. Root cause hypothesis: an older
    // broken build cached `[]` into AsyncStorage; cold-load paints
    // that empty cache before the network refresh completes, and
    // the "No recipes yet" empty-state flash can be what the tester
    // is screenshotting. Defence: refuse to ever cache an empty
    // result — if the network returned nothing, don't poison the
    // cache for the next session. Offline fallback remains intact
    // for the case where network genuinely fails and cache is non-
    // empty.
    if (!error && data) {
      const mapped: RecipeCard[] = data.map((r: any) => {
        const prepM = r.prep_time_min != null ? Number(r.prep_time_min) : NaN;
        const cookM = r.cook_time_min != null ? Number(r.cook_time_min) : NaN;
        const prepOk = Number.isFinite(prepM) && prepM > 0;
        const cookOk = Number.isFinite(cookM) && cookM > 0;
        return {
          id: r.id,
          // 2026-04-26 polish: legacy rows can carry ALL-CAPS titles
          // (publisher schema.org name fields). normalizeRecipeTitle is
          // a no-op for any title that already contains lowercase, so
          // mixed-case authored titles pass through untouched.
          title: normalizeRecipeTitle(r.title),
          image: r.image_url ?? pickDefaultImage(r.id),
          creatorName: r.source_name ?? "Community",
          creatorImage: DEFAULT_AVATAR,
          servings: r.servings ?? 1,
          calories: r.calories ?? 0,
          protein: r.protein ?? 0,
          carbs: r.carbs ?? 0,
          fat: r.fat ?? 0,
          fiberG: r.fiber_g ?? 0,
          isVerified: r.is_verified ?? false,
          savedCount: 0,
          saves: 0,
          isSaved: false,
          authorId: r.author_id,
          // B5-2a-followup (2026-04-27) — surface creator_id so discover
          // bylines can deeplink to /creator/[id]. Null for imports + user
          // creations (only curated `creators` table rows have an id).
          creatorId: r.creator_id ?? null,
          sourceUrl: r.source_url ?? null,
          contentOrigin: r.content_origin ?? undefined,
          sourceName: (r.source_name as string | null | undefined) ?? null,
          mealSlots: Array.isArray(r.meal_type) ? r.meal_type : r.meal_type ? [r.meal_type] : undefined,
          feedSource: "community" as const,
          prepTimeMin: prepOk ? Math.round(prepM) : null,
          cookTimeMin: cookOk ? Math.round(cookM) : null,
          prepTime: formatRecipeMinutes(prepOk ? prepM : null),
          cookTime: formatRecipeMinutes(cookOk ? cookM : null),
          // GW-02 (2026-04-28): pass `allergens` + `dietary_flags`
          // through so the Library Vegetarian filter can use them as
          // the primary signal. Both fall back to `[]` when the row
          // doesn't carry them (legacy rows).
          allergens: Array.isArray(r.allergens) ? (r.allergens as string[]) : [],
          dietaryFlags: Array.isArray(r.dietary_flags) ? (r.dietary_flags as string[]) : [],
        };
      });
      let enriched = mapped;
      try {
        const countsOut = await raceDiscover(
          fetchPublicRecipeSaveCounts(supabase, mapped.map((r) => r.id)),
          DISCOVER_COUNTS_TIMEOUT_MS,
          "public save counts",
        );
        if (countsOut !== discoverRaceTimeout) {
          const counts = countsOut;
          enriched = mapped.map((r) => {
            const n = counts.get(r.id) ?? 0;
            return { ...r, savedCount: n, saves: n };
          });
        }
      } catch (e) {
        console.warn("[useDiscoverRecipes] public save counts failed:", e);
      }
      // Audit gap #3 (Wave 4, 2026-05-02) — prepend the curated static
      // seed (`seedRecipesV2`) so Discover never feels empty at the
      // solo-tester stage. Seeds are content-curated, not algorithmic;
      // they take stable precedence ahead of any DB-sourced rows.
      // Each seed entry carries `feedSource: "catalog"` so downstream
      // UI can distinguish them from community uploads when needed.
      const seeds = seedsToRecipeCards(SEED_RECIPES_V2) as unknown as RecipeCard[];
      const merged: RecipeCard[] = [...seeds, ...enriched];
      setRecipes(merged);
      if (merged.length > 0) {
        // Persist counts too so offline / cold-cache Popular matches online (P-P2-3).
        void cacheDiscoverRecipes(merged);
      }
    } else if (error) {
      // Network failure — try offline cache. We have a deliberate
      // cache+seed fallback path below; this is an expected-degraded
      // state, not an unhandled error. Use `console.warn` so dev-mode
      // LogBox doesn't flag it as a red toast (same fix-pattern as
      // F-81 in `verifyRecipe.ts:425-433` for benign aborts).
      console.warn("[useDiscoverRecipes] DB failed, trying cache:", error.message);
      const cachedRaw = await raceDiscover(
        getCachedDiscoverRecipes(),
        DISCOVER_CACHE_READ_TIMEOUT_MS,
        "offline discover cache read",
      );
      const cached = cachedRaw === discoverRaceTimeout ? null : cachedRaw;
      const seeds = seedsToRecipeCards(SEED_RECIPES_V2) as unknown as RecipeCard[];
      if (cached && Array.isArray(cached)) {
        let list = cached as RecipeCard[];
        // If we're online enough for Supabase RPC, refresh global save counts on top of cache.
        try {
          const ids = list.map((r) => r.id).filter(Boolean);
          if (ids.length > 0) {
            const countsOut = await raceDiscover(
              fetchPublicRecipeSaveCounts(supabase, ids),
              DISCOVER_COUNTS_TIMEOUT_MS,
              "public save counts (cache path)",
            );
            if (countsOut !== discoverRaceTimeout) {
              const counts = countsOut;
              list = list.map((r) => {
                const n = counts.get(r.id) ?? r.saves ?? 0;
                return { ...r, savedCount: n, saves: n };
              });
            }
          }
        } catch (e) {
          console.warn("[useDiscoverRecipes] save counts on cache path failed:", e);
        }
        // De-dupe — cached entries may already include seeds from a
        // previous successful fetch.
        const seedIds = new Set(seeds.map((s) => s.id));
        const fromCache = list.filter((r) => !seedIds.has(r.id));
        setRecipes([...seeds, ...fromCache]);
      } else {
        // No cache available — at least show the curated seeds so the
        // user never sees an empty Discover.
        setRecipes(seeds);
      }
    }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { recipes, loading, refresh };
}

/** Free-tier save limit — must match web (src/context/appData/constants.ts). */
const FREE_SAVE_LIMIT = 10;

/** Fetch user's saved recipe IDs. */
export function useSavedRecipes(userId: string | null) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<"free" | "base" | "pro">("free");

  // Load user tier once. `lifetime_pro` (founding-cohort comp, ENG-1043) gates
  // as `pro` — normalise it here so the free-save-limit gate below treats
  // founders as Pro rather than letting the raw string fall through.
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("user_tier")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const raw = data?.user_tier;
        if (!raw) return;
        const normalised = raw === "lifetime_pro" ? "pro" : raw;
        if (normalised === "free" || normalised === "base" || normalised === "pro") {
          setUserTier(normalised);
        }
      });
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) { setSavedIds(new Set()); setLoading(false); return; }
    // try/finally so loading flips false even if supabase throws —
    // see useSavedLibraryRecipes below for the same pattern + rationale.
    try {
      const { data } = await supabase
        .from("saves")
        .select("recipe_id")
        .eq("user_id", userId);

      if (data) {
        setSavedIds(new Set(data.map((r: any) => r.recipe_id)));
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleSave = useCallback(async (recipeId: string) => {
    if (!userId) {
      console.warn("[toggleSave] no userId — user not logged in");
      return;
    }

    setSavedIds((prev) => {
      const isSaved = prev.has(recipeId);

      // Enforce free-tier save limit (matches web FREE_SAVE_LIMIT).
      if (!isSaved && userTier === "free" && prev.size >= FREE_SAVE_LIMIT) {
        Alert.alert(
          "Save limit reached",
          `Free plan is limited to ${FREE_SAVE_LIMIT} saved recipes. Upgrade to save more.`,
        );
        return prev; // no change
      }
      const next = new Set(prev);
      if (isSaved) next.delete(recipeId);
      else next.add(recipeId);

      // Fire DB operation in background (using current isSaved, not stale closure)
      (async () => {
        const { error } = isSaved
          ? await supabase.from("saves").delete().eq("user_id", userId).eq("recipe_id", recipeId)
          : await supabase.from("saves").insert({ user_id: userId, recipe_id: recipeId });

        if (error) {
          console.error("[toggleSave] failed:", error.message, "| userId:", userId, "| recipeId:", recipeId);
          // Roll back the optimistic update first so the UI stays truthful.
          setSavedIds((curr) => {
            const rollback = new Set(curr);
            if (isSaved) rollback.add(recipeId);
            else rollback.delete(recipeId);
            return rollback;
          });
          // When the RLS policy `saves_insert_own` rejects the insert
          // (see `supabase/migrations/20260426100000_saves_free_tier_cap.sql`),
          // Postgres returns code 42501 or a "row-level security" message.
          // Surface the paywall-style prompt instead of a generic failure.
          const msg = (error.message ?? "").toLowerCase();
          const code = (error as { code?: string }).code;
          if (!isSaved && (code === "42501" || msg.includes("row-level security") || msg.includes("row level security"))) {
            Alert.alert(
              "Save limit reached",
              `Free plan is limited to ${FREE_SAVE_LIMIT} saved recipes. Upgrade to save more.`,
            );
          }
        }
      })();

      return next;
    });
  }, [userId, userTier]);

  return { savedIds, loading, refresh, toggleSave, isSaved: (id: string) => savedIds.has(id) };
}

/**
 * Full recipe rows for everything in the user's library, including
 * private imports and created drafts.
 *
 * Library contents (F-7, TestFlight `AO2jdncS2GxyJaeXPPFR30M`,
 * 2026-04-18): the union of
 *   1. Explicit saves (`saves` rows) — bookmarked via the Save toggle.
 *   2. Anything authored by the user (`recipes.author_id = userId`) —
 *      imports and created drafts are "mine by nature", so they stay
 *      in Library even when unsaved. Web parity:
 *      `src/context/AppDataContext.tsx#savedRecipesForLibrary` and the
 *      shared pure composer `src/lib/recipes/composeLibraryEntries.ts`.
 *
 * Order: newest `saves.created_at` first for explicitly-saved rows,
 * followed by recipes authored by the user but not in `saves`
 * (ordered by `recipes.created_at` desc). `isSaved` on each card
 * reflects whether it's in `saves` so the bookmark icon tells the
 * truth — author-owned rows that are not in `saves` carry
 * `isSaved: false`.
 *
 * F-8 (TestFlight `AAHS7CjeXNC-mwzyLgWFuKQ`, 2026-04-18): when a save
 * references a recipe that no longer exists (orphan), the `.in("id",
 * saveIds)` lookup silently drops it — no "Unavailable" card is ever
 * rendered. We emit a single telemetry log when the drop count is
 * non-zero so we can track cleanup debt. Server-side orphan cleanup
 * happens on web (longer-lived auth); mobile observation-only.
 */
export function useSavedLibraryRecipes(userId: string | null) {
  const [recipes, setRecipes] = useState<RecipeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const recipesRef = useRef(recipes);
  recipesRef.current = recipes;

  const refresh = useCallback(async () => {
    if (!userId) {
      setRecipes([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Warm-start from the per-user cache BEFORE the network call so a slow
    // or hanging saves+recipes fetch never shows a BARE full-screen spinner
    // when we have prior data — mirrors Discover's offline-cache resilience.
    // A genuine cold first load (no cache) still shows the spinner via
    // library.tsx's `isLoading && savedRecipes.length === 0`, which is
    // correct. getCachedSavedRecipes swallows its own errors (returns null).
    const warmCache = (await getCachedSavedRecipes(userId)) as
      | RecipeCard[]
      | null;
    if (warmCache && warmCache.length > 0) {
      setRecipes(warmCache);
    }

    // ENG-1063 / F-168 — stale-while-revalidate: tab-focus refresh must not
    // block the list behind a pull-to-refresh gate when rows are already
    // on screen (warm cache or in-memory state from a prior fetch).
    const isBackgroundRefresh =
      recipesRef.current.length > 0 || Boolean(warmCache?.length);
    if (isBackgroundRefresh) {
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    // Wrap the whole fetch+hydrate path in try/finally so `loading`
    // ALWAYS flips false, even if a supabase call throws (network
    // failure, RLS denial, request abort). Without this guarantee the
    // Library tab renders a perpetual spinner whenever the network
    // hiccups — see `progress.tsx` for the same pattern.
    try {

    // Parallel fetch: saves + author-owned recipes. Either can be
    // empty independently (brand-new user with one created draft, or
    // a user who only bookmarks community recipes).
    //
    // 2026-05-03 — if either PostgREST call hangs (same class of issue
    // as Today `loadJournal`), `await` never completes and `finally`
    // never runs → Library shows a perpetual spinner. Race the batch.
    const LIBRARY_INITIAL_TIMEOUT_MS = 30_000;
    const LIBRARY_EXTRA_RECIPES_TIMEOUT_MS = 20_000;
    const libraryRaceTimeout = Symbol("library_saved_recipes_timeout");

    const initialOut = await Promise.race([
      Promise.all([
        (async () =>
          await supabase
            .from("saves")
            .select("recipe_id, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }))(),
        (async () =>
          await supabase
            .from("recipes")
            .select(
              "id, title, image_url, servings, calories, protein, carbs, fat, fiber_g, is_verified, published, author_id, creator_id, meal_type, source_url, source_name, content_origin, prep_time_min, cook_time_min, created_at, allergens, dietary_flags, author:profiles!author_id(display_name, avatar_url)",
            )
            .eq("author_id", userId)
            .order("created_at", { ascending: false }))(),
      ]),
      new Promise<typeof libraryRaceTimeout>((resolve) => {
        setTimeout(() => resolve(libraryRaceTimeout), LIBRARY_INITIAL_TIMEOUT_MS);
      }),
    ]);

    if (initialOut === libraryRaceTimeout) {
      console.warn("[useSavedLibraryRecipes] saves+recipes batch timed out");
      // Do NOT wipe to empty. Leave the cache-hydrated recipes (set at the
      // top of refresh) in place so a flaky network shows the last-known
      // library instead of an alarming blank screen. If there was no cache
      // (true cold load), `recipes` is still [] and the empty state shows,
      // which is correct. `finally` clears `loading`.
      return;
    }

    const [savesRes, authoredRes] = initialOut;

    const saves = savesRes.data ?? [];
    const authoredRows = authoredRes.data ?? [];

    if (saves.length === 0 && authoredRows.length === 0) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    const saveIds = saves.map((s: { recipe_id: string }) => s.recipe_id);
    const saveIdSet = new Set(saveIds);

    // Fetch full rows for saves that are NOT already in the author
    // list (authored recipes are fetched in full above). Avoids
    // re-fetching when a user has saved their own recipe.
    const authoredIdSet = new Set(authoredRows.map((r: any) => r.id as string));
    const extraIds = saveIds.filter((id) => !authoredIdSet.has(id));

    let savedOnlyRows: any[] = [];
    if (extraIds.length > 0) {
      const extraOut = await Promise.race([
        (async () =>
          await supabase
            .from("recipes")
            .select(
              "id, title, image_url, servings, calories, protein, carbs, fat, fiber_g, is_verified, published, author_id, creator_id, meal_type, source_url, source_name, content_origin, prep_time_min, cook_time_min, created_at, allergens, dietary_flags, author:profiles!author_id(display_name, avatar_url)",
            )
            .in("id", extraIds))(),
        new Promise<typeof libraryRaceTimeout>((resolve) => {
          setTimeout(() => resolve(libraryRaceTimeout), LIBRARY_EXTRA_RECIPES_TIMEOUT_MS);
        }),
      ]);
      if (extraOut === libraryRaceTimeout) {
        console.warn("[useSavedLibraryRecipes] extra saved recipe rows timed out");
        savedOnlyRows = [];
      } else {
        const { data: extraRows, error: recErr } = extraOut;
        if (!recErr && Array.isArray(extraRows)) {
          savedOnlyRows = extraRows;
          if (extraRows.length < extraIds.length) {
            // F-8 telemetry: orphan saves referenced a deleted recipe.
            // Silent log only — no user-facing error.
            console.info(
              "[useSavedLibraryRecipes] dropping orphan save rows:",
              extraIds.length - extraRows.length,
            );
          }
        }
      }
    }

    const rows = [...authoredRows, ...savedOnlyRows];
    if (rows.length === 0) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    const byId = new Map(
      (rows as any[]).map((r) => {
        const importAttribution = (r.source_name as string | null | undefined)?.trim() ?? "";
        const authorDisplay = (r.author?.display_name as string | null | undefined)?.trim() ?? "";
        const isOwn = r.author_id === userId;
        const creatorName =
          importAttribution || (isOwn ? "You" : authorDisplay || "Community");
        const creatorImage =
          (r.author?.avatar_url as string | null | undefined)?.trim() || DEFAULT_AVATAR;
        const prepM = r.prep_time_min != null ? Number(r.prep_time_min) : NaN;
        const cookM = r.cook_time_min != null ? Number(r.cook_time_min) : NaN;
        const prepOk = Number.isFinite(prepM) && prepM > 0;
        const cookOk = Number.isFinite(cookM) && cookM > 0;
        const card: RecipeCard = {
          id: r.id,
          // 2026-04-26 polish: render-time normalisation for legacy
          // ALL-CAPS rows. See useDiscoverRecipes() above for rationale.
          title: normalizeRecipeTitle(r.title),
          image: r.image_url ?? pickDefaultImage(r.id),
          creatorName,
          creatorImage,
          servings: r.servings ?? 1,
          calories: r.calories ?? 0,
          protein: r.protein ?? 0,
          carbs: r.carbs ?? 0,
          fat: r.fat ?? 0,
          fiberG: r.fiber_g ?? 0,
          isVerified: r.is_verified ?? false,
          isPublished: Boolean(r.published),
          savedCount: 0,
          // F-7: `isSaved` reflects `saves` membership only — author-
          // owned rows unioned in keep `false` so the bookmark icon on
          // Recipe Detail can toggle between saved/unsaved without
          // lying about state.
          isSaved: saveIdSet.has(r.id),
          authorId: r.author_id,
          // B5-2a-followup (2026-04-27) — surface creator_id so discover
          // bylines can deeplink to /creator/[id]. Null for imports + user
          // creations (only curated `creators` table rows have an id).
          creatorId: r.creator_id ?? null,
          sourceUrl: r.source_url ?? null,
          contentOrigin: r.content_origin ?? undefined,
          sourceName: (r.source_name as string | null | undefined) ?? null,
          mealSlots: Array.isArray(r.meal_type) ? r.meal_type : r.meal_type ? [r.meal_type] : undefined,
          prepTimeMin: prepOk ? Math.round(prepM) : null,
          cookTimeMin: cookOk ? Math.round(cookM) : null,
          prepTime: formatRecipeMinutes(prepOk ? prepM : null),
          cookTime: formatRecipeMinutes(cookOk ? cookM : null),
          // GW-02 (2026-04-28): see useDiscoverRecipes() above.
          allergens: Array.isArray(r.allergens) ? (r.allergens as string[]) : [],
          dietaryFlags: Array.isArray(r.dietary_flags) ? (r.dietary_flags as string[]) : [],
        };
        return [r.id as string, card] as const;
      }),
    );

    // Compose the ordered list:
    //   1. Explicit saves first, in saves.created_at order (newest first).
    //   2. Author-owned recipes not in saves, in recipes.created_at
    //      order (authoredRows already sorted desc by the query).
    const ordered: RecipeCard[] = [];
    const emitted = new Set<string>();
    for (const id of saveIds) {
      const c = byId.get(id);
      if (c && !emitted.has(id)) {
        ordered.push(c);
        emitted.add(id);
      }
    }
    for (const r of authoredRows as { id: string }[]) {
      if (emitted.has(r.id)) continue;
      const c = byId.get(r.id);
      if (c) {
        ordered.push(c);
        emitted.add(r.id);
      }
    }

    setRecipes(ordered);
    // Persist for the next warm-start. cacheSavedRecipes skips empty arrays,
    // so a genuine-empty or timed-out fetch never poisons a populated cache.
    void cacheSavedRecipes(userId, ordered);

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { recipes, loading, refreshing, refresh };
}

/** Fetch a single recipe with ingredients. */
export async function fetchRecipeDetail(recipeId: string) {
  const [recipeRes, ingredientsRes] = await Promise.all([
    supabase
      .from("recipes")
      .select("*")
      .eq("id", recipeId)
      .maybeSingle(),
    supabase
      .from("recipe_ingredients")
      .select("name, amount, unit, calories, protein, carbs, fat, is_verified, source")
      .eq("recipe_id", recipeId),
  ]);

  return {
    recipe: recipeRes.data,
    ingredients: ingredientsRes.data ?? [],
    error: recipeRes.error ?? ingredientsRes.error,
  };
}
