import { Pressable, StyleSheet, Text, View } from "react-native";
import { Scale } from "lucide-react-native";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { WeightPoint } from "@/lib/progress/weightTrend";
import Svg, { Circle, Line } from "react-native-svg";

type Props = {
  points: WeightPoint[];
  onLogWeight: () => void;
};

export function WeightSparseState({ points, onLogWeight }: Props) {
  const colors = useThemeColors();

  if (points.length === 0) {
    return (
      <View style={styles.container}>
        <Scale size={32} color={colors.textTertiary} strokeWidth={1.5} />
        <Text style={[styles.headline, { color: colors.text }]}>No weigh-ins yet</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Log your first weight to start a trend.
        </Text>
        <Pressable style={[styles.btn, { backgroundColor: Accent.primary }]} onPress={onLogWeight}>
          <Text style={styles.btnText}>Log weight</Text>
        </Pressable>
      </View>
    );
  }

  if (points.length === 1) {
    const kg = points[0]!.kg;
    return (
      <View style={styles.container}>
        <Scale size={32} color={colors.textTertiary} strokeWidth={1.5} />
        <Text style={[styles.singleValue, { color: colors.text }]}>{kg.toFixed(1)} kg</Text>
        <Text style={[styles.headline, { color: colors.text }]}>One weigh-in logged</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Add two more to see a trend line.
        </Text>
        <Pressable style={[styles.btn, { backgroundColor: Accent.primary }]} onPress={onLogWeight}>
          <Text style={styles.btnText}>Log weight</Text>
        </Pressable>
      </View>
    );
  }

  // 2 points — two dots + thin connecting line, no MA
  const w = 200;
  const h = 48;
  const x0 = 20;
  const x1 = w - 20;
  const p0 = points[0]!;
  const p1 = points[1]!;
  const minKg = Math.min(p0.kg, p1.kg);
  const maxKg = Math.max(p0.kg, p1.kg);
  const span = maxKg - minKg || 1;
  const y0 = h - 8 - ((p0.kg - minKg) / span) * (h - 16);
  const y1 = h - 8 - ((p1.kg - minKg) / span) * (h - 16);

  return (
    <View style={[styles.container, { paddingBottom: Spacing.sm }]}>
      <Svg width={w} height={h}>
        {/* 2026-05-12 (premium-bar audit DC5 polish): dashed 2-point
            line switched to solid. Audit: "DC5 — Sparse-state weight
            chart" is BETTER THAN BAR vs Withings, except the dashed
            line in the 2-point state read as "tentative/in-flight"
            when it should read "real trend, just early". Withings ships
            solid lines at every density. */}
        <Line
          x1={x0} y1={y0} x2={x1} y2={y1}
          stroke={colors.textSecondary}
          strokeWidth={1.5}
        />
        <Circle cx={x0} cy={y0} r={4} fill={colors.card} stroke={colors.textSecondary} strokeWidth={1.5} />
        <Circle cx={x1} cy={y1} r={4} fill={colors.card} stroke={Accent.primary} strokeWidth={1.5} />
      </Svg>
      <Text style={[styles.sparseCaption, { color: colors.textTertiary }]}>
        Trend appears after 3 weigh-ins.
      </Text>
      <Pressable style={[styles.btn, { backgroundColor: Accent.primary, marginTop: Spacing.sm }]} onPress={onLogWeight}>
        <Text style={styles.btnText}>Log weight</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  headline: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  singleValue: {
    fontSize: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  body: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  sparseCaption: {
    fontSize: 11,
    textAlign: "center",
  },
  btn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  btnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
