/**
 * Recipe detail — full-bleed hero with overlaid controls (Figma `332:2`,
 * section 1). Web parity: the hero block in `src/app/components/RecipeDetail.tsx`.
 *
 * Replaces the old cream nav-bar + gradient-placeholder pattern. The photo runs
 * edge-to-edge (375px tall, no rounded corners), a top scrim darkens the status
 * area, and the back / bookmark / share controls float over it as 40px frosted
 * circles. The no-photo case keeps a tasteful cream/plum placeholder filling the
 * full hero with the controls still overlaid — never a regression to a separate
 * nav bar.
 */
import { Image, Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Bookmark, ChevronLeft, MoreHorizontal, Share2 } from "lucide-react-native";

import { Accent, Spacing } from "@/constants/theme";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";

/** Fixed hero height — Figma `332:2` §1 (375px). */
export const RECIPE_HERO_HEIGHT = 375;

type RecipeDetailHeroProps = {
  recipeId: string;
  title: string;
  tags: string[];
  imageUrl: string | null;
  imageBroken: boolean;
  onImageError: () => void;
  topInset: number;
  saved: boolean;
  onBack: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  /** Owner-only overflow (edit / publish / delete). Hidden when absent. */
  onMore?: () => void;
};

function HeroCircleButton({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        // Figma §1 — frosted control: bg rgba(255,255,255,0.2), white icon.
        backgroundColor: "rgba(255,255,255,0.22)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {children}
    </Pressable>
  );
}

export function RecipeDetailHero({
  recipeId,
  title,
  tags,
  imageUrl,
  imageBroken,
  onImageError,
  topInset,
  saved,
  onBack,
  onToggleSave,
  onShare,
  onMore,
}: RecipeDetailHeroProps) {
  const showPhoto = Boolean(imageUrl) && !imageBroken;
  return (
    <View
      style={{ width: "100%", height: RECIPE_HERO_HEIGHT, backgroundColor: Accent.primary }}
      testID="recipe-detail-hero"
    >
      {showPhoto ? (
        <Image
          source={{ uri: imageUrl as string }}
          style={{ width: "100%", height: "100%" }}
          onError={onImageError}
          accessibilityIgnoresInvertColors
        />
      ) : (
        // No-photo fallback — fills the full hero with the deterministic
        // cream/plum placeholder + glyph; controls stay overlaid. NOT a
        // separate nav bar (Figma §1 explicit).
        <View style={{ width: "100%", height: "100%" }} testID="recipe-detail-hero-fallback">
          <RecipeHeroFallback id={recipeId} title={title} tags={tags} iconSize={56} />
        </View>
      )}

      {/* Top scrim — rgba(0,0,0,0.4) → transparent, ~88px under the controls. */}
      <Svg
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: topInset + 88 }}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="recipe-hero-scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.4} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#recipe-hero-scrim)" />
      </Svg>

      {/* Overlaid controls — back (left), bookmark + share (+ owner more) right. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: topInset,
          height: 56,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
        }}
      >
        <HeroCircleButton onPress={onBack} accessibilityLabel="Go back">
          <ChevronLeft size={24} color="#FFFFFF" />
        </HeroCircleButton>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <HeroCircleButton
            onPress={onToggleSave}
            accessibilityLabel={saved ? "Remove from library" : "Save to library"}
          >
            <Bookmark
              size={22}
              color={saved ? Accent.successLight : "#FFFFFF"}
              fill={saved ? Accent.successLight : "transparent"}
            />
          </HeroCircleButton>
          <HeroCircleButton onPress={onShare} accessibilityLabel="Share recipe">
            <Share2 size={22} color="#FFFFFF" />
          </HeroCircleButton>
          {onMore ? (
            <HeroCircleButton onPress={onMore} accessibilityLabel="More recipe actions">
              <MoreHorizontal size={22} color="#FFFFFF" />
            </HeroCircleButton>
          ) : null}
        </View>
      </View>
    </View>
  );
}
