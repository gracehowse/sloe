import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import {
  DIETARY_PREFERENCE_ENTRIES,
  normaliseDietaryFromProfile,
} from "../../../src/constants/dietaryPreferences";
import {
  calculateTDEE,
  calculateBudget,
  budgetSafety,
  calculateMacros,
  weeksToGoal,
  goalDate,
  planOptions,
  kgToLb,
  lbToKg,
  kgToStLb,
  stLbToKg,
  cmToFtIn,
  ftInToCm,
  ACTIVITY_LABELS,
  PACE_LABELS,
  STRATEGY_LABELS,
  type Sex,
  type ActivityLevel,
  type PlanPace,
  type NutritionStrategy,
} from "@/lib/tdee";
import { ageFromIsoDateString, displayNameFromAuthUser } from "../../../src/lib/profile/onboardingHydration";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Step IDs ────────────────────────────────────────────────────────
type StepId =
  | "goal"
  | "basic_info"
  | "activity"
  | "plan_pace"
  | "budget_confirm"
  | "strategy"
  | "dietary"
  | "calorie_schedule"
  | "fasting"
  | "projection"
  | "summary";

const STEP_ORDER: StepId[] = [
  "goal",
  "basic_info",
  "activity",
  "plan_pace",
  "budget_confirm",
  "strategy",
  "dietary",
  "calorie_schedule",
  "fasting",
  "projection",
  "summary",
];

// ── Onboarding State ────────────────────────────────────────────────
type WeightUnit = "kg" | "lb" | "st";
type HeightUnit = "cm" | "ft";

type OnboardingData = {
  displayName: string;
  goalType: "lose" | "health" | "strength";
  sex: Sex;
  age: string;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weightKg: string;
  weightLb: string;
  weightSt: string;
  weightStLb: string;
  goalWeightKg: string;
  goalWeightLb: string;
  goalWeightSt: string;
  goalWeightStLb: string;
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  activity: ActivityLevel;
  planPace: PlanPace;
  strategy: NutritionStrategy;
  dietary: string[];
  calorieSchedule: "even" | "flexible";
  highDays: string[];
  fastingEnabled: boolean;
  fastingWindow: string;
};

const INITIAL_DATA: OnboardingData = {
  displayName: "",
  goalType: "lose",
  sex: "female",
  age: "",
  heightCm: "",
  heightFt: "",
  heightIn: "",
  weightKg: "",
  weightLb: "",
  weightSt: "",
  weightStLb: "",
  goalWeightKg: "",
  goalWeightLb: "",
  goalWeightSt: "",
  goalWeightStLb: "",
  weightUnit: "kg",
  heightUnit: "cm",
  activity: "moderate",
  planPace: "steady",
  strategy: "balanced",
  dietary: [],
  calorieSchedule: "even",
  highDays: [],
  fastingEnabled: false,
  fastingWindow: "",
};

function formatWeight(kg: number, unit: WeightUnit): string {
  if (unit === "lb") return `${Math.round(kgToLb(kg) * 10) / 10} lb`;
  if (unit === "st") {
    const s = kgToStLb(kg);
    return `${s.st} st ${s.lb} lb`;
  }
  return `${Math.round(kg * 10) / 10} kg`;
}

function formatWeeklyRate(kgPerWeek: number, unit: WeightUnit): string {
  if (unit === "lb") return `${Math.round(kgToLb(kgPerWeek) * 10) / 10} lb`;
  if (unit === "st") return `${Math.round(kgToLb(kgPerWeek) * 10) / 10} lb`;
  return `${kgPerWeek} kg`;
}

const PLAN_PACES: PlanPace[] = ["relaxed", "steady", "accelerated", "vigorous"];
const STRATEGIES: NutritionStrategy[] = ["balanced", "high_protein", "high_satisfaction", "low_carb"];
const ACTIVITIES: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];

type ProfileHydrationRow = {
  display_name: string | null;
  sex: string | null;
  age: number | null;
  dob: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal_weight_kg: number | null;
  activity_level: string | null;
  goal: string | null;
  dietary: unknown;
  plan_pace: string | null;
  nutrition_strategy: string | null;
  calorie_schedule: string | null;
  high_days: unknown;
  fasting_enabled: boolean | null;
  fasting_window: string | null;
  measurement_system: string | null;
};

