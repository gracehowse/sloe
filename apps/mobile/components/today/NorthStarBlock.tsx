import * as React from "react";
import {
  Alert,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { GestureResponderEvent, PanResponderGestureState } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Check, ChevronRight, Clock, Flame, Sparkles, X } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { isFeatureEnabled } from "@/lib/analytics";
import * as Haptics from "expo-haptics";

// 2026-05-12 (premium-bar audit motion polish): use the reanimated
// `createAnimatedComponent` pattern so the resolved component goes
// through React's normal forwardRef pipeline rather than relying on
// `Animated.View` resolving correctly on every renderer (real RN +
// vitest shim). Mirrors `PressableScale.tsx`.
const AnimatedView = Animated.createAnimatedComponent(View);

import { IconSize, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

import { SupprCard } from "@/components/ui/SupprCard";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";

/**
 * Mobile `<NorthStarBlock>` — "What to eat next" permanent block on Today.
 *
 * Production design spec — 2026-04-27 Surface A §A-northstar.
 * Authority: D-2026-04-27-04.
 *
 * Renders one of four kinds depending on caller-determined state:
 *   - `default`         — gradient SupprCard with thumb / body / CTA + swipe-to-skip.
 *   - `library-empty`   — primary-tinted invitation when library < 5.
 *   - `over-budget`     — calm caption replaces block when ring is over.
 *   - `no-fit`          — caption + Browse link.
 *
 * Swipe-to-skip (`default` kind, mobile only): pan-left exposes a
 * destructive "Skip" affordance; releasing past 50pt commits a skip
 * and triggers a decisive haptic. Reduce-motion path: a small `X`
 * button at top-right replaces the gesture (matches spec).
 *
 * Web mirror: `src/app/components/suppr/north-star-block.tsx`.
 */

export type NorthStarKind =
  | "default"
  | "library-empty"
  | "over-budget"
  | "no-fit"
  // ENG-94 (2026-05-13): on a user's very first day — no nutrition
  // history yet — the `default` suggestion card ("Cajun Steak Bowl
  // — 1,128 kcal · Close fit") felt presumptuous: the algorithm
  // hasn't seen the user eat anything yet, so "close fit" is
  // pattern-matching on targets, not on real intake. Render a calmer
  // "Log your first meal" card instead until ≥ 1 meal has been
  // logged anywhere in the user's history.
  | "new-user";

export interface NorthStarBlockSuggestion {
  recipeId: string;
  title: string;
  thumbnail?: string;
  predictedCalories: number;
  predictedProtein: number;
  predictedCarbs: number;
  predictedFat: number;
  bandLabel: string;
  bandTight: boolean;
  /**
   * Activation hook (audit 2026-04-30 — leak fix #5): one-line
   * subtitle explaining WHICH macro the suggestion fits. Without this
   * the user sees "Close fit" but doesn't know what's being fitted —
   * the algorithm reads as a black box. Computed by
   * `whyLineForSuggestion` in `northStarSuggestion.ts` and passed in
   * by the host. Optional so older callers / non-default kinds remain
   * source-compatible.
   */
  whyLine?: string;
  /**
   * Figma `654:2` hero meta row — optional cook time in minutes. When
   * present a "· {n} min" chip with a Clock glyph renders after the
   * kcal span. Sourced from the recipe (`cookTimeMin`) by the host;
   * absent for recipes with no recorded time — the chip degrades away.
   */
  cookTimeMin?: number;
}

export interface NorthStarBlockProps {
  kind: NorthStarKind;
  suggestion?: NorthStarBlockSuggestion;
  ctaLabel?: string;
  onPrimaryCta?: () => void;
  onSkip?: () => void;
  onBrowse?: () => void;
  onOpenLibrary?: () => void;
  /** Figma `654:2` slot overline — "Dinner suggestion", etc. */
  slotEyebrow?: string;
  testID?: string;
}

const SKIP_THRESHOLD = 50;
const FIGMA_HERO_HEIGHT = 320;

export function NorthStarBlock({
  kind,
  suggestion,
  ctaLabel = "Log it",
  onPrimaryCta,
  onSkip,
  onBrowse,
  onOpenLibrary,
  slotEyebrow = "Meal suggestion",
  testID,
}: NorthStarBlockProps) {
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();
  // Secondary accent (Frost flag → damson, else clay) for the Browse link, the
  // "What to eat next" overline, and the suggestion CTA. Read before the early
  // returns so the hook is always called. The band-fit green chip + plum keep
  // their own tokens.
  const accent = useAccent();

  if (kind === "over-budget") {
    return (
      <View
        testID={testID ?? "north-star-over-budget"}
        accessibilityRole="text"
        style={{ paddingHorizontal: Spacing.xs, paddingVertical: Spacing.sm }}
      >
        <Text style={[Type.caption, { color: colors.textSecondary }]}>
          {"You've hit your calories for today — eat freely, or save for tomorrow."}
        </Text>
      </View>
    );
  }

  if (kind === "new-user") {
    return (
      <SupprCard lift="flat"
        testID={testID ?? "north-star-new-user"}
        tone="primary"
        padding="md"
        innerStyle={styles.row}
      >
        <Sparkles size={IconSize.lg} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[Type.body, { color: colors.text, fontWeight: "600" }]}>
            {"Log your first meal — suggestions get smarter once we've seen you eat."}
          </Text>
        </View>
      </SupprCard>
    );
  }

  if (kind === "library-empty") {
    // 2026-05-23 — flattened from a primary-tinted SupprCard with a
    // separate solid CTA pill into a single tappable inset row with a
    // chevron. Same grammar as the Discover "Import from TikTok" row
    // and the Today section dividers — much quieter, doesn't compete
    // with the meal slots above. The whole row is the tap target.
    return (
      <Pressable
        testID={testID ?? "north-star-library-empty"}
        accessibilityRole="button"
        accessibilityLabel="Pick recipes for your library"
        onPress={onOpenLibrary}
        style={({ pressed }) => [
          styles.libraryEmptyRow,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Sparkles size={18} color={colors.textTertiary} />
        <Text
          style={[
            Type.body,
            { color: colors.textSecondary, flex: 1, fontSize: 14 },
          ]}
        >
          {"Pick a few recipes — we'll suggest from there."}
        </Text>
        <ChevronRight size={18} color={colors.textTertiary} />
      </Pressable>
    );
  }

  if (kind === "no-fit") {
    return (
      <SupprCard lift="flat"
        testID={testID ?? "north-star-no-fit"}
        tone="neutral"
        padding="md"
        innerStyle={styles.row}
      >
        <Text style={[Type.body, { color: colors.textSecondary, flex: 1 }]}>
          Library has nothing under your remaining macros today.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse"
          onPress={onBrowse}
          hitSlop={6}
        >
          <Text
            style={[
              Type.caption,
              { color: accent.primary, fontWeight: "700" },
            ]}
          >
            Browse →
          </Text>
        </Pressable>
      </SupprCard>
    );
  }

  if (!suggestion) return null;

  if (isFeatureEnabled("today_meals_figma_654")) {
    return (
      <NorthStarFigmaHero
        suggestion={suggestion}
        slotEyebrow={slotEyebrow}
        onPrimaryCta={onPrimaryCta}
        onSkip={onSkip}
        reduceMotion={reduceMotion}
        colors={colors}
        testID={testID}
      />
    );
  }

  return (
    <NorthStarDefault
      suggestion={suggestion}
      ctaLabel={ctaLabel}
      onPrimaryCta={onPrimaryCta}
      onSkip={onSkip}
      reduceMotion={reduceMotion}
      colors={colors}
      testID={testID}
    />
  );
}

function NorthStarFigmaHero({
  suggestion,
  slotEyebrow,
  onPrimaryCta,
  onSkip,
  reduceMotion,
  colors,
  testID,
}: {
  suggestion: NorthStarBlockSuggestion;
  slotEyebrow: string;
  onPrimaryCta?: () => void;
  onSkip?: () => void;
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

  return (
    <View testID={testID ?? "north-star-figma-hero"} style={{ marginBottom: Spacing.xl }}>
      <Text
        style={[
          Type.title,
          { color: colors.navPrimary, marginBottom: Spacing.md },
        ]}
      >
        What to eat next
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${slotEyebrow}: ${suggestion.title}, ${suggestion.predictedCalories} kcal`}
        onPress={onPrimaryCta}
        style={styles.figmaHeroCard}
      >
        <View style={StyleSheet.absoluteFill}>
          {suggestion.thumbnail ? (
            <Image
              source={{ uri: suggestion.thumbnail }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
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
              <Stop offset="0" stopColor="#221B26" stopOpacity={0.9} />
              <Stop offset="0.5" stopColor="#221B26" stopOpacity={0.2} />
              <Stop offset="1" stopColor="#221B26" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#north-star-scrim)" />
        </Svg>
        {showFitsBadge ? (
          <View style={styles.figmaFitsBadge}>
            <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
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
            <X size={14} color="#FFFFFF" strokeWidth={2.25} />
          </Pressable>
        ) : null}
        <View style={styles.figmaHeroFooter}>
          <Text style={styles.figmaSlotEyebrow}>{slotEyebrow}</Text>
          <Text style={styles.figmaHeroTitle} numberOfLines={2}>
            {suggestion.title}
          </Text>
          <View style={styles.figmaKcalRow}>
            <Flame size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.figmaKcalText}>
              {suggestion.predictedCalories} kcal
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
      </Pressable>
    </View>
  );
}

interface NorthStarDefaultProps {
  suggestion: NorthStarBlockSuggestion;
  ctaLabel: string;
  onPrimaryCta?: () => void;
  onSkip?: () => void;
  reduceMotion: boolean;
  colors: ReturnType<typeof useThemeColors>;
  testID?: string;
}

function NorthStarDefault({
  suggestion,
  ctaLabel,
  onPrimaryCta,
  onSkip,
  reduceMotion,
  colors,
  testID,
}: NorthStarDefaultProps) {
  // Secondary accent (Frost flag → damson, else clay) for the "What to eat
  // next" overline + the suggestion CTA. The band-fit green chip + plum keep
  // their own tokens.
  const accent = useAccent();
  // Pan responder for swipe-to-skip. We use raw PanResponder rather
  // than reanimated here because the block is a single-state gesture
  // (commit on release > threshold) — the simplicity of PanResponder
  // is appropriate. Reduce-motion users see a top-right `X` button
  // instead of the gesture.
  //
  // Defensive: PanResponder isn't present in the test-time RN shim
  // (see apps/mobile/tests/shims/react-native.cjs) — guard the
  // .create call so unit tests can mount the block without throwing.
  // The gesture path is exercised on-device only; tests target the
  // reduce-motion `X` button fallback.
  const responder = React.useMemo(() => {
    if (
      typeof PanResponder === "undefined" ||
      typeof (PanResponder as { create?: unknown })?.create !== "function"
    ) {
      return { panHandlers: {} } as { panHandlers: Record<string, unknown> };
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (
        _evt: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => !reduceMotion && gesture.dx < -8 && Math.abs(gesture.dy) < 12,
      onPanResponderRelease: (
        _evt: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => {
        if (gesture.dx <= -SKIP_THRESHOLD && onSkip) {
          if (process.env.EXPO_OS === "ios") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          onSkip();
        }
      },
    });
  }, [onSkip, reduceMotion]);

  // 2026-05-12 (premium-bar audit DC2 polish — Cal AI 200ms fade-up
  // on first paint): the suggestion card eases in over 220ms with a
  // small upward translate so it lands as a deliberate moment, not a
  // pop-in. Reduce-motion users see no animation (skip the tween).
  const fadeOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const fadeTranslate = useSharedValue(reduceMotion ? 0 : 6);
  React.useEffect(() => {
    if (reduceMotion) {
      fadeOpacity.value = 1;
      fadeTranslate.value = 0;
      return;
    }
    fadeOpacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    fadeTranslate.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, fadeOpacity, fadeTranslate]);
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
    transform: [{ translateY: fadeTranslate.value }],
  }));

  return (
    <AnimatedView
      {...responder.panHandlers}
      testID={testID ?? "north-star-default"}
      style={fadeStyle}
    >
      <SupprCard lift="flat" tone="primary" padding="md" innerStyle={styles.defaultCard}>
        {reduceMotion && onSkip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip this suggestion"
            onPress={onSkip}
            hitSlop={6}
            style={styles.skipButton}
          >
            <X size={14} color={colors.textSecondary} strokeWidth={2.25} />
          </Pressable>
        ) : null}

        {/* 2026-05-14 (premium-bar audit DC2 polish — Recime hero
            image): the suggestion card always renders a 64×64
            thumbnail. When the suggestion carries a real
            `thumbnail` URL we render it as an `<Image>`; otherwise
            the deterministic `RecipeHeroFallback` paints the
            cuisine-tinted gradient + glyph so the card never falls
            through to a flat tint placeholder. Border-radius 8 to
            match the bumped 64pt thumb spec. */}
        <View style={styles.thumb}>
          {suggestion.thumbnail ? (
            <Image
              source={{ uri: suggestion.thumbnail }}
              style={{ width: "100%", height: "100%", borderRadius: 8 }}
            />
          ) : (
            <RecipeHeroFallback
              id={suggestion.recipeId}
              title={suggestion.title}
              iconSize={28}
            />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Sparkles size={IconSize.xs} color={accent.primary} />
            <Text
              style={{
                ...Type.label,
                color: accent.primary,
              }}
            >
              What to eat next
            </Text>
          </View>
          <Text
            style={[Type.headline, { color: colors.text, marginTop: 2 }]}
            numberOfLines={2}
          >
            {suggestion.title}
          </Text>
          {suggestion.whyLine ? (
            // 2026-05-12 (premium-bar audit DC2 polish — "Why this
            // recommendation?" disclosure): the whyLine is now
            // tappable. Tap surfaces an Alert with the longer
            // reasoning (band label + macro fit composition) so
            // power users can audit the engine without leaving the
            // card. MacroFactor parity.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${suggestion.whyLine}. Tap for full reasoning.`}
              hitSlop={4}
              onPress={() => {
                Alert.alert(
                  "Why this suggestion?",
                  [
                    suggestion.whyLine,
                    `Macro fit: ${suggestion.bandLabel.toLowerCase()}.`,
                    `Predicted: ${suggestion.predictedCalories} kcal · ${Math.round(suggestion.predictedProtein)}g P · ${Math.round(suggestion.predictedCarbs)}g C · ${Math.round(suggestion.predictedFat)}g F.`,
                    "Sloe picks the saved recipe that best closes the gap to your remaining macros for today. Re-run by skipping (swipe left) to see another candidate.",
                  ].filter(Boolean).join("\n\n"),
                );
              }}
              style={{ alignSelf: "flex-start", paddingVertical: 2 }}
            >
              <Text
                style={[
                  Type.caption,
                  {
                    color: colors.textSecondary,
                    marginTop: 2,
                    textDecorationLine: "underline",
                    textDecorationStyle: "dotted",
                  },
                ]}
                numberOfLines={1}
              >
                {suggestion.whyLine}
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: suggestion.bandTight
                    ? "rgba(34,168,96,0.10)"
                    : colors.cardBorder,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: suggestion.bandTight ? MacroColors.calories : colors.textSecondary,
                }}
              >
                {suggestion.bandLabel}
              </Text>
            </View>
            {/* 2026-05-12 (premium-bar audit cross-cutting): macro
                format unified to `698 kcal · 22g P · 95g C · 27g F`
                across Today + Eat Again + Plan grid. Was slash-
                separated (`22P / 95C / 27F`). */}
            <Text
              style={[
                Type.caption,
                {
                  color: colors.textSecondary,
                  fontVariant: ["tabular-nums"],
                },
              ]}
            >
              {suggestion.predictedCalories} kcal · {Math.round(suggestion.predictedProtein)}g P · {Math.round(suggestion.predictedCarbs)}g C · {Math.round(suggestion.predictedFat)}g F
            </Text>
          </View>

          {/* Premium-feel papercut #3 (audit 2026-04-29): the CTA
              previously used solid Accent.primary, matching the
              persistent Today FAB and creating two competing
              same-colour buttons within a thumb's reach. Demote to
              a subtle-fill variant (8% accent + accent text) so the
              FAB stays the loudest pixel and this card reads as a
              suggestion, not a demand. (Accent flag-aware → damson
              under Frost; the plum FAB is unchanged.) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            onPress={onPrimaryCta}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: `${accent.primary}14`,
                marginTop: 8,
                alignSelf: "flex-start",
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.ctaLabel, { color: accent.primary }]}>{ctaLabel}</Text>
          </Pressable>
        </View>
      </SupprCard>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  libraryEmptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  defaultCard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: Spacing.md,
  },
  // 2026-05-12 (premium-bar audit, DC2 polish): bumped 56→64 to match
  // the Recime hero-image size for the "what to eat next" card. The
  // image is the trust signal that converts the suggestion into "yes
  // I want that" — 56 was reading as a small avatar, 64 reads as a
  // proper thumbnail. Same ratio as macro tile internal padding so
  // the whole card breathes correctly.
  // 2026-05-14 — borderRadius 12 → 8 + overflow hidden so the
  // optional `RecipeHeroFallback` (absolute-positioned svg) clips to
  // the thumbnail's rounded edge. 8 matches the audit spec.
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cta: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  skipButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  figmaHeroCard: {
    height: FIGMA_HERO_HEIGHT,
    borderRadius: Radius.lg,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#221B26",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  figmaFitsBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(94,124,90,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  figmaFitsText: {
    color: "#FFFFFF",
    fontSize: 12,
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
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  figmaHeroFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    padding: 20,
  },
  figmaSlotEyebrow: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(201,194,214,0.9)",
    marginBottom: 4,
  },
  figmaMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  figmaHeroTitle: {
    fontFamily: Type.display.fontFamily,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "500",
    color: "#FFFFFF",
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

export default NorthStarBlock;
