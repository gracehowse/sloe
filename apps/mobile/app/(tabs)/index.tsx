import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { dateKeyFromDate, newMealId, type ByDay, type JournalMeal } from "@/lib/nutritionJournal";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { MacroColors, Neon, Spacing, Radius } from "@/constants/theme";
import FoodSearchModal from "@/components/FoodSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import { lookupBarcode } from "@/lib/verifyRecipe";
import CalorieRing from "@/components/charts/CalorieRing";
import DayStrip from "@/components/charts/DayStrip";
import MacroRingSmall from "@/components/charts/MacroRingSmall";
import { distributeMealBudget } from "@/lib/mealBudget";
import { computeLoggingStreak } from "@/lib/trackerStats";
import { VOICE_LOG_NATIVE_BUILD_HINT } from "@/lib/voiceLog";
import { looksLikeMissingTableError } from "@/lib/supabaseErrors";

const DEFAULT_TARGETS = { calories: 2000, protein: 150, carbs: 200, fat: 65, fiber: 25 };

const MAX_JSONB_DAYS = 90;
function pruneByDay<V>(map: Record<string, V>): Record<string, V> {
  const keys = Object.keys(map).sort().reverse().slice(0, MAX_JSONB_DAYS);
  const pruned: Record<string, V> = {};
  for (const k of keys) pruned[k] = map[k];
  return pruned;
}

