import { StyleSheet, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * LogSheet loading skeleton — the 4-row shimmer shown while Recent / Saved /
 * Library results resolve. Extracted from `LogSheet.tsx` (ENG-1643,
 * screen-budget ratchet offset) with its three private styles; behaviour is
 * byte-identical. ENG-1611: text rows load as text (no thumb) under the flag.
 */
export function SkeletonList({ colors }: { colors: ReturnType<typeof useThemeColors> }) {
  const textRows = isFeatureEnabled("ingredient_text_rows_v1");
  return (
    <View style={{ padding: Spacing.md }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          {textRows ? null : <View style={[styles.skeletonThumb, { backgroundColor: colors.skeleton }]} />}
          <View style={{ flex: 1, marginLeft: textRows ? 0 : Spacing.sm }}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.skeleton, width: "65%" }]} />
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.skeleton, width: "30%", marginTop: Spacing.xs, height: 8 },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skeletonThumb: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    opacity: 0.6,
  },
  skeletonLine: {
    height: 10,
    borderRadius: Radius.sm,
    opacity: 0.6,
  },
});

export default SkeletonList;
