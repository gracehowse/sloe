import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { SmartImage } from "@/components/ui/SmartImage";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import { MacroIconRow } from "@/components/nutrition/MacroIconRow";
import { formatTotalRecipeDuration } from "@suppr/shared/recipes/totalDuration";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { supabase } from "@/lib/supabase";
import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { decodeEntities } from "@/lib/decodeEntities";
import type { RecipeCard } from "@/lib/types";
import type { CreatorChip } from "@suppr/shared/discover/topCreators";
import {
  CREATOR_CHIP_INK,
  creatorInitialOf,
  creatorTintFor,
} from "@suppr/shared/discover/creatorChipPresentation";

/**
 * FollowingFeed — the v3 mobile Discover "Following" section (ENG-1225 #14,
 * ENG-1239 real creators). Creator posts pair with feed recipes; follow state
 * persists via the `follows` table when the viewer is signed in.
 */
export interface FollowingFeedProps {
  enabled: boolean;
  creators: CreatorChip[];
  recipes: RecipeCard[];
  onPressRecipe: (recipe: RecipeCard) => void;
  onPressCreator: (creatorId: string) => void;
}

function handleOf(c: CreatorChip): string {
  return c.handle.startsWith("@") ? c.handle : `@${c.handle}`;
}

function feedNote(creator: CreatorChip): string | null {
  const bio = creator.bio?.trim();
  return bio || null;
}

