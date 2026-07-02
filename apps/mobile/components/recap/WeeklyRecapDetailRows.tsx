import { Activity, Flame, Sprout, UtensilsCrossed } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { WeeklyRecapDetailRow } from "@suppr/shared/nutrition-core/weeklyRecapDetailRows";

const ICONS = {
  weight: Activity,
  streak: Flame,
  "most-cooked": UtensilsCrossed,
  protein: Sprout,
} as const;

/** ENG-1259 — prototype "The detail" divided set-rows (B21). */
export function WeeklyRecapDetailRows({
  rows,
  testID = "weekly-recap-detail-rows",
}: {
  rows: WeeklyRecapDetailRow[];
  testID?: string;
}) {
  const colors = useThemeColors();
  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={[styles.overline, { color: colors.textTertiary }]}>The detail</Text>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        {rows.map((row, idx) => {
          const Icon = ICONS[row.id];
          return (
            <View
              key={row.id}
              style={[
                styles.row,
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
            >
              <View style={[styles.iconPlate, { backgroundColor: colors.backgroundSecondary }]}>
                <Icon size={16} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.title, { color: colors.text }]}>{row.title}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                  {row.subtitle}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginTop: Spacing.lg },
  overline: { ...Type.caption, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 4 },
  card: { borderRadius: Radius.xl, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  iconPlate: { width: 36, height: 36, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "600" },
  subtitle: { ...Type.captionSmall, marginTop: 2 },
});

export default WeeklyRecapDetailRows;
