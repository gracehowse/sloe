import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  mergeRecipePage,
  nextPageRange,
  pageHasMore,
} from "@suppr/shared/recipes/creatorRecipePagination";

export type CreatorProfileModel = {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
};

export type CreatorRecipeRow = {
  id: string;
  title: string;
  image_url: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  cook_time_min: number | null;
  prep_time_min: number | null;
};

export function useCreatorProfile(creatorId: string | null) {
  const [creator, setCreator] = useState<CreatorProfileModel | null>(null);
  const [recipes, setRecipes] = useState<CreatorRecipeRow[]>([]);
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!creatorId) {
      setLoadError("missing_id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sessionRes = await supabase.auth.getSession();
        const uid = sessionRes.data.session?.user.id ?? null;
        if (cancelled) return;
        setAuthedUserId(uid);

        const [creatorRes, recipesRes, recipeCountRes, followCountRes, followStateRes] =
          await Promise.all([
            supabase
              .from("creators")
              .select("id, display_name, handle, avatar_url, bio, is_verified")
              .eq("id", creatorId)
              .maybeSingle(),
            supabase
              .from("recipes")
              .select(
                "id, title, image_url, calories, protein, carbs, cook_time_min, prep_time_min",
              )
              .eq("creator_id", creatorId)
              .eq("published", true)
              .order("created_at", { ascending: false })
              .range(...nextPageRange(0)),
            supabase
              .from("recipes")
              .select("id", { count: "exact", head: true })
              .eq("creator_id", creatorId)
              .eq("published", true),
            supabase
              .from("follows")
              .select("user_id", { count: "exact", head: true })
              .eq("creator_id", creatorId),
            uid
              ? supabase
                  .from("follows")
                  .select("user_id")
                  .eq("creator_id", creatorId)
                  .eq("user_id", uid)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null } as const),
          ]);

        if (cancelled) return;

        if (creatorRes.error || !creatorRes.data) {
          setLoadError(creatorRes.error?.message ?? "not_found");
          setLoading(false);
          return;
        }
        setCreator(creatorRes.data as CreatorProfileModel);

        if (!recipesRes.error && Array.isArray(recipesRes.data)) {
          const firstPage = recipesRes.data as CreatorRecipeRow[];
          setRecipes(firstPage);
          setHasMore(pageHasMore(firstPage.length));
        }
        if (!recipeCountRes.error) setRecipeCount(recipeCountRes.count ?? null);
        if (!followCountRes.error) setFollowerCount(followCountRes.count ?? 0);
        if (!followStateRes.error) setIsFollowing(Boolean(followStateRes.data));
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "unknown");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const onToggleFollow = useCallback(async () => {
    if (!creatorId || !authedUserId || followBusy) return;
    setFollowBusy(true);
    const wasFollowing = isFollowing;
    const optimisticCount = (followerCount ?? 0) + (wasFollowing ? -1 : 1);
    setIsFollowing(!wasFollowing);
    setFollowerCount(optimisticCount);
    try {
      if (wasFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("creator_id", creatorId)
          .eq("user_id", authedUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .upsert(
            { creator_id: creatorId, user_id: authedUserId },
            { onConflict: "creator_id,user_id" },
          );
        if (error) throw error;
      }
    } catch {
      setIsFollowing(wasFollowing);
      setFollowerCount(followerCount ?? 0);
    } finally {
      setFollowBusy(false);
    }
  }, [creatorId, authedUserId, followBusy, isFollowing, followerCount]);

  const onLoadMore = useCallback(async () => {
    if (!creatorId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    const [from, to] = nextPageRange(recipes.length);
    try {
      const { data, error } = await supabase
        .from("recipes")
        .select(
          "id, title, image_url, calories, protein, carbs, cook_time_min, prep_time_min",
        )
        .eq("creator_id", creatorId)
        .eq("published", true)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      const page = (data ?? []) as CreatorRecipeRow[];
      setRecipes((prev) => mergeRecipePage(prev, page));
      setHasMore(pageHasMore(page.length));
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [creatorId, loadingMore, hasMore, recipes.length]);

  return {
    creator,
    recipes,
    recipeCount,
    hasMore,
    followerCount,
    loading,
    loadError,
    loadingMore,
    loadMoreError,
    isFollowing,
    followBusy,
    authedUserId,
    onToggleFollow,
    onLoadMore,
  };
}