function mergeProfileIntoOnboarding(prev: OnboardingData, row: ProfileHydrationRow): OnboardingData {
  const next = { ...prev };
  if (row.display_name) next.displayName = row.display_name;
  if (row.sex === "male" || row.sex === "female" || row.sex === "unspecified") next.sex = row.sex;
  if (row.age != null && row.age > 0) {
    next.age = String(row.age);
  } else if (row.dob) {
    const a = ageFromIsoDateString(String(row.dob));
    if (a != null) next.age = String(a);
  }
  if (row.height_cm != null && Number(row.height_cm) > 0) {
    const h = Number(row.height_cm);
    next.heightCm = String(Math.round(h * 10) / 10);
    const { ft, inches } = cmToFtIn(h);
    next.heightFt = String(ft);
    next.heightIn = String(inches);
  }
  if (row.weight_kg != null && Number(row.weight_kg) > 0) {
    const wk = Number(row.weight_kg);
    next.weightKg = String(Math.round(wk * 10) / 10);
    next.weightLb = kgToLb(wk).toFixed(1);
    const stlb = kgToStLb(wk);
    next.weightSt = String(stlb.st);
    next.weightStLb = String(stlb.lb);
  }
  if (row.goal_weight_kg != null && Number(row.goal_weight_kg) > 0) {
    const gk = Number(row.goal_weight_kg);
    next.goalWeightKg = String(Math.round(gk * 10) / 10);
    next.goalWeightLb = kgToLb(gk).toFixed(1);
    const gst = kgToStLb(gk);
    next.goalWeightSt = String(gst.st);
    next.goalWeightStLb = String(gst.lb);
  }
  if (row.activity_level && ACTIVITIES.includes(row.activity_level as ActivityLevel)) {
    next.activity = row.activity_level as ActivityLevel;
  }
  if (row.goal === "cut") next.goalType = "lose";
  else if (row.goal === "bulk") next.goalType = "strength";
  else if (row.goal === "maintain") next.goalType = "health";
  const d = normaliseDietaryFromProfile(row.dietary);
  if (d.length > 0) next.dietary = d;
  if (row.plan_pace && PLAN_PACES.includes(row.plan_pace as PlanPace)) {
    next.planPace = row.plan_pace as PlanPace;
  }
  if (row.nutrition_strategy && STRATEGIES.includes(row.nutrition_strategy as NutritionStrategy)) {
    next.strategy = row.nutrition_strategy as NutritionStrategy;
  }
  if (row.calorie_schedule === "even" || row.calorie_schedule === "flexible") {
    next.calorieSchedule = row.calorie_schedule;
  }
  if (Array.isArray(row.high_days)) {
    next.highDays = row.high_days.filter((x): x is string => typeof x === "string");
  }
  if (typeof row.fasting_enabled === "boolean") {
    next.fastingEnabled = row.fasting_enabled;
  }
  if (row.fasting_window != null && row.fasting_window !== "") {
    next.fastingWindow = row.fasting_window;
  }
  if (row.measurement_system === "imperial") {
    next.weightUnit = "lb";
    next.heightUnit = "ft";
  } else if (row.measurement_system === "metric") {
    next.weightUnit = "kg";
    next.heightUnit = "cm";
  }
  return next;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const hydrateSeq = useRef(0);

  useEffect(() => {
    if (!userId) return;
    const id = ++hydrateSeq.current;
    let cancelled = false;
    void (async () => {
      const [{ data: sessionWrap }, { data: row }] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from("profiles")
          .select(
            "display_name, sex, age, dob, height_cm, weight_kg, goal_weight_kg, activity_level, goal, dietary, plan_pace, nutrition_strategy, calorie_schedule, high_days, fasting_enabled, fasting_window, measurement_system",
          )
          .eq("id", userId)
          .maybeSingle(),
      ]);
      if (cancelled || hydrateSeq.current !== id) return;
      let next: OnboardingData = { ...INITIAL_DATA };
      if (row) {
        next = mergeProfileIntoOnboarding(next, row as ProfileHydrationRow);
      }
      if (!next.displayName.trim()) {
        const nm = displayNameFromAuthUser(sessionWrap?.session?.user ?? null);
        if (nm) next = { ...next, displayName: nm };
      }
      setData(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const currentStepId = STEP_ORDER[step];
  const progress = (step + 1) / STEP_ORDER.length;

  // Computed values — always in metric internally
  const age = parseInt(data.age) || 25;
  const heightCm = data.heightUnit === "ft"
    ? ftInToCm(parseFloat(data.heightFt) || 0, parseFloat(data.heightIn) || 0)
    : parseFloat(data.heightCm) || 165;
  const weightKg = data.weightUnit === "lb"
    ? lbToKg(parseFloat(data.weightLb) || 0)
    : data.weightUnit === "st"
      ? stLbToKg(parseFloat(data.weightSt) || 0, parseFloat(data.weightStLb) || 0)
      : parseFloat(data.weightKg) || 70;
  const goalWeightKg = data.weightUnit === "lb"
    ? lbToKg(parseFloat(data.goalWeightLb) || 0)
    : data.weightUnit === "st"
      ? stLbToKg(parseFloat(data.goalWeightSt) || 0, parseFloat(data.goalWeightStLb) || 0)
      : parseFloat(data.goalWeightKg) || weightKg;
  const tdee = calculateTDEE(data.sex, weightKg, heightCm, age, data.activity);
  const budget = calculateBudget(tdee, data.planPace, data.goalType);
  const safety = budgetSafety(budget, data.sex);
  const macros = calculateMacros(budget, data.strategy, weightKg);
  const weeks = data.goalType === "lose" ? weeksToGoal(weightKg, goalWeightKg, data.planPace) : 0;
  const projectedDate = weeks > 0 ? goalDate(weeks) : null;

  const animateTransition = useCallback((_direction: 1 | -1) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim]);

  const goNext = useCallback(() => {
    if (step < STEP_ORDER.length - 1) {
      track(AnalyticsEvents.onboarding_step_completed, {
        step,
        step_name: STEP_ORDER[step],
      });
      animateTransition(1);
      setStep((s) => s + 1);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [step, animateTransition]);

  const goBack = useCallback(() => {
    if (step > 0) {
      animateTransition(-1);
      setStep((s) => s - 1);
    }
  }, [step, animateTransition]);

  const skip = useCallback(async () => {
    if (userId) {
      const defaultBudget = calculateBudget(calculateTDEE("female", 70, 165, 28, "moderate"), "steady", "lose");
      const defaultMacros = calculateMacros(defaultBudget, "balanced", 70);
      await supabase.from("profiles").upsert({
        id: userId,
        target_calories: defaultBudget,
        target_protein: defaultMacros.protein,
        target_carbs: defaultMacros.carbs,
        target_fat: defaultMacros.fat,
        target_fiber_g: defaultMacros.fiber,
        onboarding_completed: true,
      }, { onConflict: "id" });
    }
    router.replace("/paywall");
  }, [router, userId]);

  const saveAndFinish = useCallback(async () => {
    if (!userId) { router.replace("/paywall"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        display_name: data.displayName.trim() || null,
        sex: data.sex,
        age,
        height_cm: heightCm,
        weight_kg: weightKg,
        goal_weight_kg: goalWeightKg,
        activity_level: data.activity,
        goal: data.goalType === "lose" ? "cut" : data.goalType === "strength" ? "bulk" : "maintain",
        dietary: data.dietary,
        plan_pace: data.planPace,
        nutrition_strategy: data.strategy,
        calorie_schedule: data.calorieSchedule,
        high_days: data.highDays,
        fasting_enabled: data.fastingEnabled,
        fasting_window: data.fastingWindow || null,
        target_calories: budget,
        target_protein: macros.protein,
        target_carbs: macros.carbs,
        target_fat: macros.fat,
        target_fiber_g: macros.fiber,
        target_water_ml: Math.min(4500, Math.max(1500, Math.round(weightKg * 33))),
        measurement_system: data.weightUnit === "lb" ? "imperial" : data.weightUnit === "st" ? "imperial" : "metric",
        user_tier: "free",
        onboarding_completed: true,
      }, { onConflict: "id" });
      if (error) throw error;
    } catch (e) {
      console.error("[onboarding] save failed:", e);
      setSaving(false);
      Alert.alert("Save failed", "We couldn't save your profile. Check your connection and try again.");
      return;
    }
    setSaving(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/paywall");
  }, [userId, data, age, heightCm, weightKg, goalWeightKg, budget, macros, router]);

  const update = useCallback(<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleArrayItem = useCallback((key: keyof Pick<OnboardingData, "highDays" | "dietary">, item: string) => {
    setData((prev) => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });
  }, []);

  // ── Styles ──────────────────────────────────────────────────────────
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    skipBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    skipText: { color: colors.textTertiary, fontSize: 14, fontWeight: "600" },
    progressBar: { height: 4, backgroundColor: colors.border, marginHorizontal: Spacing.xl, borderRadius: 2 },
    progressFill: { height: 4, backgroundColor: Accent.success, borderRadius: 2 },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: 40 },
    stepContent: { flex: 1, justifyContent: "center", gap: Spacing.lg },

    heading: { fontSize: 26, fontWeight: "800", color: colors.text, textAlign: "center", lineHeight: 34 },
    subheading: { fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },

    optionBtn: {
      borderWidth: 1.5, borderColor: colors.border, borderRadius: Radius.lg,
      paddingVertical: 18, paddingHorizontal: Spacing.xl, alignItems: "center",
    },
    optionBtnActive: { borderColor: Accent.success, backgroundColor: Accent.success + "12" },
    optionText: { fontSize: 16, fontWeight: "600", color: colors.text },
    optionTextActive: { color: Accent.success },
    optionDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },

    inputRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
    inputLabel: { fontSize: 15, fontWeight: "600", color: colors.text, width: 100 },
    input: {
      flex: 1, backgroundColor: colors.card, borderRadius: Radius.md,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: Spacing.lg, paddingVertical: 14,
      color: colors.text, fontSize: 16, textAlign: "center",
    },
    inputUnit: { fontSize: 14, color: colors.textSecondary, width: 30 },

    sexRow: { flexDirection: "row", gap: Spacing.md },
    sexBtn: {
      flex: 1, paddingVertical: 16, borderRadius: Radius.md,
      borderWidth: 1.5, borderColor: colors.border, alignItems: "center",
    },
    sexBtnActive: { borderColor: Accent.success, backgroundColor: Accent.success + "12" },
    sexBtnText: { fontSize: 15, fontWeight: "600", color: colors.text },

    // Plan cards
    planCard: {
      backgroundColor: colors.card, borderRadius: Radius.lg,
      borderWidth: 2, borderColor: colors.border,
      padding: Spacing.xl, gap: Spacing.sm, alignItems: "center",
    },
    planCardRecommended: { borderColor: Accent.success },
    planBadge: {
      paddingHorizontal: 14, paddingVertical: 4, borderRadius: Radius.full,
      backgroundColor: Accent.success, marginBottom: Spacing.xs,
    },
    planBadgeWarning: { backgroundColor: Accent.warning },
    planBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 1 },
    planTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
    planDesc: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    planStat: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    planStatText: { fontSize: 14, color: colors.text },
    planSelectBtn: {
      backgroundColor: Accent.success, borderRadius: Radius.md,
      paddingVertical: 14, paddingHorizontal: 40, marginTop: Spacing.sm,
    },
    planSelectText: { color: "#fff", fontWeight: "700", fontSize: 15 },

    // Budget confirmation
    budgetNumber: { fontSize: 48, fontWeight: "900", color: Accent.success, textAlign: "center" },
    budgetLabel: { fontSize: 16, color: colors.textSecondary, textAlign: "center" },

    // Multi-select chips
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, justifyContent: "center" },
    chip: {
      paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.lg,
      borderWidth: 1.5, borderColor: colors.border,
    },
    chipActive: { borderColor: Accent.success, backgroundColor: Accent.success + "12" },
    chipText: { fontSize: 14, fontWeight: "500", color: colors.text, textAlign: "center" },

    // Projection
    projDate: { fontSize: 28, fontWeight: "800", color: Accent.success, textAlign: "center" },
    projSub: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
    weightRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.md },
    weightBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm,
    },
    weightBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },

    // Summary
    summaryRow: {
      flexDirection: "row", alignItems: "center", gap: Spacing.md,
      paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    summaryIcon: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.card, justifyContent: "center", alignItems: "center",
    },
    summaryLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
    summarySub: { fontSize: 12, color: colors.textSecondary },

    // Bottom CTA
    bottomBar: {
      paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
      backgroundColor: colors.background,
    },
    ctaBtn: {
      backgroundColor: Accent.success, borderRadius: Radius.md,
      paddingVertical: 18, alignItems: "center",
    },
    ctaBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
    ctaBtnDisabled: { opacity: 0.4 },
  }), [colors]);

  // ── Option button helper ────────────────────────────────────────────
  const OptionButton = useCallback(({ label, desc, active, onPress }: { label: string; desc?: string; active: boolean; onPress: () => void }) => (
    <Pressable
      style={[styles.optionBtn, active && styles.optionBtnActive]}
      onPress={() => { onPress(); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
      {desc && <Text style={styles.optionDesc}>{desc}</Text>}
    </Pressable>
  ), [styles]);

  // ── Render current step ─────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStepId) {
      case "goal":
        return (
          <View style={styles.stepContent}>
            <Text style={styles.heading}>{"What's your main goal?"}</Text>
            <Text style={styles.subheading}>{"We'll tailor your calorie and macro targets to match."}</Text>
            <View style={{ gap: Spacing.md }}>
              <OptionButton label="Lose weight" desc="Create a calorie deficit to reach your target" active={data.goalType === "lose"} onPress={() => { update("goalType", "lose"); goNext(); }} />
              <OptionButton label="Eat healthier" desc="Balanced nutrition without a specific weight goal" active={data.goalType === "health"} onPress={() => { update("goalType", "health"); goNext(); }} />
              <OptionButton label="Build muscle" desc="Higher protein targets to support training" active={data.goalType === "strength"} onPress={() => { update("goalType", "strength"); goNext(); }} />
            </View>
          </View>
        );

      case "basic_info": {
        const UnitToggle = ({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: any) => void }) => (
          <View style={{ flexDirection: "row", gap: 4, alignSelf: "flex-end" }}>
            {options.map((o) => (
              <Pressable key={o.value} onPress={() => onChange(o.value)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: value === o.value ? Accent.success + "20" : "transparent" }}>
                <Text style={{ fontSize: 12, fontWeight: value === o.value ? "700" : "500", color: value === o.value ? Accent.success : colors.textTertiary }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        );
        return (
          <View style={styles.stepContent}>
            <Text style={styles.heading}>Tell us about yourself</Text>
            <Text style={styles.subheading}>{"We'll use this to calculate your personal calorie budget."}</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput style={styles.input} value={data.displayName} onChangeText={(t) => update("displayName", t)} placeholder="Optional" placeholderTextColor={colors.textTertiary} autoCapitalize="words" />
            </View>
            <Text style={[styles.inputLabel, { width: "100%", marginBottom: 4 }]}>Biological sex</Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 8 }}>Used for BMR calculation only</Text>
            <View style={styles.sexRow}>
              <Pressable style={[styles.sexBtn, data.sex === "female" && styles.sexBtnActive]} onPress={() => update("sex", "female")}>
                <Text style={styles.sexBtnText}>Female</Text>
              </Pressable>
              <Pressable style={[styles.sexBtn, data.sex === "male" && styles.sexBtnActive]} onPress={() => update("sex", "male")}>
                <Text style={styles.sexBtnText}>Male</Text>
              </Pressable>
              <Pressable style={[styles.sexBtn, data.sex === "unspecified" && styles.sexBtnActive]} onPress={() => update("sex", "unspecified")}>
                <Text style={[styles.sexBtnText, { fontSize: 12 }]}>Prefer not{"\n"}to say</Text>
              </Pressable>
            </View>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput style={styles.input} value={data.age} onChangeText={(t) => update("age", t)} keyboardType="number-pad" placeholder="25" placeholderTextColor={colors.textTertiary} />
            </View>

            {/* Height */}
            <UnitToggle options={[{ label: "cm", value: "cm" }, { label: "ft/in", value: "ft" }]} value={data.heightUnit} onChange={(v) => update("heightUnit", v)} />
            {data.heightUnit === "cm" ? (
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Height</Text>
                <TextInput style={styles.input} value={data.heightCm} onChangeText={(t) => update("heightCm", t)} keyboardType="decimal-pad" placeholder="165" placeholderTextColor={colors.textTertiary} />
                <Text style={styles.inputUnit}>cm</Text>
              </View>
            ) : (
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Height</Text>
                <TextInput style={[styles.input, { flex: 0.5 }]} value={data.heightFt} onChangeText={(t) => update("heightFt", t)} keyboardType="number-pad" placeholder="5" placeholderTextColor={colors.textTertiary} />
                <Text style={styles.inputUnit}>ft</Text>
                <TextInput style={[styles.input, { flex: 0.5 }]} value={data.heightIn} onChangeText={(t) => update("heightIn", t)} keyboardType="decimal-pad" placeholder="6" placeholderTextColor={colors.textTertiary} />
                <Text style={styles.inputUnit}>in</Text>
              </View>
            )}

            {/* Weight */}
            <UnitToggle options={[{ label: "kg", value: "kg" }, { label: "lb", value: "lb" }, { label: "st/lb", value: "st" }]} value={data.weightUnit} onChange={(v) => update("weightUnit", v)} />
            {data.weightUnit === "kg" ? (
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Weight</Text>
                <TextInput style={styles.input} value={data.weightKg} onChangeText={(t) => update("weightKg", t)} keyboardType="decimal-pad" placeholder="70" placeholderTextColor={colors.textTertiary} />
                <Text style={styles.inputUnit}>kg</Text>
              </View>
            ) : data.weightUnit === "lb" ? (
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Weight</Text>
                <TextInput style={styles.input} value={data.weightLb} onChangeText={(t) => update("weightLb", t)} keyboardType="decimal-pad" placeholder="154" placeholderTextColor={colors.textTertiary} />
                <Text style={styles.inputUnit}>lb</Text>
              </View>
            ) : (
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Weight</Text>
                <TextInput style={[styles.input, { flex: 0.5 }]} value={data.weightSt} onChangeText={(t) => update("weightSt", t)} keyboardType="number-pad" placeholder="11" placeholderTextColor={colors.textTertiary} />
                <Text style={styles.inputUnit}>st</Text>
                <TextInput style={[styles.input, { flex: 0.5 }]} value={data.weightStLb} onChangeText={(t) => update("weightStLb", t)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary} />
                <Text style={styles.inputUnit}>lb</Text>
              </View>
            )}

            {/* Goal weight */}
            {data.goalType === "lose" && (
              <>
                {data.weightUnit === "kg" ? (
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Goal weight</Text>
                    <TextInput style={styles.input} value={data.goalWeightKg} onChangeText={(t) => update("goalWeightKg", t)} keyboardType="decimal-pad" placeholder="60" placeholderTextColor={colors.textTertiary} />
                    <Text style={styles.inputUnit}>kg</Text>
                  </View>
                ) : data.weightUnit === "lb" ? (
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Goal weight</Text>
                    <TextInput style={styles.input} value={data.goalWeightLb} onChangeText={(t) => update("goalWeightLb", t)} keyboardType="decimal-pad" placeholder="132" placeholderTextColor={colors.textTertiary} />
                    <Text style={styles.inputUnit}>lb</Text>
                  </View>
                ) : (
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Goal weight</Text>
                    <TextInput style={[styles.input, { flex: 0.5 }]} value={data.goalWeightSt} onChangeText={(t) => update("goalWeightSt", t)} keyboardType="number-pad" placeholder="9" placeholderTextColor={colors.textTertiary} />
                    <Text style={styles.inputUnit}>st</Text>
                    <TextInput style={[styles.input, { flex: 0.5 }]} value={data.goalWeightStLb} onChangeText={(t) => update("goalWeightStLb", t)} keyboardType="decimal-pad" placeholder="6" placeholderTextColor={colors.textTertiary} />
                    <Text style={styles.inputUnit}>lb</Text>
                  </View>
                )}
              </>
            )}
          </View>
        );
      }

      case "activity":
        return (
          <View style={styles.stepContent}>
            <Text style={styles.heading}>How active are you?</Text>
            <View style={{ gap: Spacing.sm }}>
              {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, { title: string; desc: string }][]).map(([key, val]) => (
                <OptionButton key={key} label={val.title} desc={val.desc} active={data.activity === key} onPress={() => { update("activity", key); goNext(); }} />
              ))}
            </View>
          </View>
        );

      case "plan_pace":
        return (
          <View style={styles.stepContent}>
            <Text style={styles.heading}>Select your plan</Text>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 0 }}>
              {planOptions(tdee, weightKg, goalWeightKg, data.goalType, data.sex).map((opt) => {
                const badgeColor = opt.safety === "safe" ? Accent.success : opt.safety === "caution" ? Accent.warning : Accent.destructive;
                const badgeLabel = opt.pace === "relaxed" ? "RECOMMENDED"
                  : opt.safety === "safe" ? "AVAILABLE"
                  : opt.safety === "caution" ? "CHALLENGING"
                  : "NOT RECOMMENDED";
                return (
                  <View key={opt.pace} style={[{ width: SCREEN_W - Spacing.xl * 2, paddingHorizontal: Spacing.sm }]}>
                    <View style={[styles.planCard, opt.pace === "relaxed" && styles.planCardRecommended]}>
                      <View style={[styles.planBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.planBadgeText}>{badgeLabel}</Text>
                      </View>
                      <Text style={styles.planTitle}>{PACE_LABELS[opt.pace].title}</Text>
                      <Text style={styles.planDesc}>{PACE_LABELS[opt.pace].desc}</Text>
                      <View style={styles.planStat}>
                        <Ionicons name="flame-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.planStatText}>Eat {opt.budget.toLocaleString()} calories per day</Text>
                      </View>
                      {data.goalType === "lose" && (
                        <>
                          <View style={styles.planStat}>
                            <Ionicons name="trending-down-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.planStatText}>Lose {formatWeeklyRate(opt.weeklyKg, data.weightUnit)} per week</Text>
                          </View>
                          {opt.goalDate && (
                            <View style={styles.planStat}>
                              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                              <Text style={styles.planStatText}>Reach goal {opt.goalDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Text>
                            </View>
                          )}
                        </>
                      )}
                      {opt.safety === "warning" && (
                        <Text style={{ fontSize: 11, color: Accent.destructive, textAlign: "center", marginTop: Spacing.xs }}>
                          Very low calorie — consult a doctor before starting
                        </Text>
                      )}
                      <Pressable style={styles.planSelectBtn} onPress={() => { update("planPace", opt.pace); goNext(); }}>
                        <Text style={styles.planSelectText}>Select</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        );

      case "budget_confirm":
        return (
          <View style={[styles.stepContent, { alignItems: "center" }]}>
            <Ionicons name="restaurant-outline" size={60} color={Accent.success} />
            <Text style={styles.budgetNumber}>{budget.toLocaleString()}</Text>
            <Text style={styles.budgetLabel}>calories per day</Text>
            {data.goalType === "lose" && (
              <Text style={styles.subheading}>{PACE_LABELS[data.planPace].title} pace — {formatWeeklyRate(planOptions(tdee, weightKg, goalWeightKg, data.goalType, data.sex).find(o => o.pace === data.planPace)?.weeklyKg ?? 0, data.weightUnit)} per week</Text>
            )}
            <Text style={[styles.subheading, { marginTop: Spacing.lg }]}>
              Suppr will use this to find recipes and build meal plans that fit your target. You can adjust it anytime in settings.
            </Text>
          </View>
        );

      case "strategy":
        return (
          <View style={styles.stepContent}>
            <Text style={styles.heading}>Pick your nutrition strategy</Text>
            <Text style={styles.subheading}>This determines your protein, carb, and fat targets.</Text>
            <View style={{ gap: Spacing.md }}>
              {(Object.entries(STRATEGY_LABELS) as [NutritionStrategy, { title: string; desc: string; emoji?: string }][]).map(([key, val]) => {
                const m = calculateMacros(budget, key, weightKg);
                return (
                  <Pressable
                    key={key}
                    style={[styles.optionBtn, data.strategy === key && styles.optionBtnActive]}
                    onPress={() => { update("strategy", key); goNext(); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
                    <Text style={[styles.optionText, data.strategy === key && styles.optionTextActive]}>{val.title}</Text>
                    <Text style={styles.optionDesc}>{val.desc}</Text>
                    <Text style={[styles.optionDesc, { marginTop: 2 }]}>P: {m.protein}g  C: {m.carbs}g  F: {m.fat}g  Fi: {m.fiber}g</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      case "dietary":
        return (
          <View style={styles.stepContent}>
            <Text style={styles.heading}>Any dietary preferences?</Text>
            <Text style={styles.subheading}>Select all that apply. This helps us suggest better recipes.</Text>
            <View style={styles.chipWrap}>
              {DIETARY_PREFERENCE_ENTRIES.map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[styles.chip, data.dietary.includes(opt.id) && styles.chipActive]}
                  onPress={() => toggleArrayItem("dietary", opt.id)}
                >
                  <Text style={styles.chipText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "calorie_schedule":
        return (
          <View style={styles.stepContent}>
            <Text style={styles.heading}>Add a calorie schedule?</Text>
            <Text style={styles.subheading}>
              {
                "Many people find it easier to have higher calorie days on weekends. We'll redistribute your weekly total so you don't go over."
              }
            </Text>
            <View style={{ gap: Spacing.md }}>
              <OptionButton label="Same every day" desc={`${budget} calories each day`} active={data.calorieSchedule === "even"} onPress={() => { update("calorieSchedule", "even"); goNext(); }} />
              <OptionButton label="Flexible weekender" desc="Higher on weekends, lower on weekdays" active={data.calorieSchedule === "flexible"} onPress={() => { update("calorieSchedule", "flexible"); goNext(); }} />
            </View>
          </View>
        );

      case "fasting":
        return (
          <View style={styles.stepContent}>
            <Ionicons name="time-outline" size={60} color={Accent.primary} style={{ alignSelf: "center" }} />
            <Text style={styles.heading}>Interested in intermittent fasting?</Text>
            <Text style={styles.subheading}>
              Intermittent fasting is an eating pattern where you only eat during certain hours of the day. For example, eating between noon and 8pm.
            </Text>
            <View style={{ gap: Spacing.md }}>
              <OptionButton label="Yes, I'd like to try it" active={data.fastingEnabled} onPress={() => { update("fastingEnabled", true); update("fastingWindow", "16:8"); goNext(); }} />
              <OptionButton label="No, I'm not interested" active={!data.fastingEnabled} onPress={() => { update("fastingEnabled", false); goNext(); }} />
            </View>
          </View>
        );

      case "projection":
        return (
          <View style={[styles.stepContent, { alignItems: "center" }]}>
            {data.goalType === "lose" && projectedDate ? (
              <>
                <Text style={styles.heading}>
                  {"You'll reach "}
                  {formatWeight(goalWeightKg, data.weightUnit)}
                  {" on"}
                </Text>
                <Text style={styles.projDate}>
                  {projectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </Text>
                <View style={{ width: "100%", marginVertical: Spacing.lg }}>
                  <View style={styles.weightRow}>
                    <View style={[styles.weightBadge, { backgroundColor: Accent.success }]}>
                      <Text style={styles.weightBadgeText}>{formatWeight(weightKg, data.weightUnit)}</Text>
                    </View>
                    <View style={{ flex: 1, height: 3, backgroundColor: Accent.success + "30", marginHorizontal: Spacing.md, borderRadius: 2 }}>
                      <View style={{ height: 3, width: "100%", backgroundColor: Accent.success, borderRadius: 2 }} />
                    </View>
                    <View style={[styles.weightBadge, { backgroundColor: Accent.primary }]}>
                      <Text style={styles.weightBadgeText}>{formatWeight(goalWeightKg, data.weightUnit)}</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={80} color={Accent.success} />
                <Text style={styles.heading}>{"You're all set!"}</Text>
              </>
            )}
            <View style={{ width: "100%", gap: Spacing.md }}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryIcon}><Ionicons name="flame" size={20} color={Accent.success} /></View>
                <View>
                  <Text style={styles.summaryLabel}>Budget: {budget.toLocaleString()} calories</Text>
                  {data.goalType === "lose" && <Text style={styles.summarySub}>Lose {formatWeeklyRate(planOptions(tdee, weightKg, goalWeightKg, data.goalType, data.sex).find(o => o.pace === data.planPace)?.weeklyKg ?? 0, data.weightUnit)} per week</Text>}
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryIcon}><Ionicons name="restaurant" size={20} color={Accent.primary} /></View>
                <View>
                  <Text style={styles.summaryLabel}>{STRATEGY_LABELS[data.strategy].title} Strategy</Text>
                  <Text style={styles.summarySub}>P: {macros.protein}g  C: {macros.carbs}g  F: {macros.fat}g</Text>
                </View>
              </View>
              {data.fastingEnabled && (
                <View style={styles.summaryRow}>
                  <View style={styles.summaryIcon}><Ionicons name="time" size={20} color={Accent.warning} /></View>
                  <View>
                    <Text style={styles.summaryLabel}>Intermittent Fasting</Text>
                    <Text style={styles.summarySub}>{data.fastingWindow} schedule</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        );

      case "summary":
        return (
          <View style={[styles.stepContent, { alignItems: "center" }]}>
            <Ionicons name="sparkles" size={60} color={Accent.success} />
            <Text style={styles.heading}>{"You're all set up"}</Text>
            <Text style={styles.subheading}>
              {
                "Suppr is ready. Import recipes from Instagram, TikTok, or any recipe site — we'll break down the macros automatically. Adjust your targets anytime in Profile & Targets."
              }
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  // Steps that auto-advance on selection (no Continue button needed)
  const autoAdvanceSteps: StepId[] = ["goal", "activity"];
  const multiSelectSteps: StepId[] = ["dietary"];
  const needsContinue = !autoAdvanceSteps.includes(currentStepId) || multiSelectSteps.includes(currentStepId);
  const isLastStep = currentStepId === "summary";

  // Validate current step
  const canContinue = (() => {
    switch (currentStepId) {
      case "basic_info": {
        const hasAge = parseInt(data.age) > 0;
        const hasHeight = heightCm > 50;
        const hasWeight = weightKg > 10;
        const hasGoalWeight = data.goalType !== "lose" || goalWeightKg > 10;
        return hasAge && hasHeight && hasWeight && hasGoalWeight;
      }
      default: return true;
    }
  })();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        {step > 0 ? (
          <Pressable style={styles.backBtn} onPress={goBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Pressable style={styles.skipBtn} onPress={skip} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Step content */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>
      </Animated.View>

      {/* Bottom CTA */}
      {(needsContinue || isLastStep) && !autoAdvanceSteps.includes(currentStepId) && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable
            style={[styles.ctaBtn, (!canContinue || saving) && styles.ctaBtnDisabled]}
            onPress={isLastStep ? saveAndFinish : goNext}
            disabled={!canContinue || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaBtnText}>{isLastStep ? "Get Started" : "Continue"}</Text>
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
