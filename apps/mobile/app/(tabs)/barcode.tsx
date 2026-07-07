import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import { BarcodeCameraView } from "@/components/BarcodeCameraView";
import { BarcodeShareOptIn, type BarcodeShareOptInEntry } from "@/components/barcode/BarcodeShareOptIn";
import { showSignInAlert } from "@/lib/authAlertCopy";
// 2026-04-29: migrated from `@expo/vector-icons` (Ionicons) to
// `lucide-react-native` per the team standardisation set
// 2026-04-28 (Top-5 #4 in docs/ux/teardown-2026-04-28-daily-loop.md).
// Glyph map used: camera-outline → Camera, add-circle → PlusCircle,
// alert-circle → AlertCircle.
import { AlertCircle, Camera, Check, PlusCircle, ScanLine, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useRouter, type Href } from "expo-router";

import { barcodeConfidenceTier, lookupBarcode, scaleMacrosByGrams, submitFoodCorrection, type BarcodeProduct } from "@/lib/verifyRecipe";
import { barcodeProvenanceLabel } from "@/lib/barcodeProvenance";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { isFeatureEnabled } from "@/lib/analytics";
import { SearchResultConfidenceChip } from "@/components/ui/SearchResultConfidenceChip";
import { Accent, Elevation, FontFamily, Radius, Spacing, Type, Colors } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { dateKeyFromDate, newMealId, type JournalMeal } from "@/lib/nutritionJournal";
import { buildNutritionEntryRow } from "@/lib/nutritionEntryRow";
import { snapshotDailyTargetIfMissing } from "@suppr/nutrition-core/dailyTargetSnapshot";
import { checkScaledLogPlausibility } from "@suppr/nutrition-core/macroPlausibility";
import { scaleCaffeineAlcohol } from "@suppr/nutrition-core/scaleCaffeineAlcoholForGrams";
import { scaleMicrosForGrams } from "@suppr/shared/openFoodFacts/parseOffMicros";
import { clampRememberedToServingOptions, getRememberedPortion, recordPortion } from "@/lib/barcodePortionMemory";
import { writeMealToHealthKitIfEnabled } from "@/lib/healthKitMealWriter";
import { ServingStepper } from "@/components/food-log/ServingStepper";
import { fallbackSlotFromTimeOfDay } from "@suppr/nutrition-core/recipeJournalSlot";
import { COMPLETE_DAY_V3_COPY } from "@suppr/shared/completeDayV3";