export function FollowingFeed({
  enabled,
  creators,
  recipes,
  onPressRecipe,
  onPressCreator,
}: FollowingFeedProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const cardElevation = useCardElevation({ variant: "soft" });
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessionRes = await supabase.auth.getSession();
      if (cancelled) return;
      const uid = sessionRes.data.session?.user.id ?? null;
      setAuthedUserId(uid);
      if (!uid || creators.length === 0) return;
      const { data, error } = await supabase
        .from("follows")
        .select("creator_id")
        .eq("user_id", uid)
        .in(
          "creator_id",
          creators.map((c) => c.id),
        );
      if (cancelled || error || !data) return;
      const next: Record<string, boolean> = {};
      for (const row of data) {
        if (row.creator_id) next[row.creator_id] = true;
      }
      setFollowed(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [creators]);

  const toggleFollow = useCallback(
    async (creatorId: string) => {
      if (!authedUserId || busy[creatorId]) return;
      const wasFollowing = followed[creatorId] ?? false;
      setBusy((m) => ({ ...m, [creatorId]: true }));
      setFollowed((m) => ({ ...m, [creatorId]: !wasFollowing }));
      try {
        if (wasFollowing) {
          const { error } = await supabase
            .from("follows")
            .delete()
            .eq("user_id", authedUserId)
            .eq("creator_id", creatorId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("follows").insert({
            user_id: authedUserId,
            creator_id: creatorId,
          });
          if (error) throw error;
        }
      } catch {
        setFollowed((m) => ({ ...m, [creatorId]: wasFollowing }));
      } finally {
        setBusy((m) => ({ ...m, [creatorId]: false }));
      }
    },
    [authedUserId, busy, followed],
  );

  const posts = useMemo(() => {
    const photo = recipes.filter((r) => (r.image ?? "").trim().length > 0);
    const pool = photo.length > 0 ? photo : recipes;
    return creators
      .map((c, i) => {
        const own = recipes.find((r) => r.creatorId === c.id);
        const recipe = own ?? pool[i % Math.max(1, pool.length)] ?? null;
        return recipe ? { creator: c, recipe } : null;
      })
      .filter((p): p is { creator: CreatorChip; recipe: RecipeCard } => p !== null);
  }, [creators, recipes]);

  if (!enabled || posts.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[Type.title, styles.head, { color: colors.navPrimary }]}>
        Following
      </Text>
      <Text style={[Type.caption, styles.sub, { color: colors.textTertiary }]}>
        From cooks you follow
      </Text>
      <View style={{ gap: Spacing.md }}>
        {posts.map(({ creator, recipe }) => {
          const isFollowing = followed[creator.id] ?? false;
          const note = feedNote(creator);
          const kcal = Math.round(recipe.calories);
          const protein = Math.round(recipe.protein);
          const carbs = Math.round(recipe.carbs);
          const fat = Math.round(recipe.fat);
          // ENG-1617 — total (prep + cook), not cook alone.
          const timeLabel = formatTotalRecipeDuration(recipe.prepTimeMin, recipe.cookTimeMin);
          return (
            <View
              key={creator.id}
              style={[
                styles.card,
                {
                  backgroundColor: cardElevation.liftBg ?? colors.card,
                  borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
                  borderColor: colors.cardBorder,
                },
                cardElevation.shadowStyle,
              ]}
            >
              <View style={styles.header}>
                <PressableScale
                  haptic="selection"
                  onPress={() => onPressCreator(creator.id)}
                  accessibilityRole="button"
                  accessibilityLabel={creator.displayName}
                  style={styles.who}
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: creator.avatarUrl
                          ? colors.card
                          : creatorTintFor(creator.id),
                      },
                    ]}
                  >
                    {creator.avatarUrl ? (
                      <SmartImage
                        source={{ uri: creator.avatarUrl }}
                        style={styles.avatarImg}
                        recyclingKey={creator.id}
                      />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {creatorInitialOf(creator.displayName)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.name, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {creator.displayName}
                    </Text>
                    <Text
                      style={[Type.caption, { color: colors.textTertiary }]}
                      numberOfLines={1}
                    >
                      {handleOf(creator)}
                    </Text>
                  </View>
                </PressableScale>
                <PressableScale
                  haptic="selection"
                  onPress={() => void toggleFollow(creator.id)}
                  disabled={!authedUserId || busy[creator.id]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFollowing }}
                  accessibilityLabel={
                    isFollowing
                      ? `Following ${creator.displayName}`
                      : `Follow ${creator.displayName}`
                  }
                  style={[
                    styles.followBtn,
                    {
                      backgroundColor: isFollowing
                        ? accent.primarySoft
                        : accent.primarySolid,
                      opacity: authedUserId ? 1 : 0.45,
                    },
                  ]}
                >
                  <Text
                    style={[
                      Type.caption,
                      {
                        fontWeight: "600",
                        color: isFollowing ? accent.primarySolid : Accent.primaryForeground,
                      },
                    ]}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                </PressableScale>
              </View>

              {note ? (
                <Text style={[styles.note, { color: colors.textSecondary }]}>
                  {note}
                </Text>
              ) : null}

              <PressableScale
                haptic="confirm"
                onPress={() => onPressRecipe(recipe)}
                accessibilityRole="button"
                accessibilityLabel={decodeEntities(recipe.title)}
                style={[styles.recipe, { backgroundColor: colors.background }]}
              >
                {/* ENG-1374 PR 2 — opaque cuisine-tint underlay on the
                    media wrapper itself: no child failure (404, slow load,
                    SVG mount failure) can expose page white. */}
                <View style={styles.recipeMedia}>
                  <RecipeCardImage
                    uri={recipe.image}
                    cardImageStyle={StyleSheet.absoluteFillObject}
                    recipeId={recipe.id}
                    recipeTitle={recipe.title}
                  />
                </View>
                <View style={{ padding: Spacing.md }}>
                  <Text
                    style={[Type.headline, { fontWeight: "600", color: colors.text }]}
                    numberOfLines={2}
                  >
                    {decodeEntities(recipe.title)}
                  </Text>
                  <MacroIconRow
                    kcal={kcal > 0 ? kcal : null}
                    protein={protein}
                    carbs={carbs}
                    fat={fat}
                    fiber={recipe.fiberG}
                    cookTime={timeLabel}
                    textColor={colors.textSecondary}
                    textTertiaryColor={colors.textTertiary}
                    emphasiseProtein
                    proteinTextColor={colors.text}
                    iconSize={13}
                    style={{ marginTop: Spacing.sm }}
                  />
                </View>
              </PressableScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const AVATAR = 38;

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.xl },
  head: { marginBottom: 2 },
  sub: { marginBottom: Spacing.md },
  card: {
    borderRadius: CARD_RADIUS,
    padding: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  who: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: AVATAR, height: AVATAR },
  avatarInitial: {
    fontFamily: FontFamily.serifMedium,
    fontSize: 17,
    color: CREATOR_CHIP_INK,
  },
  name: {
    ...Type.bodyLarge,
    lineHeight: 19,
    fontWeight: "500",
  },
  followBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  note: {
    ...Type.bodyMuted,
    marginTop: Spacing.dense,
    marginBottom: Spacing.dense,
  },
  recipe: {
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
  },
  recipeMedia: {
    width: "100%",
    aspectRatio: 16 / 10,
    overflow: "hidden",
    // Ground colour is the per-recipe cuisine tint, applied inline at the
    // callsite (ENG-1374 PR 2) — never transparent/white.
  },
});

export default FollowingFeed;
