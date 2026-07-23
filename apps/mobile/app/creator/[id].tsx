/**
 * B5 Phase 2a (2026-04-27) — Creator profile page (mobile).
 *
 * Spec: docs/specs/2026-04-27-b5-discover-phase2.md
 *
 * Lands at `/creator/[id]` via Expo Router. Read-only profile + recipe
 * grid. Tapping a creator byline anywhere on Discover or Recipe Detail
 * routes here. Web parallel ships at app/creator/[id]/page.tsx.
 *
 * Data sources:
 *   - `creators` table (existing): display_name, handle, avatar_url, bio, is_verified.
 *   - `recipes.creator_id` (existing): published recipes by this creator.
 *   - `follows` table (existing): user_id → creator_id; powers the
 *     follow toggle + follower count.
 *
 * No migration required. The 5 columns above already exist in production.
 *
 * Phase 2a deliberately ships:
 *   - Header (avatar, display name, handle, bio, verified tick).
 *   - Follower count + Follow / Following toggle (optimistic update).
 *   - Recipe list (newest-first, paginated — see ENG-748 #14 below).
 *   - Honest empty state when the creator has no published recipes.
 *
 * ENG-748 #14 (2026-05-27) — pagination. The list used to hard-cap at
 * 50 (`.limit(50)`), so creators with >50 published recipes had older
 * ones silently invisible. We now fetch the first `RECIPES_PAGE_SIZE`
 * on mount and append further pages via the same public query on a
 * "Load more" button. The follower/recipe stat shows the TRUE total
 * count (a separate `head: true` count), decoupled from how many rows
 * are currently loaded. Web parallel: app/creator/[id]/page.tsx +
 * src/app/components/creator/CreatorRecipeList.tsx (same page size,
 * same newest-first ordering, same "Load more" affordance).
 *
 * Phase 2a deliberately does NOT ship (queued for 2.5/2.b):
 *   - Sort toggle (recent vs popular). Default sort is recent.
 *   - Stats row (recipes count, total saves, joined date) — pending the
 *     SECURITY-DEFINER aggregate RPC.
 *   - Recipe-card popularity ribbon. Phase 2b alongside the filter sheet.
 *
 * Pressable chrome extracted to `CreatorProfileParts` (ENG-1565).
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Spacing } from "@/constants/theme";
import {
  mergeRecipePage,
  nextPageRange,
  pageHasMore,
} from "@suppr/shared/recipes/creatorRecipePagination";
import { decodeEntities } from "@/lib/decodeEntities";
import {
  CreatorBackButton,
  CreatorFollowButton,
  CreatorLoadMoreButton,
  CreatorRecipeRow,
  CreatorVerifiedIcon,
  useCreatorProfileStyles,
  type CreatorProfileRecipeRow,
} from "@/components/creator/CreatorProfileParts";

type Creator = {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
};

export default function CreatorProfileScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const creatorId = typeof params.id === "string" ? params.id : null;
  const styles = useCreatorProfileStyles();

  const [creator, setCreator] = useState<Creator | null>(null);
  const [recipes, setRecipes] = useState<CreatorProfileRecipeRow[]>([]);
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [loadMoreError, setLoadMoreError] = useState<boolean>(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
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
        setCreator(creatorRes.data as Creator);

        if (!recipesRes.error && Array.isArray(recipesRes.data)) {
          const firstPage = recipesRes.data as CreatorProfileRecipeRow[];
          setRecipes(firstPage);
          setHasMore(pageHasMore(firstPage.length));
        }
        if (!recipeCountRes.error) {
          setRecipeCount(recipeCountRes.count ?? null);
        }
        if (!followCountRes.error) {
          setFollowerCount(followCountRes.count ?? 0);
        }
        if (!followStateRes.error) {
          setIsFollowing(Boolean(followStateRes.data));
        }
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
    } catch (_e) {
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
      const page = (data ?? []) as CreatorProfileRecipeRow[];
      setRecipes((prev) => mergeRecipePage(prev, page));
      setHasMore(pageHasMore(page.length));
    } catch (_e) {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [creatorId, loadingMore, hasMore, recipes.length]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        <CreatorBackButton onPress={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.text} />
        </View>
      </View>
    );
  }

  if (loadError || !creator) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        <CreatorBackButton onPress={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Creator not available</Text>
          <Text style={styles.emptyBody}>
            This profile may have been removed or is not yet published.
          </Text>
        </View>
      </View>
    );
  }

  const followerLabel = followerCount === 1 ? "follower" : "followers";
  const isSelf = authedUserId === creator.id;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.sm,
        paddingBottom: insets.bottom + Spacing.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <CreatorBackButton onPress={() => router.back()} />

      <View style={styles.header}>
        {creator.avatar_url ? (
          <Image
            source={{ uri: creator.avatar_url }}
            style={styles.avatar}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>
              {creator.display_name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerNameRow}>
          <Text style={styles.displayName}>{decodeEntities(creator.display_name)}</Text>
          {creator.is_verified ? <CreatorVerifiedIcon /> : null}
        </View>
        <Text style={styles.handle}>@{creator.handle}</Text>
        {creator.bio ? <Text style={styles.bio}>{decodeEntities(creator.bio)}</Text> : null}

        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            <Text style={styles.statNumber}>{followerCount ?? "—"}</Text> {followerLabel}
          </Text>
          <Text style={styles.statDivider}> · </Text>
          <Text style={styles.statText}>
            <Text style={styles.statNumber}>{recipeCount ?? recipes.length}</Text> recipe
            {(recipeCount ?? recipes.length) === 1 ? "" : "s"}
          </Text>
        </View>

        {!isSelf && authedUserId ? (
          <CreatorFollowButton
            isFollowing={isFollowing}
            followBusy={followBusy}
            onPress={() => void onToggleFollow()}
          />
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>Recipes</Text>
      {recipes.length === 0 ? (
        <View style={styles.emptyRecipes}>
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptyBody}>
            When {decodeEntities(creator.display_name)} publishes a recipe it&apos;ll appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.recipesList}>
          {recipes.map((r, idx) => (
            <CreatorRecipeRow
              key={r.id}
              recipe={r}
              isFirst={idx === 0}
              onPress={() => router.push(`/recipe/${r.id}`)}
            />
          ))}
        </View>
      )}

      {recipes.length > 0 && hasMore ? (
        <CreatorLoadMoreButton
          loadingMore={loadingMore}
          loadMoreError={loadMoreError}
          onPress={() => void onLoadMore()}
        />
      ) : null}
    </ScrollView>
  );
}
