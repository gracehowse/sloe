import { Pressable, StyleSheet, Text, View } from "react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { WeightRange } from "@/lib/progress/weightTrend";

// 2026-05-12 (Grace TF chart parity with Withings): full-word labels
// replace the compact 1W / 1M / 3M / 1Y form. Withings ships
// Week / Month / Quarter / Year / All — words read more calmly and
// don't require the user to mentally expand "3M" → "three months".
const RANGES: { key: WeightRange; label: string }[] = [
  { key: "1w", label: "Week" },
  { key: "1m", label: "Month" },
  { key: "3m", label: "Quarter" },
  { key: "1y", label: "Year" },
  { key: "all", label: "All" },
];

type Props = {
  value: WeightRange;
  onChange: (range: WeightRange) => void;
};

export function WeightRangeToggle({ value, onChange }: Props) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.inputBg }]}>
      {RANGES.map(({ key, label }) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            style={[styles.pill, active && { backgroundColor: colors.card, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}
            onPress={() => onChange(key)}
          >
            <Text
              style={[
                styles.label,
                { color: active ? colors.text : colors.textSecondary },
                active && { fontWeight: "600" },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: Radius.full,
    padding: 3,
    alignSelf: "stretch",
  },
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
  },
});
