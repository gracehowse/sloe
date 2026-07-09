import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Clock, Flame, X } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { Accent, Colors, Radius, Spacing, Type } from "@/constants/theme";
import type { useThemeColors } from "@/hooks/use-theme-colors";

import { PressableScale } from "@/components/ui/PressableScale";
import { QuickLogButton } from "@/components/ui/QuickLogButton";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { SmartImage } from "@/components/ui/SmartImage";
import { isFeatureEnabled } from "@/lib/analytics";
import { formatQualifiedKcal } from "@suppr/nutrition-core/formatMacro";

import type { NorthStarBlockSuggestion } from "./NorthStarBlock";

/**
 * NorthStarFigmaHero — the Figma `654:2` full-bleed "What to eat next" hero
 * variant (flag `today_meals_figma_654`). Extracted from `NorthStarBlock.tsx`
 * (ENG-1301) so the block file stays under its screen-budget pin; behaviour
 * unchanged apart from the new compact secondary "Log" action (ENG-1301):
 * the whole-card press still routes to the recipe; the on-image pill commits
 * the suggested recipe to the suggested slot in one tap.
 *
 * Web mirror: `NorthStarFigmaHeroBlock` in
 * `src/app/components/suppr/north-star-figma-hero.tsx`.
 */

const FIGMA_HERO_HEIGHT = 320;

