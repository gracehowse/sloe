import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Flame, Footprints, Moon } from "lucide-react-native";

import { Accent, FontFamily, MacroColors, MacroColorsDark, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { BurnDetailLoadingSkeleton } from "@/components/burn/BurnDetailLoadingSkeleton";
import { SupprCard } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { dateKeyFromDate } from "@suppr/nutrition-core/trackerStats";
import { resolveMaintenance } from "@suppr/nutrition-core/resolveMaintenance";
import { maintenanceIntakeFromTargetCalories } from "@/lib/calcTargets";
import { syncHealthDataThrottled, isHealthSyncAvailable } from "@/lib/healthSync";
// `filterByDateRangeDays` import removed 2026-05-13 — was only used
// by the 30-day steps chart which moved to Progress per TF feedback.
// import { filterByDateRangeDays } from "@/lib/weightProjection";
// MiniBarChart import removed 2026-05-13 — see steps-chart removal
// note further down. Re-import here when adding back any other
// bar-chart surface on this screen.
// import MiniBarChart from "@/components/charts/MiniBarChart";

function profileAgeYears(p: { dob?: string | null; age?: number | null }): number | null {
  if (p.age != null) {
    const a = typeof p.age === "number" ? p.age : Number(p.age);
    if (Number.isFinite(a) && a > 0) return Math.round(Math.min(100, Math.max(14, a)));
  }
  if (p.dob) {
    const dobMs = new Date(p.dob).getTime();
    if (Number.isFinite(dobMs)) {
      return Math.max(14, Math.min(100, Math.floor((Date.now() - dobMs) / 31557600000)));
    }
  }
  return null;
}

export default function BurnDetailScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors(), mc = useColorScheme() === "dark" ? MacroColorsDark : MacroColors;
  // Secondary accent (Frost flag → damson, else clay) for the loading spinner,
  // the workout/barbell glyph, and the Apple-Health-source switch track. The
  // burn/activity identity (rings, honey) keeps `Accent.activity*` (held).
  const accent = useAccent();
  // Theme-aware honey TEXT (base honey is fill-only — 2.3:1 even on white):
  // deep honey on light, lifted honey on dark; both clear AA. Mirrors web
  // `--activity-solid`.
  const activitySolid =
    useColorScheme() === "dark" ? Accent.activitySolidDark : Accent.activitySolid;
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
    workouts: { type: string; minutes: number; calories: number; source: string }[];
  } | null>(null);
  // 2026-05-12 (premium-bar audit weight-chart Phase 2 — Option B+):
  // 30-day steps trend chart relocated from /weight-tracker → here.
  // Burn detail is the canonical activity drill-down (per the
  // MFP + Lose It IA pattern that pairs steps with calories-out, not
  // weight). `stepsByDay` keeps the full map; `dailyStepsGoal` for
  // the goal line. Empty state still uses the existing single-day
  // "Steps" row above for "no chart yet" feel.
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(NUTRITION_DEFAULTS.steps);
  // 2026-05-13 (TF feedback `AOc1nHHposbaZ7yEgDLwPdE` — "this should
  // be a toggle so user can choose"): inline switch on this screen
  // for `prefer_activity_adjusted_calories`. Default on for new users (ENG-566).
  // opts in to having today's burn bonus add to the food budget.
  const [preferActivityAdjustedCalories, setPreferActivityAdjustedCalories] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  // 2026-04-26 polish (round 2): pre-fix the screen rendered a static
  // "Loading..." text with no spinner and no terminal state — if userId
  // was null or the profile select returned an empty row, the screen
  // stayed stuck on "Loading..." indefinitely. Track explicit loading +
  // error states so the empty-state surfaces instead of an infinite spinner.
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      // No user yet — surface a transient empty state, not an infinite
      // loading spinner. Auth will hydrate and the effect re-fires.
      setLoadError("Sign in to see your activity bonus.");
      return;
    }
    let cancelled = false;
    setLoadError(null);
    // Debug audit 2026-05-04 (code-quality #3): the IIFE was wrapping
    // a single try/catch around the HealthKit sync only — a thrown
    // rejection from the supabase select fell through, the IIFE
    // silently died, and `setLoadError` never fired. The screen sat on
    // the loading spinner forever. Now: full-body try/catch with an
    // explicit empty-state error so the user always has a recovery
    // affordance.
    (async () => {
      try {
        // Ensure HealthKit data is synced to Supabase before reading
        if (isHealthSyncAvailable()) {
          try { await syncHealthDataThrottled(userId); } catch { /* ignore */ }
        }
        if (cancelled) return;
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select(
            "activity_burn_by_day, basal_burn_by_day, steps_by_day, daily_steps_goal, workouts_by_day, target_calories, goal, plan_pace, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, sex, height_cm, weight_kg, age, dob, activity_level, prefer_activity_adjusted_calories",
          )
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (profileErr) {
          setLoadError("Could not load activity data. Pull to retry.");
          return;
        }
        if (!profile) {
          setLoadError("No profile found. Complete onboarding to see your activity bonus.");
          return;
        }
        const p = profile as any;
        const targetCal = Number(p.target_calories) || 0;
        const ageYears = profileAgeYears({ dob: p.dob, age: p.age });
        const resolved = resolveMaintenance({
          adaptive_tdee: p.adaptive_tdee != null ? Number(p.adaptive_tdee) : null,
          adaptive_tdee_confidence: p.adaptive_tdee_confidence ?? null,
          adaptive_tdee_updated_at: p.adaptive_tdee_updated_at ?? null,
          sex: p.sex ?? null,
          weight_kg: p.weight_kg != null ? Number(p.weight_kg) : null,
          height_cm: p.height_cm != null ? Number(p.height_cm) : null,
          age: ageYears,
          activity_level: p.activity_level ?? null,
        });
        const maintenanceKcal =
          resolved != null && resolved.kcal > 0
            ? resolved.kcal
            : maintenanceIntakeFromTargetCalories(targetCal, p.goal, p.plan_pace);
        setData({
          activeBurn: Math.round(Number((p.activity_burn_by_day ?? {})[viewKey]) || 0),
          restingBurn: Math.round(Number((p.basal_burn_by_day ?? {})[viewKey]) || 0),
          steps: Math.round(Number((p.steps_by_day ?? {})[viewKey]) || 0),
          maintenanceKcal,
          workouts: Array.isArray((p.workouts_by_day ?? {})[viewKey]) ? (p.workouts_by_day ?? {})[viewKey] : [],
        });
        setPreferActivityAdjustedCalories(Boolean(p.prefer_activity_adjusted_calories));
        // Hydrate the 30-day steps trend (Phase 2 relocation). The map
        // comes from HealthKit sync (mobile) or manual entry; we coerce
        // every value to a finite number, drop the rest, so the chart
        // never renders a stray NaN bar.
        const sbd = p.steps_by_day;
        if (sbd && typeof sbd === "object" && !Array.isArray(sbd)) {
          const parsed: Record<string, number> = {};
          for (const [k, v] of Object.entries(sbd as Record<string, unknown>)) {
            const n = typeof v === "number" ? v : Number(v);
            if (Number.isFinite(n)) parsed[k] = n;
          }
          setStepsByDay(parsed);
        }
        const sg = Number(p.daily_steps_goal);
        setDailyStepsGoal(
          Number.isFinite(sg) && sg > 0 ? Math.round(sg) : NUTRITION_DEFAULTS.steps,
        );
      } catch (err) {
        if (cancelled) return;
        if (typeof console !== "undefined") {
          console.warn("[burn-detail] load failed:", err instanceof Error ? err.message : err);
        }
        setLoadError("Could not load activity data. Pull to retry.");
      }
    })();
    return () => { cancelled = true; };
  }, [userId, viewKey]);

  // 30-day steps trend memo removed 2026-05-13 (TF
  // `AEAhefzqZ_0tuPnEONlytgI`) along with the chart. `stepsByDay`
  // stays in state because it still feeds today's step count
  // surface near the top of the screen.

  const totals = useMemo(() => {
    if (!data) return null;
    const actualBurn = data.restingBurn + data.activeBurn;

    if (isPast) {
      const bonus = data.maintenanceKcal > 0 ? Math.max(0, actualBurn - data.maintenanceKcal) : 0;
      return { total: actualBurn, futureBurn: 0, bonus, isProjected: false };
    }

    // Matches Lose It!'s model: bonus = projected EOD burn − full
    // maintenance. See `dayActivityBudgetAddon` in (tabs)/index.tsx
    // for the shared rationale.
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

  const dateCaption = formatDateLabel(viewKey);
  const stepsPct =
    data && dailyStepsGoal > 0
      ? Math.min(100, Math.round((data.steps / dailyStepsGoal) * 100))
      : 0;

  return (
    <View testID="screen-burn-detail" style={{ flex: 1, backgroundColor: colors.background }}>
      <PushScreenHeader
        title="Activity Summary"
        caption={dateCaption}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + 40,
          gap: Spacing.lg,
        }}
      >
        {!data && loadError ? (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: Spacing.md }}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.textTertiary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", maxWidth: 260 }}>
              {loadError}
            </Text>
          </View>
        ) : !data ? (
          // ENG-768 — deeplink cold-open loading state. Flag ON → skeleton
          // silhouette of the loaded layout (matches the Progress tab's tile
          // treatment); OFF → the legacy centred spinner (byte-identical to
          // pre-ENG-768). Ramp via the `deeplink_skeletons` PostHog flag.
          isFeatureEnabled("deeplink_skeletons") ? (
            <BurnDetailLoadingSkeleton />
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: Spacing.md }}>
              <ActivityIndicator size="small" color={accent.primary} />
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading…</Text>
            </View>
          )
        ) : (
          <>
            {/* Sits on the burn-detail scroll ground → soft lift (one-treatment, Grace 2026-06-09). */}
            <SupprCard lift="soft" padding="none" testID="burn-detail-hero">
              <View style={{ alignItems: "center", paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xl }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "rgba(214,162,74,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: Spacing.dense,
                  }}
                >
                  <Flame size={22} color={Accent.activity} strokeWidth={2} />
                </View>
                <Text
                  testID="burn-detail-hero-kcal"
                  style={{
                    fontFamily: FontFamily.serifRegular,
                    fontSize: 64,
                    lineHeight: 64,
                    color: colors.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {(totals?.total ?? data.restingBurn + data.activeBurn).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: Spacing.sm }}>
                  kcal burned · {dateCaption}
                </Text>
              </View>
            </SupprCard>

            <View>
              <Text style={{ ...Type.label, color: colors.textTertiary, marginBottom: 8, paddingHorizontal: 4 }}>
                Breakdown
              </Text>
              {/* Sits on the burn-detail scroll ground → soft lift (one-treatment, Grace 2026-06-09). */}
              <SupprCard lift="soft" padding="none" testID="burn-detail-breakdown">
                <BurnStatRow
                  icon={<Flame size={18} color={Accent.activity} strokeWidth={2} />}
                  iconBg="rgba(214,162,74,0.14)"
                  title="Active energy"
                  subtitle="Exercise, walking, movement above resting"
                  value={data.activeBurn.toLocaleString()}
                  borderColor={colors.border}
                  textColor={colors.text}
                  subtitleColor={colors.textTertiary}
                />
                <BurnStatRow
                  icon={<Moon size={18} color={colors.textSecondary} strokeWidth={2} />}
                  iconBg="rgba(106,96,114,0.10)"
                  title="Resting energy"
                  subtitle="Energy your body uses while minimally active"
                  value={data.restingBurn.toLocaleString()}
                  borderColor={colors.border}
                  textColor={colors.text}
                  subtitleColor={colors.textTertiary}
                />
                {totals?.isProjected && totals.futureBurn > 0 ? (
                  <BurnStatRow
                    icon={<Moon size={18} color={colors.textSecondary} strokeWidth={2} />}
                    iconBg="rgba(106,96,114,0.10)"
                    title="Estimated remaining"
                    subtitle="Based on your resting rate so far today"
                    value={totals.futureBurn.toLocaleString()}
                    borderColor={colors.border}
                    textColor={colors.text}
                    subtitleColor={colors.textTertiary}
                  />
                ) : null}
                <BurnStatRow
                  icon={<Footprints size={18} color={colors.textSecondary} strokeWidth={2} />}
                  iconBg="rgba(106,96,114,0.10)"
                  title="Steps"
                  subtitle="Daily movement goal"
                  value={data.steps.toLocaleString()}
                  valueSuffix={` / ${dailyStepsGoal.toLocaleString()}`}
                  borderColor={colors.border}
                  textColor={colors.text}
                  subtitleColor={colors.textTertiary}
                  isLast
                  stepsBar={{ pct: stepsPct, color: mc.calories }}
                />
                {data.workouts.map((w, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Spacing.sm,
                      paddingHorizontal: Spacing.md,
                      paddingVertical: Spacing.sm,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Ionicons name="barbell-outline" size={14} color={accent.primary} />
                    <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>{w.type}</Text>
                    {w.minutes > 0 ? (
                      <Text style={{ ...Type.captionSmall, color: colors.textSecondary }}>{w.minutes} min</Text>
                    ) : null}
                    {w.calories > 0 ? (
                      <Text style={{ fontSize: 12, fontWeight: "700", color: activitySolid, fontVariant: ["tabular-nums"] }}>
                        {w.calories}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </SupprCard>
            </View>

            {totals ? (
              <View>
                <Text style={{ ...Type.label, color: colors.textTertiary, marginBottom: 8, paddingHorizontal: 4 }}>
                  Activity bonus
                </Text>
                {/* Sits on the burn-detail scroll ground → soft lift (one-treatment, Grace 2026-06-09). */}
                <SupprCard lift="soft" padding="lg" testID="burn-detail-bonus-card" innerStyle={{ gap: 0 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.sm }}>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                      {isPast ? "Final burn" : "Projected burn"}
                    </Text>
                    <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 18, color: colors.text, fontVariant: ["tabular-nums"] }}>
                      {totals.total.toLocaleString()}
                    </Text>
                  </View>
                  {data.maintenanceKcal > 0 ? (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.sm }}>
                      <Text style={{ fontSize: 14, color: colors.textSecondary }}>Maintenance estimate</Text>
                      <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 18, color: colors.text, fontVariant: ["tabular-nums"] }}>
                        − {data.maintenanceKcal.toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                  {data.maintenanceKcal > 0 ? (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: Spacing.sm,
                        paddingTop: Spacing.md,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
                        {totals.bonus > 0 ? "Bonus earned" : "Bonus"}
                      </Text>
                      <Text
                        testID="burn-detail-bonus-result"
                        style={{
                          fontFamily: FontFamily.serifRegular,
                          fontSize: totals.bonus > 0 ? 28 : 20,
                          lineHeight: totals.bonus > 0 ? 28 : 24,
                          color: totals.bonus > 0 ? activitySolid : colors.textTertiary,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {totals.bonus > 0 ? `+${totals.bonus.toLocaleString()} kcal` : "No bonus earned"}
                      </Text>
                    </View>
                  ) : null}
                  {totals.bonus > 0 ? (
                    <View
                      testID="burn-detail-activity-budget-toggle"
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Spacing.dense,
                        marginTop: Spacing.md,
                        paddingTop: Spacing.md,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                          Add bonus to today&apos;s budget
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                            marginTop: 2,
                            lineHeight: 16,
                          }}
                        >
                          {isToday
                            ? "When on, the bonus above adds to your Today calorie target."
                            : "When on, activity bonus adds to your Today calorie target."}
                        </Text>
                      </View>
                      <Switch
                        value={preferActivityAdjustedCalories}
                        disabled={savingPreference || !userId}
                        testID="burn-detail-activity-budget-toggle-switch"
                        onValueChange={async (next) => {
                          setPreferActivityAdjustedCalories(next);
                          if (!userId) return;
                          setSavingPreference(true);
                          try {
                            const { error } = await supabase
                              .from("profiles")
                              .update({ prefer_activity_adjusted_calories: next })
                              .eq("id", userId);
                            if (error) setPreferActivityAdjustedCalories(!next);
                          } finally {
                            setSavingPreference(false);
                          }
                        }}
                        trackColor={{ true: accent.primary, false: colors.border }}
                      />
                    </View>
                  ) : null}
                </SupprCard>
                <Text style={{ ...Type.captionSmall, color: colors.textTertiary, marginTop: Spacing.dense, lineHeight: 18, paddingHorizontal: 4 }}>
                  Burn above your maintenance estimate adds to your daily food budget.
                </Text>
              </View>
            ) : null}
            {/* v3 atde-cta (ENG-1247 A3): a primary Done CTA closes the screen, not back-nav only. */}
            <SupprButton variant="primary" label="Done" onPress={() => router.back()} style={{ alignSelf: "stretch", marginTop: Spacing.lg }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function BurnStatRow({
  icon,
  iconBg,
  title,
  subtitle,
  value,
  valueSuffix,
  borderColor,
  textColor,
  subtitleColor,
  isLast = false,
  stepsBar,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  value: string;
  valueSuffix?: string;
  borderColor: string;
  textColor: string;
  subtitleColor: string;
  isLast?: boolean;
  stepsBar?: { pct: number; color: string };
}) {
  return (
    <View
      style={{
        paddingVertical: 16,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: borderColor,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.dense }}>
        {/* v3 set-ic plate (ENG-1247 A3): 36px icon plate, full-circle (Radius.full). */}
        <View style={{ width: 36, height: 36, borderRadius: Radius.full, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
          {icon}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: "500", color: textColor }}>{title}</Text>
          <Text style={{ ...Type.captionSmall, color: subtitleColor, marginTop: 2 }}>{subtitle}</Text>
        </View>
        <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 20, color: textColor, fontVariant: ["tabular-nums"] }}>
          {value}
          {valueSuffix ? (
            <Text style={{ fontSize: 13, color: subtitleColor }}>{valueSuffix}</Text>
          ) : null}
        </Text>
      </View>
      {stepsBar ? (
        <View style={{ marginTop: Spacing.dense, marginLeft: 48, height: 6, borderRadius: 3, backgroundColor: borderColor, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${stepsBar.pct}%`, borderRadius: 3, backgroundColor: stepsBar.color }} />
        </View>
      ) : null}
    </View>
  );
}
