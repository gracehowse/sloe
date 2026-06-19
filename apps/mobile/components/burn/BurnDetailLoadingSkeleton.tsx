import { StyleSheet, View } from "react-native";

import { Shimmer } from "@/components/ui/SkeletonRow";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * BurnDetailLoadingSkeleton — ENG-768 deeplink skeleton parity (mobile).
 *
 * Replaces the raw centred `ActivityIndicator` + "Loading…" on the
 * Activity Bonus / burn-detail deeplink with a silhouette of the loaded
 * layout: hero kcal card → "Breakdown" section card → "Activity bonus"
 * section card. Reuses the shared `Shimmer` primitive (the same pulse the
 * Today / Library / Discover skeletons use) and the `CARD_RADIUS` /
 * `Spacing` / `Radius` tokens, matching the Progress tab's tile treatment
 * (card-footprint placeholders, no invented numbers).
 *
 * Flag-gated by `deeplink_skeletons` at the call site — when the flag is
 * OFF the legacy spinner renders instead, so this component is the ON
 * branch only.
 */
export function BurnDetailLoadingSkeleton() {
  const colors = useThemeColors();
  return (
    <View
      testID="burn-detail-loading-skeleton"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your activity summary"
      style={{ gap: Spacing.lg }}
    >
      {/* Hero kcal card silhouette — glyph chip + big numeral + caption. */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <View style={{ alignItems: "center", gap: Spacing.dense }}>
          <Shimmer style={{ width: 44, height: 44, borderRadius: Radius.full }} />
          <Shimmer style={{ width: 140, height: 56, borderRadius: Radius.md }} />
          <Shimmer style={{ width: 160, height: 12, borderRadius: Radius.sm }} />
        </View>
      </View>

      {/* "Breakdown" section — label + four stat rows. */}
      <View style={{ gap: Spacing.sm }}>
        <Shimmer
          style={{
            width: 96,
            height: 10,
            borderRadius: Radius.sm,
            marginLeft: 4,
          }}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              paddingVertical: 0,
              paddingHorizontal: 0,
            },
          ]}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.dense,
                paddingVertical: 16,
                paddingHorizontal: Spacing.md,
                borderBottomWidth: i === 3 ? 0 : StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              }}
            >
              <Shimmer
                style={{ width: 40, height: 40, borderRadius: Radius.full }}
              />
              <View style={{ flex: 1, gap: Spacing.sm }}>
                <Shimmer style={{ width: "55%", height: 13, borderRadius: Radius.sm }} />
                <Shimmer style={{ width: "80%", height: 10, borderRadius: Radius.sm }} />
              </View>
              <Shimmer style={{ width: 48, height: 18, borderRadius: Radius.sm }} />
            </View>
          ))}
        </View>
      </View>

      {/* "Activity bonus" section — label + summary card. */}
      <View style={{ gap: Spacing.sm }}>
        <Shimmer
          style={{
            width: 110,
            height: 10,
            borderRadius: Radius.sm,
            marginLeft: 4,
          }}
        />
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={{ gap: Spacing.dense }}>
            <View style={styles.bonusRow}>
              <Shimmer style={{ width: 100, height: 13, borderRadius: Radius.sm }} />
              <Shimmer style={{ width: 56, height: 18, borderRadius: Radius.sm }} />
            </View>
            <View style={styles.bonusRow}>
              <Shimmer style={{ width: 140, height: 13, borderRadius: Radius.sm }} />
              <Shimmer style={{ width: 56, height: 18, borderRadius: Radius.sm }} />
            </View>
            <View
              style={[
                styles.bonusRow,
                {
                  paddingTop: Spacing.md,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Shimmer style={{ width: 90, height: 15, borderRadius: Radius.sm }} />
              <Shimmer style={{ width: 120, height: 26, borderRadius: Radius.md }} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  bonusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
