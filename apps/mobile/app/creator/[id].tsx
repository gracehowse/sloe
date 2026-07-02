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
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMacro, formatKcalDisplay } from "@suppr/nutrition-core/formatMacro";

import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Spacing, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { normalizeRecipeTitle } from "@suppr/shared/recipes/normalizeRecipeTitle";
import {
  mergeRecipePage,
  nextPageRange,
  pageHasMore,
} from "@suppr/shared/recipes/creatorRecipePagination";
import { decodeEntities } from "@/lib/decodeEntities";

type Creator = {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
};

type CreatorRecipeRow = {
  id: string;
  title: string;
  image_url: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  cook_time_min: number | null;
  prep_time_min: number | null;
};

export default function CreatorProfileScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the verified/follow
  // affordance + the primary CTAs. Threaded into the module-level StyleSheet
  // factory.
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const creatorId = typeof params.id === "string" ? params.id : null;

  const [creator, setCreator] = useState<Creator | null>(null);
  const [recipes, setRecipes] = useState<CreatorRecipeRow[]>([]);
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

  // Initial fetch — creator row + recipe list + follow state in
  // parallel. Errors land on `loadError` rather than crashing; the
  // empty-state branch covers the not-found case ("This creator's
  // profile is no longer available.").
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
            // ENG-748 #14: first page only — the rest loads on "Load more".
            supabase
              .from("recipes")
              .select(
                "id, title, image_url, calories, protein, carbs, cook_time_min, prep_time_min",
              )
              .eq("creator_id", creatorId)
              .eq("published", true)
              .order("created_at", { ascending: false })
              .range(...nextPageRange(0)),
            // ENG-748 #14: true total published-recipe count for the stat
            // row, decoupled from how many rows are currently loaded.
            supabase
              .from("recipes")
              .select("id", { count: "exact", head: true })
              .eq("creator_id", creatorId)
              .eq("published", true),
            // SECURITY DEFINER follower count is the eventual goal; for
            // Phase 2a we count rows directly. The count query is
            // O(followers); fine until any creator hits ~10k.
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
          const firstPage = recipesRes.data as CreatorRecipeRow[];
          setRecipes(firstPage);
          // First page came back full → there may be more to load.
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

  // Optimistic follow toggle. Reverts on error so the UI never lies.
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
      // Roll back the optimistic update so the UI matches the DB truth.
      setIsFollowing(wasFollowing);
      setFollowerCount(followerCount ?? 0);
    } finally {
      setFollowBusy(false);
    }
  }, [creatorId, authedUserId, followBusy, isFollowing, followerCount]);

  // ENG-748 #14: append the next page of recipes. Same public query as
  // the initial fetch, offset by how many rows are already loaded.
  // De-dupes by id so a recipe published since first paint can't render
  // twice. On error we keep `hasMore` true and surface a retry line —
  // never silently drop the tap.
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
    } catch (_e) {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [creatorId, loadingMore, hasMore, recipes.length]);

  const styles = useMemo(() => buildStyles(colors, accent), [colors, accent]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.text} />
        </View>
      </View>
    );
  }

  if (loadError || !creator) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
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
      contentContainerStyle={{ paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      {/* Header — avatar, name, handle, bio, follower count, follow CTA. */}
      <View style={styles.header}>
        {creator.avatar_url ? (
          <Image source={{ uri: creator.avatar_url }} style={styles.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>
              {creator.display_name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerNameRow}>
          <Text style={styles.displayName}>{decodeEntities(creator.display_name)}</Text>
          {creator.is_verified ? (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={accent.primary}
              accessibilityLabel="Verified creator"
            />
          ) : null}
        </View>
        <Text style={styles.handle}>@{creator.handle}</Text>
        {creator.bio ? <Text style={styles.bio}>{decodeEntities(creator.bio)}</Text> : null}

        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            <Text style={styles.statNumber}>{followerCount ?? "—"}</Text>{" "}
            {followerLabel}
          </Text>
          <Text style={styles.statDivider}> · </Text>
          <Text style={styles.statText}>
            <Text style={styles.statNumber}>{recipeCount ?? recipes.length}</Text> recipe{(recipeCount ?? recipes.length) === 1 ? "" : "s"}
          </Text>
        </View>

        {!isSelf && authedUserId ? (
          <Pressable
            onPress={onToggleFollow}
            disabled={followBusy}
            style={[styles.followBtn, isFollowing ? styles.followBtnFollowing : styles.followBtnFollow]}
            accessibilityRole="button"
            accessibilityLabel={isFollowing ? "Unfollow creator" : "Follow creator"}
          >
            <Text
              style={[
                styles.followText,
                isFollowing ? styles.followTextFollowing : styles.followTextFollow,
              ]}
            >
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Recipe list — newest first. */}
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
            <Pressable
              key={r.id}
              onPress={() => router.push(`/recipe/${r.id}`)}
              style={[
                styles.recipeRow,
                { borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.cardBorder },
              ]}
            >
              {r.image_url ? (
                <Image
                  source={{ uri: r.image_url }}
                  style={styles.recipeThumb}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={[styles.recipeThumb, styles.recipeThumbFallback]}>
                  <Ionicons name="restaurant-outline" size={20} color={colors.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeTitle} numberOfLines={2}>
                  {normalizeRecipeTitle(decodeEntities(r.title))}
                </Text>
                <Text style={styles.recipeMeta} numberOfLines={1}>
                  {formatKcalDisplay(r.calories ?? 0)} kcal
                  {r.protein != null ? ` · ${formatMacro(r.protein, "protein", "g")} protein` : ""}
                  {r.cook_time_min ? ` · ${r.cook_time_min} min` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      )}

      {/* ENG-748 #14 — Load more. Only rendered when the creator has more
          published recipes than are currently loaded. */}
      {recipes.length > 0 && hasMore ? (
        <View style={styles.loadMoreWrap}>
          <Pressable
            onPress={onLoadMore}
            disabled={loadingMore}
            style={[styles.loadMoreBtn, loadingMore ? styles.loadMoreBtnBusy : null]}
            accessibilityRole="button"
            accessibilityLabel="Load more recipes"
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.loadMoreText}>Load more</Text>
            )}
          </Pressable>
          {loadMoreError ? (
            <Text style={styles.loadMoreError}>
              Couldn&apos;t load more recipes. Tap to try again.
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function buildStyles(
  colors: ReturnType<typeof useThemeColors>,
  accent: ReturnType<typeof useAccent>,
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.md,
    },
    backHit: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.xl,
    },
    header: {
      alignItems: "center",
      paddingVertical: Spacing.lg,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.cardBorder,
      marginBottom: Spacing.sm,
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: accent.primary,
    },
    avatarFallbackText: {
      color: colors.primaryForeground,
      fontSize: 36,
      fontWeight: "700",
    },
    headerNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    displayName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700",
    },
    handle: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 2,
    },
    bio: {
      color: colors.text,
      fontSize: 14,
      textAlign: "center",
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      lineHeight: 20,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginTop: Spacing.md,
    },
    statText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    statNumber: {
      color: colors.text,
      fontWeight: "700",
    },
    statDivider: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    followBtn: {
      marginTop: Spacing.md,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 999,
      minWidth: 140,
      alignItems: "center",
    },
    followBtnFollow: {
      backgroundColor: accent.primary,
    },
    followBtnFollowing: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    followText: {
      fontSize: 14,
      fontWeight: "600",
    },
    followTextFollow: {
      color: colors.primaryForeground,
    },
    followTextFollowing: {
      color: colors.text,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.xs,
    },
    recipesList: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: "hidden",
    },
    recipeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      padding: Spacing.sm,
    },
    recipeThumb: {
      width: 56,
      height: 56,
      borderRadius: Radius.md,
      backgroundColor: colors.background,
    },
    recipeThumbFallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    recipeTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    recipeMeta: {
      color: colors.textSecondary,
      ...Type.captionSmall,
      marginTop: 2,
    },
    emptyRecipes: {
      paddingVertical: Spacing.xl,
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    emptyBody: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: "center",
      marginTop: Spacing.xs,
      lineHeight: 18,
    },
    loadMoreWrap: {
      alignItems: "center",
      marginTop: Spacing.md,
      gap: Spacing.xs,
    },
    loadMoreBtn: {
      minWidth: 140,
      minHeight: 42,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    loadMoreBtnBusy: {
      opacity: 0.6,
    },
    loadMoreText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    loadMoreError: {
      color: colors.textSecondary,
      ...Type.captionSmall,
      textAlign: "center",
    },
  });
}
