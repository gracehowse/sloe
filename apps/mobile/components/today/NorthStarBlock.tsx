import * as React from "react";
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { GestureResponderEvent, PanResponderGestureState } from "react-native";
import { Sparkles, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

import { SupprCard } from "@/components/ui/SupprCard";

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
  | "no-fit";

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
}

export interface NorthStarBlockProps {
  kind: NorthStarKind;
  suggestion?: NorthStarBlockSuggestion;
  ctaLabel?: string;
  onPrimaryCta?: () => void;
  onSkip?: () => void;
  onBrowse?: () => void;
  onOpenLibrary?: () => void;
  testID?: string;
}

const SKIP_THRESHOLD = 50;

export function NorthStarBlock({
  kind,
  suggestion,
  ctaLabel = "Log it",
  onPrimaryCta,
  onSkip,
  onBrowse,
  onOpenLibrary,
  testID,
}: NorthStarBlockProps) {
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();

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

  if (kind === "library-empty") {
    return (
      <SupprCard
        testID={testID ?? "north-star-library-empty"}
        tone="primary"
        padding="md"
        style={styles.row}
      >
        <Sparkles size={IconSize.lg} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[Type.body, { color: colors.text, fontWeight: "600" }]}>
            {"Pick a few recipes you'd actually cook — we'll suggest from there."}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Library"
          onPress={onOpenLibrary}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: Accent.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.ctaLabel}>Open Library →</Text>
        </Pressable>
      </SupprCard>
    );
  }

  if (kind === "no-fit") {
    return (
      <SupprCard
        testID={testID ?? "north-star-no-fit"}
        tone="neutral"
        padding="md"
        style={styles.row}
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
              { color: Accent.primary, fontWeight: "700" },
            ]}
          >
            Browse →
          </Text>
        </Pressable>
      </SupprCard>
    );
  }

  if (!suggestion) return null;

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

  return (
    <View {...responder.panHandlers} testID={testID ?? "north-star-default"}>
      <SupprCard tone="primary" padding="md" style={styles.defaultCard}>
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

        {suggestion.thumbnail ? (
          <Image source={{ uri: suggestion.thumbnail }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: `${Accent.primary}26` }]} />
        )}

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Sparkles size={IconSize.xs} color={Accent.primary} />
            <Text
              style={{
                ...Type.label,
                color: Accent.primary,
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
            <Text
              // Activation hook (audit 2026-04-30 — leak fix #5).
              // 12pt secondary matches the existing card cadence
              // (the chip + macros caption row below uses the same
              // size). Trust signal — tells the user WHICH macro
              // fits, so "Close fit" stops reading as black-box.
              style={[
                Type.caption,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
              numberOfLines={1}
            >
              {suggestion.whyLine}
            </Text>
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
                  color: suggestion.bandTight ? "#22a860" : colors.textSecondary,
                }}
              >
                {suggestion.bandLabel}
              </Text>
            </View>
            <Text
              style={[
                Type.caption,
                {
                  color: colors.textSecondary,
                  fontVariant: ["tabular-nums"],
                },
              ]}
            >
              {suggestion.predictedCalories} kcal · {Math.round(suggestion.predictedProtein)}P / {Math.round(suggestion.predictedCarbs)}C / {Math.round(suggestion.predictedFat)}F
            </Text>
          </View>

          {/* Premium-feel papercut #3 (audit 2026-04-29): the CTA
              previously used solid Accent.primary, matching the
              persistent Today FAB and creating two competing
              same-colour buttons within a thumb's reach. Demote to
              a subtle-fill variant (8% Accent + Accent text) so the
              FAB stays the loudest pixel and this card reads as a
              suggestion, not a demand. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            onPress={onPrimaryCta}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: `${Accent.primary}14`,
                marginTop: 8,
                alignSelf: "flex-start",
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.ctaLabel, { color: Accent.primary }]}>{ctaLabel}</Text>
          </Pressable>
        </View>
      </SupprCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  defaultCard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: Spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    flexShrink: 0,
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
});

export default NorthStarBlock;
