import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Check, ChevronRight, Circle, Flame, Shield } from "lucide-react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import {
  type EditorialProfileBlockModel,
  type StreakDotState,
} from "@/lib/editorialProfileBlock";

/** Recipe subset the grid needs — matches the mobile RecipeCard fields used. */
export interface EditorialProfileRecipe {
  id: string;
  title: string;
  image: string | null;
}

export interface EditorialProfileBlockProps {
  displayName: string;
  joinedLabel: string | null;
  monogramInitial: string;
  tierLabel: string;
  isPro: boolean;
  /** Derived streak/dots/milestones model (from buildEditorialProfileBlock). */
  model: EditorialProfileBlockModel;
  /** Saved recipes for the preview grid (already-loaded rows — no fetch here). */
  recipes: EditorialProfileRecipe[];
  /** Total saved-recipe count (may exceed the previewed grid). */
  recipeCount: number;
  /** Open a recipe from the grid (router.push in the host). */
  onOpenRecipe: (recipeId: string) => void;
  /** "See all" → the Recipes tab. */
  onSeeAllRecipes: () => void;
}

/** Max recipes rendered in the preview grid — one tidy 3-up row. */
const RECIPE_GRID_LIMIT = 6;

/**
 * EditorialProfileBlock — the shared editorial Profile block (Gap #16,
 * ENG-1246). Replaces the old inline identity card + bare streak-number /
 * recipe-count stat strip with one editorial surface: identity → streak dots +
 * best/freezes line → milestones list → recipe grid.
 *
 * Display-only: every value is derived upstream from already-loaded data
 * (freeze ledger, saved recipes). No fetches, no writes. Mobile twin of the
 * web `EditorialProfileBlock` — same information architecture, native
 * primitives (PressableScale tiles + haptics).
 */
