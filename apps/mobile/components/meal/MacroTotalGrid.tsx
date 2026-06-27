import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { PressableScale } from "@/components/ui/PressableScale";
import { FontFamily, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * MacroTotalGrid — the v3 `.md-totalgrid`: a 4-cell macro summary
 * (Protein / Carbs / Fat / Fibre) for the meal-detail slot rollup. Each cell is
 * a recessed-grey card with a macro dot, a serif gram value, and an uppercase
 * label; tapping it opens the day's macro-detail breakdown for that macro
 * (`/macro-detail`, the existing ENG-1213 screen — protein/carbs/fat/fiber are
 * all interactive keys). Prototype: `docs/ux/redesign/v3/Sloe-App.html`
 * `.md-totalgrid` / `.md-totalcell`.
 *
 * Fibre is REAL data (`mealContributedFiberG` / `sumDayFiberFromMeals`), not the
 * prototype's `carbs × 0.13` placeholder — we never guess nutrition. Because
 * Fibre now leads here, the host stops injecting it into the micro table (no
 * double-show). Parity twin: `src/app/components/suppr/MacroTotalGrid.tsx`.
 */
export type MacroTotalKey = "protein" | "carbs" | "fat" | "fiber";

export interface MacroTotalCell {
  key: MacroTotalKey;
  /** Display label — `"Fibre"` (UK), not the route key `"fiber"`. */
  label: string;
  grams: number;
  color: string;
}

export function MacroTotalGrid({
  cells,
  dateKey,
}: {
  cells: MacroTotalCell[];
  /** Day to open in macro-detail when a cell is tapped. */
  dateKey: string;
}) {
  const colors = useThemeColors();
  const router = useRouter();
  return (
    <View style={styles.grid}>
      {cells.map((c) => {
        const grams = Math.round(c.grams * 10) / 10;
        return (
          <PressableScale
            key={c.key}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={`${c.label} ${grams} grams — open breakdown`}
            onPress={() =>
              router.push({ pathname: "/macro-detail", params: { macro: c.key, date: dateKey } })
            }
            style={[styles.cell, { backgroundColor: colors.backgroundSecondary }]}
          >
            <View style={[styles.dot, { backgroundColor: c.color }]} />
            <Text style={[styles.value, { color: colors.text }]}>
              {grams}
              <Text style={[styles.unit, { color: colors.textTertiary }]}>g</Text>
            </Text>
            <Text style={[styles.label, { color: colors.textTertiary }]}>{c.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: 8, marginTop: Spacing.md },
  cell: {
    flex: 1,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.dense,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  dot: { width: 9, height: 9, borderRadius: 4.5, marginBottom: 6 },
  value: { fontFamily: FontFamily.serifRegular, fontSize: 24, lineHeight: 24, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FontFamily.serifRegular, fontSize: 13 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", marginTop: 5 },
});