export default function TrackerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const colors = useThemeColors();

  const [byDay, setByDay] = useState<ByDay>({});
  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileTargets, setProfileTargets] = useState(DEFAULT_TARGETS);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [activeMealSlot, setActiveMealSlot] = useState("Breakfast");
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);
  const [waterGoalMl, setWaterGoalMl] = useState(2000);
  const [extraWaterByDay, setExtraWaterByDay] = useState<Record<string, number>>({});
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(10000);
  const [plannedMeals, setPlannedMeals] = useState<Array<{name?: string; recipe_title?: string; calories?: number; protein?: number; carbs?: number; fat?: number}>>([]);
  const [activeFastStart, setActiveFastStart] = useState<string | null>(null);
  const [fabSheetOpen, setFabSheetOpen] = useState(false);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [voiceInputOpen, setVoiceInputOpen] = useState(false);
  const [voiceInputText, setVoiceInputText] = useState("");
  const [fastingTick, setFastingTick] = useState(Date.now());

  useEffect(() => {
    if (!activeFastStart) return;
    const id = setInterval(() => setFastingTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [activeFastStart]);

  const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

  // Recent unique meals from all days for "Add previous meal"
  const recentMeals = useMemo(() => {
    const seen = new Set<string>();
    const recent: JournalMeal[] = [];
    const allDayKeys = Object.keys(byDay).sort().reverse();
    for (const dk of allDayKeys) {
      for (const m of (byDay[dk] ?? []).slice().reverse()) {
        const key = `${m.recipeTitle}|${m.calories}`;
        if (seen.has(key)) continue;
        seen.add(key);
        recent.push(m);
        if (recent.length >= 20) break;
      }
      if (recent.length >= 20) break;
    }
    return recent;
  }, [byDay]);

  const loadProfileTargets = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select(
        "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, extra_water_by_day, steps_by_day, daily_steps_goal, fasting_sessions",
      )
      .eq("id", userId)
      .maybeSingle();
    if (!data) return;
    setProfileTargets({
      calories: (data.target_calories as number) ?? DEFAULT_TARGETS.calories,
      protein: (data.target_protein as number) ?? DEFAULT_TARGETS.protein,
      carbs: (data.target_carbs as number) ?? DEFAULT_TARGETS.carbs,
      fat: (data.target_fat as number) ?? DEFAULT_TARGETS.fat,
      fiber: (data.target_fiber_g as number) ?? DEFAULT_TARGETS.fiber,
    });
    const tw = data.target_water_ml != null ? Number(data.target_water_ml) : 2000;
    setWaterGoalMl(Number.isFinite(tw) && tw > 0 ? Math.round(tw) : 2000);
    if (data.extra_water_by_day && typeof data.extra_water_by_day === "object") {
      const o = data.extra_water_by_day as Record<string, unknown>;
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(o)) {
        const n = typeof v === "number" ? v : Number(v);
        if (Number.isFinite(n)) next[k] = Math.round(n);
      }
      setExtraWaterByDay(next);
    }
    if (data.steps_by_day && typeof data.steps_by_day === "object") {
      const o = data.steps_by_day as Record<string, unknown>;
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(o)) {
        const n = typeof v === "number" ? v : Number(v);
        if (Number.isFinite(n)) next[k] = Math.round(n);
      }
      setStepsByDay(next);
    }
    const sg = data.daily_steps_goal != null ? Number(data.daily_steps_goal) : 10000;
    setDailyStepsGoal(Number.isFinite(sg) && sg > 0 ? Math.round(sg) : 10000);
    if (Array.isArray(data.fasting_sessions)) {
      const active = (data.fasting_sessions as Array<{start: string; end: string | null}>).find((s) => s.end === null);
      setActiveFastStart(active?.start ?? null);
    }
  }, [userId]);

  const dayKey = dateKeyFromDate(selectedDate);
  const mealsToday = byDay[dayKey] ?? [];
  const targets = profileTargets;
  const isToday = dayKey === dateKeyFromDate(new Date());

  const navigateDay = useCallback((offset: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset);
      return next;
    });
  }, []);

  const formatDateLabel = useCallback((d: Date) => {
    const today = new Date();
    const todayStr = dateKeyFromDate(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dk = dateKeyFromDate(d);
    if (dk === todayStr) return "Today";
    if (dk === dateKeyFromDate(yesterday)) return "Yesterday";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }, []);

  // Week data: Mon-Sun for the selected date's week
  const weekData = useMemo(() => {
    const d = new Date(selectedDate);
    const dayOfWeek = d.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);

    const days: { key: string; label: string; short: string; date: Date; meals: JournalMeal[]; totals: { calories: number; protein: number; carbs: number; fat: number } }[] = [];
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      const dk = dateKeyFromDate(dd);
      const meals = byDay[dk] ?? [];
      const totals = meals.reduce(
        (acc, m) => ({
          calories: acc.calories + Math.max(0, m.calories),
          protein: acc.protein + Math.max(0, m.protein),
          carbs: acc.carbs + Math.max(0, m.carbs),
          fat: acc.fat + Math.max(0, m.fat),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      days.push({ key: dk, label: dayLabels[i], short: dayLabels[i], date: dd, meals, totals });
    }

    const weekTotals = days.reduce(
      (acc, d) => ({
        calories: acc.calories + d.totals.calories,
        protein: acc.protein + d.totals.protein,
        carbs: acc.carbs + d.totals.carbs,
        fat: acc.fat + d.totals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const daysWithFood = days.filter((d) => d.totals.calories > 0).length || 1;
    const weekAvg = {
      calories: Math.round(weekTotals.calories / daysWithFood),
      protein: Math.round(weekTotals.protein / daysWithFood),
      carbs: Math.round(weekTotals.carbs / daysWithFood),
      fat: Math.round(weekTotals.fat / daysWithFood),
    };

    const weekStart = monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekEnd = sunday.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return { days, weekTotals, weekAvg, daysWithFood, label: `${weekStart} – ${weekEnd}` };
  }, [selectedDate, byDay]);

  const navigateWeek = useCallback((offset: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset * 7);
      return next;
    });
  }, []);

  const totals = useMemo(() => {
    const raw = mealsToday.reduce(
      (acc, m) => ({
        calories: acc.calories + Math.max(0, m.calories),
        protein: acc.protein + Math.max(0, m.protein),
        carbs: acc.carbs + Math.max(0, m.carbs),
        fat: acc.fat + Math.max(0, m.fat),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return {
      calories: Math.round(raw.calories),
      protein: Math.round(raw.protein),
      carbs: Math.round(raw.carbs),
      fat: Math.round(raw.fat),
    };
  }, [mealsToday]);

  const remaining = targets.calories - totals.calories;

  const fiberToday = useMemo(
    () => mealsToday.reduce((a, m) => a + (m.fiberG ?? 0), 0),
    [mealsToday],
  );

  const loggedDays = useMemo(() => {
    const s = new Set<string>();
    for (const k of Object.keys(byDay)) {
      if ((byDay[k] ?? []).length > 0) s.add(k);
    }
    return s;
  }, [byDay]);

  const streakDays = useMemo(
    () => computeLoggingStreak(byDay as any),
    [byDay],
  );

  const mealBudgets = useMemo(() => {
    const consumed: Record<string, number> = {};
    for (const m of mealsToday) {
      const slot = m.name || "Other";
      consumed[slot] = (consumed[slot] ?? 0) + m.calories;
    }
    return distributeMealBudget(targets.calories, targets.fiber, consumed);
  }, [mealsToday, targets.calories, targets.fiber]);

  const extraWaterToday = extraWaterByDay[dayKey] ?? 0;
  const stepsTodayCount = stepsByDay[dayKey] ?? 0;

  const handlePhotoLog = useCallback(async () => {
    try {
      const ImagePicker = require("expo-image-picker");
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera access is required for photo logging.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;

      setPhotoAnalyzing(true);

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("image", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: "meal.jpg",
      } as any);

      const apiBase = (
        (await import("expo-constants")).default.expoConfig?.extra as any
      )?.platemateApiUrl ?? "";
      const resp = await fetch(`${apiBase}/api/nutrition/photo-log`, {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      const data = await resp.json();
      setPhotoAnalyzing(false);

      if (resp.status === 403 && data.error === "upgrade_required") {
        Alert.alert(
          "Upgrade required",
          typeof data.message === "string" && data.message
            ? data.message
            : "Photo meal logging is available on Base or Pro. Upgrade in the web app to continue.",
        );
        return;
      }

      if (!data.ok || !Array.isArray(data.items) || data.items.length === 0) {
        Alert.alert("Could not identify", data.message ?? "Try a clearer photo with better lighting.");
        return;
      }

      const itemNames = data.items.map((i: any) => `${i.name}: ${i.calories} kcal`).join("\n");
      Alert.alert(
        `Found ${data.items.length} item${data.items.length > 1 ? "s" : ""}`,
        `${itemNames}\n\nTotal: ${data.totalCalories} kcal`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Log All",
            onPress: () => {
              const newMeals: JournalMeal[] = data.items.map((item: any) => ({
                id: newMealId(),
                name: activeMealSlot,
                recipeTitle: item.name,
                time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                calories: Math.round(item.calories),
                protein: Math.round(item.protein),
                carbs: Math.round(item.carbs),
                fat: Math.round(item.fat),
              }));
              setByDay((prev) => ({
                ...prev,
                [dayKey]: [...(prev[dayKey] ?? []), ...newMeals],
              }));
            },
          },
        ],
      );
    } catch (e) {
      setPhotoAnalyzing(false);
      Alert.alert("Photo logging unavailable", "Camera requires a development build.");
    }
  }, [session, activeMealSlot, dayKey]);

  const handleVoiceLog = useCallback(async () => {
    try {
      const { isSpeechAvailable, listenForSpeech } = await import("@/lib/voiceLog");
      if (!isSpeechAvailable()) {
        setVoiceInputOpen(true);
        return;
      }
      Alert.alert("Listening...", "Describe what you ate.");
      const transcript = await listenForSpeech({ maxDurationMs: 10_000 });
      if (!transcript.trim()) {
        Alert.alert("No speech detected", "Please try again.");
        return;
      }
      await submitVoiceTranscript(transcript);
    } catch {
      setVoiceInputOpen(true);
    }
  }, [session, activeMealSlot, dayKey]);

  const submitVoiceTranscript = useCallback(async (transcript: string) => {
    try {
      const Constants = (await import("expo-constants")).default;
      const apiBase = (Constants.expoConfig?.extra as any)?.platemateApiUrl ?? "";
      const resp = await fetch(`${apiBase}/api/nutrition/voice-log`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ transcript }),
      });
      const data = await resp.json();
      if (resp.status === 403 && data.error === "upgrade_required") {
        Alert.alert(
          "Upgrade required",
          typeof data.message === "string" && data.message
            ? data.message
            : "Voice meal logging is available on Base or Pro. Upgrade in the web app to continue.",
        );
        return;
      }
      if (!data.ok || !Array.isArray(data.items) || data.items.length === 0) {
        Alert.alert("Could not parse", data.message ?? "Try describing your meal differently.");
        return;
      }
      const itemNames = data.items.map((i: any) => `${i.name}: ${i.calories} kcal`).join("\n");
      Alert.alert(
        `Parsed ${data.items.length} item${data.items.length > 1 ? "s" : ""}`,
        `${itemNames}\n\nTotal: ${data.totalCalories} kcal`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Log All",
            onPress: () => {
              const newMeals: JournalMeal[] = data.items.map((item: any) => ({
                id: newMealId(),
                name: activeMealSlot,
                recipeTitle: item.name,
                time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                calories: Math.round(item.calories),
                protein: Math.round(item.protein),
                carbs: Math.round(item.carbs),
                fat: Math.round(item.fat),
              }));
              setByDay((prev) => ({
                ...prev,
                [dayKey]: [...(prev[dayKey] ?? []), ...newMeals],
              }));
            },
          },
        ],
      );
    } catch {
      Alert.alert("Voice logging failed", "Please try again.");
    }
  }, [session, activeMealSlot, dayKey]);

  const addWaterMl = useCallback(
    (ml: number) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(ml));
      if (add === 0) return;
      setExtraWaterByDay((prev) => {
        const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
        void supabase.from("profiles").update({ extra_water_by_day: next }).eq("id", userId);
        return next;
      });
    },
    [userId, dayKey],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 120, gap: Spacing.lg },


        dateNav: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.xl,
        },
        dateNavArrow: { color: colors.textSecondary, fontSize: 22, fontWeight: "600" },
        dateNavLabel: { color: colors.text, fontSize: 16, fontWeight: "600" },

        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
          gap: Spacing.md,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
        cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },

        macroBarBlock: { gap: Spacing.xs, paddingVertical: Spacing.sm },
        macroBarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
        macroBarTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
        macroBarNums: { fontSize: 12, color: colors.textTertiary, fontVariant: ["tabular-nums"] },
        macroBarTrack: {
          height: 8,
          backgroundColor: colors.border,
          borderRadius: 4,
          overflow: "hidden",
        },
        macroBarFill: { height: 8, borderRadius: 4 },

        // Calorie math
        calorieMathRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.md,
        },
        calorieMathItem: { alignItems: "center" },
        calorieMathNumber: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
        calorieMathLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
        calorieMathOp: { fontSize: 18, color: colors.textTertiary, fontWeight: "600" },

        // Meal sections
        mealSlotHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        mealSlotName: { fontSize: 18, fontWeight: "700", color: colors.text },
        mealSlotCals: { fontSize: 18, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
        mealSlotMacros: { fontSize: 12, color: colors.textSecondary },
        mealRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        mealName: { fontSize: 15, fontWeight: "500", color: colors.text },
        mealMeta: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
        mealCals: { fontSize: 16, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },

        addFoodBtn: {
          borderWidth: 1,
          borderColor: Neon.purple + "60",
          borderRadius: Radius.md,
          paddingVertical: Spacing.md,
          alignItems: "center",
        },
        addFoodBtnText: { color: Neon.purple, fontWeight: "700", fontSize: 14 },

        emptyText: { color: colors.textTertiary, textAlign: "center", fontSize: 14 },

        // Add food form
        input: {
          backgroundColor: colors.inputBg,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          color: colors.text,
          fontSize: 15,
        },
        inputRow: { flexDirection: "row", gap: Spacing.sm },
        submitBtn: {
          backgroundColor: Neon.purple,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
        },
        submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

      }),
    [colors],
  );

  const loadJournal = useCallback(async () => {
    if (!userId) return;

    const loadLegacyByDay = async (): Promise<ByDay | null> => {
      const { data: legacyData, error: legacyError } = await supabase
        .from("nutrition_journals")
        .select("by_day")
        .eq("user_id", userId)
        .maybeSingle();
      if (legacyError || !legacyData?.by_day || typeof legacyData.by_day !== "object") return null;
      const raw = legacyData.by_day as Record<string, unknown>;
      const out: ByDay = {};
      for (const [dayKey, meals] of Object.entries(raw)) {
        if (!Array.isArray(meals)) continue;
        out[dayKey] = meals.map((m: Record<string, unknown>) => ({
          id: typeof m.id === "string" ? m.id : newMealId(),
          name: String(m.name ?? ""),
          recipeTitle: String(m.recipeTitle ?? m.recipe_title ?? ""),
          time: String(m.time ?? m.time_label ?? ""),
          calories: Number(m.calories) || 0,
          protein: Number(m.protein) || 0,
          carbs: Number(m.carbs) || 0,
          fat: Number(m.fat) || 0,
          fiberG: m.fiberG != null ? Number(m.fiberG) : m.fiber_g != null ? Number(m.fiber_g) : undefined,
          waterMl: m.waterMl != null ? Number(m.waterMl) : m.water_ml != null ? Number(m.water_ml) : undefined,
          portionMultiplier:
            m.portionMultiplier != null
              ? Number(m.portionMultiplier)
              : m.portion_multiplier != null
                ? Number(m.portion_multiplier)
                : undefined,
        }));
      }
      return out;
    };

    const { data: rows, error } = await supabase
      .from("nutrition_entries")
      .select("id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    let loaded: ByDay = {};

    if (error) {
      const msg = error.message ?? "";
      if (looksLikeMissingTableError(msg)) {
        const legacy = await loadLegacyByDay();
        setByDay(legacy ?? {});
      } else {
        console.error("[tracker] load failed:", msg);
        setByDay({});
      }
    } else {
      for (const r of rows ?? []) {
        const k = r.date_key as string;
        if (!loaded[k]) loaded[k] = [];
        loaded[k].push({
          id: r.id as string,
          name: (r.name as string) ?? "",
          recipeTitle: (r.recipe_title as string) ?? "",
          time: (r.time_label as string) ?? "",
          calories: (r.calories as number) ?? 0,
          protein: (r.protein as number) ?? 0,
          carbs: (r.carbs as number) ?? 0,
          fat: (r.fat as number) ?? 0,
          fiberG: (r.fiber_g as number) ?? undefined,
          waterMl: (r.water_ml as number) ?? undefined,
          portionMultiplier: (r.portion_multiplier as number) ?? undefined,
        });
      }
      if (Object.keys(loaded).length === 0) {
        const legacy = await loadLegacyByDay();
        if (legacy && Object.keys(legacy).length > 0) loaded = legacy;
      }
      setByDay(loaded);
    }
    setHydrated(true);

    // Load today's planned meals
    const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
    const { data: planRows } = await supabase
      .from("meal_plan_days")
      .select("meals")
      .eq("user_id", userId)
      .eq("day_number", todayDow)
      .eq("slot_id", "default")
      .maybeSingle();
    if (planRows?.meals && Array.isArray(planRows.meals)) {
      setPlannedMeals(planRows.meals as typeof plannedMeals);
    } else {
      setPlannedMeals([]);
    }
  }, [userId]);

  // Reload journal + targets every time this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      void loadJournal();
      void loadProfileTargets();
    }, [loadJournal, loadProfileTargets]),
  );

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Sync journal to relational nutrition_entries table
  useEffect(() => {
    if (!userId || !hydrated) return;
    const t = setTimeout(() => {
      const dk = dateKeyFromDate(selectedDate);
      const todayMeals = byDay[dk] ?? [];
      if (todayMeals.length > 0) {
        const rows = todayMeals.map((m) => ({
          id: UUID_RE.test(m.id) ? m.id : newMealId(),
          user_id: userId,
          date_key: dk,
          name: m.name,
          recipe_title: m.recipeTitle,
          time_label: m.time,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          fiber_g: m.fiberG ?? null,
          water_ml: m.waterMl ?? null,
          portion_multiplier: m.portionMultiplier ?? 1,
        }));
        void supabase
          .from("nutrition_entries")
          .upsert(rows, { onConflict: "id" })
          .then(({ error }) => {
            if (error) console.error("[tracker] sync failed:", error.message);
          });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [userId, hydrated, byDay, selectedDate]);

  const addMeal = useCallback(() => {
    const cal = Number(kcal) || 0;
    const p = Number(protein) || 0;
    const cb = Number(carbs) || 0;
    const f = Number(fat) || 0;
    if (cal <= 0) return;

    const meal: JournalMeal = {
      id: newMealId(),
      name: activeMealSlot,
      recipeTitle: title.trim() || "Quick entry",
      time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      calories: Math.round(cal),
      protein: Math.round(p),
      carbs: Math.round(cb),
      fat: Math.round(f),
    };
    setByDay((prev) => ({
      ...prev,
      [dayKey]: [...(prev[dayKey] ?? []), meal],
    }));
    setTitle("");
    setKcal("");
    setProtein("");
    setCarbs("");
    setFat("");
    setAddOpen(false);
  }, [dayKey, kcal, protein, carbs, fat, title, activeMealSlot]);

  const deleteMeal = useCallback((mealId: string) => {
    setByDay((prev) => ({
      ...prev,
      [dayKey]: (prev[dayKey] ?? []).filter((m) => m.id !== mealId),
    }));

    // Persist deletion to Supabase (relational table).
    // Without this, the meal reappears on next app launch.
    if (userId) {
      void supabase
        .from("nutrition_entries")
        .delete()
        .eq("id", mealId)
        .then(({ error }) => {
          if (error) {
            console.error("[tracker] delete meal failed:", error.message);
          }
        });
    }
  }, [dayKey, userId]);

  // Group meals by slot
  const mealGroups = useMemo(() => {
    const groups: Record<string, JournalMeal[]> = {};
    for (const m of mealsToday) {
      const slot = m.name || "Other";
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(m);
    }
    return groups;
  }, [mealsToday]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
            {isToday ? "Today" : formatDateLabel(selectedDate)}
          </Text>
          <Pressable onPress={() => router.push("/progress")} hitSlop={8}>
            <Text style={{ color: Neon.purple, fontWeight: "700", fontSize: 14 }}>Progress →</Text>
          </Pressable>
        </View>

        {/* Day/Week toggle */}
        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: Radius.md, padding: 3 }}>
          <Pressable
            onPress={() => setViewMode("day")}
            style={{ flex: 1, paddingVertical: 10, borderRadius: Radius.sm, backgroundColor: viewMode === "day" ? Neon.purple : "transparent", alignItems: "center" }}
          >
            <Text style={{ color: viewMode === "day" ? "#fff" : colors.textSecondary, fontWeight: "700", fontSize: 14 }}>Day</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode("week")}
            style={{ flex: 1, paddingVertical: 10, borderRadius: Radius.sm, backgroundColor: viewMode === "week" ? Neon.purple : "transparent", alignItems: "center" }}
          >
            <Text style={{ color: viewMode === "week" ? "#fff" : colors.textSecondary, fontWeight: "700", fontSize: 14 }}>Week</Text>
          </Pressable>
        </View>

        {/* Day-of-week strip */}
        {viewMode === "day" && (
          <DayStrip
            selectedDate={selectedDate}
            loggedDays={loggedDays}
            onSelectDate={setSelectedDate}
            textColor={colors.text}
            secondaryColor={colors.textSecondary}
            cardColor={colors.card}
          />
        )}

        {/* Streak badge */}
        {viewMode === "day" && streakDays > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: Spacing.xs }}>
            <Ionicons name="flame" size={18} color={Neon.orange} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
              {streakDays} day streak
            </Text>
          </View>
        )}
        {viewMode === "day" && isToday && streakDays > 0 && mealsToday.length === 0 && (
          <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs }}>
            <Text style={{ fontSize: 12, color: Neon.orange, textAlign: "center", fontWeight: "600" }}>
              Keep your streak alive — log a meal today!
            </Text>
          </View>
        )}

        {/* Fasting status pill */}
        {viewMode === "day" && activeFastStart && (() => {
          const elapsedH = Math.max(0, (fastingTick - new Date(activeFastStart).getTime()) / 3600_000);
          const h = Math.floor(elapsedH);
          const m = Math.floor((elapsedH - h) * 60);
          return (
            <Pressable
              onPress={() => router.push("/fasting")}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                paddingVertical: 6, paddingHorizontal: Spacing.lg,
                alignSelf: "center",
                backgroundColor: Neon.purple + "15",
                borderRadius: Radius.md,
                marginVertical: Spacing.xs,
              }}
            >
              <Ionicons name="time" size={16} color={Neon.purple} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: Neon.purple }}>
                Fasting — {h}h {m}m
              </Text>
            </Pressable>
          );
        })()}

        {viewMode === "week" ? (
          <>
            {/* Week date nav */}
            <View style={styles.dateNav}>
              <Pressable onPress={() => navigateWeek(-1)} hitSlop={12}>
                <Text style={styles.dateNavArrow}>‹</Text>
              </Pressable>
              <Pressable onPress={() => { setSelectedDate(new Date()); }} hitSlop={12}>
                <Text style={styles.dateNavLabel}>{weekData.label}</Text>
              </Pressable>
              <Pressable onPress={() => navigateWeek(1)} hitSlop={12}>
                <Text style={styles.dateNavArrow}>›</Text>
              </Pressable>
            </View>

            {/* Weekly bar chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Calories</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 140, marginTop: Spacing.md }}>
                {weekData.days.map((day) => {
                  const maxCal = Math.max(targets.calories, ...weekData.days.map((d) => d.totals.calories));
                  const barHeight = maxCal > 0 ? Math.max(4, (day.totals.calories / maxCal) * 110) : 4;
                  const over = day.totals.calories > targets.calories;
                  const todayDk = dateKeyFromDate(new Date());
                  const isCurrentDay = day.key === todayDk;
                  return (
                    <Pressable
                      key={day.key}
                      onPress={() => { setSelectedDate(day.date); setViewMode("day"); }}
                      style={{ alignItems: "center", flex: 1, gap: 4 }}
                    >
                      <Text style={{ fontSize: 10, color: colors.textTertiary, fontVariant: ["tabular-nums"] }}>
                        {day.totals.calories > 0 ? Math.round(day.totals.calories) : ""}
                      </Text>
                      <View
                        style={{
                          width: 28,
                          height: barHeight,
                          borderRadius: 4,
                          backgroundColor: over ? Neon.red + "CC" : day.totals.calories > 0 ? Neon.purple : colors.border,
                        }}
                      />
                      <Text style={{
                        fontSize: 11,
                        fontWeight: isCurrentDay ? "800" : "600",
                        color: isCurrentDay ? Neon.purple : colors.textSecondary,
                      }}>
                        {day.short}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {/* Goal line label */}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>Daily goal: {targets.calories} kcal</Text>
              </View>
            </View>

            {/* Weekly summary */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Summary</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: Spacing.md }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>{Math.round(weekData.weekTotals.calories)}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Total kcal</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: Neon.purple, fontVariant: ["tabular-nums"] }}>{Math.round(weekData.weekAvg.calories)}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Daily avg</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: targets.calories * 7 > weekData.weekTotals.calories ? Neon.green : Neon.red, fontVariant: ["tabular-nums"] }}>
                    {Math.round(Math.abs(targets.calories * 7 - weekData.weekTotals.calories))}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {targets.calories * 7 > weekData.weekTotals.calories ? "Under budget" : "Over budget"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Weekly macro averages */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Averages</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: Spacing.sm }}>
                Based on {weekData.daysWithFood} day{weekData.daysWithFood !== 1 ? "s" : ""} with logged food
              </Text>
              <MacroBarRow label="PROTEIN" current={weekData.weekAvg.protein} goal={targets.protein} color={MacroColors.protein} styles={styles} />
              <MacroBarRow label="CARBS" current={weekData.weekAvg.carbs} goal={targets.carbs} color={MacroColors.carbs} styles={styles} />
              <MacroBarRow label="FATS" current={weekData.weekAvg.fat} goal={targets.fat} color={MacroColors.fat} styles={styles} />
            </View>

            {/* Macro bars per day */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Macro Breakdown</Text>
              <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
                {weekData.days.map((day) => (
                  <Pressable
                    key={day.key}
                    onPress={() => { setSelectedDate(day.date); setViewMode("day"); }}
                    style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
                  >
                    <Text style={{ width: 30, fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>{day.short}</Text>
                    <View style={{ flex: 1, flexDirection: "row", height: 14, borderRadius: 3, overflow: "hidden", backgroundColor: colors.border }}>
                      {day.totals.calories > 0 && (() => {
                        const total = day.totals.protein + day.totals.carbs + day.totals.fat || 1;
                        return (
                          <>
                            <View style={{ width: `${(day.totals.protein / total) * 100}%`, backgroundColor: MacroColors.protein }} />
                            <View style={{ width: `${(day.totals.carbs / total) * 100}%`, backgroundColor: MacroColors.carbs }} />
                            <View style={{ width: `${(day.totals.fat / total) * 100}%`, backgroundColor: MacroColors.fat }} />
                          </>
                        );
                      })()}
                    </View>
                    <Text style={{ width: 45, fontSize: 11, color: colors.textTertiary, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                      {day.totals.calories > 0 ? `${Math.round(day.totals.calories)}` : "—"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.lg, justifyContent: "center", marginTop: Spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.protein }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Protein</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.carbs }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Carbs</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.fat }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Fat</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Calorie Ring */}
            <View style={styles.card}>
              <CalorieRing
                consumed={totals.calories}
                goal={targets.calories}
                textColor={colors.text}
                secondaryColor={colors.textSecondary}
                trackColor={colors.border}
              />
            </View>

            {/* Macro + Fiber Rings */}
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                <MacroRingSmall value={totals.protein} goal={targets.protein} color={MacroColors.protein} label="Protein" trackColor={colors.border} labelColor={colors.textSecondary} />
                <MacroRingSmall value={totals.carbs} goal={targets.carbs} color={MacroColors.carbs} label="Carbs" trackColor={colors.border} labelColor={colors.textSecondary} />
                <MacroRingSmall value={totals.fat} goal={targets.fat} color={MacroColors.fat} label="Fat" trackColor={colors.border} labelColor={colors.textSecondary} />
                <MacroRingSmall value={Math.round(fiberToday)} goal={targets.fiber} color={MacroColors.fiber} label="Fibre" trackColor={colors.border} labelColor={colors.textSecondary} />
              </View>
            </View>

            {/* Water card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Water</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>
                {extraWaterToday.toLocaleString()} / {waterGoalMl.toLocaleString()} ml
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: Spacing.md }}>
                {[200, 250, 500].map((ml) => (
                  <Pressable
                    key={ml}
                    onPress={() => addWaterMl(ml)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: Radius.md,
                      backgroundColor: Neon.purple + "28",
                      borderWidth: 1,
                      borderColor: Neon.purple + "55",
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: Neon.purple, fontSize: 13 }}>+{ml} ml</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Steps card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Steps</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>
                {stepsTodayCount.toLocaleString()} / {dailyStepsGoal.toLocaleString()}
              </Text>
              <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: Spacing.sm, overflow: "hidden" }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: Neon.purple, width: `${Math.min(100, (stepsTodayCount / Math.max(1, dailyStepsGoal)) * 100)}%` }} />
              </View>
              <Pressable onPress={() => router.push("/progress")} style={{ marginTop: Spacing.md, alignSelf: "flex-start" }}>
                <Text style={{ color: Neon.purple, fontWeight: "700", fontSize: 13 }}>Log steps & weigh-in →</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Deficit insight */}
        {viewMode === "day" && isToday && remaining > 0 && (
          <View style={{ backgroundColor: Neon.purple + "12", borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Neon.purple + "25" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: Neon.purple }}>
              ~{remaining} kcal under budget so far today
            </Text>
            {(() => {
              const last7Keys = Object.keys(byDay).sort().reverse().slice(0, 7);
              if (last7Keys.length < 2) return null;
              const avgDeficit = Math.round(
                last7Keys.reduce((sum, k) => {
                  const dayCals = (byDay[k] ?? []).reduce((a, m) => a + m.calories, 0);
                  return sum + (targets.calories - dayCals);
                }, 0) / last7Keys.length,
              );
              if (avgDeficit <= 0) return null;
              return (
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  7-day avg: ~{avgDeficit} kcal/day under goal
                </Text>
              );
            })()}
          </View>
        )}

        {/* Meal sections (day view only) — show all slots */}
        {viewMode === "day" && MEAL_SLOTS.map((slot) => {
          const meals = mealGroups[slot] ?? [];
          const slotCals = Math.round(meals.reduce((a, m) => a + m.calories, 0));
          const slotP = Math.round(meals.reduce((a, m) => a + m.protein, 0));
          const slotC = Math.round(meals.reduce((a, m) => a + m.carbs, 0));
          const slotF = Math.round(meals.reduce((a, m) => a + m.fat, 0));
          const budget = mealBudgets.find((b) => b.slot === slot);
          return (
            <View key={slot} style={styles.card}>
              <View style={styles.mealSlotHeader}>
                <Text style={styles.mealSlotName}>{slot}</Text>
                {slotCals > 0 && <Text style={styles.mealSlotCals}>{slotCals}</Text>}
              </View>
              {slotCals > 0 ? (
                <Text style={styles.mealSlotMacros}>
                  P {slotP}g · C {slotC}g · F {slotF}g
                </Text>
              ) : budget && budget.calories > 0 ? (
                <Text style={{ fontSize: 12, color: colors.textTertiary, fontStyle: "italic" }}>
                  {budget.calories} calories suggested · {budget.fiber}g fibre
                </Text>
              ) : null}
              {meals.map((m) => (
                <View key={m.id} style={[styles.mealRow, { gap: Spacing.sm }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealName}>{m.recipeTitle}</Text>
                    <Text style={styles.mealMeta}>P {Math.round(m.protein)}g · C {Math.round(m.carbs)}g · F {Math.round(m.fat)}g</Text>
                  </View>
                  <Text style={styles.mealCals}>{Math.round(m.calories)}</Text>
                  <Pressable
                    onPress={() => {
                      Alert.alert("Delete entry", `Remove "${m.recipeTitle}"?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => deleteMeal(m.id) },
                      ]);
                    }}
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addFoodBtn} onPress={() => { setActiveMealSlot(slot); setFabSheetOpen(true); }}>
                <Text style={styles.addFoodBtnText}>+ Add Food</Text>
              </Pressable>
            </View>
          );
        })}

        {/* Planned meals from the planner */}
        {viewMode === "day" && plannedMeals.length > 0 && (
          <View style={styles.card}>
            <View style={styles.mealSlotHeader}>
              <Text style={[styles.mealSlotName, { color: Neon.purple }]}>Planned</Text>
            </View>
            {plannedMeals.map((pm, i) => (
              <View key={`planned-${i}`} style={styles.mealRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mealName, { opacity: 0.7 }]}>{pm.recipe_title ?? pm.name}</Text>
                  <Text style={styles.mealMeta}>
                    {Math.round(pm.calories ?? 0)} kcal · P {Math.round(pm.protein ?? 0)}g · C {Math.round(pm.carbs ?? 0)}g · F {Math.round(pm.fat ?? 0)}g
                  </Text>
                </View>
                <Pressable
                  onPress={async () => {
                    const entryId = newMealId();
                    const dk = dateKeyFromDate(selectedDate);
                    const { error } = await supabase.from("nutrition_entries").insert({
                      id: entryId,
                      user_id: userId,
                      date_key: dk,
                      name: pm.name ?? pm.recipe_title ?? "",
                      recipe_title: pm.recipe_title ?? pm.name ?? "",
                      time_label: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                      calories: pm.calories ?? 0,
                      protein: pm.protein ?? 0,
                      carbs: pm.carbs ?? 0,
                      fat: pm.fat ?? 0,
                      portion_multiplier: 1,
                    });
                    if (error) {
                      Alert.alert("Log failed", error.message);
                    } else {
                      void loadJournal();
                    }
                  }}
                  style={{ paddingHorizontal: 8, paddingVertical: 12 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Neon.purple }}>Log{"\n"}today</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Add food form */}
        {viewMode === "day" && addOpen && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Log to {activeMealSlot}</Text>
            {/* Meal slot quick-switch */}
            <View style={{ flexDirection: "row", gap: Spacing.xs }}>
              {MEAL_SLOTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setActiveMealSlot(s)}
                  style={{
                    flex: 1, paddingVertical: 6, borderRadius: Radius.sm, alignItems: "center",
                    backgroundColor: activeMealSlot === s ? Neon.purple : colors.border + "40",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: activeMealSlot === s ? "#fff" : colors.textSecondary }}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholder="Food name"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
            <View style={styles.inputRow}>
              <TextInput
                placeholder="Calories"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={kcal}
                onChangeText={setKcal}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                placeholder="Protein"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={protein}
                onChangeText={setProtein}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                placeholder="Carbs"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={carbs}
                onChangeText={setCarbs}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                placeholder="Fat"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={fat}
                onChangeText={setFat}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <Pressable style={[styles.submitBtn, { flex: 1 }]} onPress={addMeal}>
                <Text style={styles.submitBtnText}>Add to Today</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, { flex: 1, backgroundColor: Neon.purple }]}
                onPress={() => { setAddOpen(false); setSearchOpen(true); }}
              >
                <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.submitBtnText}>Search</Text>
              </Pressable>
            </View>
          </View>
        )}

      </ScrollView>

      {/* FAB — always visible, opens bottom sheet */}
      {viewMode === "day" && !addOpen && !showPrevious && !fabSheetOpen && (
        <Pressable
          onPress={() => setFabSheetOpen(true)}
          style={{
            position: "absolute",
            right: Spacing.xl,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: Neon.purple,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Neon.purple,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}

      {/* Bottom sheet for logging options */}
      {fabSheetOpen && (
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setFabSheetOpen(false)}
        >
          <Pressable
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: Spacing.lg }}>Log Food</Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.md }}>
              {[
                { icon: "add-circle-outline" as const, label: "Quick Add", onPress: () => { setFabSheetOpen(false); setAddOpen(true); } },
                { icon: "search" as const, label: "Search", onPress: () => { setFabSheetOpen(false); setSearchOpen(true); } },
                { icon: "barcode-outline" as const, label: "Scan", onPress: () => { setFabSheetOpen(false); setBarcodeOpen(true); } },
                { icon: "camera-outline" as const, label: "Photo", onPress: () => { setFabSheetOpen(false); handlePhotoLog(); } },
                { icon: "mic-outline" as const, label: "Voice", onPress: () => { setFabSheetOpen(false); handleVoiceLog(); } },
                { icon: "time-outline" as const, label: "Previous", onPress: () => { setFabSheetOpen(false); setShowPrevious(true); } },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  onPress={item.onPress}
                  style={{
                    width: "30%",
                    alignItems: "center",
                    paddingVertical: Spacing.md,
                    borderRadius: Radius.md,
                    backgroundColor: colors.inputBg,
                  }}
                >
                  <Ionicons name={item.icon} size={24} color={Neon.purple} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginTop: 6 }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      )}

      {/* Photo analyzing overlay */}
      {photoAnalyzing && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
          <View style={{ backgroundColor: colors.card, borderRadius: Radius.lg, padding: Spacing.xxxl, alignItems: "center", gap: Spacing.md }}>
            <ActivityIndicator size="large" color={Neon.purple} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Analyzing meal...</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>AI is identifying food items.{"\n"}This may take a moment.</Text>
          </View>
        </View>
      )}

      {/* Voice input modal (cross-platform) */}
      {voiceInputOpen && (
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setVoiceInputOpen(false)}
        >
          <Pressable
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: Spacing.sm }}>Voice Log</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.xs }}>
              Describe what you ate (e.g. "2 scrambled eggs and toast with butter")
            </Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: Spacing.lg }}>
              {VOICE_LOG_NATIVE_BUILD_HINT}
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.inputBg,
                borderRadius: Radius.md,
                paddingHorizontal: Spacing.lg,
                paddingVertical: Spacing.md,
                color: colors.text,
                fontSize: 15,
                minHeight: 48,
              }}
              placeholder="Type what you ate..."
              placeholderTextColor={colors.textTertiary}
              value={voiceInputText}
              onChangeText={setVoiceInputText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (voiceInputText.trim()) {
                  setVoiceInputOpen(false);
                  submitVoiceTranscript(voiceInputText.trim());
                  setVoiceInputText("");
                }
              }}
            />
            <Pressable
              style={{ backgroundColor: Neon.purple, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center", marginTop: Spacing.md }}
              onPress={() => {
                if (voiceInputText.trim()) {
                  setVoiceInputOpen(false);
                  submitVoiceTranscript(voiceInputText.trim());
                  setVoiceInputText("");
                }
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Log Food</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {/* Food search modal for logging */}
      <FoodSearchModal
        visible={searchOpen}
        initialQuery=""
        onSelect={(result: any) => {
          const grams = result.chosenPortion.gramWeight * result.quantity;
          const f = grams / 100;
          const meal: JournalMeal = {
            id: newMealId(),
            name: activeMealSlot,
            recipeTitle: result.name,
            time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
            calories: Math.round(result.macrosPer100g.calories * f),
            protein: Math.round(result.macrosPer100g.protein * f * 10) / 10,
            carbs: Math.round(result.macrosPer100g.carbs * f * 10) / 10,
            fat: Math.round(result.macrosPer100g.fat * f * 10) / 10,
          };
          setByDay((prev) => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] ?? []), meal],
          }));
          setSearchOpen(false);
        }}
        onClose={() => setSearchOpen(false)}
      />

      {/* Barcode scanner */}
      <BarcodeScannerModal
        visible={barcodeOpen}
        onScan={async (code: string) => {
          const product = await lookupBarcode(code);
          setBarcodeOpen(false);
          if (!product) {
            Alert.alert("Not found", "Couldn't find nutrition data for this barcode.");
            return;
          }
          const meal: JournalMeal = {
            id: newMealId(),
            name: activeMealSlot,
            recipeTitle: product.name,
            time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
            calories: product.calories,
            protein: product.protein,
            carbs: product.carbs,
            fat: product.fat,
          };
          setByDay((prev) => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] ?? []), meal],
          }));
          Alert.alert("Logged", `${product.name} added to ${activeMealSlot}.`);
        }}
        onClose={() => setBarcodeOpen(false)}
      />

      {/* Previous meals panel */}
      {showPrevious && (
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0, top: 0,
          backgroundColor: colors.background, paddingTop: insets.top,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Previous Meals</Text>
              <Text style={{ fontSize: 12, color: Neon.purple, fontWeight: "600", marginTop: 2 }}>
                Logging to {activeMealSlot}
              </Text>
            </View>
            <Pressable onPress={() => setShowPrevious(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: 40, gap: Spacing.sm }}>
            {recentMeals.length === 0 && (
              <Text style={{ color: colors.textSecondary, textAlign: "center", paddingTop: 40 }}>
                No previous meals to show. Start logging to build your history.
              </Text>
            )}
            {recentMeals.map((m, idx) => (
              <Pressable
                key={`${m.recipeTitle}-${idx}`}
                style={{
                  backgroundColor: colors.card, borderRadius: Radius.md,
                  padding: Spacing.md, flexDirection: "row", alignItems: "center",
                  borderWidth: 1, borderColor: colors.border,
                }}
                onPress={() => {
                  const meal: JournalMeal = {
                    id: newMealId(),
                    name: activeMealSlot,
                    recipeTitle: m.recipeTitle,
                    time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                    calories: m.calories,
                    protein: m.protein,
                    carbs: m.carbs,
                    fat: m.fat,
                  };
                  setByDay((prev) => ({
                    ...prev,
                    [dayKey]: [...(prev[dayKey] ?? []), meal],
                  }));
                  setShowPrevious(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{m.recipeTitle}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {Math.round(m.calories)} kcal · P {Math.round(m.protein)}g · C {Math.round(m.carbs)}g · F {Math.round(m.fat)}g
                  </Text>
                </View>
                <Ionicons name="add-circle" size={24} color={Neon.purple} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function MacroBarRow({
  label,
  current,
  goal,
  color,
  styles,
}: {
  label: string;
  current: number;
  goal: number;
  color: string;
  styles: Record<string, any>;
}) {
  const pct = goal > 0 ? Math.min(1, current / goal) : 0;
  const rem = Math.max(0, Math.round(goal - current));
  return (
    <View style={styles.macroBarBlock}>
      <View style={styles.macroBarTop}>
        <Text style={[styles.macroBarTitle, { color }]}>{label}</Text>
        <Text style={styles.macroBarNums}>
          {Math.round(current)}g / {Math.round(goal)}g · {rem}g left
        </Text>
      </View>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}
