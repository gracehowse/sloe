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
import { PostHogMaskView } from "posthog-react-native";
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
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
import { Accent, MacroColors, Spacing, Radius, Type, FontFamily } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets, calculateTDEE } from "@/lib/calcTargets";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useSettingsWinMoment } from "@/hooks/useSettingsWinMoment";
import { dateKeyFromDate } from "@suppr/shared/nutrition/trackerStats";
import { resolveLatestWeightKg } from "@suppr/shared/weightProjection";
import {
  activityLevelCaption,
  deficitSurplusCaption,
  buildMacroTiles,
  buildGoalCard,
} from "@suppr/shared/targets/targetsView";
import { WhyThisNumberSheet } from "@/components/today/WhyThisNumberSheet";
import { GoalPaceEditorSheet } from "@/components/recap/GoalPaceEditorSheet";
import { paceKgPerWeekFromPreset } from "@suppr/shared/nutrition/whyThisNumber";
import { isFeatureEnabled } from "@/lib/analytics";

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
  // Secondary accent (Frost flag → damson, else clay) for the calorie target
  // ring's SVG gradient stops (primaryLight → primary), the loading spinners,
  // and the help affordance. Threaded into the memoised StyleSheet via the dep
  // array below. Macros keep `MacroColors`; status keeps success/warning/destructive.
  const accent = useAccent();
  const cardElevation = useCardElevation();
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
  // Numbers audit 2026-05-04 #3 — surface a small breadcrumb when the
  // user has activity-adjusted calories on. Today's ring goal silently
  // adds an activity bonus to the stored target, so a user with
  // `prefer_activity_adjusted_calories=true` and a 350 kcal active burn
  // sees Today say "of 1,950 kcal" while Targets says "1,800 kcal" —
  // looks like a divergence bug. We don't recompute the bonus here
  // (that's owed by the shared `activityBudgetAddon` helper extraction
  // in finding #13); we just tell the user *why* the numbers might
  // differ so they don't read the gap as a math error.
  const [preferActivityAdjustedCalories, setPreferActivityAdjustedCalories] = useState(false);
  // 2026-04-30 (#1): mirror the net-carbs lens decision used on Today.
  // Without this, Today and /targets disagreed on the carbs target
  // (Today rendered net carbs while /targets always showed gross),
  // creating the appearance of a profile-targets divergence bug.
  const [netCarbsLensEnabled, setNetCarbsLensEnabled] = useState(false);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>({});

  // 2026-05-12 round 4 (Grace TF): "How is this calculated?" opens
  // the WhyThisNumberSheet inline on Targets. Round-3 routed via a
  // deeplink to Today which "popped up" away from the user's current
  // context — wrong call. Now the sheet mounts here and uses the
  // profile state Targets already hydrates (adaptive_tdee, confidence,
  // plan_pace).
  const [whySheetOpen, setWhySheetOpen] = useState(false);
  const [adaptiveTdee, setAdaptiveTdee] = useState<number | null>(null);
  const [adaptiveTdeeConfidence, setAdaptiveTdeeConfidence] = useState<string | null>(null);
  const [planPace, setPlanPace] = useState<string | null>(null);
  // Premium-bar audit Group J line 442 — Recalculate button feedback.
  // When the user taps the action we briefly show "Recalculating…" so
  // the press has confirmation; falls back to a Saved-style "Updated"
  // toast on completion. State is purely local — the data is reloaded
  // via the same query path the initial load uses, so RLS + cache
  // semantics are identical.
  const [recalculating, setRecalculating] = useState(false);
  const [recalcToast, setRecalcToast] = useState(false);
  // ENG goal-editor (2026-05-25): the Edit action opens the "Edit goal &
  // pace" sheet when the `goal-editor` flag is on; otherwise it keeps the
  // old behaviour (route to /profile, which has no goal control — the gap
  // this closes). The flag gates only the new UI entry; the recompute
  // logic itself is unconditional.
  const goalEditorEnabled = isFeatureEnabled("goal_editor");
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  // ENG-824 — quiet win-moment (success haptic + win-colour wash on the calorie
  // card) when targets are saved (goal/pace edit) or recalculated. Gated behind
  // `redesign_winmoment`; inert when off.
  const winMoment = useSettingsWinMoment();

  const loadTargets = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!userId) return;
    // Debug audit 2026-05-04 (code-quality #4): the IIFE used to dive
    // straight into supabase awaits with no try/catch. Either the
    // profile select or the `meals` fallback select rejecting silently
    // killed the IIFE before `setLoading(false)`, leaving the screen
    // stuck on the skeleton. Now: full-body try/finally so loading
    // always resolves, and an error is logged + surfaced via the
    // existing empty/loaded state instead of the spinner.
    try {
      const cancelled = () => Boolean(signal?.cancelled);
      const { data } = await supabase
        .from("profiles")
        .select(
          "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, weight_kg, goal_weight_kg, weight_kg_by_day, height_cm, sex, activity_level, goal, dob, age, plan_pace, net_carbs_lens_enabled, prefer_activity_adjusted_calories, adaptive_tdee, adaptive_tdee_confidence",
        )
        .eq("id", userId)
        .maybeSingle();
      if (cancelled() || !data) {
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
      setPreferActivityAdjustedCalories(
        Boolean((d as Record<string, unknown>).prefer_activity_adjusted_calories),
      );
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
      // 2026-05-12 round 4 (Grace TF): hydrate the inputs the
      // WhyThisNumberSheet needs. Adaptive TDEE + confidence drive
      // the "calibrating / early estimate / strong estimate" copy;
      // plan_pace + goal drive the "Lose / Maintain / Gain" line.
      const at = d.adaptive_tdee != null ? Number(d.adaptive_tdee) : null;
      setAdaptiveTdee(Number.isFinite(at) && at != null && at > 0 ? at : null);
      setAdaptiveTdeeConfidence(
        typeof d.adaptive_tdee_confidence === "string" ? d.adaptive_tdee_confidence : null,
      );
      setPlanPace(typeof d.plan_pace === "string" ? d.plan_pace : null);
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
      if (!cancelled() && Array.isArray(mealsData)) {
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
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[targets] load failed:", err instanceof Error ? err.message : err);
      }
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const signal = { cancelled: false };
    void loadTargets(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [userId, loadTargets]);

  // Premium-bar audit Group J line 442 — re-derive targets from current
  // profile data. Re-uses the same load path the screen mounts with,
  // which is the canonical query path through `resolveTargets`. We
  // don't call a separate "recalculate" endpoint because targets are
  // derived deterministically from profile fields on every read; the
  // user-facing effect of "Recalculate" is therefore equivalent to a
  // forced reload that surfaces any out-of-band profile changes (e.g.
  // adaptive TDEE engine writes, mid-day weigh-ins).
  const onRecalculate = useCallback(async () => {
    if (!userId || recalculating) return;
    setRecalculating(true);
    try {
      await loadTargets();
      setRecalcToast(true);
      setTimeout(() => setRecalcToast(false), 1800);
      // ENG-824 — a fresh recalculation lands new numbers; celebrate the save.
      winMoment.celebrate();
    } finally {
      setRecalculating(false);
    }
  }, [userId, recalculating, loadTargets, winMoment]);

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
  // Audit 2026-05-04 #5: prefer the freshest weigh-in (latest entry in
  // `weight_kg_by_day`) over the profile snapshot — Progress already does
  // this via `resolveLatestWeightKg`. Without parity here, Targets shows
  // the lagging `profiles.weight_kg` (e.g. 55.3) while Progress shows the
  // latest weigh-in (e.g. 55.2), looking inconsistent on adjacent tabs.
  const latestWeightKg = useMemo(
    () => resolveLatestWeightKg(weightKgByDay, weightKg),
    [weightKgByDay, weightKg],
  );
  const goalCard = useMemo(
    () =>
      buildGoalCard({
        currentWeightKg: latestWeightKg,
        goalWeightKg,
        weightKgByDay,
      }),
    [latestWeightKg, goalWeightKg, weightKgByDay],
  );
  const tdeeCaption = useMemo(() => {
    // 2026-05-26 consistency fix: the deficit MUST be computed from the
    // same maintenance the MAINTENANCE row shows (adaptive when present),
    // otherwise the screen contradicts itself — e.g. maintenance 1,568 with
    // a static-derived "750 kcal deficit" on a 901 target (1,568 − 901 =
    // 667, not 750). Use one number for both, and label its source
    // honestly (adaptive is measured, not Mifflin-St Jeor). Matches web.
    const maintenance = adaptiveTdee ?? tdeeKcal;
    const basis =
      adaptiveTdee != null
        ? "Maintenance from your recent intake"
        : "Estimated TDEE · Mifflin-St Jeor";
    const base = `${basis} · ${activityLevelCaption(activityLevel)}`;
    const tail = deficitSurplusCaption({
      targetCalories: targets.calories,
      tdeeKcal: maintenance,
      goal,
    });
    return tail ? `${base} · ${tail}` : base;
  }, [activityLevel, targets.calories, tdeeKcal, adaptiveTdee, goal]);

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
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: colors.border,
          backgroundColor: cardElevation.liftBg ?? colors.card,
          ...(cardElevation.shadowStyle ?? {}),
        },
        editText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
        scroll: {
          paddingHorizontal: Spacing.xl,
          paddingBottom: 120,
          gap: Spacing.xxl,
        },
        card: {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: Radius.lg,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: colors.border,
          padding: Spacing.xl,
          ...(cardElevation.shadowStyle ?? {}),
        },
        overline: {
          fontSize: 11,
          fontWeight: "800",
          color: colors.textSecondary,
          letterSpacing: 1.5,
          marginBottom: 6,
        },
        // SLOE Phase 0: the hero calorie numeral reads in Newsreader serif
        // (the design system reserves big numerals for serif). Reuse the
        // `Type.ringValue` token the Today calorie ring uses so the two hero
        // numbers stay byte-identical in face/size/weight. fontVariant kept
        // for tabular alignment as the value count-changes on recalculate.
        bigNumber: {
          ...Type.ringValue,
          color: colors.text,
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
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: Radius.lg,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: colors.border,
          padding: Spacing.lg,
          gap: 8,
          ...(cardElevation.shadowStyle ?? {}),
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
        // SLOE Phase 0: macro target numerals read in Newsreader serif on the
        // Targets review surface (the design system reserves big numerals for
        // serif). This is the documented override of `Type.macroValue` (which
        // stays sans on the tiny Today ring tiles for tabular alignment); on
        // the Targets tiles the serif hero treatment is intended. fontVariant
        // keeps the digits tabular so the value column doesn't jitter.
        macroValue: {
          fontFamily: FontFamily.serifRegular,
          fontSize: 22,
          lineHeight: 26,
          fontWeight: "400",
          color: colors.text,
          letterSpacing: -0.4,
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
        goalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, flexShrink: 1 },
        // Audit 2026-05-12: goalSub previously clipped at the right edge of its
        // flex-1 column because RN didn't shrink the Text container before
        // the row laid out. flexShrink: 1 + numberOfLines={2} forces a graceful
        // wrap so "Currently 54.5 kg · could reach by ≈ 18 July 2026" doesn't
        // truncate to "≈ 18".
        goalSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18, flexShrink: 1 },
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
        // ENG-67 disclaimer style — smaller + dimmer than the
        // projections footnote above it. Sits at the very bottom of
        // the scroll so it doesn't compete with the primary
        // adjust-targets affordance.
        disclaimer: {
          fontSize: 11,
          color: colors.textTertiary,
          textAlign: "center",
          paddingHorizontal: Spacing.lg,
          lineHeight: 16,
          marginTop: Spacing.md,
          marginBottom: Spacing.lg,
          opacity: 0.85,
        },
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
      }),
    [colors, cardElevation],
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
          <ActivityIndicator size="large" color={accent.primary} />
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
        <Text style={styles.title}>Daily targets</Text>
        <Pressable
          style={styles.editBtn}
          onPress={() => {
            if (goalEditorEnabled) {
              setGoalEditorOpen(true);
            } else {
              router.push("/profile");
            }
          }}
          accessibilityLabel="Edit goal and pace"
          testID="targets-edit"
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
        <View
          testID="targets-calorie-card"
          style={[styles.card, { alignItems: "center" }, winMoment.flashStyle]}
        >
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
                  <Stop offset="0" stopColor={accent.primaryLight} />
                  <Stop offset="1" stopColor={accent.primary} />
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
          {/* Premium-bar audit Group J line 442 — derivation one-liner +
              clearly-labelled maintenance row + Recalculate. MacroFactor
              parity. Maintenance was only visible inside the
              WhyThisNumberSheet before; surfacing it on the main card
              answers the user's first follow-up question ("what's my
              maintenance?") without requiring a sheet open. */}
          <Text
            style={[styles.caption, { textAlign: "center", marginTop: 4 }]}
            accessibilityLabel="Targets are based on your goal, weight, and activity level."
          >
            Based on your goal, weight, and activity level.
          </Text>
          {tdeeKcal != null ? (
            // ENG-534 (2026-05-16): maintenance TDEE is HIGH-class
            // (derived body-stat). Mask the whole row so session-replay
            // renders the kcal value as grey blocks.
            <PostHogMaskView>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "center",
                  gap: 6,
                  marginTop: Spacing.md,
                  paddingTop: Spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  alignSelf: "stretch",
                }}
                testID="targets-maintenance-row"
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.textSecondary,
                    letterSpacing: 1.5,
                  }}
                >
                  MAINTENANCE
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: colors.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {(adaptiveTdee ?? tdeeKcal).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>kcal / day</Text>
              </View>
            </PostHogMaskView>
          ) : null}
          {/* Recalculate — aubergine OUTLINE button (Sloe treatment #1,
              2026-06-08). The everyday primary CTA is an accent LINE, not a
              filled slab: transparent fill, 1.5px border in
              `Accent.primarySolid` (#4E3260, ≈8.7:1 on the white card — AA),
              label in the same. Pressed state lifts a faint aubergine wash.
              The FAB + conversion CTAs keep the fill; this everyday recompute
              reads as the calm outline. */}
          <Pressable
            onPress={() => void onRecalculate()}
            disabled={recalculating}
            accessibilityRole="button"
            accessibilityLabel="Recalculate targets from current profile data"
            testID="targets-recalculate"
            style={({ pressed }) => ({
              marginTop: Spacing.md,
              alignSelf: "center",
              paddingHorizontal: Spacing.lg,
              paddingVertical: 9,
              borderRadius: Radius.full,
              borderWidth: 1.5,
              borderColor: Accent.primarySolid,
              backgroundColor: pressed ? Accent.primarySoft : "transparent",
              opacity: recalculating ? 0.6 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            })}
          >
            {recalculating ? (
              <ActivityIndicator size="small" color={Accent.primarySolid} />
            ) : null}
            <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primarySolid }}>
              {recalculating ? "Recalculating…" : recalcToast ? "Updated" : "Recalculate"}
            </Text>
          </Pressable>
          {/* Numbers audit 2026-05-04 #3: when activity-adjusted calories
              are on, Today's ring goal is `targets.calories +
              dayActivityBudgetAddon(...)`. The Targets number above is
              the *static* base. Without this note, a user with a 350
              kcal active burn would see "1800" here and "1950" on Today
              and read it as an inconsistency. The full delta number
              would require duplicating the addon math; that's owed by
              the shared-helper extraction in audit finding #13. For now
              we tell the user *why* the numbers can differ. */}
          {preferActivityAdjustedCalories ? (
            <Text style={[styles.caption, { textAlign: "center", marginTop: 4 }]}>
              Today&apos;s goal adjusts upward by your active-burn calories.
            </Text>
          ) : null}
        </View>

        {/* Macros — each tile taps through to the manual /profile editor
            (incl. the fibre goal + per-macro overrides). The goal editor
            recomputes macros from goal/pace but doesn't own those manual
            fields; the `goal-editor` flag had orphaned this path. Restored
            here (thread C, target-recompute unification 2026-05-26). */}
        <Text style={styles.sectionHeading}>Macros</Text>
        <View style={styles.macroGrid}>
          {macroTiles.map((m) => {
            const color = macroColorFor(m.key);
            return (
              <Pressable
                key={m.key}
                style={styles.macroTile}
                onPress={() => router.push("/profile")}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${m.label} target`}
                testID={`targets-macro-tile-${m.key}`}
              >
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
                  {/* Audit 2026-05-04 #30: at 0% the fill collapsed to
                      width: 0 and the track-grey blended with the card
                      background, making it look like the progress bar
                      was missing entirely. Render a minimum 4-pixel
                      "starting tick" of the macro colour at low pct so
                      the bar's start anchor is always visible. */}
                  {m.pct > 0 ? (
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.round(m.pct * 100)}%`, backgroundColor: color },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.barFill,
                        { width: 4, backgroundColor: color, opacity: 0.45 },
                      ]}
                    />
                  )}
                </View>
                <Text style={styles.macroRemaining}>{m.remainingLabel}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Goal */}
        {goalCard ? (
          <View style={styles.card}>
            <View style={styles.goalHead}>
              <View style={{ flex: 1, minWidth: 0, paddingRight: Spacing.sm }}>
                <Text style={styles.goalTitle}>{goalCard.title}</Text>
                <Text style={styles.goalSub} numberOfLines={2}>{goalCard.subtitle}</Text>
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

        {/* 2026-05-12 round 4 (Grace TF): "How is this calculated?" row
            opens the WhyThisNumberSheet INLINE on this screen. Round 3
            deep-linked to Today which "popped up" away from the user's
            current context — wrong call. The sheet now mounts at the
            bottom of this file and uses the profile state Targets
            already hydrates. */}
        <Pressable
          onPress={() => setWhySheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="How is this calculated? Open calorie target explanation"
          style={({ pressed }) => ({
            backgroundColor: cardElevation.liftBg ?? colors.card,
            borderWidth: cardElevation.useBorder ? 1 : 0,
            borderColor: colors.cardBorder,
            borderRadius: Radius.lg,
            paddingVertical: 14,
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            opacity: pressed ? 0.7 : 1,
            ...(cardElevation.shadowStyle ?? {}),
          })}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: accent.primary + "1A",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HelpCircle size={14} color={accent.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
              How is this calculated?
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              See the maintenance TDEE, goal, and pace behind today&apos;s target.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} strokeWidth={1.75} />
        </Pressable>

        <Text style={styles.footnote}>
          Projections assume a 14-day moving average. Targets adapt weekly based on logged intake.
        </Text>

        {/*
         * ENG-67 (2026-05-16, Grace decision = "Onboarding + Targets
         * only"): the methodology / safety-floor disclaimer that
         * lives inline at the foot of the onboarding pace step (see
         * `apps/mobile/components/onboarding/steps/pace.tsx`) also
         * lives here — Targets is the dedicated review surface for
         * the numbers, so the user gets the same hedge any time
         * they're looking at those numbers. Removed from Today /
         * Progress / Recipes per the same decision.
         */}
        <Text style={styles.disclaimer}>
          Estimate uses ~7,700 kcal ≈ 1 kg of body mass. Safety floors reference
          NIH/NHS guidance. Sloe is not a substitute for medical advice — consult
          your doctor before any significant dietary change, especially if you&apos;re
          pregnant, under 18, or managing a medical condition.
        </Text>
      </ScrollView>

      {/* 2026-05-12 round 4 (Grace TF): inline WhyThisNumberSheet.
          Adaptive TDEE is preferred when present; the sheet falls back
          to the static Mifflin × activity TDEE when adaptive hasn't
          fired yet. Goal/pace plumbing mirrors Today's wiring. */}
      <WhyThisNumberSheet
        visible={whySheetOpen}
        onClose={() => setWhySheetOpen(false)}
        targetCalories={targets.calories}
        maintenanceTdee={adaptiveTdee ?? tdeeKcal}
        confidence={
          adaptiveTdeeConfidence === "low" ||
          adaptiveTdeeConfidence === "medium" ||
          adaptiveTdeeConfidence === "high"
            ? adaptiveTdeeConfidence
            : null
        }
        loggingDays={null}
        goal={
          goal === "gain" || goal === "bulk" || goal === "strength"
            ? "gain"
            : goal === "maintain" || goal === "health"
              ? "maintain"
              : "lose"
        }
        paceKgPerWeek={paceKgPerWeekFromPreset(
          planPace,
          goal === "gain" || goal === "bulk" || goal === "strength"
            ? "gain"
            : goal === "maintain" || goal === "health"
              ? "maintain"
              : "lose",
        )}
        mealLogDays={null}
        weightLogCount={Object.keys(weightKgByDay).length}
        onPressAdjustTarget={() => {
          setWhySheetOpen(false);
          // When the goal editor is live, "Adjust target" opens it in
          // place rather than routing to /profile (no goal control).
          if (goalEditorEnabled) {
            setGoalEditorOpen(true);
          } else {
            router.push("/profile?focus=plan" as never);
          }
        }}
        backgroundColor={colors.background}
        cardColor={colors.card}
        cardBorderColor={colors.cardBorder}
        textColor={colors.text}
        textSecondaryColor={colors.textSecondary}
        textTertiaryColor={colors.textTertiary}
      />

      {/* ENG goal-editor (2026-05-25): post-onboarding "Edit goal & pace"
          sheet. On save, reload the screen's targets so the new calorie
          number + macro tiles + goal card update in place (mirrors
          GoalPaceRetuneSheet's onSaved → refetch contract). */}
      {userId ? (
        <GoalPaceEditorSheet
          visible={goalEditorOpen}
          onClose={() => setGoalEditorOpen(false)}
          userId={userId}
          onSaved={() => {
            void loadTargets();
            // ENG-824 — goal/pace saved → quiet win-moment on the calorie card.
            winMoment.celebrate();
          }}
        />
      ) : null}
    </View>
  );
}