export default function BarcodeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarClearance(); // ENG-1247 — pad scroll to clear frosted (absolute) tab bar.
  const router = useRouter();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for CTAs, scan-frame,
  // preset/retry/manual chips, and serving hint. Log/Use keeps `Accent.success`
  // (green commit); the error icon keeps `Accent.destructive`.
  const accent = useAccent();
  const cardElevation = useCardElevation();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Search-results redesign (2026-05-31): when on, the barcode result adopts the
  // food-search language — Verified/Estimated confidence chip + blue commit CTA.
  // Old path (binary green tick + green CTA) stays alive in the else.
  const searchRedesign = isFeatureEnabled("redesign_search_results");

  const [permission, requestPermission] = useCameraPermissions();
  const [last, setLast] = useState<string | null>(null);
  // F-78 (2026-04-25) — `last` setState is async, so the closure inside
  // `onBarcode` reads stale state when expo-camera re-fires the same scan
  // event before React commits. The ref is written synchronously, so a
  // duplicate event for the same code can never start a second lookup.
  const lastRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gramsInput, setGramsInput] = useState("100");
  const [logging, setLogging] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  // ENG-1247 — opt-in community contribution (flag-gated, default off). After a
  // not-found barcode is logged PRIVATELY, offer the explicit opt-in to share it
  // to the shared food DB. Never automatic; the private log stands regardless.
  const communityShareEnabled = isFeatureEnabled("barcode_community_contribution");
  const sectionA = isFeatureEnabled("eng1247_section_a_v1");
  const [shareEntry, setShareEntry] = useState<BarcodeShareOptInEntry | null>(null);
  const [savedAck, setSavedAck] = useState<{ name: string; kcal: number } | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");

  // Audit/2026-04-30 — when the user has logged this exact barcode
  // before, surface "You usually log {n} g — using that" near the
  // portion picker. `null` = no remembered portion (default-serving
  // path); a number = grams pulled from AsyncStorage via
  // `getRememberedPortion`. Cleared on every fresh scan.
  const [rememberedPortion, setRememberedPortion] = useState<number | null>(null);

  // Correction mode state (edit scanned product data and save to DB)
  const [correctionMode, setCorrectionMode] = useState(false);
  const [corrName, setCorrName] = useState("");
  const [corrCalories, setCorrCalories] = useState("");
  const [corrProtein, setCorrProtein] = useState("");
  const [corrCarbs, setCorrCarbs] = useState("");
  const [corrFat, setCorrFat] = useState("");
  const [corrSaving, setCorrSaving] = useState(false);

  // Gap #5 (2026-06-09) — meal-slot picker. Defaults to the time-of-day
  // slot (same ladder used by the recipe log and LogSheet). The user can
  // override before logging. Previously hardcoded to "Snacks".
  const [mealSlot, setMealSlot] = useState<"Breakfast" | "Lunch" | "Dinner" | "Snacks">(
    () => fallbackSlotFromTimeOfDay() as "Breakfast" | "Lunch" | "Dinner" | "Snacks",
  );

  // P0 (2026-05-26) — once the user confirms past a "numbers look unusually
  // high" plausibility warning, this ref lets the next Log tap proceed
  // without re-prompting. Reset on every fresh scan / portion change.
  const plausibilityOverrideRef = useRef(false);

  const grams = useMemo(() => {
    const n = Number.parseFloat(String(gramsInput).replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) return 100;
    return Math.min(10_000, Math.round(n * 10) / 10);
  }, [gramsInput]);

  const scaled = useMemo(() => {
    if (!product) return null;
    return scaleMacrosByGrams(
      { calories: product.calories, protein: product.protein, carbs: product.carbs, fat: product.fat, fiberG: product.fiberG },
      grams,
    );
  }, [product, grams]);

  const portionSummary = useMemo(() => {
    const opts = product?.servingOptions ?? [];
    const hit = opts.find((o) => Math.abs(o.grams - grams) < 0.51);
    return hit?.label ?? `${grams} g`;
  }, [product, grams]);

  const onBarcode = useCallback(
    async (e: { data: string }) => {
      if (loading || lastRef.current === e.data) return;
      lastRef.current = e.data;
      setLast(e.data);
      setLoading(true);
      setError(null);
      setProduct(null);
      plausibilityOverrideRef.current = false;
      const result = await lookupBarcode(e.data);
      setLoading(false);
      if (result) {
        setProduct(result);
        // Audit/2026-04-30 — barcode portion memory. If the user has
        // logged this barcode before, default to that grams instead of
        // the OFF reference serving. Snap to the closest serving
        // option when the food has presets so the picker label stays
        // truthful (e.g. "1 bar (40 g)" instead of a freeform 38 g).
        const remembered = await getRememberedPortion(e.data);
        if (remembered != null && remembered > 0) {
          const snapped = clampRememberedToServingOptions(remembered, result.servingOptions ?? null);
          setRememberedPortion(remembered);
          setGramsInput(String(Math.round(snapped)));
        } else {
          setRememberedPortion(null);
          if (result.servingSizeG && result.servingSizeG > 0) {
            setGramsInput(String(Math.round(result.servingSizeG)));
          } else {
            setGramsInput("100");
          }
        }
      } else {
        setRememberedPortion(null);
        setError(
          sectionA
            ? COMPLETE_DAY_V3_COPY.barcodeNotFoundBody
            : "Product not found. Try a different barcode or enter it manually.",
        );
      }
    },
    // `last` removed 2026-04-29: the callback only reads `lastRef.current`
    // (a stable ref) and the `setLast` setter; the bare `last` state is
    // never referenced inside, so eslint exhaustive-deps was correctly
    // flagging the dep as unnecessary.
    [loading],
  );

  const commitLog = useCallback(async () => {
    if (!scaled || !product || !userId) return;
    setLogging(true);
    const dateKey = dateKeyFromDate(new Date());
    const mealId = newMealId();
    const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    // F-13 (2026-04-19) — compute caffeine + alcohol for the scanned
    // portion. Product fields came from OFF `nutriments.caffeine_100g`
    // / `alcohol_100g`; null when absent so the commit path skips the
    // bump rather than inventing a fallback.
    const { caffeineMg, alcoholG } = scaleCaffeineAlcohol({
      grams,
      caffeineMgPer100g: product.caffeineMgPer100g ?? null,
      alcoholGPer100g: product.alcoholGPer100g ?? null,
    });
    // F-79 (2026-04-25) — scale the full OFF micro set for `grams` and merge
    // with caffeine/alcohol overrides (F-13 already explicitly computed those
    // via `scaleCaffeineAlcohol`, so they take precedence over the generic
    // micro scaler). Empty when OFF didn't expose any micros for the row.
    const explicit: Record<string, number> = {};
    if (caffeineMg > 0) explicit.caffeineMg = caffeineMg;
    if (alcoholG > 0) explicit.alcoholG = alcoholG;
    const nutritionMicros = scaleMicrosForGrams(
      product.microsPer100g ?? {},
      grams,
      explicit,
    );
    // Single shared row shape (launch-audit P1-2 consolidation). Fresh
    // barcode log → no `eatenAt` → `eaten_at: null` with today's
    // `date_key` — byte-identical semantics to the previous inline
    // literal ("Open Food Facts" is already canonical).
    const barcodeMeal: JournalMeal = {
      id: mealId,
      name: mealSlot,
      recipeTitle: `${product.name} (${portionSummary})`,
      time: timeLabel,
      calories: Math.min(32767, Math.round(scaled.calories)),
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      fiberG: scaled.fiberG ?? undefined,
      micros: Object.keys(nutritionMicros).length > 0 ? nutritionMicros : undefined,
      portionMultiplier: 1,
      source: "Open Food Facts",
    } as JournalMeal;
    const { error: dbErr } = await supabase
      .from("nutrition_entries")
      .insert(buildNutritionEntryRow(barcodeMeal, dateKey, userId));
    setLogging(false);
    if (dbErr) { Alert.alert("Could not log", dbErr.message); } else {
      // F-2 — freeze today's target on first log of the day.
      void snapshotDailyTargetIfMissing(supabase, userId);
      // F-74 / F-103 fix (2026-05-07): per-meal micros canonical SoT.
      // `nutrition_micros.caffeineMg` / `alcoholG` is already on the
      // inserted row above; Today's `caffeineFromMealsMg` /
      // `alcoholByDayMerged` will sum it at render. No ledger bump
      // (the previous one + the read-side merge double-counted by 2×).
      // Audit/2026-04-30 — remember this portion size for the barcode
      // so the next scan defaults here. Fire-and-forget; AsyncStorage
      // failures are non-fatal (the meal already persisted).
      if (last) void recordPortion(last, grams);
      // Audit/2026-04-30 — per-meal Apple HealthKit write (parity with
      // MFP / Cal AI). Honours the "Share meals to Health" toggle and
      // is idempotent on `mealId`. Fire-and-forget — HK errors must
      // not block the logged-meal alert.
      void writeMealToHealthKitIfEnabled({
        mealId,
        userId,
        name: `${product.name} (${portionSummary})`,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
        fiberG: scaled.fiberG ?? null,
        date: new Date().toISOString(),
        source: "Open Food Facts",
        origin: "barcode",
      });
      // DC12 (2026-05-14, premium-bar audit) — specific log
      // confirmation: surface the actual meal name in the title so
      // the user reads back exactly what they just logged (Cal AI /
      // MFP parity, the "what" not the verb). Mobile parity sweep.
      Alert.alert(`${product.name} logged`, `Added to today's tracker (${portionSummary}).`, [
        { text: "Scan another", onPress: () => { lastRef.current = null; setLast(null); setProduct(null); setError(null); setRememberedPortion(null); plausibilityOverrideRef.current = false; } },
        { text: "Go to tracker", onPress: () => router.push("/(tabs)/index" as Href) },
      ]);
    }
  }, [scaled, product, userId, grams, portionSummary, router, last, mealSlot]);

  const handleLog = useCallback(async () => {
    if (!scaled || !product || !userId) {
      if (!userId) showSignInAlert("log food to your tracker");
      return;
    }
    // P0 (2026-05-26) — physical-plausibility guard before writing the row.
    // Catches the OFF per-serving-basis bug (e.g. 500 g Greek yogurt scaling
    // to ~1,325 kcal / 265 g protein) and any other physically-impossible
    // scaled value. Soft-flag: warn + let the user confirm or edit; never a
    // hard block (legit edge foods like oil/protein isolate must pass) and
    // never a silent bad write. `product.{calories,…}` is the per-100g panel
    // for the source-basis cross-check.
    const plausibility = checkScaledLogPlausibility(
      { calories: scaled.calories, protein: scaled.protein, carbs: scaled.carbs, fat: scaled.fat },
      grams,
      { calories: product.calories, protein: product.protein, carbs: product.carbs, fat: product.fat },
    );
    if ((!plausibility.ok || product.basisCorrected) && !plausibilityOverrideRef.current) {
      Alert.alert(
        "Double-check these numbers",
        `${Math.round(scaled.calories)} kcal and ${Math.round(scaled.protein)} g protein for ${Math.round(grams)} g looks unusually high — this product's label data may be per serving, not per 100 g. Edit the values or amount if they look wrong.`,
        [
          {
            text: "Edit",
            style: "cancel",
            // Inline the same state openCorrectionMode sets (defined below);
            // avoids a forward reference inside this useCallback.
            onPress: () => {
              setCorrName(product.name);
              setCorrCalories(String(product.calories));
              setCorrProtein(String(product.protein));
              setCorrCarbs(String(product.carbs));
              setCorrFat(String(product.fat));
              setCorrectionMode(true);
            },
          },
          {
            text: "Log anyway",
            onPress: () => {
              plausibilityOverrideRef.current = true;
              void commitLog();
            },
          },
        ],
      );
      return;
    }
    await commitLog();
  }, [scaled, product, userId, grams, commitLog]);

  const handleManualLog = useCallback(async () => {
    const cal = Number(manualCalories) || 0;
    if (!manualName.trim() || cal <= 0 || !userId) {
      if (!userId) showSignInAlert("log food to your tracker");
      return;
    }
    setLogging(true);
    const dateKey = dateKeyFromDate(new Date());
    const mealId = newMealId();
    const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    // Single shared row shape (launch-audit P1-2 consolidation). Manual
    // barcode-fallback log → no `eatenAt` → `eaten_at: null` with today's
    // `date_key` ("barcode" is already canonical).
    const manualMeal: JournalMeal = {
      id: mealId,
      name: mealSlot,
      recipeTitle: manualName.trim(),
      time: timeLabel,
      calories: Math.min(32767, Math.round(cal)),
      protein: Math.round((Number(manualProtein) || 0) * 10) / 10,
      carbs: Math.round((Number(manualCarbs) || 0) * 10) / 10,
      fat: Math.round((Number(manualFat) || 0) * 10) / 10,
      portionMultiplier: 1,
      source: "barcode",
    } as JournalMeal;
    const { error: dbErr } = await supabase
      .from("nutrition_entries")
      .insert(buildNutritionEntryRow(manualMeal, dateKey, userId));
    setLogging(false);
    if (dbErr) {
      Alert.alert("Could not log", dbErr.message);
    } else {
      // F-2 — freeze today's target on first log of the day.
      void snapshotDailyTargetIfMissing(supabase, userId);
      // Audit/2026-04-30 — per-meal HK write + portion memory. The
      // manual-entry path implies grams = 1 serving (no scaling), so
      // remembering "100 g" by default is useful enough to keep the
      // next scan-and-correction cheap.
      if (last) void recordPortion(last, 100);
      void writeMealToHealthKitIfEnabled({
        mealId,
        userId,
        name: manualName.trim(),
        calories: cal,
        protein: Math.round((Number(manualProtein) || 0) * 10) / 10,
        carbs: Math.round((Number(manualCarbs) || 0) * 10) / 10,
        fat: Math.round((Number(manualFat) || 0) * 10) / 10,
        date: new Date().toISOString(),
        source: "Manual barcode entry",
        origin: "manual",
      });
      // ENG-1247 — flag ON: offer the explicit community-contribution opt-in (the
      // private log already happened above). Flag OFF: the existing confirmation.
      if (communityShareEnabled && last) {
        setManualMode(false);
        setShareEntry({
          barcode: last,
          name: manualName.trim(),
          calories: Math.round(cal),
          protein: Math.round((Number(manualProtein) || 0) * 10) / 10,
          carbs: Math.round((Number(manualCarbs) || 0) * 10) / 10,
          fat: Math.round((Number(manualFat) || 0) * 10) / 10,
        });
      } else {
        // DC12 (2026-05-14, premium-bar audit) — specific log confirmation.
        Alert.alert(`${manualName.trim()} logged`, "Added to today's tracker.", [
          { text: "Scan another", onPress: () => { lastRef.current = null; setLast(null); setProduct(null); setError(null); setManualMode(false); setManualName(""); setManualCalories(""); setManualProtein(""); setManualCarbs(""); setManualFat(""); setRememberedPortion(null); } },
          { text: "Go to tracker", onPress: () => router.push("/(tabs)/index" as Href) },
        ]);
      }
    }
  }, [manualName, manualCalories, manualProtein, manualCarbs, manualFat, userId, router, last, mealSlot, communityShareEnabled]);

  const openCorrectionMode = useCallback(() => {
    if (!product) return;
    setCorrName(product.name);
    setCorrCalories(String(product.calories));
    setCorrProtein(String(product.protein));
    setCorrCarbs(String(product.carbs));
    setCorrFat(String(product.fat));
    setCorrectionMode(true);
  }, [product]);

  const submitCorrection = useCallback(async () => {
    if (!last || !userId) return;
    const cal = Number(corrCalories) || 0;
    if (!corrName.trim() || cal <= 0) return;
    setCorrSaving(true);
    const result = await submitFoodCorrection({
      barcode: last,
      name: corrName.trim(),
      calories: Math.round(cal),
      protein: Math.round((Number(corrProtein) || 0) * 10) / 10,
      carbs: Math.round((Number(corrCarbs) || 0) * 10) / 10,
      fat: Math.round((Number(corrFat) || 0) * 10) / 10,
      userId,
    });
    setCorrSaving(false);
    if (result.ok) {
      const corrected: BarcodeProduct = {
        name: corrName.trim(),
        calories: Math.round(cal),
        protein: Math.round((Number(corrProtein) || 0) * 10) / 10,
        carbs: Math.round((Number(corrCarbs) || 0) * 10) / 10,
        fat: Math.round((Number(corrFat) || 0) * 10) / 10,
        fiberG: product?.fiberG ?? 0,
        servingSizeG: product?.servingSizeG ?? 100,
        source: "user",
        verified: false,
        verificationStatus: "pending",
        isOwnSubmission: true,
      };
      setProduct(corrected);
      setCorrectionMode(false);
      setGramsInput("100");
      // Corrected values supersede the OFF basis warning; re-evaluate fresh.
      plausibilityOverrideRef.current = false;
    }
  }, [last, userId, corrName, corrCalories, corrProtein, corrCarbs, corrFat, product]);

  const resetScan = useCallback(() => {
    lastRef.current = null;
    setLast(null);
    setProduct(null);
    setError(null);
    setManualMode(false);
    setCorrectionMode(false);
    plausibilityOverrideRef.current = false;
  }, []);

  // ENG-1247 — conclude the community opt-in: clear the share + manual state and
  // return to the scanner (the private log already stands).
  const handleShareDone = useCallback(() => {
    if (sectionA && shareEntry) {
      setSavedAck({ name: shareEntry.name, kcal: shareEntry.calories });
    }
    setShareEntry(null);
    setManualName("");
    setManualCalories("");
    setManualProtein("");
    setManualCarbs("");
    setManualFat("");
    if (!sectionA) resetScan();
  }, [resetScan, sectionA, shareEntry]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        fill: { flex: 1, backgroundColor: colors.background },
        camera: { flex: 1 },
        // Gap #3 (2026-06-09): corner-bracket reticle replaces faint
        // full-perimeter outline. Four absolute-positioned brackets at
        // full opacity — legible over both camera feed and white bg.
        // The bracket container is positioned identically to the old
        // full-perimeter rect; four <View> children draw each corner.
        reticleContainer: {
          position: "absolute",
          top: "25%",
          left: "10%",
          width: "80%",
          height: "30%",
        },
        reticleCornerTL: {
          position: "absolute",
          top: 0,
          left: 0,
          width: 24,
          height: 24,
          borderTopWidth: 3,
          borderLeftWidth: 3,
          borderColor: accent.primary,
          borderTopLeftRadius: Radius.sm,
        },
        reticleCornerTR: {
          position: "absolute",
          top: 0,
          right: 0,
          width: 24,
          height: 24,
          borderTopWidth: 3,
          borderRightWidth: 3,
          borderColor: accent.primary,
          borderTopRightRadius: Radius.sm,
        },
        reticleCornerBL: {
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 24,
          height: 24,
          borderBottomWidth: 3,
          borderLeftWidth: 3,
          borderColor: accent.primary,
          borderBottomLeftRadius: Radius.sm,
        },
        reticleCornerBR: {
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 24,
          height: 24,
          borderBottomWidth: 3,
          borderRightWidth: 3,
          borderColor: accent.primary,
          borderBottomRightRadius: Radius.sm,
        },
        overlay: {
          position: "absolute",
          left: Spacing.lg,
          right: Spacing.lg,
          bottom: insets.bottom + Spacing.lg,
          padding: Spacing.xl,
          // Gap #2 (2026-06-09): editorial overlay treatment — use
          // elevation tokens for the sheet shadow and tighten radius.
          borderRadius: Radius.xl,
          borderWidth: 1,
          borderColor: Colors.dark.cardBorder,
          backgroundColor: Colors.dark.overlay,
          gap: Spacing.sm,
          ...Elevation.sheet,
        },
        // headers census 2026-06-10: hand-tuned 18/600 serif title → Type.navTitle
        // (the canonical compact serif title voice; was Type.headline + overrides).
        overlayTitle: {
          ...Type.navTitle,
          color: Accent.primaryForeground,
        },
        hint: { color: Colors.dark.textSecondary, fontSize: 13 },
        dim: { color: Colors.dark.textTertiary },
        centered: { flex: 1, padding: Spacing.xl, justifyContent: "center", alignItems: "center", gap: Spacing.md },
        permIcon: { marginBottom: Spacing.sm },
        permText: { color: colors.textSecondary, fontSize: 16, textAlign: "center", maxWidth: 280 },
        permBtn: {
          backgroundColor: accent.primary,
          paddingHorizontal: Spacing.xxl,
          // Gap #4 (2026-06-09): paddingVertical → Spacing.md (16) gives
          // ≥48px height with fontSize 15 (≈20px line + 32px padding = 52px).
          paddingVertical: Spacing.md,
          borderRadius: Radius.xl,
        },
        permBtnText: { color: Accent.primaryForeground, fontWeight: "700", fontSize: 15 },
        // headers census 2026-06-10: hand-tuned 17/600 serif → Type.navTitle.
        productName: {
          ...Type.navTitle,
          color: Accent.primaryForeground,
          textAlign: "center",
        },
        macroRow: { flexDirection: "row", justifyContent: "center", gap: Spacing.lg },
        macroChip: { alignItems: "center" },
        // Gap #1: macro values → heroValue (Newsreader/serif, 20/500).
        // Gap #12: bump size slightly and use textSecondary for labels.
        macroValue: {
          color: Accent.primaryForeground,
          ...Type.heroValue,
          fontSize: 16,
        },
        // Gap #12: raise caption to 12px and use textSecondary.
        macroLabel: { color: Colors.dark.textSecondary, fontSize: 12, fontFamily: FontFamily.sansRegular },
        source: { color: Colors.dark.textSecondary, fontSize: 12, textAlign: "center", fontFamily: FontFamily.sansRegular },
        servingRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
        },
        servingLabel: { color: Colors.dark.textSecondary, fontSize: 13 },
        servingInput: {
          color: Accent.primaryForeground,
          fontFamily: Type.bodyLarge.fontFamily, fontSize: Type.bodyLarge.fontSize, lineHeight: Type.bodyLarge.lineHeight, fontWeight: "600",
          // Gap #10: token-based input bg instead of raw rgba literal.
          backgroundColor: Colors.dark.inputBg,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          minWidth: 56,
          textAlign: "center",
        },
        servingUnit: { color: Colors.dark.textSecondary, fontSize: 13 },
        servingStepper: { flexShrink: 1 },
        servingHint: { color: Colors.dark.textTertiary, fontSize: 11, textAlign: "center" as const },
        // Gap #4: preset row/chip spacing snapped to scale tokens.
        presetRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: Spacing.sm, justifyContent: "center" as const },
        presetChip: {
          // Gap #4: paddingHorizontal → sm(8), paddingVertical → xs(4).
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          borderRadius: Radius.sm,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: accent.primary + "55",
          ...(cardElevation.shadowStyle ?? {}),
        },
        presetChipSelected: { backgroundColor: accent.primary + "22", borderColor: accent.primary },
        presetChipText: { fontSize: 11, fontWeight: "600" as const, color: accent.primarySolid },
        // Gap #5 (2026-06-09): slot pill row — 4-segment pill above portion
        // picker. Matches §3.1 LogSheet pattern.
        slotRow: {
          flexDirection: "row" as const,
          gap: Spacing.xs,
          marginBottom: Spacing.xs,
        },
        slotPill: {
          flex: 1,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          paddingVertical: Spacing.xs,
          borderRadius: Radius.full,
          borderWidth: 1,
          borderColor: Colors.dark.border,
        },
        slotPillActive: {
          backgroundColor: accent.primary,
          borderColor: accent.primary,
        },
        slotPillText: {
          fontSize: 11,
          fontWeight: "600" as const,
          color: Colors.dark.textSecondary,
          fontFamily: FontFamily.sansSemibold,
        },
        slotPillTextActive: { color: colors.primaryForeground },
        btnRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
        logBtn: {
          flex: 2,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
          backgroundColor: Accent.success,
          // Gap #10: radius → xl(12) for premium rounded CTA language.
          borderRadius: Radius.xl,
          // Gap #4: paddingVertical → Spacing.md (≥48px height).
          paddingVertical: Spacing.md,
        },
        logBtnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 15 },
        secondaryBtn: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          // Gap #10: radius → xl(12).
          borderRadius: Radius.xl,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          // Gap #10: token-based border instead of raw rgba literal.
          borderColor: Colors.dark.border,
          // Gap #4: paddingVertical → Spacing.md (≥48px).
          paddingVertical: Spacing.md,
          ...(cardElevation.shadowStyle ?? {}),
        },
        secondaryBtnText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 14 },
        errorIcon: { marginBottom: Spacing.xs },
        errorTitle: { ...Type.headline, fontSize: 18, textAlign: "center", marginBottom: Spacing.xs },
        errorText: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: "center", maxWidth: 260 },
        retryBtn: {
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: accent.primary + "55",
          // Gap #10: radius → xl(12).
          borderRadius: Radius.xl,
          paddingHorizontal: Spacing.xl,
          // Gap #4: paddingVertical → Spacing.md.
          paddingVertical: Spacing.md,
          marginTop: Spacing.sm,
          ...(cardElevation.shadowStyle ?? {}),
        },
        retryBtnText: { color: accent.primarySolid, fontWeight: "600" },
        manualEntryBtn: {
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: accent.primary + "55",
          // Gap #10: radius → xl(12).
          borderRadius: Radius.xl,
          paddingHorizontal: Spacing.xl,
          // Gap #4: paddingVertical → Spacing.md.
          paddingVertical: Spacing.md,
          marginTop: Spacing.xs,
          ...(cardElevation.shadowStyle ?? {}),
        },
        manualEntryBtnText: { color: accent.primarySolid, fontWeight: "600" },
        manualOverlay: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: colors.background,
          padding: Spacing.xl,
          paddingTop: insets.top + Spacing.xl,
          gap: Spacing.md,
        },
        // headers census 2026-06-10: sheet title → Type.navTitle.
        manualTitle: {
          ...Type.navTitle,
          color: Accent.primaryForeground,
        },
        // Gap #4: replace marginTop:-4 negative hack with gap token on
        // the parent container (gap: Spacing.md already set on manualOverlay).
        manualSub: { color: Colors.dark.textSecondary, fontSize: 13 },
        bcChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          alignSelf: "flex-start",
          backgroundColor: colors.card,
          borderRadius: Radius.full,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: colors.border,
        },
        bcChipText: { ...Type.body, color: colors.text, fontVariant: ["tabular-nums"] },
        manualInput: {
          // Gap #10: token-based input bg.
          backgroundColor: Colors.dark.inputBg,
          // Gap #10: radius → xl(12).
          borderRadius: Radius.xl,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          color: Accent.primaryForeground,
          ...Type.bodyLarge,
        },
        manualInputRow: { flexDirection: "row", gap: Spacing.sm },
        corrLink: { color: accent.primarySolid, fontSize: 13, textDecorationLine: "underline" as const, textAlign: "center" as const, paddingTop: Spacing.xs },
        corrOverlay: {
          position: "absolute" as const,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: colors.background,
          padding: Spacing.xl,
          paddingTop: insets.top + Spacing.xl,
          gap: Spacing.md,
        },
        // headers census 2026-06-10: correction sheet title → Type.navTitle.
        corrTitle: {
          ...Type.navTitle,
          color: Accent.primaryForeground,
        },
        // Gap #4: replace marginTop:-4 negative hack.
        corrSub: { color: Colors.dark.textSecondary, fontSize: 13 },
      }),
    [colors, insets.bottom, cardElevation, accent],
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={accent.primary} />
        <Text style={styles.permText}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Camera size={48} color={colors.textSecondary} style={styles.permIcon} strokeWidth={1.75} />
        <Text style={styles.permText}>
          Sloe needs your camera to scan product barcodes and look up nutrition info.
        </Text>
        <Pressable style={styles.permBtn} onPress={() => void requestPermission()} accessibilityLabel="Grant camera permission">
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View testID="screen-barcode" style={styles.fill}>
      <BarcodeCameraView
        style={styles.camera}
        facing="back"
        barcodeScannerEnabled={!product && !manualMode && !correctionMode}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
        onBarcodeScanned={product || manualMode || correctionMode ? undefined : onBarcode}
      />

      {/* Gap #3 (2026-06-09): corner-bracket targeting marks replace the
          faint full-perimeter outline. Full-opacity accent brackets are
          clearly legible over both a real camera feed and the white
          sim background. */}
      {!product && !loading && !manualMode && !correctionMode && (
        <View style={styles.reticleContainer} pointerEvents="none">
          <View style={styles.reticleCornerTL} />
          <View style={styles.reticleCornerTR} />
          <View style={styles.reticleCornerBL} />
          <View style={styles.reticleCornerBR} />
        </View>
      )}

      {/*
        E8 (2026-05-11 visual sweep): deeplinking to `/barcode` (from
        the share-extension success path, deeplink, or programmatic
        nav) put the user on a full-screen scanner with no way back
        except the bottom tab bar — which is itself less obvious
        than a close button on what reads as a modal-style overlay.
        Floating close (×) button in the top-left, padded by the
        safe-area inset.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close barcode scanner"
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)");
          }
        }}
        hitSlop={16}
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: Spacing.md,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(0,0,0,0.45)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={22} color={Accent.primaryForeground} strokeWidth={2.25} />
      </Pressable>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.overlay}>
        {loading && (
          <>
            <ActivityIndicator size="small" color={accent.primary} />
            <Text style={styles.hint}>Looking up product…</Text>
          </>
        )}

        {product && scaled && !correctionMode && (
          <>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.macroRow}>
              <View style={styles.macroChip}>
                <Text style={styles.macroValue}>{Math.round(scaled.calories)}</Text>
                <Text style={styles.macroLabel}>kcal</Text>
              </View>
              <View style={styles.macroChip}>
                <Text style={styles.macroValue}>{Math.round(scaled.protein)}g</Text>
                <Text style={styles.macroLabel}>protein</Text>
              </View>
              <View style={styles.macroChip}>
                <Text style={styles.macroValue}>{Math.round(scaled.carbs)}g</Text>
                <Text style={styles.macroLabel}>carbs</Text>
              </View>
              <View style={styles.macroChip}>
                <Text style={styles.macroValue}>{Math.round(scaled.fat)}g</Text>
                <Text style={styles.macroLabel}>fat</Text>
              </View>
            </View>

            {/* Gap #5 (2026-06-09): 4-segment meal-slot picker above the
                portion stepper. Defaults to time-of-day slot on mount;
                user can override before logging. Parity with web
                today-barcode-dialog.tsx <select> meal slot. */}
            <View style={styles.slotRow}>
              {(["Breakfast", "Lunch", "Dinner", "Snacks"] as const).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.slotPill, mealSlot === s && styles.slotPillActive]}
                  onPress={() => setMealSlot(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: mealSlot === s }}
                  accessibilityLabel={`Log to ${s}`}
                >
                  <Text style={[styles.slotPillText, mealSlot === s && styles.slotPillTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* F-137 (2026-05-11) — inline stepper replaces the free
                grams TextInput. Step = 5 g (typical OFF granularity).
                Direct text entry still works via the inline TextInput
                inside the stepper, so users can paste precise values
                like "112.5 g" off the label. */}
            <View style={styles.servingRow}>
              <Text style={styles.servingLabel}>Amount:</Text>
              <ServingStepper
                value={gramsInput}
                onChange={setGramsInput}
                step={5}
                unit="g"
                min={0}
                max={10000}
                inputAccessibilityLabel="Serving size in grams"
                testIdPrefix="barcode-amount"
                style={styles.servingStepper}
              />
            </View>
            {rememberedPortion != null && rememberedPortion > 0 ? (
              <Text style={[styles.servingHint, { color: accent.primarySolid }]}>
                You usually log {Math.round(rememberedPortion)} g — using that.
              </Text>
            ) : (
              <Text style={styles.servingHint}>Tap a label serving or edit grams.</Text>
            )}
            <View style={styles.presetRow}>
              {(product.servingOptions ?? []).map((o) => {
                const selected = Math.abs(o.grams - grams) < 0.51;
                return (
                  <Pressable
                    key={`${o.label}-${o.grams}`}
                    style={[styles.presetChip, selected && styles.presetChipSelected]}
                    onPress={() => setGramsInput(String(o.grams))}
                  >
                    <Text style={styles.presetChipText}>{o.label}</Text>
                  </Pressable>
                );
              })}
              {[50, 150, 200]
                .filter((g) => !(product.servingOptions ?? []).some((o) => Math.abs(o.grams - g) < 0.51))
                .map((g) => {
                  const selected = Math.abs(g - grams) < 0.51;
                  return (
                    <Pressable
                      key={`preset-${g}`}
                      style={[styles.presetChip, selected && styles.presetChipSelected]}
                      onPress={() => setGramsInput(String(g))}
                    >
                      <Text style={styles.presetChipText}>{g} g</Text>
                    </Pressable>
                  );
                })}
            </View>
            {searchRedesign ? (
              // Redesign: legible Verified/Estimated chip (search-results
              // language) + the source line beneath it for provenance.
              <View style={{ alignItems: "center", gap: Spacing.xs }}>
                <SearchResultConfidenceChip
                  tier={barcodeConfidenceTier(product)}
                  testID="barcode-confidence-chip"
                />
                <Text style={styles.source}>{barcodeProvenanceLabel(product)}</Text>
              </View>
            ) : product.verified ? (
              // Old path (binary green tick): preserved for flag-off.
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Check size={11} color={Colors.dark.textTertiary} strokeWidth={3} />
                <Text style={styles.source}>Verified</Text>
              </View>
            ) : (
              <Text style={styles.source}>{barcodeProvenanceLabel(product)}</Text>
            )}
            <View style={styles.btnRow}>
              <Pressable
                style={[styles.logBtn, searchRedesign && { backgroundColor: accent.primary }]}
                onPress={handleLog}
                disabled={logging}
                accessibilityLabel={`Log ${product.name} to ${mealSlot}`}
              >
                {logging ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <PlusCircle size={20} color={colors.primaryForeground} />
                )}
                <Text style={styles.logBtnText} numberOfLines={1}>
                  {logging ? "Logging…" : `Log to ${mealSlot}`}
                </Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={resetScan} accessibilityLabel="Scan another barcode">
                <Text style={styles.secondaryBtnText}>Scan again</Text>
              </Pressable>
            </View>
            {/* "This is wrong" link */}
            <Pressable onPress={openCorrectionMode} style={{ alignItems: "center", paddingTop: Spacing.xs }}>
              <Text style={styles.corrLink}>This is wrong — edit and update</Text>
            </Pressable>
          </>
        )}

        {error && !manualMode && (
          <>
            <AlertCircle size={32} color={Accent.destructive} style={styles.errorIcon} strokeWidth={2} />
            {sectionA ? (
              <Text style={[styles.errorTitle, { color: colors.text }]}>{COMPLETE_DAY_V3_COPY.barcodeNotFoundTitle}</Text>
            ) : null}
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={resetScan} accessibilityLabel="Try scanning again">
              <Text style={styles.retryBtnText}>Try again</Text>
            </Pressable>
            {/* Gap #6 (2026-06-09): photo-fallback CTA added to the
                not-found state. Matches web today-barcode-dialog.tsx
                "Scan the label" secondary CTA (parity). Routes to
                manual entry for now as the Label OCR path is deferred
                — see ENG-1004. */}
            <Pressable style={styles.manualEntryBtn} onPress={() => setManualMode(true)} accessibilityLabel="Enter nutrition manually">
              <Text style={styles.manualEntryBtnText}>Enter manually</Text>
            </Pressable>
          </>
        )}

        {/* Gap #2 (2026-06-09): editorial idle state — serif title, scan
            icon, calm-coach sub-copy. Centred layout under the reticle. */}
        {!loading && !product && !error && !manualMode && (
          <View style={{ alignItems: "center", gap: Spacing.sm }}>
            <ScanLine size={22} color={accent.primary} strokeWidth={1.75} accessibilityLabel="Barcode scanner icon" />
            <Text style={[styles.overlayTitle, { textAlign: "center" }]}>Scan a barcode</Text>
            <Text style={[styles.hint, { textAlign: "center" }]}>
              Point the camera at any EAN or UPC barcode to look up nutrition info
            </Text>
          </View>
        )}
      </View>
      </TouchableWithoutFeedback>

      {/* Manual entry overlay */}
      {manualMode && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.manualOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md, paddingBottom: tabBarHeight + Spacing.xxxl }}>
            <Text style={styles.manualTitle}>Add Item Manually</Text>
            {sectionA && last ? (
              <View style={styles.bcChip}>
                <ScanLine size={15} color={accent.primary} />
                <Text style={styles.bcChipText}>{last}</Text>
              </View>
            ) : null}
            <Text style={styles.manualSub}>
              {last ? `Barcode: ${last}` : "Enter the nutrition info from the label"}
            </Text>
            {/* Gap #5: slot picker in manual entry, parity with the found-product card. */}
            <View style={styles.slotRow}>
              {(["Breakfast", "Lunch", "Dinner", "Snacks"] as const).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.slotPill, mealSlot === s && styles.slotPillActive]}
                  onPress={() => setMealSlot(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: mealSlot === s }}
                  accessibilityLabel={`Log to ${s}`}
                >
                  <Text style={[styles.slotPillText, mealSlot === s && styles.slotPillTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.manualInput}
              placeholder="Food name"
              placeholderTextColor={Colors.dark.textTertiary}
              value={manualName}
              onChangeText={setManualName}
              autoFocus
            />
            <View style={styles.manualInputRow}>
              <TextInput
                style={[styles.manualInput, { flex: 1 }]}
                placeholder="Calories"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numeric"
                value={manualCalories}
                onChangeText={setManualCalories}
              />
              <TextInput
                style={[styles.manualInput, { flex: 1 }]}
                placeholder="Protein (g)"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numeric"
                value={manualProtein}
                onChangeText={setManualProtein}
              />
            </View>
            <View style={styles.manualInputRow}>
              <TextInput
                style={[styles.manualInput, { flex: 1 }]}
                placeholder="Carbs (g)"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numeric"
                value={manualCarbs}
                onChangeText={setManualCarbs}
              />
              <TextInput
                style={[styles.manualInput, { flex: 1 }]}
                placeholder="Fat (g)"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numeric"
                value={manualFat}
                onChangeText={setManualFat}
              />
            </View>
            {sectionA ? (
              <Text style={[Type.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
                {COMPLETE_DAY_V3_COPY.sharedAnonymouslyNote}
              </Text>
            ) : null}
            <Pressable
              style={[
                styles.logBtn,
                searchRedesign && { backgroundColor: accent.primary },
                { opacity: manualName.trim() && Number(manualCalories) > 0 ? 1 : 0.4 },
              ]}
              onPress={handleManualLog}
              disabled={!manualName.trim() || !(Number(manualCalories) > 0) || logging}
            >
              {logging ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <PlusCircle size={20} color={colors.primaryForeground} />
              )}
              <Text style={styles.logBtnText}>{logging ? "Logging…" : `Log to ${mealSlot}`}</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={resetScan}>
              <Text style={styles.secondaryBtnText}>Back to scanner</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ENG-1247 — community-contribution opt-in. Shown after a not-found
          barcode has been logged PRIVATELY (handleManualLog), when the
          `barcode_community_contribution` flag is on. Never automatic. */}
      {shareEntry && userId && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.manualOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md, paddingBottom: tabBarHeight + Spacing.xxxl }}>
            <BarcodeShareOptIn entry={shareEntry} userId={userId} onDone={handleShareDone} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {savedAck && sectionA ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.manualOverlay}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, gap: Spacing.md }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: Radius.full,
                backgroundColor: Accent.success + "1F",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={28} color={Accent.successSolid} strokeWidth={2.5} />
            </View>
            <Text style={[Type.headline, { color: colors.text, textAlign: "center" }]} testID="barcode-saved-title">
              {COMPLETE_DAY_V3_COPY.savedTitle}
            </Text>
            <Text style={[Type.body, { color: colors.textSecondary, textAlign: "center", lineHeight: 22 }]}>
              {COMPLETE_DAY_V3_COPY.savedThanks(savedAck.name)}
            </Text>
            <Pressable
              style={[styles.logBtn, { width: "100%", marginTop: Spacing.md, backgroundColor: accent.primary }]}
              onPress={() => {
                setSavedAck(null);
                resetScan();
              }}
              accessibilityLabel="Log it now"
            >
              <Text style={styles.logBtnText}>Log it now</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {/* Correction overlay */}
      {correctionMode && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.corrOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md, paddingBottom: tabBarHeight + Spacing.xxxl }}>
            <Text style={styles.corrTitle}>Correct Nutrition Info</Text>
            <Text style={styles.corrSub}>
              {last ? `Barcode: ${last}` : "Update the nutrition data for this product"}
            </Text>
            <TextInput
              style={styles.manualInput}
              placeholder="Food name"
              placeholderTextColor={Colors.dark.textTertiary}
              value={corrName}
              onChangeText={setCorrName}
              autoFocus
            />
            <View style={styles.manualInputRow}>
              <TextInput
                style={[styles.manualInput, { flex: 1 }]}
                placeholder="Calories"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numeric"
                value={corrCalories}
                onChangeText={setCorrCalories}
              />
              <TextInput
                style={[styles.manualInput, { flex: 1 }]}
                placeholder="Protein (g)"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numeric"
                value={corrProtein}
                onChangeText={setCorrProtein}
              />
            </View>
            <View style={styles.manualInputRow}>
              <TextInput
                style={[styles.manualInput, { flex: 1 }]}
                placeholder="Carbs (g)"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numeric"
                value={corrCarbs}
                onChangeText={setCorrCarbs}
              />
              <TextInput
                style={[styles.manualInput, { flex: 1 }]}
                placeholder="Fat (g)"
                placeholderTextColor={Colors.dark.textTertiary}
                keyboardType="numeric"
                value={corrFat}
                onChangeText={setCorrFat}
              />
            </View>
            <Pressable
              style={[styles.logBtn, { opacity: corrName.trim() && Number(corrCalories) > 0 ? 1 : 0.4 }]}
              onPress={submitCorrection}
              disabled={!corrName.trim() || !(Number(corrCalories) > 0) || corrSaving}
            >
              <Text style={styles.logBtnText}>{corrSaving ? "Saving..." : "Save Correction"}</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => setCorrectionMode(false)}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