export function NorthStarFigmaHero({
  suggestion,
  slotEyebrow,
  onPrimaryCta,
  onSkip,
  onLogCta,
  reduceMotion,
  colors: _colors,
  testID,
}: {
  suggestion: NorthStarBlockSuggestion;
  slotEyebrow: string;
  onPrimaryCta?: () => void;
  onSkip?: () => void;
  /** ENG-1301 — one-tap quick-log of the suggested recipe to the suggested
   *  slot. Host reuses the existing quick-log insert helper. */
  onLogCta?: () => Promise<void> | void;
  reduceMotion: boolean;
  colors: ReturnType<typeof useThemeColors>;
  testID?: string;
}) {
  const showFitsBadge =
    suggestion.bandTight ||
    suggestion.bandLabel.toLowerCase().includes("close");
  const cookMin =
    typeof suggestion.cookTimeMin === "number" && suggestion.cookTimeMin > 0
      ? suggestion.cookTimeMin
      : null;
  // ENG-1417 — flag-gated "~" qualifier when the suggestion's macros are an
  // unverified estimate rather than a verified nutrition lookup. Off →
  // exact pre-ENG-1417 kcal display (kill switch). Mirror of web
  // `north-star-figma-hero.tsx`.
  const kcalDisplay = isFeatureEnabled("kcal_trust_qualifier_v1")
    ? formatQualifiedKcal(suggestion.predictedCalories, suggestion.isVerified)
    : String(suggestion.predictedCalories);

  return (
    <View testID={testID ?? "north-star-figma-hero"} style={{ marginBottom: Spacing.xl }}>
      <Text
        style={[
          Type.title,
          { color: _colors.navPrimary, marginBottom: Spacing.md },
        ]}
      >
        What to eat next
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${slotEyebrow}: ${suggestion.title}, ${kcalDisplay} kcal`}
        haptic="selection"
        onPress={onPrimaryCta}
        style={styles.figmaHeroCard}
      >
        <View style={StyleSheet.absoluteFill}>
          {suggestion.thumbnail ? (
            <SmartImage
              source={{ uri: suggestion.thumbnail }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              recyclingKey={suggestion.recipeId ?? suggestion.thumbnail}
            />
          ) : (
            <RecipeHeroFallback
              id={suggestion.recipeId}
              title={suggestion.title}
              iconSize={48}
            />
          )}
        </View>
        {/* Two-layer scrim per Figma 654:165-166: a flat base overlay
            under a bottom-up gradient so the footer text keeps contrast
            even where the photo is light at the bottom. Replaces the
            previous solid footer panel. Uses react-native-svg's
            LinearGradient (a real project dep) — expo-linear-gradient
            is intentionally NOT used (not installed; see welcome.tsx). */}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(34,27,38,0.2)" }]}
          pointerEvents="none"
        />
        <Svg
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          width="100%"
          height="100%"
        >
          <Defs>
            <LinearGradient id="north-star-scrim" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={Colors.light.text} stopOpacity={0.9} />
              <Stop offset="0.5" stopColor={Colors.light.text} stopOpacity={0.2} />
              <Stop offset="1" stopColor={Colors.light.text} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#north-star-scrim)" />
        </Svg>
        {showFitsBadge ? (
          <View style={styles.figmaFitsBadge}>
            <Check size={14} color={Accent.primaryForeground} strokeWidth={2.5} />
            <Text style={styles.figmaFitsText}>Fits your day</Text>
          </View>
        ) : null}
        {reduceMotion && onSkip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip this suggestion"
            onPress={onSkip}
            hitSlop={6}
            style={styles.figmaSkipButton}
          >
            <X size={14} color={Accent.primaryForeground} strokeWidth={2.25} />
          </Pressable>
        ) : null}
        <View style={styles.figmaHeroFooter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.figmaSlotEyebrow}>{slotEyebrow}</Text>
            <Text style={styles.figmaHeroTitle} numberOfLines={2}>
              {suggestion.title}
            </Text>
            <View style={styles.figmaKcalRow}>
              <Flame size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.figmaKcalText}>
                {kcalDisplay} kcal
              </Text>
              {cookMin !== null ? (
                <>
                  <View style={styles.figmaMetaDot} />
                  <Clock size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.figmaKcalText}>{cookMin} min</Text>
                </>
              ) : null}
            </View>
          </View>
          {/* ENG-1301 — compact secondary Log, bottom-right in the footer row
              (the skip button's on-image grammar). Nested pressable wins the
              touch, so the whole-card recipe press stays intact around it. */}
          {onLogCta ? (
            <QuickLogButton
              testID="north-star-log-cta"
              appearance="onImage"
              onLog={onLogCta}
              accessibilityLabel={`Log ${suggestion.title}`}
            />
          ) : null}
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  figmaHeroCard: {
    height: FIGMA_HERO_HEIGHT,
    borderRadius: Radius.lg,
    overflow: "hidden",
    position: "relative",
    // Flat-card surfaces (2026-06-12, Withings grammar — decision:
    // docs/decisions/2026-06-12-flat-card-surfaces.md): the "What to eat next"
    // hero is a resting card and sits FLAT now — the soft lift is retired; the
    // full-bleed photo/gradient fill on the cream ground is the separation.
  },
  figmaFitsBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(94,124,90,0.9)",
    paddingHorizontal: Spacing.dense,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  figmaFitsText: {
    color: Accent.primaryForeground,
    fontSize: 11,
    fontWeight: "500",
  },
  figmaSkipButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  figmaHeroFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    padding: 20,
    // ENG-1301 — footer is now a row: text column (flex 1) + Log pill
    // bottom-right, so the pill never overlaps the two-line title.
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.md,
  },
  figmaSlotEyebrow: {
    // headers census 2026-06-10: eyebrow metrics → Type.label (kills the
    // off-ramp 10/500/ls1). Colour stays a light lilac-white because this
    // eyebrow sits on the DARK photo scrim, where the light-surface role
    // tokens (primarySolid / textTertiary) would be invisible — its
    // white-literal siblings (figmaHeroTitle / figmaKcalText) share that
    // on-image context. Tokenising on-image text colours is a separate
    // scoped task (the census roles assume a light surface).
    ...Type.label,
    color: "rgba(201,194,214,0.9)",
    marginBottom: Spacing.xs,
  },
  figmaMetaDot: {
    width: 4,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  figmaHeroTitle: {
    fontFamily: Type.display.fontFamily,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "500",
    color: Accent.primaryForeground,
    marginBottom: 4,
  },
  figmaKcalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  figmaKcalText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
});

export default NorthStarFigmaHero;
