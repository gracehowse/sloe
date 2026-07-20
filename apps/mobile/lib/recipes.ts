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
import type { NorthStarRecipe } from "@suppr/nutrition-core/northStarSuggestion";
import { NEUTRAL_AVATAR_DATA_URI } from "@suppr/shared/ui/neutralAvatar";
import { fetchPublicRecipeSaveCounts } from "@suppr/shared/recipes/fetchPublicRecipeSaveCounts";
import { normalizeRecipeTitle } from "@suppr/shared/recipes/normalizeRecipeTitle";
import {
  SEED_RECIPES_V2,
  isRetiredDiscoverSeedCard,
} from "@suppr/shared/recipes/seedRecipesV2";
import { seedsToRecipeCards } from "@suppr/shared/recipes/seedRecipesToCard";
import {
  isRetiredStockImageUrl,
  pickHeroImageUrl,
} from "@suppr/shared/recipes/heroImageFallback";
import { isDiscoverReadyRecipeCard } from "@suppr/shared/recipes/discoverRecipeReadiness";
import {
  addRecipeToCollection as addRecipeToCollectionShared,
  createRecipeCollection as createRecipeCollectionShared,
  deleteRecipeCollection as deleteRecipeCollectionShared,
  fetchCollectionMembership,
  fetchRecipeCollections,
  removeRecipeFromCollection as removeRecipeFromCollectionShared,
  renameRecipeCollection as renameRecipeCollectionShared,
  type RecipeCollection,
} from "@suppr/shared/recipes/recipeCollections";
import { fetchAllUserSaves } from "@suppr/shared/recipes/fetchAllUserSaves";
import { looksLikeMissingTableError } from "./supabaseErrors";
import {
  fetchMaterialisedSeedMap,
  isUuid,
  materialiseSeedRecipeById,
} from "@suppr/shared/recipes/materialiseSeedRecipe";
import { IMPORT_ERROR_COPY } from "@suppr/shared/recipes/importErrorCopy";

// ENG-1287 (2026-07-01, launch-blocker): the old F-21 fallback rotated a
// 6-photo Unsplash pool keyed by recipe id, presenting someone else's dish
// as the recipe's real photo ("Protein banana bread" rendered a stir-fry).
// A recipe with no image now stays `image: null` end-to-end and every card
// surface renders the deterministic `RecipeHeroFallback` (cuisine-tinted
// gradient + glyph, §11.4) instead. Web parity: `src/context/AppDataContext.tsx`.
const DEFAULT_AVATAR = NEUTRAL_AVATAR_DATA_URI;

const DISCOVER_SEED_CARDS = (
  seedsToRecipeCards(SEED_RECIPES_V2) as unknown as RecipeCard[]
).filter(isDiscoverReadyRecipeCard);

/**
 * Pre-ENG-1287 offline caches stored the fabricated pool URLs baked into
 * `RecipeCard.image`. Strip them on read so a stale cache can't keep
 * lying after the fabrication removal.
 */
