/**
 * B5 Phase 2a (2026-04-27) — Creator profile page (mobile).
 * Web parallel: app/creator/[id]/page.tsx
 */

import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMacro, formatKcalDisplay } from "@suppr/nutrition-core/formatMacro";

import { CreatorGoPublicPromo } from "@/components/creator/CreatorGoPublicPromo";
import { CreatorProfileHeader } from "@/components/creator/CreatorProfileHeader";
import { CreatorRecipeGrid } from "@/components/creator/CreatorRecipeGrid";
import { CreatorStatsCard } from "@/components/creator/CreatorStatsCard";
import { useCreatorProfile } from "@/components/creator/useCreatorProfile";
import { PressableScale } from "@/components/ui/PressableScale";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { Spacing, Radius, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import { normalizeRecipeTitle } from "@suppr/shared/recipes/normalizeRecipeTitle";
import { formatTotalRecipeDuration } from "@suppr/shared/recipes/totalDuration";
import { decodeEntities } from "@/lib/decodeEntities";

export default function CreatorProfileScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const creatorId = typeof params.id === "string" ? params.id : null;
  const v3Profile = isFeatureEnabled("creator_profile_v3");

  const {
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
  } = useCreatorProfile(creatorId);

  const styles = StyleSheet.create({
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
    legacyStatsRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "center",
      marginTop: Spacing.md,
    },
    statText: { color: colors.textSecondary, fontSize: 13 },
    statNumber: { color: colors.text, fontWeight: "700" },
    followBtn: {
      marginTop: Spacing.md,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: Radius.full,
      minWidth: 140,
      alignItems: "center",
      alignSelf: "center",
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
    emptyRecipes: {
      paddingVertical: Spacing.xl,
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
    },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
    emptyBody: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: "center",
      marginTop: Spacing.xs,
      lineHeight: 18,
    },
    loadMoreWrap: { alignItems: "center", marginTop: Spacing.md, gap: Spacing.xs },
    loadMoreBtn: {
      minWidth: 140,
      minHeight: 42,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    loadMoreText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    loadMoreError: { color: colors.textSecondary, ...Type.captionSmall, textAlign: "center" },
  });

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
          <ChevronLeft size={24} color={colors.text} />
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
          <ChevronLeft size={24} color={colors.text} />
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

  const isSelf = authedUserId === creator.id;
  const followerLabel = followerCount === 1 ? "follower" : "followers";
  const showFollow = !isSelf && authedUserId;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <PressableScale haptic="light" onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
        <ChevronLeft size={24} color={colors.text} />
      </PressableScale>

      <CreatorProfileHeader creator={creator} />

      <CreatorStatsCard
        recipeCount={recipeCount ?? recipes.length}
        followerCount={followerCount ?? 0}
        followingCount={0}
      />

      {!v3Profile ? (
        <View style={styles.legacyStatsRow}>
          <Text style={styles.statText}>
            <Text style={styles.statNumber}>{followerCount ?? "—"}</Text> {followerLabel}
          </Text>
          <Text style={styles.statText}> · </Text>
          <Text style={styles.statText}>
            <Text style={styles.statNumber}>{recipeCount ?? recipes.length}</Text> recipe
            {(recipeCount ?? recipes.length) === 1 ? "" : "s"}
          </Text>
        </View>
      ) : null}

      {showFollow ? (
        <PressableScale
          haptic="light"
          onPress={onToggleFollow}
          disabled={followBusy}
          style={[
            styles.followBtn,
            v3Profile ? { alignSelf: "stretch" } : null,
            isFollowing
              ? { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.cardBorder }
              : { backgroundColor: accent.primary },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? "Unfollow creator" : "Follow creator"}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: isFollowing ? colors.text : colors.primaryForeground,
            }}
          >
            {isFollowing ? "Following" : "Follow"}
          </Text>
        </PressableScale>
      ) : null}

      <CreatorGoPublicPromo />

      <Text style={styles.sectionLabel}>Recipes</Text>
      {recipes.length === 0 ? (
        <View style={styles.emptyRecipes}>
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptyBody}>
            When {decodeEntities(creator.display_name)} publishes a recipe it&apos;ll appear here.
          </Text>
        </View>
      ) : v3Profile ? (
        <CreatorRecipeGrid recipes={recipes} />
      ) : (
        <View style={styles.recipesList}>
          {recipes.map((r, idx) => (
            <PressableScale
              key={r.id}
              haptic="selection"
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
                <View style={[styles.recipeThumb, { alignItems: "center", justifyContent: "center" }]}>
                  <UtensilsCrossed size={20} color={colors.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }} numberOfLines={2}>
                  {normalizeRecipeTitle(decodeEntities(r.title))}
                </Text>
                <Text style={{ color: colors.textSecondary, ...Type.captionSmall, marginTop: 2 }} numberOfLines={1}>
                  {formatKcalDisplay(r.calories ?? 0)} kcal
                  {r.protein != null ? ` · ${formatMacro(r.protein, "protein", "g")} protein` : ""}
                  {formatTotalRecipeDuration(r.prep_time_min, r.cook_time_min)
                    ? ` · ${formatTotalRecipeDuration(r.prep_time_min, r.cook_time_min)}`
                    : ""}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textTertiary} />
            </PressableScale>
          ))}
        </View>
      )}

      {recipes.length > 0 && hasMore ? (
        <View style={styles.loadMoreWrap}>
          <PressableScale
            haptic="light"
            onPress={onLoadMore}
            disabled={loadingMore}
            style={[styles.loadMoreBtn, loadingMore ? { opacity: 0.6 } : null]}
            accessibilityRole="button"
            accessibilityLabel="Load more recipes"
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.loadMoreText}>Load more</Text>
            )}
          </PressableScale>
          {loadMoreError ? (
            <Text style={styles.loadMoreError}>Couldn&apos;t load more recipes. Tap to try again.</Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
