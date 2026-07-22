import * as React from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Spacing } from "@/constants/theme";
import { CARD_RADIUS, INSET_RADIUS } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Mobile `<SkeletonRow>` + `<SkeletonCard>` — silhouettes that match
 * meal-row / recipe-card shapes with a 700ms shimmer.
 *
 * Production design spec — 2026-04-27 §Part 3 "New components".
 * Mirror: `src/app/components/ui/skeleton-row.tsx`.
 *
 * Reduce-motion: when `AccessibilityInfo.isReduceMotionEnabled()` is
 * true, the shimmer collapses to a static muted block.
 *
 * Phase 1 ships the primitive; loading states across the app are not
 * migrated.
 */

export interface SkeletonRowProps {
  /** Number of secondary text lines. Defaults to 2. */
  lines?: 1 | 2;
  /** Whether to render a leading thumb silhouette. Defaults to true. */
  thumb?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function SkeletonRow({
  lines = 2,
  thumb = true,
  style,
  testID,
}: SkeletonRowProps) {
  const colors = useThemeColors();
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          borderRadius: CARD_RADIUS,
        },
        style,
      ]}
    >
      {thumb ? (
        <Shimmer
          style={{ width: 40, height: 40, borderRadius: INSET_RADIUS }}
        />
      ) : null}
      <View style={styles.body}>
        <Shimmer style={{ height: 14, width: "60%", borderRadius: 4 }} />
        {lines >= 2 ? (
          <Shimmer
            style={{ height: 12, width: "40%", borderRadius: 4 }}
          />
        ) : null}
      </View>
    </View>
  );
}

export interface SkeletonCardProps {
  /** Render a hero image area at the top. Defaults to true. */
  hero?: boolean;
  /** Number of body text lines. Defaults to 2. */
  lines?: 1 | 2 | 3;
  style?: ViewStyle;
  testID?: string;
}

export function SkeletonCard({
  hero = true,
  lines = 2,
  style,
  testID,
}: SkeletonCardProps) {
  const colors = useThemeColors();
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          borderRadius: CARD_RADIUS,
        },
        style,
      ]}
    >
      {hero ? (
        <Shimmer style={{ width: "100%", aspectRatio: 16 / 10 }} />
      ) : null}
      <View style={styles.cardBody}>
        <Shimmer style={{ height: 16, width: "75%", borderRadius: 4 }} />
        {Array.from({ length: lines - 1 }).map((_, i) => (
          <Shimmer
            key={i}
            style={{
              height: 12,
              width: `${50 + i * 12}%` as `${number}%`,
              borderRadius: 4,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Shimmer component — opacity tween 1 → 0.5 → 1 over 700ms.
 * Reduce-motion: skips the loop and renders static at 0.6 opacity.
 *
 * Exported (audit 2026-05-04 #7) so other surfaces — Today skeleton,
 * delete-account staged skeleton — can adopt the same pulse without
 * each writing its own Animated boilerplate.
 */
export function Shimmer({ style }: { style: ViewStyle }) {
  const colors = useThemeColors();
  const opacity = React.useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      },
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  React.useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 350,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={[
        // ENG-1479 — dedicated skeleton fill: the previous `inputBg` fill
        // went white-on-white in the v3 token migration, rendering every
        // shimmer invisible (Discover's 2.5s "blank box").
        { backgroundColor: colors.skeleton, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: Spacing.sm,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cardBody: {
    padding: Spacing.md,
    gap: 8,
  },
});

export default SkeletonRow;
