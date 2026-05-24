import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { getSupprApiBase } from "@/lib/supprWeb";
import { authedFetch } from "@/lib/authedFetch";
import { commitPlanImport } from "@/lib/planImportCommit";
import { setPendingImportDayPlan } from "@/lib/planImportPendingApply";
import { rebalanceImportedPlanDays } from "@suppr/shared/planning/planImport/rebalanceImportedPlan";
import { DEFAULT_PLANNER_BANDS } from "@suppr/shared/nutrition/mealPlanAlgo";
import type {
  PlanImportCompiledSlot,
  PlanImportNutritionMode,
  PlanImportParseResult,
  PlanImportVerifiedRecipe,
} from "@suppr/shared/planning/planImport/types";
import { MEAL_PREP_WEEK1_PASTE } from "@suppr/shared/planning/planImport/fixtures/mealPrepWeek1";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";

type PlanImportParseApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  planName?: string;
  recipes?: PlanImportVerifiedRecipe[];
  slots?: PlanImportCompiledSlot[];
  stats?: PlanImportParseResult["stats"];
};

type Step = "paste" | "parsing" | "review";

export default function PlanImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [step, setStep] = useState<Step>("paste");
  const [pasteText, setPasteText] = useState(MEAL_PREP_WEEK1_PASTE);
  const [planName, setPlanName] = useState("Meal prep — Week 1");
  const [parseResult, setParseResult] = useState<PlanImportParseResult | null>(null);
  const [slots, setSlots] = useState<PlanImportCompiledSlot[]>([]);
  const [recipes, setRecipes] = useState<PlanImportVerifiedRecipe[]>([]);
  const [nutritionMode, setNutritionMode] = useState<PlanImportNutritionMode>("match");
  const [importToLibrary, setImportToLibrary] = useState(true);
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [userTargetKcal] = useState(2000);

  const apiBase = getSupprApiBase();

  const runParse = useCallback(async () => {
    if (!userId) {
      Alert.alert("Sign in", "Sign in to import a meal plan.");
      return;
    }
    if (!apiBase) {
      Alert.alert("API not configured", "Set supprApiUrl in app config or EXPO_PUBLIC_API_URL.");
      return;
    }
    if (!pasteText.trim()) {
      Alert.alert("Paste required", "Include your weekly plan and recipe sections.");
      return;
    }
    setStep("parsing");
    try {
      const res = await authedFetch(`${apiBase}/api/plan-import/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText, planName }),
      });
      const raw = await res.text();
      let json: PlanImportParseApiResponse;
      try {
        json = JSON.parse(raw) as PlanImportParseApiResponse;
      } catch {
        if (res.status === 404) {
          Alert.alert(
            "Plan import not on this server",
            __DEV__
              ? "This route isn’t on production yet. Run npm run dev in another terminal, stop Metro, then npm run mobile:dev:local and reload the sim."
              : "Plan import isn’t available yet — update the app after the next release.",
          );
        } else {
          Alert.alert(
            "Server error",
            __DEV__
              ? `HTTP ${res.status} from ${apiBase}. Is npm run dev running?`
              : "Something went wrong. Try again in a moment.",
          );
        }
        setStep("paste");
        return;
      }
      if (!json.ok || !json.planName || !json.recipes || !json.slots || !json.stats) {
        Alert.alert("Could not parse plan", json.message ?? "Try again with recipes included.");
        setStep("paste");
        return;
      }
      const result: PlanImportParseResult = {
        planName: json.planName,
        recipes: json.recipes,
        slots: json.slots,
        stats: json.stats,
      };
      setParseResult(result);
      setPlanName(result.planName);
      setRecipes(result.recipes);
      setSlots(result.slots);
      setStep("review");
    } catch {
      Alert.alert("Network error", "Check your connection and try again.");
      setStep("paste");
    }
  }, [apiBase, pasteText, planName, userId]);

  const displaySlots = useMemo(() => {
    if (!autoRebalance || nutritionMode !== "match") return slots;
    return rebalanceImportedPlanDays({
      slots,
      mode: nutritionMode,
      targets: {
        calories: userTargetKcal,
        protein: Math.round(userTargetKcal * 0.075),
        carbs: Math.round(userTargetKcal * 0.125),
        fat: Math.round(userTargetKcal * 0.035),
        fiber: 30,
        calorieBandPct: DEFAULT_PLANNER_BANDS.calorieBandPct,
        carbFatBandPct: DEFAULT_PLANNER_BANDS.carbFatBandPct,
      },
    });
  }, [slots, autoRebalance, nutritionMode, userTargetKcal]);

  const avgKcal = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const s of displaySlots) {
      const k =
        nutritionMode === "author" && s.authorNutrition?.calories
          ? s.authorNutrition.calories
          : s.supprNutrition.calories ?? 0;
      byDay.set(s.dayIndex, (byDay.get(s.dayIndex) ?? 0) + k);
    }
    const totals = [...byDay.values()];
    return totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  }, [displaySlots, nutritionMode]);

  const finishCommit = useCallback(
    async (activate: boolean) => {
      if (!userId || !parseResult) return;
      setCommitting(true);
      const res = await commitPlanImport({
        userId,
        planName: planName.trim() || parseResult.planName,
        recipes,
        slots: displaySlots,
        nutritionMode,
        importToLibrary,
      });
      setCommitting(false);
      setActivateOpen(false);
      if (!res.ok) {
        Alert.alert("Could not save", res.error);
        return;
      }
      track(AnalyticsEvents.plan_template_created, {
        dayCount: res.dayPlan.length,
        slotCount: displaySlots.length,
        source: "plan_import",
      });
      if (activate) {
        setPendingImportDayPlan(res.dayPlan);
      }
      Alert.alert(
        activate ? "Plan activated" : "Template saved",
        activate
          ? `"${planName}" is now your active plan.`
          : `"${planName}" saved to templates — switch anytime from Plan.`,
        [{ text: "Done", onPress: () => router.back() }],
      );
    },
    [userId, parseResult, planName, recipes, displaySlots, nutritionMode, importToLibrary, router],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        scroll: { padding: Spacing.lg, paddingBottom: insets.bottom + 48 },
        subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
        callout: {
          backgroundColor: Accent.success + "18",
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.md,
          borderWidth: 1,
          borderColor: Accent.success + "40",
        },
        calloutTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
        calloutItem: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
        label: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, marginBottom: 6, marginTop: Spacing.sm },
        input: {
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          fontSize: 15,
          color: colors.text,
          minHeight: 160,
          textAlignVertical: "top",
        },
        textInput: {
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          fontSize: 15,
          color: colors.text,
        },
        primaryBtn: {
          backgroundColor: Accent.primary,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
          marginTop: Spacing.lg,
        },
        primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
        seg: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
        segBtn: {
          flex: 1,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        segBtnActive: { borderColor: Accent.primary, backgroundColor: Accent.primary + "12" },
        assessment: {
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        row: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: Spacing.sm,
          paddingVertical: Spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
        rowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        kcal: { fontSize: 17, fontWeight: "700", color: colors.text },
        toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
        parseCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
      }),
    [colors, insets.bottom],
  );

  if (step === "parsing") {
    return (
      <View style={styles.root} testID="screen-plan-import-parsing">
        <PushScreenHeader title="Import" onBack={() => setStep("paste")} />
        <View style={styles.parseCenter}>
          <ActivityIndicator size="large" color={Accent.primary} />
          <Text style={{ marginTop: Spacing.lg, fontSize: 18, fontWeight: "700", color: colors.text }}>
            Building your plan…
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.textSecondary, textAlign: "center" }}>
            Recipes first — ingredients matched to Suppr — then the weekly schedule is compiled.
          </Text>
        </View>
      </View>
    );
  }

  if (step === "review" && parseResult) {
    return (
      <View style={styles.root} testID="screen-plan-import-review">
        <PushScreenHeader
          title="Review import"
          onBack={() => setStep("paste")}
          rightSlot={
            <Pressable onPress={() => setActivateOpen(true)} disabled={committing} hitSlop={8}>
              <Text style={{ color: Accent.primary, fontWeight: "700" }}>Save</Text>
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.assessment}>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
              Plan averages <Text style={{ fontWeight: "700" }}>{avgKcal} kcal/day</Text> (Suppr calc) · Your
              target <Text style={{ fontWeight: "700" }}>{userTargetKcal}</Text>
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
              {parseResult.stats.recipeCount} recipes · {parseResult.stats.slotCount} slots ·{" "}
              {parseResult.stats.blockedCount} blocked
            </Text>
          </View>

          <Text style={styles.label}>Nutrition handling</Text>
          <View style={styles.seg}>
            {(["author", "match"] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.segBtn, nutritionMode === mode && styles.segBtnActive]}
                onPress={() => setNutritionMode(mode)}
              >
                <Text style={{ fontWeight: "700", fontSize: 13, color: colors.text }}>
                  {mode === "author" ? "Author's numbers" : "Match & verify"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.text }}>
              Import all recipes to Library
            </Text>
            <Switch value={importToLibrary} onValueChange={setImportToLibrary} />
          </View>

          {nutritionMode === "match" ? (
            <View style={styles.toggleRow}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.text }}>
                Auto-rebalance portions
              </Text>
              <Switch value={autoRebalance} onValueChange={setAutoRebalance} />
            </View>
          ) : null}

          <Text style={styles.label}>Plan name</Text>
          <TextInput style={styles.textInput} value={planName} onChangeText={setPlanName} />

          {displaySlots.map((slot, idx) => {
            const kcal =
              nutritionMode === "author" && slot.authorNutrition?.calories
                ? slot.authorNutrition.calories
                : slot.supprNutrition.calories;
            return (
              <View key={`${slot.dayIndex}-${slot.slot}-${idx}`} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{slot.title}</Text>
                  <Text style={styles.rowMeta}>
                    {slot.dayLabel} · {slot.slot}
                    {slot.linkStatus === "blocked" ? " · needs recipe" : ""}
                  </Text>
                </View>
                <Text style={styles.kcal}>{kcal}</Text>
              </View>
            );
          })}

          <Pressable style={styles.primaryBtn} onPress={() => setActivateOpen(true)} disabled={committing}>
            {committing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Save as template</Text>
            )}
          </Pressable>
        </ScrollView>

        <Modal visible={activateOpen} transparent animationType="fade">
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: Spacing.xl }}
            onPress={() => !committing && setActivateOpen(false)}
          >
            <Pressable
              style={{ backgroundColor: colors.card, borderRadius: Radius.lg, padding: Spacing.lg }}
              onPress={() => {}}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 }}>
                Activate imported plan?
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: Spacing.lg }}>
                Save as a template and optionally replace your current week.
              </Text>
              <Pressable
                style={[styles.primaryBtn, { marginTop: 0 }]}
                onPress={() => void finishCommit(true)}
                disabled={committing}
              >
                <Text style={styles.primaryBtnText}>Activate imported plan</Text>
              </Pressable>
              <Pressable
                style={{ paddingVertical: 14, alignItems: "center", marginTop: 8 }}
                onPress={() => void finishCommit(false)}
                disabled={committing}
              >
                <Text style={{ fontWeight: "600", color: colors.textSecondary }}>Save template only</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID="screen-plan-import"
    >
      <PushScreenHeader title="Import meal plan" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          Paste a plan that includes recipes (ingredients + method) or kcal per meal — not just dish names.
        </Text>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>What works</Text>
          <Text style={styles.calloutItem}>Program PDF — week grid + recipe pages with kcal panels</Text>
          <Text style={styles.calloutItem}>Meal-prep paste — batch recipes with ingredients</Text>
          <Text style={styles.calloutItem}>Coach PDF — schedule + recipe appendix</Text>
        </View>
        <Text style={styles.label}>Plan + recipes</Text>
        <TextInput
          testID="plan-import-paste"
          style={styles.input}
          multiline
          value={pasteText}
          onChangeText={setPasteText}
          autoCorrect={false}
          spellCheck={false}
        />
        <Text style={styles.label}>Plan name</Text>
        <TextInput
          testID="plan-import-name"
          style={styles.textInput}
          value={planName}
          onChangeText={setPlanName}
        />
        <Pressable
          testID="plan-import-parse"
          style={styles.primaryBtn}
          onPress={() => void runParse()}
        >
          <Text style={styles.primaryBtnText}>Parse plan</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
