import { StyleSheet, Text, View } from "react-native";
import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { LucideIcon } from "lucide-react-native";

type Props = {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string | null | undefined;
  stale?: boolean;
  isFirst?: boolean;
};

export function HealthDataRow({ icon: Icon, tint, label, value, stale, isFirst }: Props) {
  const colors = useThemeColors();

  const displayValue = value ?? "—";
  const valueColor =
    !value ? colors.textTertiary : stale ? colors.textSecondary : colors.text;

  return (
    <View style={[styles.row, !isFirst && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={styles.left}>
        <Icon size={16} color={tint} />
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: valueColor }]}>{displayValue}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
