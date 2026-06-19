import { StyleSheet, View } from "react-native";

import { Shimmer } from "@/components/ui/SkeletonRow";
import { Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * ShoppingLoadingSkeleton — ENG-768 deeplink skeleton parity (mobile).
 *
 * Replaces the raw centred `ActivityIndicator` + "Loading your shopping
 * list…" on the Shopping deeplink with a silhouette of the loaded layout:
 * a Progress card (label + count + track) followed by two grouped section
 * cards with checkbox item rows. Reuses the shared `Shimmer` primitive
 * (same pulse as the Today / Library / Discover skeletons) and the
 * `Spacing` / `Radius` tokens, matching the Progress tab's card-footprint
 * treatment (neutral placeholders, no invented data).
 *
 * Flag-gated by `deeplink_skeletons` at the call site — when the flag is
 * OFF the legacy spinner renders instead, so this component is the ON
 * branch only.
 */
export function ShoppingLoadingSkeleton() {
  const colors = useThemeColors();
  const card = {
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  } as const;
  return (
    <View
      testID="shopping-loading-skeleton"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your shopping list"
      style={{ gap: Spacing.md }}
    >
      {/* Progress card — label + count + track. */}
      <View style={card}>
        <View style={styles.rowBetween}>
          <Shimmer style={{ width: 76, height: 16, borderRadius: Radius.sm }} />
          <Shimmer style={{ width: 40, height: 20, borderRadius: Radius.sm }} />
        </View>
        <Shimmer style={{ width: "100%", height: 6, borderRadius: 3 }} />
      </View>

      {/* Two grouped section cards — category header + item rows. */}
      {[0, 1].map((section) => (
        <View key={section} style={card}>
          <View style={[styles.rowBetween, { marginBottom: Spacing.sm }]}>
            <Shimmer style={{ width: 120, height: 14, borderRadius: Radius.sm }} />
            <Shimmer style={{ width: 28, height: 11, borderRadius: Radius.sm }} />
          </View>
          {[0, 1, 2].map((row) => (
            <View
              key={row}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.md,
                paddingVertical: Spacing.md,
                minHeight: 52,
                borderTopWidth: row === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              <Shimmer style={{ width: 22, height: 22, borderRadius: Radius.full }} />
              <View style={{ flex: 1, gap: Spacing.sm }}>
                <Shimmer style={{ width: "60%", height: 14, borderRadius: Radius.sm }} />
                <Shimmer style={{ width: "38%", height: 10, borderRadius: Radius.sm }} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