function sanitizeCachedCardImages(cards: RecipeCard[]): RecipeCard[] {
  return cards.map((c) =>
    isRetiredStockImageUrl(c.image) ? { ...c, image: null } : c,
  );
}

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

    // Keep unauthored rows in the query because creator/community content can
    // legitimately be unauthored. After mapping,
    // `isRetiredDiscoverSeedCard` removes only superseded platform-catalogue
    // rows; the current approved catalogue is always prepended from the shared
    // static Sloe Kitchen source of truth.
    const queryOut = await raceDiscover(
      (async () =>
        await supabase
          .from("recipes")
          .select(
            "id, title, image_url, image_source, servings, calories, protein, carbs, fat, fiber_g, is_verified, created_at, author_id, creator_id, meal_type, source_url, source_name, content_origin, prep_time_min, cook_time_min, allergens, dietary_flags",
          )
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(200))(),
      DISCOVER_QUERY_TIMEOUT_MS,
      "published recipes",
    );

    if (queryOut === discoverRaceTimeout) {
      setRecipes(DISCOVER_SEED_CARDS);
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
          image: pickHeroImageUrl({
            image_url: r.image_url ?? null,
            image_source: r.image_source ?? null,
            source_url: r.source_url ?? null,
          }) ?? null, // ENG-1287 — no image stays null (RecipeHeroFallback renders)
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
      }).filter(
        (card: RecipeCard) =>
          !isRetiredDiscoverSeedCard(card) && isDiscoverReadyRecipeCard(card),
      );
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
      const merged: RecipeCard[] = [...DISCOVER_SEED_CARDS, ...enriched];
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
      if (cached && Array.isArray(cached)) {
        let list = sanitizeCachedCardImages(cached as RecipeCard[]).filter(
          (card) =>
            !isRetiredDiscoverSeedCard(card) && isDiscoverReadyRecipeCard(card),
        );
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
        // De-dupe current seeds after the retirement guard above has removed
        // cached entries from older catalogues.
        const seedIds = new Set(DISCOVER_SEED_CARDS.map((s) => s.id));
        const fromCache = list.filter((r) => !seedIds.has(r.id));
        setRecipes([...DISCOVER_SEED_CARDS, ...fromCache]);
      } else {
        // No cache available — at least show the curated seeds so the
        // user never sees an empty Discover.
        setRecipes(DISCOVER_SEED_CARDS);
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
  // ENG-1467 — copy-on-save: Discover seed recipes have slug ids
  // (`seed-v2-...`), not UUIDs, so they can never appear directly in
  // `savedIds` (which mirrors the `saves` table's real `recipe_id` uuid
  // column). This map remembers, per signed-in session, which seed id
  // resolves to which materialised `recipes` row, so `isSaved(seedId)`
  // and `toggleSave(seedId)` both read/write through the real id
  // transparently. Rebuilt from the DB on every `refresh()` via
  // `fetchMaterialisedSeedMap` so it survives remounts.
  const seedSaveMapRef = useRef<Record<string, string>>({});

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
    if (!userId) { setSavedIds(new Set()); seedSaveMapRef.current = {}; setLoading(false); return; }
    // try/finally so loading flips false even if supabase throws —
    // see useSavedLibraryRecipes below for the same pattern + rationale.
    try {
      const [{ rows }, seedMap] = await Promise.all([
        fetchAllUserSaves(supabase, userId),
        fetchMaterialisedSeedMap(supabase, userId),
      ]);
      seedSaveMapRef.current = seedMap;
      const rowIds = new Set(rows.map((r) => r.recipe_id));
      // Surface a seed as "saved" via its ORIGINAL slug id too, so
      // Discover cards (which only know the slug id) render the saved
      // state correctly.
      for (const [seedId, materialisedId] of Object.entries(seedMap)) {
        if (rowIds.has(materialisedId)) rowIds.add(seedId);
      }
      setSavedIds(rowIds);
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

    const wasSaved = savedIds.has(recipeId);

    // Enforce free-tier save limit (matches web FREE_SAVE_LIMIT).
    if (!wasSaved && userTier === "free" && savedIds.size >= FREE_SAVE_LIMIT) {
      Alert.alert(
        "Save limit reached",
        `Free plan is limited to ${FREE_SAVE_LIMIT} saved recipes. Upgrade to save more.`,
      );
      return;
    }

    // Optimistic update, keyed on the id the caller/UI actually knows
    // (the seed's slug id, when this is a catalogue recipe).
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });

    const rollback = () => {
      setSavedIds((curr) => {
        const r = new Set(curr);
        if (wasSaved) r.add(recipeId);
        else r.delete(recipeId);
        return r;
      });
    };

    // ENG-1467 — copy-on-save. A non-UUID id means this is a Discover
    // seed (or any future non-DB catalogue entry); resolve/materialise
    // its real `recipes` row before touching `saves`, whose
    // `recipe_id` column is a uuid FK.
    let dbRecipeId = recipeId;
    if (!isUuid(recipeId)) {
      if (wasSaved) {
        // Unsaving a seed: use the id already recorded from the save.
        const mapped = seedSaveMapRef.current[recipeId];
        if (!mapped) {
          // Nothing to unsave server-side (e.g. optimistic-only state
          // from a save that failed silently pre-fix); the local
          // removal above is enough.
          return;
        }
        dbRecipeId = mapped;
      } else {
        const result = await materialiseSeedRecipeById(supabase, userId, recipeId);
        if (!result.ok) {
          console.error("[toggleSave] seed materialise failed:", result.error, "| recipeId:", recipeId);
          rollback();
          Alert.alert("Couldn't save recipe", result.error);
          return;
        }
        dbRecipeId = result.recipeId;
        seedSaveMapRef.current = { ...seedSaveMapRef.current, [recipeId]: dbRecipeId };
      }
    }

    const { error } = wasSaved
      ? await supabase.from("saves").delete().eq("user_id", userId).eq("recipe_id", dbRecipeId)
      : await supabase.from("saves").insert({ user_id: userId, recipe_id: dbRecipeId });

    if (error) {
      console.error("[toggleSave] failed:", error.message, "| userId:", userId, "| recipeId:", recipeId);
      rollback();
      // When the RLS policy `saves_insert_own` rejects the insert
      // (see `supabase/migrations/20260426100000_saves_free_tier_cap.sql`),
      // Postgres returns code 42501 or a "row-level security" message.
      // Surface the paywall-style prompt instead of a generic failure.
      const msg = (error.message ?? "").toLowerCase();
      const code = (error as { code?: string }).code;
      if (!wasSaved && (code === "42501" || msg.includes("row-level security") || msg.includes("row level security"))) {
        Alert.alert(
          "Save limit reached",
          `Free plan is limited to ${FREE_SAVE_LIMIT} saved recipes. Upgrade to save more.`,
        );
      } else {
        // ENG-1467 — no-silent-failures: this used to be console-only.
        Alert.alert("Couldn't save recipe", IMPORT_ERROR_COPY.save_failed);
      }
    }
  }, [userId, userTier, savedIds]);

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
      setRecipes(sanitizeCachedCardImages(warmCache));
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
        (async () => {
          // ENG-1413 — page to exhaustion (see fetchAllSaves) rather than
          // one unbounded fetch; sort by created_at after all pages land
          // since the fixed display order below still assumes newest-first.
          const { rows, error } = await fetchAllUserSaves(supabase, userId);
          rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
          return { data: error ? null : rows, error };
        })(),
        (async () =>
          await supabase
            .from("recipes")
            .select(
              "id, title, image_url, image_source, servings, calories, protein, carbs, fat, fiber_g, is_verified, published, author_id, creator_id, meal_type, source_url, source_name, content_origin, prep_time_min, cook_time_min, created_at, allergens, dietary_flags, author:profiles!author_id(display_name, avatar_url)",
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
              "id, title, image_url, image_source, servings, calories, protein, carbs, fat, fiber_g, is_verified, published, author_id, creator_id, meal_type, source_url, source_name, content_origin, prep_time_min, cook_time_min, created_at, allergens, dietary_flags, author:profiles!author_id(display_name, avatar_url)",
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
          image: pickHeroImageUrl({
            image_url: r.image_url ?? null,
            image_source: r.image_source ?? null,
            source_url: r.source_url ?? null,
          }) ?? null, // ENG-1287 — no image stays null (RecipeHeroFallback renders)
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

/**
 * Maps `useSavedLibraryRecipes` output to the shape
 * `<NorthStarBlockHost>`'s `savedRecipesForLibrary` prop needs. Extracted
 * from `TodayScreen.tsx` (screen-budget pin) so the mapping lives next to
 * the hook that produces its input. ENG-1417 — threads `isVerified`
 * through so the north-star card can render the "~" unverified-estimate
 * qualifier. Web mirror: the `savedRecipesForLibrary as NorthStarRecipe[]`
 * cast in `AppDataContext.tsx` (web's `RecipeCard.isVerified` already
 * flows through that cast; mobile constructs the shape explicitly here).
 */
export function toNorthStarLibrary(recipes: RecipeCard[]): NorthStarRecipe[] {
  return recipes.map((r) => ({
    id: r.id,
    title: r.title,
    calories: r.calories ?? 0,
    protein: r.protein ?? 0,
    carbs: r.carbs ?? 0,
    fat: r.fat ?? 0,
    thumbnail: r.image,
    mealType: r.mealSlots,
    cookTimeMin: r.cookTimeMin ?? undefined,
    isVerified: r.isVerified,
  }));
}

/**
 * Head-only count of the user's `saves` rows — a single `head: true` COUNT
 * query that returns no rows. The cheap alternative to `useSavedLibraryRecipes`
 * for surfaces that only need "how many saved" (ENG-1246 review fix M2: the
 * Profile kill-switch path). Pass a null `userId` (or the flag-off gate result)
 * to skip the query and report 0. Re-runs whenever `userId` changes; the caller
 * decides focus behaviour. Non-fatal on error — reports 0.
 */
export function useSavesHeadCount(userId: string | null): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    void supabase
      .from("saves")
      .select("recipe_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .then(({ count: n }) => {
        if (!cancelled) setCount(n ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return count;
}

/**
 * ENG-1126 — user-created recipe collections. Calls the SAME shared CRUD
 * functions as web's `useRecipeCollectionsState` (`@suppr/shared/recipes/
 * recipeCollections`, path-mapped to `src/lib/recipes/recipeCollections.ts`)
 * so there is exactly one implementation of the query logic, not two
 * hand-mirrored ones. Degrades silently (no blocking `Alert`) if the
 * migration hasn't landed on this environment's DB yet — matches
 * `looksLikeMissingTableError`'s existing "sync disabled, don't interrupt"
 * convention (see `TodayScreen.tsx`'s journal fallback). CRUD failures
 * during an explicit user action DO surface via `Alert.alert`, matching
 * the existing mobile error-surface convention for this class of write.
 */
export function useRecipeCollections(userId: string | null) {
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [membership, setMembership] = useState<Record<string, string[]>>({});
  const [enabled, setEnabled] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [cols, mem] = await Promise.all([
      fetchRecipeCollections(supabase),
      fetchCollectionMembership(supabase),
    ]);
    setCollections(cols);
    setMembership(mem);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setCollections([]);
      setMembership({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { error } = await supabase.from("recipe_collections").select("id").limit(1);
      if (cancelled) return;
      if (error) {
        if (looksLikeMissingTableError(error.message ?? "")) setEnabled(false);
        return;
      }
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const createCollection = useCallback(
    async (name: string): Promise<boolean> => {
      if (!userId) return false;
      const result = await createRecipeCollectionShared(supabase, userId, name);
      if ("error" in result) {
        Alert.alert("Couldn't create collection", result.error);
        return false;
      }
      setCollections((prev) => [...prev, result.collection]);
      return true;
    },
    [userId],
  );

  const renameCollection = useCallback(async (collectionId: string, name: string): Promise<boolean> => {
    const result = await renameRecipeCollectionShared(supabase, collectionId, name);
    if ("error" in result) {
      Alert.alert("Couldn't rename collection", result.error);
      return false;
    }
    setCollections((prev) => prev.map((c) => (c.id === collectionId ? { ...c, name: name.trim() } : c)));
    return true;
  }, []);

  const deleteCollection = useCallback(async (collectionId: string): Promise<boolean> => {
    const result = await deleteRecipeCollectionShared(supabase, collectionId);
    if ("error" in result) {
      Alert.alert("Couldn't delete collection", result.error);
      return false;
    }
    setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    setMembership((prev) => {
      const next: Record<string, string[]> = {};
      for (const [recipeId, ids] of Object.entries(prev)) {
        const filtered = ids.filter((id) => id !== collectionId);
        if (filtered.length > 0) next[recipeId] = filtered;
      }
      return next;
    });
    return true;
  }, []);

  const addRecipeToCollection = useCallback(async (collectionId: string, recipeId: string): Promise<boolean> => {
    setMembership((prev) => {
      const existing = prev[recipeId] ?? [];
      if (existing.includes(collectionId)) return prev;
      return { ...prev, [recipeId]: [...existing, collectionId] };
    });
    const result = await addRecipeToCollectionShared(supabase, collectionId, recipeId);
    if ("error" in result) {
      Alert.alert("Couldn't add to collection", result.error);
      setMembership((prev) => ({
        ...prev,
        [recipeId]: (prev[recipeId] ?? []).filter((id) => id !== collectionId),
      }));
      return false;
    }
    return true;
  }, []);

  const removeRecipeFromCollection = useCallback(
    async (collectionId: string, recipeId: string): Promise<boolean> => {
      const previousIds = membership[recipeId] ?? [];
      setMembership((prev) => ({
        ...prev,
        [recipeId]: (prev[recipeId] ?? []).filter((id) => id !== collectionId),
      }));
      const result = await removeRecipeFromCollectionShared(supabase, collectionId, recipeId);
      if ("error" in result) {
        Alert.alert("Couldn't remove from collection", result.error);
        setMembership((prev) => ({ ...prev, [recipeId]: previousIds }));
        return false;
      }
      return true;
    },
    [membership],
  );

  return {
    collections,
    membership,
    enabled,
    createCollection,
    renameCollection,
    deleteCollection,
    addRecipeToCollection,
    removeRecipeFromCollection,
  };
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
