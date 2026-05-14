import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { dateKeyFromDate } from "../../../src/lib/nutrition/trackerStats";
import { resolveMaintenance } from "../../../src/lib/nutrition/resolveMaintenance";
import { maintenanceIntakeFromTargetCalories } from "@/lib/calcTargets";
import { syncHealthDataThrottled, isHealthSyncAvailable } from "@/lib/healthSync";

/**
 * 2026-05-14 (premium-bar audit Group H #5): build the last-7-days
 * burn series anchored at the current `viewKey`. Each entry is the
 * sum of resting + active for that day; missing days resolve to 0.
 * Day labels are single-letter weekday initials (M / T / W ...) so
 * the row fits in the 80px chart without overflowing on narrow
 * devices. The label-key pair is exported in viewKey-ending order
 * so the latest day is the rightmost bar.
 */
function buildSevenDayBurnSeries(
  anchorDateKey: string,
  activeByDay: Record<string, number>,
  basalByDay: Record<string, number>,
): Array<{ key: string; label: string; value: number; isAnchor: boolean }> {
  const out: Array<{ key: string; label: string; value: number; isAnchor: boolean }> = [];
  // anchor is rightmost; walk backwards 6 days, then reverse so the
  // earliest day is at the left.
  const anchor = new Date(anchorDateKey + "T12:00:00");
  const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    const key = dateKeyFromDate(d);
    const active = Number(activeByDay[key]) || 0;
    const basal = Number(basalByDay[key]) || 0;
    out.push({
      key,
      label: WEEKDAY_INITIALS[d.getDay()] ?? "",
      value: Math.max(0, Math.round(active + basal)),
      isAnchor: key === anchorDateKey,
    });
  }
  return out;
}
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

  // 2026-05-14 (premium-bar audit Group H #5): 7-day burn history.
  // `activityBurnByDay` + `basalBurnByDay` retain the raw maps so the
  // chart builder can sum them per day; the anchor day (`viewKey`) is
  // the rightmost bar.
  const [activityBurnByDay, setActivityBurnByDay] = useState<Record<string, number>>({});
  const [basalBurnByDay, setBasalBurnByDay] = useState<Record<string, number>>({});
  // 2026-05-13 (TF feedback `AOc1nHHposbaZ7yEgDLwPdE` — "this should
  // be a toggle so user can choose"): inline switch on this screen
  // for `prefer_activity_adjusted_calories`. Default off — the user
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
        // 2026-05-14 (premium-bar audit Group H #5): hydrate the 7-day
        // burn maps so the trend chart at the top of the screen has
        // historic context. Parse each entry to a finite number so a
        // stale string value never bleeds into the chart's scale.
        {
          const abd = p.activity_burn_by_day;
          if (abd && typeof abd === "object" && !Array.isArray(abd)) {
            const parsed: Record<string, number> = {};
            for (const [k, v] of Object.entries(abd as Record<string, unknown>)) {
              const n = typeof v === "number" ? v : Number(v);
              if (Number.isFinite(n)) parsed[k] = n;
            }
            setActivityBurnByDay(parsed);
          }
          const bbd = p.basal_burn_by_day;
          if (bbd && typeof bbd === "object" && !Array.isArray(bbd)) {
            const parsed: Record<string, number> = {};
            for (const [k, v] of Object.entries(bbd as Record<string, unknown>)) {
              const n = typeof v === "number" ? v : Number(v);
              if (Number.isFinite(n)) parsed[k] = n;
            }
            setBasalBurnByDay(parsed);
          }
        }
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

  // 2026-05-14 (premium-bar audit Group H #5): 7-day burn series for
  // the chart at the top of the screen. Pure derive from the
  // hydrated maps + the active `viewKey`; recomputes when the user
  // navigates back/forward between days so the chart always anchors
  // on the screen they're viewing.
  const sevenDaySeries = useMemo(
    () => buildSevenDayBurnSeries(viewKey, activityBurnByDay, basalBurnByDay),
    [viewKey, activityBurnByDay, basalBurnByDay],
  );
  const sevenDayMax = useMemo(
    () => Math.max(0, ...sevenDaySeries.map((d) => d.value)),
    [sevenDaySeries],
  );
  const sevenDayHasData = sevenDayMax > 0;

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

  return (
    <View testID="screen-burn-detail" style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>{isPast ? "Activity Summary" : "Activity Bonus"}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{formatDateLabel(viewKey)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 40 }}>
        {!data && loadError ? (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: Spacing.md }}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.textTertiary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", maxWidth: 260 }}>
              {loadError}
            </Text>
          </View>
        ) : !data ? (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: Spacing.md }}>
            <ActivityIndicator size="small" color={Accent.primary} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading…</Text>
          </View>
        ) : (
          <>
            {/* 2026-05-14 (premium-bar audit Group H #5): 7-day burn
                trend chart. Each bar is total burn (resting + active)
                for that day; the rightmost bar is `viewKey`. Brand
                primary fill; the anchor day pops at full opacity
                while the surrounding days sit at 0.55 so the
                "what day am I looking at" cue is preserved.
                Renders only when there's any non-zero burn in the
                window so an empty install doesn't show a flat row
                of zero-height bars. */}
            <View
              testID="burn-detail-seven-day-chart"
              style={{
                marginTop: 4,
                marginBottom: Spacing.lg,
                padding: Spacing.md,
                borderRadius: Radius.md,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                Last 7 days
              </Text>
              {sevenDayHasData ? (
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      height: 80,
                      gap: 6,
                    }}
                  >
                    {sevenDaySeries.map((d) => {
                      const h = sevenDayMax > 0 ? Math.max(2, (d.value / sevenDayMax) * 72) : 2;
                      return (
                        <View
                          key={d.key}
                          testID={`burn-detail-bar-${d.key}`}
                          style={{
                            flex: 1,
                            height: h,
                            borderRadius: 4,
                            backgroundColor: Accent.primary,
                            opacity: d.isAnchor ? 1 : 0.55,
                          }}
                        />
                      );
                    })}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    {sevenDaySeries.map((d, i) => (
                      <Text
                        key={`${d.key}-lbl-${i}`}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          fontSize: 10,
                          fontWeight: d.isAnchor ? "700" : "500",
                          color: d.isAnchor ? Accent.primary : colors.textTertiary,
                        }}
                      >
                        {d.label}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textTertiary,
                    textAlign: "center",
                    paddingVertical: Spacing.md,
                  }}
                >
                  No burn data yet. Connect Apple Health to populate.
                </Text>
              )}
            </View>

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
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Based on your resting rate so far today</Text>
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

            {/* Steps — single-day count */}
            {data.steps > 0 && (
              <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Steps</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>{data.steps.toLocaleString()}</Text>
              </View>
            )}

            {/* 2026-05-12 (premium-bar audit Phase 2 — relocated from
                /weight-tracker): 30-day steps trend with the user's
                daily goal as a horizontal line. Burn detail is the
                canonical activity drill-down per MFP + Lose It IA —
                steps belongs here, not on the weight surface. Renders
                only when there are at least 2 days of data.
                2026-05-13 (TF feedback `AEAhefzqZ_0tuPnEONlytgI` —
                "we don't need the last 30 days step chart here that
                belongs in progress"): the 30-day steps chart removed
                from Activity Bonus. Today's bonus surface is about
                *today's* burn — a 30-day trend chart belongs in
                Progress, not on the daily drill-down. The chart now
                lives at the top of the burn-history rail in
                Progress's burn / activity section (which still uses
                the same `stepsHistory` data shape). */}

            {/* Totals card — mirrors Lose It!'s breakdown so the rows
                above the divider visibly produce the bonus below it.
                Today: Projected burn − Maintenance = Bonus earned.
                Closed: Final burn − Maintenance = Bonus earned. */}
            {totals && (
              <View style={{ marginTop: Spacing.lg, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                    {isPast ? "Final burn" : "Projected burn"}
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
                      {totals.bonus > 0 ? "Bonus earned" : "No bonus earned"}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: totals.bonus > 0 ? Accent.warning : colors.textTertiary, fontVariant: ["tabular-nums"] }}>
                      {totals.bonus > 0 ? `+${totals.bonus.toLocaleString()}` : "0"}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 2026-05-13 (TF feedback `AOc1nHHposbaZ7yEgDLwPdE` —
                "this should be a toggle so user can choose"):
                inline switch right under the bonus so the user can
                opt in / out without digging into Settings. When ON,
                today's bonus is added to the calorie target on
                Today; OFF (default) keeps the target static and
                the bonus is informational only. Bug repro from the
                same feedback ("bonus earned over 300 but not
                reflected in target") was the default-OFF case;
                surfacing the toggle here closes the loop. */}
            {totals && totals.bonus > 0 ? (
              <View
                style={{
                  marginTop: Spacing.lg,
                  padding: Spacing.md,
                  borderRadius: Radius.md,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                    Add bonus to today&apos;s budget
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                    When on, the bonus above adds to your Today calorie target.
                  </Text>
                </View>
                <Switch
                  value={preferActivityAdjustedCalories}
                  disabled={savingPreference || !userId}
                  onValueChange={async (next) => {
                    setPreferActivityAdjustedCalories(next);
                    if (!userId) return;
                    setSavingPreference(true);
                    try {
                      const { error } = await supabase
                        .from("profiles")
                        .update({ prefer_activity_adjusted_calories: next })
                        .eq("id", userId);
                      if (error) {
                        // Roll back on error so the UI stays
                        // honest about what's persisted.
                        setPreferActivityAdjustedCalories(!next);
                      }
                    } finally {
                      setSavingPreference(false);
                    }
                  }}
                  trackColor={{ true: Accent.primary, false: colors.border }}
                />
              </View>
            ) : null}

            {/* 2026-05-07 ui-critic F6: trimmed the activity-bonus
                explainer to the one fact that matters at this level —
                "burn above maintenance counts as extra food budget".
                The longer paragraph (with the "your calorie target
                already accounts for typical daily activity" caveat)
                belongs in onboarding / a one-time tip, not under
                every burn-detail render. */}
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: Spacing.lg, lineHeight: 16 }}>
              Burn above your maintenance estimate adds to your daily food budget.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
