import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";

/* ── Icon Box ── */
function IconBox({ color, size = 28, iconSize = 14, children }: { color: string; size?: number; iconSize?: number; children: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3.5, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

/* ── Data (placeholder — will connect to Supabase later) ── */
const DAILY_CALORIES = [
  { day: "Mon", cal: 2100, target: 2200 },
  { day: "Tue", cal: 2350, target: 2200 },
  { day: "Wed", cal: 2050, target: 2200 },
  { day: "Thu", cal: 2280, target: 2200 },
  { day: "Fri", cal: 2100, target: 2200 },
  { day: "Sat", cal: 2450, target: 2200 },
  { day: "Sun", cal: 2180, target: 2200 },
];

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const avgCalories = useMemo(() => Math.round(DAILY_CALORIES.reduce((s, d) => s + d.cal, 0) / DAILY_CALORIES.length), []);
  const proteinOnTarget = 5;
  const streakDays = 12;
  const proteinAdherence = 75;
  const carbsAdherence = 62;
  const fatAdherence = 68;

  const t = {
    text: colors.text,
    sub: colors.textSecondary,
    dim: colors.textTertiary,
    bg: colors.background,
    elevated: colors.card,
    border: colors.cardBorder,
    accent: Accent.primary,
    green: Accent.success,
    amber: Accent.warning,
    protein: MacroColors.protein,
    carbs: MacroColors.carbs,
    fat: MacroColors.fat,
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
      {/* Header */}
      <Text style={{ fontSize: 22, fontWeight: "700", color: t.text, letterSpacing: -0.4 }}>Progress</Text>
      <Text style={{ fontSize: 12, color: t.dim, marginTop: 1, marginBottom: 14 }}>Weekly report</Text>

      {/* 2x2 Stat Grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {([
          ["Avg Calories", String(avgCalories), "vs 2,100 target", t.amber, "flame-outline"],
          ["Protein Hit", `${proteinOnTarget}/7`, "days on target", t.green, "checkmark-circle-outline"],
          ["Streak", `${streakDays} days`, "protein goal", t.green, "trophy-outline"],
          ["Trend", "−0.4 kg", "on track", t.accent, "trending-down-outline"],
        ] as const).map(([title, val, sub, color, iconName], i) => (
          <View key={i} style={{ width: "48.5%", padding: 14, borderRadius: 14, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <IconBox color={color} size={24} iconSize={12}>
                <Ionicons name={iconName as any} size={12} color={color} />
              </IconBox>
              <Text style={{ fontSize: 10, color: t.dim, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: "700", color, fontVariant: ["tabular-nums"] }}>{val}</Text>
            <Text style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>{sub}</Text>
          </View>
        ))}
      </View>

      {/* Daily Calories Bar Chart */}
      <View style={{ backgroundColor: t.elevated, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: t.text, marginBottom: 12 }}>Daily Calories</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 90 }}>
          {DAILY_CALORIES.map((d, i) => {
            const overTarget = d.cal > d.target;
            const barH = (d.cal / 2400) * 70;
            return (
              <View key={d.day} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 9, color: t.dim, fontVariant: ["tabular-nums"] }}>
                  {d.cal >= 1000 ? `${(d.cal / 1000).toFixed(1)}k` : d.cal}
                </Text>
                <View style={{ width: "100%", height: barH, borderRadius: 5, backgroundColor: overTarget ? t.amber : t.green, opacity: i === 6 ? 0.4 : 0.75 }} />
                <Text style={{ fontSize: 10, color: t.dim, fontWeight: "500" }}>{d.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Macro Adherence */}
      <View style={{ backgroundColor: t.elevated, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: t.text, marginBottom: 12 }}>Macro Adherence</Text>
        {([
          ["Protein", proteinAdherence, t.protein],
          ["Carbs", carbsAdherence, t.carbs],
          ["Fat", fatAdherence, t.fat],
        ] as const).map(([name, pct, color]) => (
          <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
            <Text style={{ fontSize: 12, color: t.sub, width: 50 }}>{name}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.border }}>
              <View style={{ width: `${pct}%`, height: "100%", borderRadius: 3, backgroundColor: color }} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: "600", color, width: 32, textAlign: "right", fontVariant: ["tabular-nums"] }}>{pct}%</Text>
          </View>
        ))}
      </View>

      {/* Weekly Insight */}
      <View style={{ padding: 14, borderRadius: 14, backgroundColor: t.accent + "08", borderWidth: 1, borderColor: t.accent + "22" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <IconBox color={t.accent} size={24} iconSize={12}>
            <Ionicons name="star-outline" size={12} color={t.accent} />
          </IconBox>
          <Text style={{ fontSize: 10, fontWeight: "600", color: t.accent, letterSpacing: 0.5, textTransform: "uppercase" }}>Weekly insight</Text>
        </View>
        <Text style={{ fontSize: 12, color: t.text, lineHeight: 18 }}>
          Protein consistency is strong — {proteinOnTarget} of 7 days on target. Average intake is {avgCalories} kcal vs your 2,100 target. Keep it up!
        </Text>
      </View>
    </ScrollView>
  );
}
