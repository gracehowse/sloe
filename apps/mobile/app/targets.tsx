import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Beef,
  Wheat,
  Droplets,
  Leaf,
} from "lucide-react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets, calculateTDEE } from "@/lib/calcTargets";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { dateKeyFromDate } from "../../../src/lib/nutrition/trackerStats";
import {
  activityLevelCaption,
  deficitSurplusCaption,
  buildMacroTiles,
  buildGoalCard,
} from "../../../src/lib/targets/targetsView";

/**
 * Targets screen — 2026-04-20 prototype port. Dedicated surface that
 * shows the user's daily calorie target, macro progress for today,
 * and the weight goal timeline. The Edit action routes to
 * `/profile`, which owns the form (prototype is a read surface; the
 * existing profile form is intentionally preserved as the write
 * surface so we don't duplicate state).
 */
export default function TargetsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)");
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState({
    calories: NUTRITION_DEFAULTS.calories,
    protein: NUTRITION_DEFAULTS.protein,
    carbs: NUTRITION_DEFAULTS.carbs,
    fat: NUTRITION_DEFAULTS.fat,
    fiber: NUTRITION_DEFAULTS.fiber,
  });
  const [consumed, setConsumed] = useState({
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [tdeeKcal, setTdeeKcal] = useState<number | null>(null);
  // 2026-04-30 (#1): mirror the net-carbs lens decision used on Today.
  // Without this, Today and /targets disagreed on the carbs target
  // (Today rendered net carbs while /targets always showed gross),
  // creating the appearance of a profile-targets divergence bug.
  const [netCarbsLensEnabled, setNetCarbsLensEnabled] = useState(false);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, weight_kg, goal_weight_kg, weight_kg_by_day, height_cm, sex, activity_level, goal, dob, age, plan_pace, net_carbs_lens_enabled",
        )
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !data) {
        if (!cancelled) setLoading(false);
        return;
      }
      const d = data as Record<string, unknown>;
      const resolved = resolveTargets(
        {
          target_calories: d.target_calories != null ? Number(d.target_calories) : null,
          target_protein: d.target_protein != null ? Number(d.target_protein) : null,
          target_carbs: d.target_carbs != null ? Number(d.target_carbs) : null,
          target_fat: d.target_fat != null ? Number(d.target_fat) : null,
          target_fiber_g: d.target_fiber_g != null ? Number(d.target_fiber_g) : null,
        },
        {
          weight_kg: d.weight_kg != null ? Number(d.weight_kg) : null,
          height_cm: d.height_cm != null ? Number(d.height_cm) : null,
          sex: typeof d.sex === "string" ? d.sex : null,
          activity_level: typeof d.activity_level === "string" ? d.activity_level : null,
          goal: typeof d.goal === "string" ? d.goal : null,
          dob: typeof d.dob === "string" ? d.dob : null,
          age: d.age != null ? Number(d.age) : null,
          plan_pace: typeof d.plan_pace === "string" ? d.plan_pace : null,
        },
      );
      setTargets({
        calories: resolved.calories,
        protein: resolved.protein,
        carbs: resolved.carbs,
        fat: resolved.fat,
        fiber: resolved.fiber,
      });
      setNetCarbsLensEnabled(Boolean((d as Record<string, unknown>).net_carbs_lens_enabled));
      const lvl = typeof d.activity_level === "string" ? d.activity_level : null;
      setActivityLevel(lvl);
      setGoal(typeof d.goal === "string" ? d.goal : null);
      const w = d.weight_kg != null ? Number(d.weight_kg) : null;
      const h = d.height_cm != null ? Number(d.height_cm) : null;
      const age = d.age != null ? Number(d.age) : null;
      const sex = typeof d.sex === "string" ? d.sex : null;
      if (w != null && h != null && age != null && sex != null && lvl != null) {
        setTdeeKcal(calculateTDEE(sex, w, h, age, lvl));
      }
      setWeightKg(w);
      setGoalWeightKg(d.goal_weight_kg != null ? Number(d.goal_weight_kg) : null);
      const wMap = d.weight_kg_by_day;
      if (wMap && typeof wMap === "object" && !Array.isArray(wMap)) {
        const parsed: Record<string, number> = {};
        for (const [k, v] of Object.entries(wMap as Record<string, unknown>)) {
          const n = typeof v === "number" ? v : Number(v);
          if (Number.isFinite(n)) parsed[k] = n;
        }
        setWeightKgByDay(parsed);
      }

      // Today's consumed macros — sum meals for today from `meals`.
      const todayKey = dateKeyFromDate(new Date());
      const { data: mealsData } = await supabase
        .from("meals")
        .select("protein, carbs, fat, fiber_g")
        .eq("user_id", userId)
        .eq("log_date", todayKey);
      if (!cancelled && Array.isArray(mealsData)) {
        const sum = mealsData.reduce(
          (acc, m: any) => ({
            protein: acc.protein + (Number(m.protein) || 0),
            carbs: acc.carbs + (Number(m.carbs) || 0),
            fat: acc.fat + (Number(m.fat) || 0),
            fiber: acc.fiber + (Number(m.fiber_g) || 0),
          }),
          { protein: 0, carbs: 0, fat: 0, fiber: 0 },
        );
        setConsumed(sum);
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 2026-05-02 (net-carbs toggle fix) — refresh the lens flag on every
  // screen focus so toggling "Show net carbs" in Settings flips the
  // /targets carb tile label + value without requiring a remount.
  // Cheap one-row select; runs after the bigger initial load on userId.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      (async () => {
        const { data } = await supabase
          .from("profiles")
          .select("net_carbs_lens_enabled")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        setNetCarbsLensEnabled(
          Boolean(
            (data as { net_carbs_lens_enabled?: boolean } | null)
              ?.net_carbs_lens_enabled,
          ),
        );
      })().catch(() => { /* preserve prior state on error */ });
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const macroTiles = useMemo(
    () => buildMacroTiles({ targets, consumed, netCarbsLensEnabled }),
    [targets, consumed, netCarbsLensEnabled],
  );
  const goalCard = useMemo(
    () =>
      buildGoalCard({
        currentWeightKg: weightKg,
        goalWeightKg,
        weightKgByDay,
      }),
    [weightKg, goalWeightKg, weightKgByDay],
  );
  const tdeeCaption = useMemo(() => {
    const base = `Estimated TDEE based on Mifflin-St Jeor · ${activityLevelCaption(activityLevel)}`;
    const tail = deficitSurplusCaption({
      targetCalories: targets.calories,
      tdeeKcal,
      goal,
    });
    return tail ? `${base} · ${tail}` : base;
  }, [activityLevel, targets.calories, tdeeKcal, goal]);

  const macroColorFor = (key: string): string => {
    switch (key) {
      case "protein":
        return MacroColors.protein;
      case "carbs":
        return MacroColors.carbs;
      case "fat":
        return MacroColors.fat;
      case "fiber":
      default:
        return MacroColors.fiber;
    }
  };

  // 2026-04-30 (#20, design-system-enforcer): retoken to lucide-react-native
  // per carryover rule #2 (prototype icon set). The previous Ionicon
  // names mapped 1:1 to the lucide equivalents already used on Today.
  const MacroIconFor = ({ macroKey, color }: { macroKey: string; color: string }) => {
    const size = 16;
    const stroke = 1.75;
    switch (macroKey) {
      case "protein":
        return <Beef size={size} color={color} strokeWidth={stroke} />;
      case "carbs":
        return <Wheat size={size} color={color} strokeWidth={stroke} />;
      case "fat":
        return <Droplets size={size} color={color} strokeWidth={stroke} />;
      case "fiber":
      default:
        return <Leaf size={size} color={color} strokeWidth={stroke} />;
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        topBar: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.sm,
          paddingBottom: Spacing.md,
        },
        backHit: { padding: 6, marginLeft: -6 },
        title: {
          flex: 1,
          fontSize: 24,
          fontWeight: "700",
          color: colors.text,
          letterSpacing: -0.4,
        },
        editBtn: {
          paddingHorizontal: Spacing.md,
          paddingVertical: 6,
          borderRadius: Radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        editText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
        scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 100, gap: Spacing.lg },
        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
        },
        overline: {
          fontSize: 11,
          fontWeight: "800",
          color: colors.textSecondary,
          letterSpacing: 1.5,
          marginBottom: 6,
        },
        bigNumber: {
          fontSize: 48,
          fontWeight: "800",
          color: colors.text,
          letterSpacing: -1.2,
          fontVariant: ["tabular-nums"],
        },
        kcalUnit: {
          fontSize: 18,
          fontWeight: "600",
          color: colors.textSecondary,
          marginLeft: 6,
        },
        caption: {
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: 8,
          lineHeight: 18,
        },
        sectionHeading: {
          fontSize: 17,
          fontWeight: "700",
          color: colors.text,
          marginTop: Spacing.sm,
          marginBottom: -Spacing.xs,
        },
        macroGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Spacing.md,
        },
        macroTile: {
          width: "47%",
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
          gap: 8,
        },
        macroHead: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        macroLabel: {
          fontSize: 11,
          fontWeight: "800",
          color: colors.textSecondary,
          letterSpacing: 1.2,
        },
        macroValue: {
          fontSize: 22,
          fontWeight: "800",
          color: colors.text,
          fontVariant: ["tabular-nums"],
        },
        macroValueUnit: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
        },
        barTrack: {
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.border,
          overflow: "hidden",
        },
        barFill: {
          height: "100%",
          borderRadius: 3,
        },
        macroRemaining: {
          fontSize: 11,
          color: colors.textTertiary,
          fontVariant: ["tabular-nums"],
        },
        goalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        goalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
        goalSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
        statusPill: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
        },
        statusText: { fontSize: 11, fontWeight: "700" },
        footnote: {
          fontSize: 12,
          color: colors.textTertiary,
          textAlign: "center",
          paddingHorizontal: Spacing.lg,
          lineHeight: 18,
        },
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
      }),
    [colors],
  );

  const statusPillStyle = (status: string | undefined) => {
    switch (status) {
      case "on_track":
        return { background: Accent.success + "22", fg: Accent.success };
      case "stalled":
        return { background: Accent.warning + "22", fg: Accent.warning };
      case "wrong_way":
        return { background: Accent.destructive + "22", fg: Accent.destructive };
      default:
        return { background: colors.border, fg: colors.textSecondary };
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Accent.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backHit} accessibilityLabel="Back">
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Targets</Text>
        <Pressable
          style={styles.editBtn}
          onPress={() => router.push("/profile")}
          accessibilityLabel="Edit targets"
        >
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Daily calorie target — 2026-04-30 audit visual-qa P1 #10:
            mirror the onboarding reveal's gradient ring so the
            "what's my target" surface has the same premium-tier
            visual ceiling as the first-time delight moment. The
            ring renders at 100% (full sweep) since this is a
            target display, not a progress display — Today owns
            the "how am I doing" view. */}
        <View style={[styles.card, { alignItems: "center" }]}>
          <Text style={styles.overline}>DAILY CALORIE TARGET</Text>
          <View
            style={{
              width: 200,
              height: 200,
              alignItems: "center",
              justifyContent: "center",
              marginVertical: Spacing.md,
            }}
          >
            <Svg
              width={200}
              height={200}
              style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
            >
              <Defs>
                <SvgLinearGradient id="targets-grad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={Accent.primaryLight} />
                  <Stop offset="1" stopColor={MacroColors.fat} />
                </SvgLinearGradient>
              </Defs>
              <Circle
                cx={100}
                cy={100}
                r={84}
                stroke={colors.inputBg}
                strokeWidth={10}
                fill="none"
              />
              <Circle
                cx={100}
                cy={100}
                r={84}
                stroke="url(#targets-grad)"
                strokeWidth={10}
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.bigNumber}>{targets.calories.toLocaleString()}</Text>
              <Text style={[styles.kcalUnit, { marginLeft: 0, marginTop: 2 }]}>
                kcal / day
              </Text>
            </View>
          </View>
          <Text style={[styles.caption, { textAlign: "center" }]}>{tdeeCaption}</Text>
        </View>

        {/* Macros */}
        <Text style={styles.sectionHeading}>Macros</Text>
        <View style={styles.macroGrid}>
          {macroTiles.map((m) => {
            const color = macroColorFor(m.key);
            return (
              <View key={m.key} style={styles.macroTile}>
                <View style={styles.macroHead}>
                  <Text style={styles.macroLabel}>{m.label}</Text>
                  <MacroIconFor macroKey={m.key} color={color} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={styles.macroValue}>
                    {m.current}
                  </Text>
                  <Text style={styles.macroValueUnit}>/ {m.target} g</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.round(m.pct * 100)}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={styles.macroRemaining}>{m.remainingLabel}</Text>
              </View>
            );
          })}
        </View>

        {/* Goal */}
        {goalCard ? (
          <View style={styles.card}>
            <View style={styles.goalHead}>
              <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                <Text style={styles.goalTitle}>{goalCard.title}</Text>
                <Text style={styles.goalSub}>{goalCard.subtitle}</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusPillStyle(goalCard.status).background },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: statusPillStyle(goalCard.status).fg },
                  ]}
                >
                  {goalCard.statusLabel}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <Text style={styles.footnote}>
          Projections assume a 14-day moving average. Targets adapt weekly based on logged intake.
        </Text>
      </ScrollView>
    </View>
  );
}
