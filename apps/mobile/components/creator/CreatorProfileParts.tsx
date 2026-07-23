/**
 * Creator profile chrome — back, follow, recipe rows, load-more (ENG-1565).
 * Extracted from `app/creator/[id].tsx` for PressableScale migration + screen budget.
 */
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { ChevronLeft, ChevronRight, CircleCheck, UtensilsCrossed } from "lucide-react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Spacing, Radius, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { formatMacro, formatKcalDisplay } from "@suppr/nutrition-core/formatMacro";
import { normalizeRecipeTitle } from "@suppr/shared/recipes/normalizeRecipeTitle";
import { formatTotalRecipeDuration } from "@suppr/shared/recipes/totalDuration";
import { decodeEntities } from "@/lib/decodeEntities";

export type CreatorProfileRecipeRow = {
  id: string;
  title: string;
  image_url: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  cook_time_min: number | null;
  prep_time_min: number | null;
};

export function useCreatorProfileStyles() {
  const colors = useThemeColors();
  const accent = useAccent();
  return useMemo(() => buildStyles(colors, accent), [colors, accent]);
}

export function CreatorBackButton({ onPress }: { onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useCreatorProfileStyles();
  return (
    <PressableScale haptic="selection" onPress={onPress} hitSlop={12} style={styles.backHit}>
      <ChevronLeft size={24} color={colors.text} />
    </PressableScale>
  );
}

export function CreatorFollowButton({
  isFollowing,
  followBusy,
  onPress,
}: {
  isFollowing: boolean;
  followBusy: boolean;
  onPress: () => void;
}) {
  const styles = useCreatorProfileStyles();
  return (
    <PressableScale
      haptic="confirm"
      onPress={onPress}
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
    </PressableScale>
  );
}

export function CreatorRecipeRow({
  recipe,
  isFirst,
  onPress,
}: {
  recipe: CreatorProfileRecipeRow;
  isFirst: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const styles = useCreatorProfileStyles();
  const rowBorder: ViewStyle = {
    borderTopWidth: isFirst ? 0 : 1,
    borderTopColor: colors.cardBorder,
  };
  return (
    <PressableScale
      haptic="confirm"
      onPress={onPress}
      style={[styles.recipeRow, rowBorder]}
    >
      {recipe.image_url ? (
        <Image
          source={{ uri: recipe.image_url }}
          style={styles.recipeThumb}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.recipeThumb, styles.recipeThumbFallback]}>
          <UtensilsCrossed size={20} color={colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.recipeTitle} numberOfLines={2}>
          {normalizeRecipeTitle(decodeEntities(recipe.title))}
        </Text>
        <Text style={styles.recipeMeta} numberOfLines={1}>
          {formatKcalDisplay(recipe.calories ?? 0)} kcal
          {recipe.protein != null ? ` · ${formatMacro(recipe.protein, "protein", "g")} protein` : ""}
          {formatTotalRecipeDuration(recipe.prep_time_min, recipe.cook_time_min)
            ? ` · ${formatTotalRecipeDuration(recipe.prep_time_min, recipe.cook_time_min)}`
            : ""}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textTertiary} />
    </PressableScale>
  );
}

export function CreatorLoadMoreButton({
  loadingMore,
  loadMoreError,
  onPress,
}: {
  loadingMore: boolean;
  loadMoreError: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const styles = useCreatorProfileStyles();
  return (
    <View style={styles.loadMoreWrap}>
      <PressableScale
        haptic="selection"
        onPress={onPress}
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
      </PressableScale>
      {loadMoreError ? (
        <Text style={styles.loadMoreError}>
          Couldn&apos;t load more recipes. Tap to try again.
        </Text>
      ) : null}
    </View>
  );
}

export function CreatorVerifiedIcon() {
  const accent = useAccent();
  return (
    <CircleCheck size={18} color={accent.primary} accessibilityLabel="Verified creator" />
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
      borderRadius: Radius.full,
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
      gap: Spacing.xs,
    },
    displayName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700",
    },
    handle: {
      color: colors.textSecondary,
      fontSize: 14,
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
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
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
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
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
