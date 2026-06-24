import { useCallback, useEffect, useMemo, useState } from "react";
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
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { getSupprApiBase } from "@/lib/supprWeb";
import { authedFetch } from "@/lib/authedFetch";
import { commitPlanImport } from "@/lib/planImportCommit";
import { consumePendingImportText } from "@suppr/shared/recipe-import/pendingImportText";
import { setPendingImportDayPlan } from "@/lib/planImportPendingApply";
import { rebalanceImportedPlanDays } from "@suppr/shared/planning/planImport/rebalanceImportedPlan";
import { DEFAULT_PLANNER_BANDS } from "@suppr/nutrition-core/mealPlanAlgo";
import type {
  PlanImportCompiledSlot,
  PlanImportNutritionMode,
  PlanImportParseResult,
  PlanImportVerifiedRecipe,
} from "@suppr/shared/planning/planImport/types";
import { MEAL_PREP_WEEK1_PASTE } from "@suppr/shared/planning/planImport/fixtures/mealPrepWeek1";
import { isFeatureEnabled, track } from "@/lib/analytics";
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
type ImportSource = "paste" | "pdf" | "photo";

type PickedFile = { uri: string; name: string; mimeType: string };

export default function PlanImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Secondary accent (Frost → damson, else clay) for CTAs/tabs/spinner/Save (success keeps sage).
  const accent = useAccent();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [step, setStep] = useState<Step>("paste");
  const [source, setSource] = useState<ImportSource>("paste");
  const [pasteText, setPasteText] = useState(MEAL_PREP_WEEK1_PASTE);
  const [planName, setPlanName] = useState("Meal prep — Week 1");
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [parsingMessage, setParsingMessage] = useState("Building your plan…");
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

  // ENG-742 — deep-link flag gate. ENG-1245 #3 — also consume plan text threaded
  // from the unified Import sheet once (replacing the sample) so no re-paste.
  useEffect(() => {
    if (!isFeatureEnabled("plan_import_enabled")) {
      router.replace("/(tabs)/planner");
      return;
    }
    const pending = consumePendingImportText();
    if (pending) setPasteText(pending);
  }, [router]);

  const extractSourceText = useCallback(
    async (file: PickedFile, kind: "pdf" | "image"): Promise<string | null> => {
      if (!apiBase) return null;
      const fd = new FormData();
      fd.append("source", kind);
      fd.append(
        "file",
        {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        } as unknown as Blob,
      );
      const res = await authedFetch(`${apiBase}/api/plan-import/extract`, {
        method: "POST",
        body: fd,
      });
      const raw = await res.text();
      let json: { ok?: boolean; text?: string; message?: string; error?: string };
      try {
        json = JSON.parse(raw) as typeof json;
      } catch {
        if (res.status === 404) {
          Alert.alert(
            "Plan import not on this server",
            __DEV__
              ? "Extract route isn’t deployed yet. Run npm run dev, then npm run mobile:dev:local and reload."
              : "Plan import isn’t available yet — update after the next release.",
          );
        } else {
          Alert.alert("Server error", __DEV__ ? `HTTP ${res.status} from ${apiBase}` : "Try again shortly.");
        }
        return null;
      }
      if (!json.ok || !json.text?.trim()) {
        Alert.alert("Could not read file", json.message ?? "Try paste or a clearer photo.");
        return null;
      }
      return json.text;
    },
    [apiBase],
  );

  const runParse = useCallback(
    async (textOverride?: string) => {
    if (!userId) {
      Alert.alert("Sign in", "Sign in to import a meal plan.");
      return;
    }
    if (!apiBase) {
      Alert.alert("API not configured", "Set supprApiUrl in app config or EXPO_PUBLIC_API_URL.");
      return;
    }
    let text = (textOverride ?? pasteText).trim();
    if (!text && source !== "paste") {
      Alert.alert("File required", source === "pdf" ? "Choose a PDF first." : "Choose a photo first.");
      return;
    }
    if (!text) {
      Alert.alert("Paste required", "Include your weekly plan and recipe sections.");
      return;
    }
    setParsingMessage("Building your plan…");
    setStep("parsing");
    try {
      if (source !== "paste" && !textOverride && pickedFile) {
        setParsingMessage(source === "pdf" ? "Reading PDF…" : "Reading photo…");
        const extracted = await extractSourceText(pickedFile, source === "pdf" ? "pdf" : "image");
        if (!extracted) {
          setStep("paste");
          return;
        }
        text = extracted;
        setPasteText(extracted);
        if (!planName.trim() || planName === "Meal prep — Week 1") {
          const stem = pickedFile.name.replace(/\.[^.]+$/, "").slice(0, 80);
          if (stem) setPlanName(stem);
        }
        setParsingMessage("Building your plan…");
      }
      const res = await authedFetch(`${apiBase}/api/plan-import/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, planName }),
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
  },
    [apiBase, extractSourceText, pasteText, pickedFile, planName, source, userId],
  );

  const pickPdf = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setPickedFile({
      uri: asset.uri,
      name: asset.name ?? "plan.pdf",
      mimeType: asset.mimeType ?? "application/pdf",
    });
  }, []);

  const pickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos access", "Allow photo access to import a plan screenshot.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setPickedFile({
      uri: asset.uri,
      name: asset.fileName ?? "plan-photo.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }, []);

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
        // SLOE DS reskin (2026-06-07): cream surface-card slabs, 24px radius, serif headings — presentation only.
        callout: {
          backgroundColor: Accent.success + "18",
          borderRadius: 16,
          padding: Spacing.lg,
          marginBottom: Spacing.md,
          borderWidth: 1,
          borderColor: Accent.success + "40",
        },
        calloutTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
        calloutItem: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
        label: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, marginBottom: 6, marginTop: Spacing.sm },
        input: {
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
          fontSize: 15,
          color: colors.text,
          minHeight: 160,
          textAlignVertical: "top",
        },
        textInput: {
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
          fontSize: 15,
          color: colors.text,
        },
        primaryBtn: {
          backgroundColor: accent.primary,
          borderRadius: 16,
          paddingVertical: 16,
          alignItems: "center",
          marginTop: Spacing.lg,
        },
        primaryBtnText: { color: colors.primaryForeground, fontSize: 16, fontWeight: "700" },
        seg: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
        segBtn: {
          flex: 1,
          padding: Spacing.md,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        segBtnActive: { borderColor: accent.primary, backgroundColor: accent.primary + "12" },
        sourceTabs: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
        sourceTab: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          backgroundColor: colors.card,
        },
        sourceTabActive: { borderColor: accent.primary, backgroundColor: accent.primary + "12" },
        uploadZone: {
          backgroundColor: colors.card,
          borderRadius: Radius.xl * 2,
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: "dashed",
          padding: Spacing.xl,
          alignItems: "center",
          marginBottom: Spacing.sm,
        },
        uploadTitle: { ...Type.headline, color: colors.text, textAlign: "center" },
        uploadHint: { fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: "center", lineHeight: 18 },
        assessment: {
          backgroundColor: colors.card,
          borderRadius: Radius.xl * 2,
          padding: Spacing.lg,
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
    [colors, insets.bottom, accent],
  );

  if (step === "parsing") {
    return (
      <View style={styles.root} testID="screen-plan-import-parsing">
        <PushScreenHeader title="Import" onBack={() => setStep("paste")} />
        <View style={styles.parseCenter}>
          <ActivityIndicator size="large" color={accent.primary} />
          <Text style={{ ...Type.title, marginTop: Spacing.lg, color: colors.navPrimary, textAlign: "center" }}>
            {parsingMessage}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.textSecondary, textAlign: "center" }}>
            Recipes first — ingredients matched to Sloe — then the weekly schedule is compiled.
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
              <Text style={{ color: accent.primary, fontWeight: "700" }}>Save</Text>
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.assessment}>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
              Plan averages <Text style={{ fontWeight: "700" }}>{avgKcal} kcal/day</Text> (Sloe calc) · Your
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
              <ActivityIndicator color={colors.primaryForeground} />
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
              style={{ backgroundColor: colors.card, borderRadius: Radius.xl * 2, padding: Spacing.xl }}
              onPress={() => {}}
            >
              <Text style={{ ...Type.title, color: colors.navPrimary, marginBottom: 8 }}>
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
          PDF, paste, or photo — same pipeline. Source must include recipes or per-meal kcal.
        </Text>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>What works</Text>
          <Text style={styles.calloutItem}>Program PDF — week grid + recipe pages with kcal panels</Text>
          <Text style={styles.calloutItem}>Meal-prep paste — batch recipes with ingredients</Text>
          <Text style={styles.calloutItem}>Coach PDF — schedule + recipe appendix</Text>
        </View>
        <View style={styles.sourceTabs} accessibilityRole="tablist">
          {(
            [
              ["paste", "Paste"],
              ["pdf", "PDF"],
              ["photo", "Photo"],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              testID={`plan-import-source-${key}`}
              style={[styles.sourceTab, source === key && styles.sourceTabActive]}
              onPress={() => {
                setSource(key);
                if (key === "paste") setPickedFile(null);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: source === key }}
            >
              <Text style={{ fontWeight: "700", fontSize: 13, color: colors.text }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {source === "paste" ? (
          <>
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
          </>
        ) : source === "pdf" ? (
          <Pressable testID="plan-import-pick-pdf" style={styles.uploadZone} onPress={() => void pickPdf()}>
            <Text style={styles.uploadTitle}>
              {pickedFile ? pickedFile.name : "Choose program PDF"}
            </Text>
            <Text style={styles.uploadHint}>
              {pickedFile
                ? "Tap to replace · full file with week grid + recipe pages"
                : "Upload the full file — page 1 calendar + recipe appendix with ingredients"}
            </Text>
          </Pressable>
        ) : (
          <Pressable testID="plan-import-pick-photo" style={styles.uploadZone} onPress={() => void pickPhoto()}>
            <Text style={styles.uploadTitle}>
              {pickedFile ? pickedFile.name : "Choose photo or screenshot"}
            </Text>
            <Text style={styles.uploadHint}>
              Single recipe page works · full weeks need PDF
            </Text>
          </Pressable>
        )}
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
          <Text style={styles.primaryBtnText}>
            {source === "paste" ? "Parse plan" : "Continue"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
