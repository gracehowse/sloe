import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { dateKeyFromDate } from "../../../src/lib/nutrition/trackerStats";
import { maintenanceIntakeFromTargetCalories } from "@/lib/calcTargets";

export default function BurnDetailScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const todayKey = dateKeyFromDate(new Date());
  const viewKey = typeof dateParam === "string" ? dateParam : todayKey;
  const isToday = viewKey === todayKey;
  const isPast = viewKey < todayKey;

  const [data, setData] = useState<{
    activeBurn: number;
    restingBurn: number;
    steps: number;
    maintenanceKcal: number;
    workouts: Array<{ type: string; minutes: number; calories: number; source: string }>;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("activity_burn_by_day, basal_burn_by_day, steps_by_day, workouts_by_day, target_calories, goal")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data: profile }) => {
        if (!profile) return;
        const p = profile as any;
        const targetCal = Number(p.target_calories) || 0;
        setData({
          activeBurn: Math.round(Number((p.activity_burn_by_day ?? {})[viewKey]) || 0),
          restingBurn: Math.round(Number((p.basal_burn_by_day ?? {})[viewKey]) || 0),
          steps: Math.round(Number((p.steps_by_day ?? {})[viewKey]) || 0),
          maintenanceKcal: maintenanceIntakeFromTargetCalories(targetCal, p.goal),
          workouts: Array.isArray((p.workouts_by_day ?? {})[viewKey]) ? (p.workouts_by_day ?? {})[viewKey] : [],
        });
      });
  }, [userId, viewKey]);

  const totals = useMemo(() => {
    if (!data) return null;
    const actualBurn = data.restingBurn + data.activeBurn;

    if (isPast) {
      const bonus = data.maintenanceKcal > 0 ? Math.max(0, actualBurn - data.maintenanceKcal) : 0;
      return { total: actualBurn, futureBurn: 0, bonus, isProjected: false };
    }

    const now = new Date();
    const hoursElapsed = now.getHours() + now.getMinutes() / 60;
    const hourlyResting = hoursElapsed > 0 && data.restingBurn > 0 ? data.restingBurn / hoursElapsed : 0;
    const futureBurn = Math.round(hourlyResting * Math.max(0, 24 - hoursElapsed));
    const projected = actualBurn + futureBurn;
    const bonus = data.maintenanceKcal > 0 ? Math.max(0, projected - data.maintenanceKcal) : 0;
    return { total: projected, futureBurn, bonus, isProjected: true };
  }, [data, isPast]);

  function formatDateLabel(dk: string): string {
    if (dk === todayKey) return "Today";
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (dk === dateKeyFromDate(y)) return "Yesterday";
    try { return new Date(dk + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
    catch { return dk; }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>Activity Bonus</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{formatDateLabel(viewKey)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 40 }}>
        {!data ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Energy rows */}
            <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Active energy</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>{data.activeBurn.toLocaleString()}</Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Exercise, walking, movement above resting</Text>
            </View>

            <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Resting energy</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>{data.restingBurn.toLocaleString()}</Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Energy your body uses while minimally active</Text>
            </View>

            {totals?.isProjected && totals.futureBurn > 0 && (
              <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Estimated remaining</Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>{totals.futureBurn.toLocaleString()}</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Projected burn for the rest of today</Text>
              </View>
            )}

            {/* Workouts */}
            {data.workouts.length > 0 && (
              <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 8 }}>Workouts</Text>
                {data.workouts.map((w, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                    <Ionicons name="barbell-outline" size={14} color={Accent.primary} />
                    <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>{w.type}</Text>
                    {w.minutes > 0 && <Text style={{ fontSize: 12, color: colors.textSecondary }}>{w.minutes} min</Text>}
                    {w.calories > 0 && <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.warning, fontVariant: ["tabular-nums"] }}>{w.calories}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Steps */}
            {data.steps > 0 && (
              <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Steps</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>{data.steps.toLocaleString()}</Text>
              </View>
            )}

            {/* Totals card */}
            {totals && (
              <View style={{ marginTop: Spacing.lg, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                    {isPast ? "Total burn" : "Projected total"}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>{totals.total.toLocaleString()}</Text>
                </View>
                {data.maintenanceKcal > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Maintenance</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>{data.maintenanceKcal.toLocaleString()}</Text>
                  </View>
                )}
                {data.maintenanceKcal > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: totals.bonus > 0 ? Accent.warning : colors.textTertiary }}>
                      {totals.bonus > 0
                        ? (isPast ? "Bonus earned" : "Bonus so far")
                        : (isPast ? "No bonus earned" : "No bonus yet")}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: totals.bonus > 0 ? Accent.warning : colors.textTertiary, fontVariant: ["tabular-nums"] }}>
                      {totals.bonus > 0 ? `+${totals.bonus.toLocaleString()}` : "0"}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: Spacing.lg, lineHeight: 16 }}>
              {isPast
                ? "Bonus calories were added to your food budget when your total burn exceeded your maintenance estimate."
                : "Bonus calories are added to your food budget when your projected total burn exceeds your maintenance estimate. This prevents double-counting since your calorie target already includes estimated daily activity."}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
