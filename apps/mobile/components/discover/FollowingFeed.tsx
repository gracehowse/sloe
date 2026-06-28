import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { SmartImage } from "@/components/ui/SmartImage";
import { MacroIconRow } from "@/components/nutrition/MacroIconRow";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
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
import {
  isSeedCreatorId,
  SEED_CREATORS,
} from "@suppr/shared/discover/seedCreators";
import { readCreatorFollowState, toggleCreatorFollow } from "@suppr/shared/discover/toggleCreatorFollow";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";

/**
 * FollowingFeed — the v3 mobile Discover "Following" section (ENG-1225 #14,
 * prototype `.feed-card`, Sloe-App.html L4251-4261): a stack of creator
 * post-cards, each = a creator header (avatar + name + @handle · when + a
 * Follow/Following affordance), a one-line note, and the creator's latest
 * recipe rendered as a compact card.
 *
 * This is the web-missing half (web has no Following FEED; it has a
 * Following SCOPE toggle) — added here because iOS is the primary surface. It is
 * the parity mirror of where the web featured hero lands on the wide canvas.
 *
 * Behind the host's `discover_creator_rail_v1` gate (passed as `enabled`).
 * Renders nothing when disabled or when there are no creators. Creators come
 * from the SAME resolver as the rail (`resolveCreatorRail`): real creators when
 * they exist, else the presentation-only seed set. The seed posts carry sample
 * "what they just cooked" notes (`SEED_CREATORS.latestNote`); real creators pair
 * with the first available feed recipe.
 *
 * Follow state is LOCAL/optimistic here — the seed creators have no DB row to
 * write to, so the toggle is presentation-only (it never lies about a persisted
 * follow; seed posts carry an explicit "Sample creator" disclosure). When the
 * rail is wired to REAL creators (the Grace-filed follow-up in `seedCreators.ts`),
 * this routes the follow write through the existing `follows` graph.
 */
export interface FollowingFeedProps {
  enabled: boolean;
  /** Resolved creators (real or seed) — same source as the rail. */
  creators: CreatorChip[];
  /** Discover feed recipes — paired with creators that lack a seed post. */
  recipes: RecipeCard[];
  onPressRecipe: (recipe: RecipeCard) => void;
  onPressCreator: (creatorId: string) => void;
}

function noteFor(creatorId: string): string | null {
  const seed = SEED_CREATORS.find((c) => c.id === creatorId);
  return seed?.latestNote ?? null;
}

function postedAgoFor(creatorId: string): string | null {
  const seed = SEED_CREATORS.find((c) => c.id === creatorId);
  return seed?.postedAgo ?? null;
}

function handleOf(c: CreatorChip): string {
  return c.handle.startsWith("@") ? c.handle : `@${c.handle}`;
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
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!userId) return;
    const realIds = creators.map((c) => c.id).filter((id) => !isSeedCreatorId(id));
    void readCreatorFollowState(supabase, userId, realIds).then(setFollowed);
  }, [userId, creators]);

  // Pair each creator with a recipe to feature: their own when we can resolve a
  // creatorId match, else the Nth feed recipe so every post shows a real card.
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
          const note = noteFor(creator.id);
          const when = postedAgoFor(creator.id);
          const kcal = Math.round(recipe.calories);
          const protein = Math.round(recipe.protein);
          const carbs = Math.round(recipe.carbs);
          const fat = Math.round(recipe.fat);
          // Seed creators have no DB row — the follow toggle is presentation-
          // only (never claims a persisted follow). Real creators (no
          // `seed-creator-` id) route through the follow graph once wired.
          const canPersist = !isSeedCreatorId(creator.id);
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
              {/* Creator header */}
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
                      { backgroundColor: creator.avatarUrl ? colors.card : creatorTintFor(creator.id) },
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
                      {when ? ` · ${when}` : ""}
                    </Text>
                  </View>
                </PressableScale>
                <PressableScale
                  haptic="selection"
                  onPress={async () => {
                    if (!canPersist || !userId) {
                      setFollowed((m) => ({ ...m, [creator.id]: !isFollowing }));
                      return;
                    }
                    const next = !isFollowing;
                    setFollowed((m) => ({ ...m, [creator.id]: next }));
                    const result = await toggleCreatorFollow(
                      supabase,
                      userId,
                      creator.id,
                      isFollowing,
                    );
                    if (!result.ok) {
                      setFollowed((m) => ({ ...m, [creator.id]: isFollowing }));
                    }
                  }}
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
                      backgroundColor: isFollowing ? accent.primarySoft : accent.primarySolid,
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

              {/* Recipe card */}
              <PressableScale
                haptic="confirm"
                onPress={() => onPressRecipe(recipe)}
                accessibilityRole="button"
                accessibilityLabel={decodeEntities(recipe.title)}
                style={[styles.recipe, { backgroundColor: colors.background }]}
              >
                <View style={styles.recipeMedia}>
                  {(recipe.image ?? "").trim().length > 0 ? (
                    <SmartImage
                      source={{ uri: (recipe.image ?? "").trim() }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                      recyclingKey={recipe.id}
                    />
                  ) : (
                    <RecipeHeroFallback id={recipe.id} title={recipe.title} />
                  )}
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
                    cookTime={recipe.cookTime}
                    textColor={colors.textSecondary}
                    textTertiaryColor={colors.textTertiary}
                    emphasiseProtein
                    proteinTextColor={colors.text}
                    iconSize={13}
                    style={{ marginTop: Spacing.sm }}
                  />
                </View>
              </PressableScale>

              {!canPersist ? (
                <Text style={[Type.caption, styles.sampleNote, { color: colors.textTertiary }]}>
                  Sample creator · follow lands when creators go live
                </Text>
              ) : null}
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
    fontFamily: FontFamily.serifMedium,
    fontSize: 15,
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
    backgroundColor: "transparent",
  },
  sampleNote: {
    marginTop: Spacing.sm,
    textAlign: "center",
  },
});

export default FollowingFeed;