function EditorialProfileBlockImpl({
  displayName,
  joinedLabel,
  monogramInitial,
  tierLabel,
  isPro,
  model,
  recipes,
  recipeCount,
  onOpenRecipe,
  onSeeAllRecipes,
}: EditorialProfileBlockProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const styles = useMemo(() => makeStyles(colors, accent), [colors, accent]);

  const gridRecipes = recipes.slice(0, RECIPE_GRID_LIMIT);
  const freezeCount = model.freezesAvailable;

  const dotColor = (state: StreakDotState): string => {
    if (state === "logged") return accent.successSolid;
    if (state === "frozen") return colors.textTertiary;
    return colors.cardBorder;
  };

  return (
    <View style={styles.wrap}>
      {/* Identity — monogram + name + tier·joined + tier pill. */}
      <View style={styles.identityCard}>
        <View style={styles.monogram} accessible={false}>
          <Text style={styles.monogramInitial}>{monogramInitial}</Text>
        </View>
        <View style={styles.identityBody}>
          <Text style={styles.identityName} numberOfLines={1}>
            {displayName.trim() || "Your profile"}
          </Text>
          <Text style={styles.identityMeta} numberOfLines={1}>
            {tierLabel}
            {joinedLabel ? ` · ${joinedLabel}` : ""}
          </Text>
        </View>
        {isPro ? (
          <View style={styles.tierPill}>
            <Text style={styles.tierPillText}>{tierLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Streak — dot row + best/freezes line. */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.inlineRow}>
            <Flame size={16} color={accent.primarySolid} strokeWidth={2.25} />
            <Text style={styles.streakLabel}>{model.currentStreak}-day streak</Text>
          </View>
          {freezeCount > 0 ? (
            <View style={styles.inlineRow}>
              <Shield size={13} color={colors.textSecondary} strokeWidth={2.25} />
              <Text style={styles.freezeLabel}>
                {freezeCount} freeze{freezeCount === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={styles.dotRow}
          accessibilityRole="image"
          accessibilityLabel={`Last ${model.dots.length} days: ${model.dots
            .map((d) => d.state)
            .join(", ")}`}
        >
          {model.dots.map((dot) => (
            <View
              key={dot.dateKey}
              style={[
                styles.dot,
                { backgroundColor: dotColor(dot.state) },
                dot.isToday ? styles.dotToday : null,
              ]}
            />
          ))}
        </View>
        <Text style={styles.bestLine}>
          Best streak {model.bestStreak} day{model.bestStreak === 1 ? "" : "s"}
          {freezeCount > 0
            ? ` · ${freezeCount} freeze${freezeCount === 1 ? "" : "s"} in hand`
            : ""}
        </Text>
      </View>

      {/* Milestones — streak landmarks with achieved / next state. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Milestones</Text>
        {model.milestones.map((m) => (
          <View key={m.days} style={styles.milestoneRow}>
            <View
              style={[
                styles.milestoneIcon,
                m.achieved ? styles.milestoneIconDone : styles.milestoneIconTodo,
              ]}
            >
              {m.achieved ? (
                <Check size={14} color={accent.successSolid} strokeWidth={2.5} />
              ) : (
                <Circle size={12} color={colors.textTertiary} strokeWidth={1.75} />
              )}
            </View>
            <Text
              style={[styles.milestoneLabel, m.achieved ? styles.milestoneLabelDone : null]}
            >
              {m.days}-day streak
            </Text>
            {m.next ? (
              <Text style={styles.milestoneNext}>Next up</Text>
            ) : m.achieved ? (
              <Text style={styles.milestoneReached}>Reached</Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* Recipe grid — saved recipes preview (already-loaded rows). */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Saved recipes</Text>
          {recipeCount > 0 ? (
            <PressableScale
              haptic="selection"
              onPress={onSeeAllRecipes}
              accessibilityRole="button"
              accessibilityLabel={`See all ${recipeCount} saved recipes`}
              style={styles.seeAll}
            >
              <Text style={styles.seeAllText}>See all {recipeCount}</Text>
              <ChevronRight size={14} color={accent.primarySolid} strokeWidth={2.25} />
            </PressableScale>
          ) : null}
        </View>
        {gridRecipes.length === 0 ? (
          <Text style={styles.emptyText}>
            Recipes you save land here. Browse Discover to start your collection.
          </Text>
        ) : (
          <View style={styles.grid}>
            {gridRecipes.map((recipe) => (
              <PressableScale
                key={recipe.id}
                haptic="selection"
                onPress={() => onOpenRecipe(recipe.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${recipe.title}`}
                style={styles.tile}
              >
                <RecipeCardImage
                  uri={recipe.image}
                  cardImageStyle={styles.tileImage}
                  recipeId={recipe.id}
                  recipeTitle={recipe.title}
                />
              </PressableScale>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useThemeColors>,
  accent: ReturnType<typeof useAccent>,
) {
  return StyleSheet.create({
    wrap: { gap: Spacing.md },

    identityCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
    },
    monogram: {
      width: 48,
      height: 48,
      borderRadius: Radius.full,
      backgroundColor: accent.primarySolid,
      alignItems: "center",
      justifyContent: "center",
    },
    monogramInitial: { ...Type.title, color: accent.primaryForeground },
    identityBody: { flex: 1, minWidth: 0 },
    identityName: { ...Type.title, color: colors.text },
    identityMeta: { ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs },
    tierPill: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: accent.primarySoft,
    },
    tierPillText: { ...Type.label, color: accent.primarySolid },

    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.dense,
    },
    cardTitle: { ...Type.headline, color: colors.text },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    inlineRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
    streakLabel: {
      ...Type.body,
      color: colors.text,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    freezeLabel: {
      ...Type.caption,
      color: colors.textSecondary,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },

    dotRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    dot: { width: 10, height: 10, borderRadius: Radius.full },
    // m7 — semi-transparent today ring (~40% opacity, `+ '66'`) to match the
    // web `ring-primary/40` halo. Threaded via `accent` (M3) so the plum inverts
    // correctly on dark instead of collapsing to the near-invisible static plum.
    // ENG-1572 exempt: deliberate cross-platform halo parity, not drift.
    dotToday: { borderWidth: 2, borderColor: accent.primarySolid + "66" },
    bestLine: { ...Type.caption, color: colors.textSecondary, fontVariant: ["tabular-nums"] },

    milestoneRow: { flexDirection: "row", alignItems: "center", gap: Spacing.dense },
    milestoneIcon: {
      width: 24,
      height: 24,
      borderRadius: Radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    // n14 — dark-aware success tint (~15%, `+ '26'`) via the threaded `accent`,
    // so the done-icon fill tracks the scheme instead of the static light sage.
    milestoneIconDone: { backgroundColor: `${accent.success}26` },
    milestoneIconTodo: { backgroundColor: colors.cardBorder },
    milestoneLabel: { ...Type.body, flex: 1, color: colors.textSecondary },
    milestoneLabelDone: { color: colors.text, fontWeight: "600" },
    milestoneNext: { ...Type.caption, color: accent.primarySolid, fontWeight: "700" },
    milestoneReached: { ...Type.caption, color: colors.textSecondary },

    seeAll: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
    seeAllText: {
      ...Type.caption,
      color: accent.primarySolid,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    emptyText: { ...Type.bodyMuted, color: colors.textSecondary },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    tile: {
      width: "31.5%",
      aspectRatio: 1,
      borderRadius: Radius.lg,
      overflow: "hidden",
      backgroundColor: colors.cardBorder,
    },
    tileImage: { width: "100%", height: "100%" },
  });
}

export const EditorialProfileBlock = memo(EditorialProfileBlockImpl);

export default EditorialProfileBlock;
