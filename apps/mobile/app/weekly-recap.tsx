/**
 * Weekly recap screen — the destination for the StreakPip tap.
 *
 * Authority: 2026-04-30 audit verdict ("cut OR finish") — the pip was
 * decorative dead UI. We finished it: the pip is now a tappable entry
 * point to a focused weekly surface that holds the calm-streak
 * posture (D-2026-04-27-07).
 *
 * Posture rules pinned by `selectClosestToTargetDay` and the existing
 * Digest primitive:
 *   - Observational copy. "You logged 5 of 7 days." Never "You missed
 *     2 days" or "You're crushing it!".
 *   - No flame, no confetti, no "🔥" or other gamification glyphs in
 *     copy. The lucide `Flame` glyph already lives inside the
 *     `<StreakPip>`; we never add another beside it.
 *   - Streak freeze ledger is surfaced as a calm "freezes available"
 *     line, not a currency. Zero earned freezes → suppress the line.
 *   - Empty / first-week / zero-day-streak state lands here with a
 *     calm explainer instead of a broken card.
 *
 * Data shape:
 *   - Reads `nutrition_entries` for the last 90 days so the current
 *     week is always in scope. Mirrors the Progress tab's window so
 *     a user landing here sees exactly the same numbers.
 *   - Reads `profiles.streak_freezes_*` for the freeze ledger.
 *   - Builds the *current* week (not the previous week the Digest
 *     covers) — the user just tapped their live pip and expects to
 *     see "where I'm at this week".
 *
 * Web parity: intentionally mobile-only for now. Web's pip lives on
 * the single-page `NutritionTracker`; there's no `/weekly-recap` route
 * to navigate to and the existing <Digest/> Sunday card already
 * surfaces the same data. Documented in the file's StreakPip JSDoc.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import {
  dateKeyFromDate,
  type ByDay,
  type JournalMeal,
} from "@/lib/nutritionJournal";
import { buildWeekStats } from "@/lib/progressWeekReport";
import { selectClosestToTargetDay, formatWeekLabel } from "@/lib/weeklyRecap";
import {
  availableFreezes,
  computeProtectedStreak,
  readFreezeLedger,
  type FreezeLedger,
} from "@/lib/streakFreeze";
import { StreakPip } from "@/components/today/StreakPip";

type LoadState = "loading" | "ready" | "empty" | "error";

const DEFAULT_TARGETS = {
  calories: NUTRITION_DEFAULTS.calories,
  protein: NUTRITION_DEFAULTS.protein,
  carbs: NUTRITION_DEFAULTS.carbs,
  fat: NUTRITION_DEFAULTS.fat,
};

export default function WeeklyRecapScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [state, setState] = useState<LoadState>("loading");
  const [byDay, setByDay] = useState<ByDay>({});
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({
    earnedAt: [],
    usedHistory: [],
  });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);

  const loadData = useCallback(async () => {
    if (!userId) {
      setState("empty");
      return;
    }
    setState("loading");

    // 90-day window matches the Progress tab so the numbers can never
    // disagree by source. Anything older isn't displayed on this
    // screen so there's no point pulling it.
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    try {
      const [{ data: rows, error: rowsErr }, { data: profile, error: profErr }] =
        await Promise.all([
          supabase
            .from("nutrition_entries")
            .select("date_key, calories, protein, carbs, fat")
            .eq("user_id", userId)
            .gte("date_key", ninetyDaysAgo)
            .order("created_at", { ascending: true }),
          supabase
            .from("profiles")
            .select(
              "target_calories, target_protein, target_carbs, target_fat, week_start_day, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history",
            )
            .eq("id", userId)
            .maybeSingle(),
        ]);

      if (rowsErr || profErr) {
        setState("error");
        return;
      }

      if (profile) {
        setTargets({
          calories: (profile.target_calories as number) ?? DEFAULT_TARGETS.calories,
          protein: (profile.target_protein as number) ?? DEFAULT_TARGETS.protein,
          carbs: (profile.target_carbs as number) ?? DEFAULT_TARGETS.carbs,
          fat: (profile.target_fat as number) ?? DEFAULT_TARGETS.fat,
        });
        if (profile.week_start_day === "sunday" || profile.week_start_day === "monday") {
          setWeekStartDay(profile.week_start_day);
        }
        const rawBudget = Number((profile as any).streak_freeze_budget_max);
        setFreezeBudgetMax(Number.isFinite(rawBudget) ? Math.max(0, Math.min(10, rawBudget)) : 3);
        setFreezeLedger(
          readFreezeLedger({
            earnedAt: (profile as any).streak_freezes_earned_at,
            usedHistory: (profile as any).streak_freezes_used_history,
          }),
        );
      }

      const loaded: ByDay = {};
      if (rows) {
        for (const r of rows) {
          const k = r.date_key as string;
          if (!loaded[k]) loaded[k] = [];
          loaded[k].push({
            id: "",
            name: "",
            recipeTitle: "",
            time: "",
            calories: (r.calories as number) ?? 0,
            protein: (r.protein as number) ?? 0,
            carbs: (r.carbs as number) ?? 0,
            fat: (r.fat as number) ?? 0,
          } as JournalMeal);
        }
      }
      setByDay(loaded);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Current-week stats. `buildWeekStats` defaults to "now" so we get
  // Mon–Sun (or Sun–Sat) of the active week — exactly what the user
  // expects when they tap a live pip.
  const weekStats = useMemo(
    () => buildWeekStats(byDay, targets, weekStartDay, new Date()),
    [byDay, targets, weekStartDay],
  );

  const protectedStreak = useMemo(
    () => computeProtectedStreak(byDay as never, freezeLedger, freezeBudgetMax, new Date()),
    [byDay, freezeLedger, freezeBudgetMax],
  );
  const streakDays = protectedStreak.streakLength;
  const freezesAvailableNow = useMemo(
    () => availableFreezes(freezeLedger, freezeBudgetMax),
    [freezeLedger, freezeBudgetMax],
  );

  const closestToTarget = useMemo(
    () => selectClosestToTargetDay(weekStats.days),
    [weekStats.days],
  );

  // Days logged in the current 7-day window. Mirrors the Digest's
  // `daysLogged` definition so the two surfaces never disagree.
  const daysLogged = useMemo(
    () => weekStats.days.filter((d) => d.calories > 0).length,
    [weekStats.days],
  );

  const weekLabel = useMemo(() => {
    if (weekStats.days.length === 0) return "";
    return formatWeekLabel(weekStats.days[0].key, weekStats.days[weekStats.days.length - 1].key);
  }, [weekStats.days]);

  // Protein hit threshold matches the existing convention used on
  // `progress-metric.tsx` (≥90% of target counts as "hit"). Kept inline
  // so we don't introduce a new shared helper for a single readout.
  const proteinHitDays = useMemo(() => {
    if (targets.protein <= 0) return 0;
    const threshold = targets.protein * 0.9;
    return weekStats.days.filter((d) => d.protein >= threshold).length;
  }, [weekStats.days, targets.protein]);

  const avgProteinHitDays = useMemo(() => {
    if (daysLogged === 0) return 0;
    return Math.round(weekStats.avgProtein);
  }, [weekStats.avgProtein, daysLogged]);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  // ── Render ──

  if (state === "loading") {
    return (
      <View
        testID="weekly-recap-loading"
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top,
        }}
      >
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  if (state === "error") {
    return (
      <View
        testID="weekly-recap-error"
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: Spacing.xl,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 15, textAlign: "center", marginBottom: Spacing.sm }}>
          Couldn&rsquo;t load your week.
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>
          Pull down or tap back to try again.
        </Text>
      </View>
    );
  }

  // ── Empty / zero-streak explainer ──
  // Pip days === 0 lands here with a calm, observational explainer per
  // the audit spec Step 1: "press should still work but route to a
  // 'your streak starts when you log on 2 different days this week'
  // explainer". We show this when the user has no logged days this
  // week AT ALL — including for streak === 1 if it's just today, the
  // explainer is still right (their streak starts when they keep
  // going). The threshold is "no logged days this week" because
  // that's the most conservative empty signal.
  const isEmpty = state === "empty" || daysLogged === 0;

  const sectionLabel = (txt: string) => (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: colors.textTertiary,
        letterSpacing: 0.88,
        textTransform: "uppercase",
        marginBottom: Spacing.sm,
      }}
    >
      {txt}
    </Text>
  );

  const card = (children: React.ReactNode, testID?: string) => (
    <View
      testID={testID}
      style={{
        backgroundColor: colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
      }}
    >
      {children}
    </View>
  );

  return (
    <ScrollView
      testID="weekly-recap-screen"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xxxl,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header — calm, observational. */}
      <View style={{ marginBottom: Spacing.xl }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textTertiary,
            letterSpacing: 0.88,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          This week
        </Text>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          {weekLabel}
        </Text>
        {/* Pip headline — same component, larger, non-tappable here
            (we're already on the destination). Sits inline with the
            range so the user sees the streak as part of the frame. */}
        <View style={{ marginTop: Spacing.md, alignSelf: "flex-start" }}>
          <StreakPip days={streakDays} size="lg" />
        </View>
      </View>

      {isEmpty ? (
        // Empty state — explainer per audit Step 1. Calm copy, no
        // pressure language. Pinned by test
        // "weekly-recap empty state explains how the streak starts".
        card(
          <>
            <Text
              testID="weekly-recap-empty-headline"
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: colors.text,
                marginBottom: Spacing.sm,
              }}
            >
              Your streak starts here.
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                lineHeight: 20,
              }}
            >
              A streak begins when you log on two different days in the same
              week. There&rsquo;s nothing to recap yet — log a meal today and
              come back to see it grow.
            </Text>
          </>,
          "weekly-recap-empty-card",
        )
      ) : (
        <>
          {/* DAYS LOGGED — small dot grid + plain summary. */}
          {card(
            <>
              {sectionLabel("Days logged")}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: Spacing.sm,
                }}
              >
                {daysLogged} of 7 days
              </Text>
              <View
                testID="weekly-recap-day-grid"
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginTop: Spacing.xs,
                }}
              >
                {weekStats.days.map((d) => {
                  const filled = d.calories > 0;
                  const isToday = d.key === todayKey;
                  return (
                    <View
                      key={d.key}
                      testID={`weekly-recap-day-dot-${d.key}`}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: filled
                            ? Accent.primary
                            : "transparent",
                          borderWidth: 1.5,
                          borderColor: filled ? Accent.primary : colors.cardBorder,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: isToday ? "700" : "500",
                          color: isToday ? colors.text : colors.textTertiary,
                          letterSpacing: 0.2,
                        }}
                      >
                        {d.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>,
            "weekly-recap-days-card",
          )}

          {/* CALORIES — average vs target, observational copy. */}
          {card(
            <>
              {sectionLabel("Average daily calories")}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {weekStats.avgCalories.toLocaleString()} kcal
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                {(() => {
                  const diff = weekStats.avgCalories - targets.calories;
                  const abs = Math.abs(Math.round(diff));
                  if (targets.calories <= 0 || daysLogged === 0) {
                    return `Across ${daysLogged} day${daysLogged === 1 ? "" : "s"} you logged.`;
                  }
                  if (abs <= 50) {
                    return `On target (${targets.calories.toLocaleString()} kcal).`;
                  }
                  if (diff < 0) {
                    return `${abs.toLocaleString()} under your ${targets.calories.toLocaleString()} kcal target.`;
                  }
                  return `${abs.toLocaleString()} over your ${targets.calories.toLocaleString()} kcal target.`;
                })()}
              </Text>
            </>,
            "weekly-recap-calories-card",
          )}

          {/* PROTEIN — average + days hit. */}
          {card(
            <>
              {sectionLabel("Protein")}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {avgProteinHitDays}g average
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                {targets.protein > 0
                  ? `Hit your ${Math.round(targets.protein)}g goal on ${proteinHitDays} of 7 days.`
                  : "No protein target set."}
              </Text>
            </>,
            "weekly-recap-protein-card",
          )}

          {/* CLOSEST TO TARGET — per memory, "Best Day → Closest to target". */}
          {closestToTarget
            ? card(
                <>
                  {sectionLabel("Closest to target")}
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "700",
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {closestToTarget.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textSecondary,
                      lineHeight: 18,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {closestToTarget.calories.toLocaleString()} kcal
                    {targets.calories > 0
                      ? ` vs ${targets.calories.toLocaleString()} target`
                      : ""}
                    {" · "}
                    {closestToTarget.protein}g protein
                  </Text>
                </>,
                "weekly-recap-closest-card",
              )
            : null}

          {/* STREAK + FREEZES — calm ledger. Suppress the freeze line
              entirely when the user has earned 0; gamifying it would
              break the calm-streak posture. */}
          {card(
            <>
              {sectionLabel("Streak")}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {streakDays} day{streakDays === 1 ? "" : "s"} in a row
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                {streakDays === 0
                  ? "Log on two different days this week to start it."
                  : streakDays === 1
                    ? "Log again tomorrow to keep it going."
                    : "Counts every day with at least one meal logged."}
              </Text>
              {freezesAvailableNow > 0 ? (
                <Text
                  testID="weekly-recap-freezes-line"
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 18,
                    marginTop: Spacing.sm,
                  }}
                >
                  {freezesAvailableNow} freeze{freezesAvailableNow === 1 ? "" : "s"} available
                  {protectedStreak.freezesConsumed > 0
                    ? ` (${protectedStreak.freezesConsumed} used to protect this streak).`
                    : "."}
                </Text>
              ) : null}
            </>,
            "weekly-recap-streak-card",
          )}
        </>
      )}
    </ScrollView>
  );
}
