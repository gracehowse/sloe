import { StyleSheet, Text, View } from "react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { namedTrackerReassuranceItems } from "@suppr/shared/imports/namedTrackerReassurance";

/** ENG-1258 — lightweight supported-tracker strip (B18 option C). */
export function NamedTrackerReassuranceStrip({
  testID = "mfp-tracker-reassurance-strip",
}: {
  testID?: string;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const items = namedTrackerReassuranceItems();

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={[styles.overline, { color: colors.textTertiary }]}>Supported exports</Text>
      <View style={styles.row}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            accessibilityRole="text"
            accessibilityLabel={item.label}
          >
            <View style={[styles.mark, { backgroundColor: accent.primarySoft }]}>
              <Text style={[styles.markText, { color: accent.primarySolid }]}>{item.mark}</Text>
            </View>
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.md, gap: Spacing.sm },
  overline: { ...Type.caption, fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  mark: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { fontSize: 11, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
});

export default NamedTrackerReassuranceStrip;
