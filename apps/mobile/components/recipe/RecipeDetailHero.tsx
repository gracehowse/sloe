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
import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import {
  Bookmark,
  ChevronLeft,
  Clock,
  Flame,
  MoreHorizontal,
  Share2,
  UtensilsCrossed,
} from "lucide-react-native";

import { Accent, FontFamily, Spacing, Type } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { SmartImage } from "@/components/ui/SmartImage";
import { recipeUnderlayColor } from "@suppr/shared/recipe/recipeHeroFallback";
import { useResolvedScheme } from "@/context/theme";

/** Fixed hero height — Figma `332:2` §1 (375px). */
export const RECIPE_HERO_HEIGHT = 375;

/**
 * ENG-1247 — v3 prototype hero title OVERLAY (Sloe-App.html RecipeDetail
 * L4336–4341). When the recipe HAS a photo and the conformance flag is on, the
 * kicker + serif H1 + clock·flame·serves meta row sit ON the hero under a
 * bottom veil. When there is NO photo this is `null` and the title stays in the
 * body title block (the placeholder must not carry the overlay).
 */
export type RecipeHeroOverlay = {
  /** Cuisine, or "From your cookbook" (saved), else "Fits your day". */
  kicker: string;
  title: string;
  timeMin: number | null;
  kcal: number | null;
  servings: number;
};

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
  showSloeImageLabel?: boolean;
  /** ENG-1247 — v3 hero title overlay. Rendered only when set AND a photo
   *  shows (the host passes null on the no-photo fallback + flag-off). */
  overlay?: RecipeHeroOverlay | null;
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
    <PressableScale
      haptic="selection"
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
    </PressableScale>
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
  showSloeImageLabel = false,
  overlay = null,
}: RecipeDetailHeroProps) {
  const showPhoto = Boolean(imageUrl) && !imageBroken;
  // ENG-1528 — dark hero wrapper gets the dark ramp tint, not glowing cream.
  const scheme = useResolvedScheme();
  // ENG-1247 — the title overlay only rides a real photo. On the placeholder
  // fallback the title belongs in the body (per task: never force the overlay
  // onto the tinted placeholder).
  const showOverlay = showPhoto && overlay != null;
  const heroMetaStyle = {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    fontWeight: "500" as const,
    color: "rgba(255,255,255,0.92)",
  };
  return (
    <View
      // ENG-1374 PR 2 — the hero wrapper paints the recipe's opaque §11.4
      // cuisine tint (was the brand plum) so a 404'd photo or a failed
      // fallback SVG mount never exposes ~280pt of blank, and the pre-paint
      // ground matches the tile/photo that lands on top.
      style={{
        width: "100%",
        height: RECIPE_HERO_HEIGHT,
        backgroundColor: recipeUnderlayColor({ id: recipeId, title, tags }, scheme),
      }}
      testID="recipe-detail-hero"
    >
      {showPhoto ? (
        <SmartImage
          source={{ uri: imageUrl as string }}
          style={{ width: "100%", height: "100%" }}
          onError={onImageError}
          recyclingKey={recipeId}
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

      {showSloeImageLabel ? (
        <View
          style={{
            position: "absolute",
            left: Spacing.md,
            bottom: Spacing.md,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.5)",
            paddingHorizontal: Spacing.sm,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: Accent.primaryForeground, ...Type.captionStrong }}>
            Sloe image
          </Text>
        </View>
      ) : null}

      {/* ENG-1247 — bottom veil + title overlay (prototype rd-veil + rd-title).
          Only over a real photo; the kicker + serif H1 + clock·flame·serves
          meta row sit at the foot of the hero. */}
      {showOverlay ? (
        <>
          <Svg
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 220 }}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="recipe-hero-veil" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0.62} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#recipe-hero-veil)" />
          </Svg>
          <View
            testID="recipe-hero-title-overlay"
            pointerEvents="none"
            style={{
              position: "absolute",
              left: Spacing.xl,
              right: Spacing.xl,
              bottom: Spacing.xl,
              gap: Spacing.sm,
            }}
          >
            <Text
              testID="recipe-hero-kicker"
              style={{
                ...Type.statLabel,
                color: "rgba(255,255,255,0.92)",
              }}
              numberOfLines={1}
            >
              {overlay!.kicker}
            </Text>
            <Text
              testID="recipe-hero-overlay-title"
              style={{
                fontFamily: FontFamily.serifRegular,
                fontSize: 30,
                lineHeight: 36,
                fontWeight: "400",
                letterSpacing: -0.4,
                color: Accent.primaryForeground,
              }}
            >
              {overlay!.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Clock size={14} color="rgba(255,255,255,0.9)" />
                <Text style={heroMetaStyle} numberOfLines={1}>
                  {overlay!.timeMin != null ? `${overlay!.timeMin} min` : "—"}
                </Text>
              </View>
              {overlay!.kcal != null ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Flame size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={heroMetaStyle} numberOfLines={1}>
                    {overlay!.kcal} kcal
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <UtensilsCrossed size={14} color="rgba(255,255,255,0.9)" />
                <Text style={heroMetaStyle} numberOfLines={1}>
                  Serves {overlay!.servings}
                </Text>
              </View>
            </View>
          </View>
        </>
      ) : null}

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
          <ChevronLeft size={24} color={Accent.primaryForeground} />
        </HeroCircleButton>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <HeroCircleButton
            onPress={onToggleSave}
            accessibilityLabel={saved ? "Remove from library" : "Save to library"}
          >
            <Bookmark
              size={22}
              color={saved ? Accent.successLight : Accent.primaryForeground}
              fill={saved ? Accent.successLight : "transparent"}
            />
          </HeroCircleButton>
          <HeroCircleButton onPress={onShare} accessibilityLabel="Share recipe">
            <Share2 size={22} color={Accent.primaryForeground} />
          </HeroCircleButton>
          {onMore ? (
            <HeroCircleButton onPress={onMore} accessibilityLabel="More recipe actions">
              <MoreHorizontal size={22} color={Accent.primaryForeground} />
            </HeroCircleButton>
          ) : null}
        </View>
      </View>
    </View>
  );
}
