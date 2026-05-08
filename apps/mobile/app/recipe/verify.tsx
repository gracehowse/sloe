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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { decodeEntities } from "@/lib/decodeEntities";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import {
  fetchIngredientsForVerification,
  saveVerifiedIngredients,
  scaleMacros,
  totalGramsForVerifyScale,
  totalGramsForVerifyScaleDetailed,
  parseIngredientForSearch,
  sourceLabel,
  RECIPE_INGREDIENT_REVIEW_CONFIDENCE,
  addUserIngredient,
  setIngredientOverride,
  type VerifiableIngredient,
  type BarcodeProduct,
  type FoodPortion,
  type IngredientOverride,
} from "@/lib/verifyRecipe";
import FoodSearchModal, { type SelectedFood } from "@/components/FoodSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import VoiceLogSheet from "@/components/VoiceLogSheet";
import PhotoLogSheet from "@/components/PhotoLogSheet";
import type { AiLoggedItem } from "../../../../src/lib/nutrition/aiLogging";
import AddIngredientSheet, {
  type AddIngredientPayload,
} from "@/components/AddIngredientSheet";
import OverrideIngredientSheet from "@/components/OverrideIngredientSheet";
import Badge from "@/components/Badge";
import {
  effectiveMacros,
  hasOverride,
  recomputeRecipeTotals,
} from "../../../../src/lib/nutrition/ingredientOverrides";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import { classifyConfidence } from "../../../../src/lib/nutrition/aiLogging";
import {
  nutritionDelta,
  type CaptionNutritionClaim,
} from "../../../../src/lib/recipe-import/extractCaptionNutrition";

/** Standard units always available for editing */
const STANDARD_UNITS: FoodPortion[] = [
  { label: "g", gramWeight: 1, amount: 1 },
  { label: "oz", gramWeight: 28.35, amount: 1 },
  { label: "tbsp", gramWeight: 14.79, amount: 1 },
  { label: "tsp", gramWeight: 4.93, amount: 1 },
  { label: "cup", gramWeight: 236.59, amount: 1 },
  { label: "ml", gramWeight: 1, amount: 1 },
];

export default function VerifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { session } = useAuth();
  const recipeId = typeof id === "string" ? id : "";

  const [recipe, setRecipe] = useState<{ title: string; servings: number } | null>(null);
  const [captionClaim, setCaptionClaim] = useState<CaptionNutritionClaim | null>(null);
  const [ingredients, setIngredients] = useState<VerifiableIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  // F-114 broader sweep (2026-05-07): surface initial-load failures so
  // the user gets a retry path instead of a perpetual spinner.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [searchIndex, setSearchIndex] = useState<number | null>(null);
  const [barcodeIndex, setBarcodeIndex] = useState<number | null>(null);
  // Batch 2.7 — add-ingredient + per-ingredient override sheets.
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null);
  // F-128 follow-up (Grace, 2026-05-07): voice + photo log as
  // append-paths for verify-after-import. Each AI item lands as a new
  // user-added ingredient via the existing `addUserIngredient` flow
  // (per-row Supabase write — same path AddIngredientSheet uses).
  const [voiceLogOpen, setVoiceLogOpen] = useState(false);
  const [photoLogOpen, setPhotoLogOpen] = useState(false);
  const [apiBase, setApiBase] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Constants = (await import("expo-constants")).default;
        const extra = Constants.expoConfig?.extra as
          | { supprApiUrl?: string }
          | undefined;
        if (!cancelled) setApiBase(extra?.supprApiUrl ?? "");
      } catch {
        if (!cancelled) setApiBase("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    (async () => {
      // F-114 broader sweep (2026-05-07): wrap initial load in
      // try/catch/finally. Pre-fix shape was bare `await Promise.all` —
      // a Supabase rejection or a fetchIngredientsForVerification
      // throw stranded `loading=true` and the user saw a perpetual
      // verify-screen spinner.
      try {
        const [recipeRes, ings] = await Promise.all([
          supabase
            .from("recipes")
            .select("title, servings, caption_nutrition_claim")
            .eq("id", recipeId)
            .maybeSingle(),
          fetchIngredientsForVerification(recipeId),
        ]);
        if (cancelled) return;
        if (recipeRes.data) {
          const r = recipeRes.data as {
            title: string;
            servings: number;
            caption_nutrition_claim?: CaptionNutritionClaim | null;
          };
          setRecipe({ title: r.title, servings: r.servings });
          setCaptionClaim(r.caption_nutrition_claim ?? null);
        }
        setIngredients(ings);
      } catch (err) {
        if (cancelled) return;
        console.error("[recipe/verify] initial load failed:", err);
        setLoadError(
          "Couldn't load this recipe. Check your connection and reopen the screen.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [recipeId]);

  // Live totals — macros respect per-row overrides via the shared
  // `recomputeRecipeTotals` helper (Batch 2.7). Sugar / sodium don't have
  // an override surface yet, so they're summed from the snapshot columns.
  const totals = useMemo(() => {
    const srv = Math.max(1, recipe?.servings ?? 1);
    const pEff = recomputeRecipeTotals(ingredients, srv);
    const sum = ingredients.reduce(
      (acc, i) => {
        const eff = effectiveMacros(i);
        return {
          calories: acc.calories + eff.calories,
          protein: acc.protein + eff.protein,
          carbs: acc.carbs + eff.carbs,
          fat: acc.fat + eff.fat,
          fiberG: acc.fiberG + (eff.fiber ?? i.fiberG),
          sugarG: acc.sugarG + i.sugarG,
          sodiumMg: acc.sodiumMg + i.sodiumMg,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
    );
    return {
      total: sum,
      perServing: {
        calories: pEff.calories,
        protein: pEff.protein,
        carbs: pEff.carbs,
        fat: pEff.fat,
        fiberG: pEff.fiber ?? Math.round((sum.fiberG / srv) * 10) / 10,
        sugarG: Math.round((sum.sugarG / srv) * 10) / 10,
        sodiumMg: Math.round(sum.sodiumMg / srv),
      },
    };
  }, [ingredients, recipe?.servings]);

  const hasDirty = ingredients.some((i) => i.isDirty);
  const hasUnverified = ingredients.some(
    (i) => !i.isVerified || i.confidence < RECIPE_INGREDIENT_REVIEW_CONFIDENCE,
  );

  const updateIngredient = useCallback(
    (index: number, updates: Partial<VerifiableIngredient>) => {
      setIngredients((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, ...updates, isDirty: true } : item,
        ),
      );
    },
    [],
  );

  // Food search selection
  const onFoodSelected = useCallback(
    (result: SelectedFood) => {
      if (searchIndex == null) return;
      // 2026-05-06: per-serving-only FatSecret foods don't have a
      // per-100g basis. Compute the scaled values from
      // `macrosPerServing × quantity` directly and persist
      // `macrosPer100g: null` so subsequent quantity edits skip
      // gram-based re-scaling.
      const isPerServingOnly =
        result.macrosPer100g === null && Boolean(result.macrosPerServing);
      const grams = isPerServingOnly ? 0 : result.chosenPortion.gramWeight * result.quantity;
      const ps = result.macrosPerServing;
      const q = result.quantity;
      const scaled = isPerServingOnly && ps
        ? {
            calories: Math.round(ps.calories * q),
            protein: Math.round(ps.protein * q * 10) / 10,
            carbs: Math.round(ps.carbs * q * 10) / 10,
            fat: Math.round(ps.fat * q * 10) / 10,
            fiberG: 0,
            sugarG: 0,
            sodiumMg: 0,
          }
        : scaleMacros(result.macrosPer100g!, grams);
      updateIngredient(searchIndex, {
        matchedName: result.name,
        source: result.source,
        confidence: 1.0,
        isVerified: true,
        macrosPer100g: result.macrosPer100g,
        portions: result.portions,
        chosenPortion: result.chosenPortion,
        amount: result.quantity,
        unit: result.chosenPortion.label,
        ...scaled,
      });
      setSearchIndex(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [searchIndex, updateIngredient],
  );

  // Barcode scan
  const onBarcodeScanned = useCallback(
    (_barcode: string, product: BarcodeProduct) => {
      if (barcodeIndex == null) return;
      const ing = ingredients[barcodeIndex];
      if (!ing) return;
      const per100g = {
        calories: product.calories, protein: product.protein,
        carbs: product.carbs, fat: product.fat,
        fiberG: product.fiberG, sugarG: 0, sodiumMg: 0,
        // F-74 cross-device (2026-05-08): forward caffeine/alcohol
        // per-100g so the scaled output (which spreads onto the
        // ingredient row below) populates `caffeineMg` / `alcoholG`
        // on the row, then rolls up to the recipe.
        caffeineMgPer100g: product.caffeineMgPer100g ?? null,
        alcoholGPer100g: product.alcoholGPer100g ?? null,
      };
      const defaultGrams =
        ing.unit === "g" && ing.amount != null && ing.amount > 0
          ? ing.amount
          : product.servingSizeG ?? 100;
      const offPortions: FoodPortion[] = (product.servingOptions ?? []).map((o) => ({
        label: o.label,
        gramWeight: o.grams,
        amount: 1,
      }));
      const seen = new Set(offPortions.map((p) => p.label));
      const mergedPortions = [...offPortions, ...STANDARD_UNITS.filter((s) => !seen.has(s.label))];
      const chosenPortion: FoodPortion = { label: "g", gramWeight: 1, amount: 1 };
      const scaled = scaleMacros(per100g, defaultGrams);
      updateIngredient(barcodeIndex, {
        matchedName: product.name, source: "OFF",
        confidence: 1.0, isVerified: true,
        macrosPer100g: per100g,
        portions: mergedPortions,
        chosenPortion,
        unit: "g",
        amount: defaultGrams,
        ...scaled,
      });
      setBarcodeIndex(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [barcodeIndex, ingredients, updateIngredient],
  );

  // Amount change — recalculate macros using chosen portion gram weight
  const onAmountChange = useCallback(
    (index: number, text: string) => {
      const num = parseFloat(text) || null;
      const ing = ingredients[index];
      if (!ing) return;
      if (ing.macrosPer100g && num != null && num > 0) {
        const grams = totalGramsForVerifyScale({ ...ing, amount: num }, num);
        const scaled = scaleMacros(ing.macrosPer100g, grams);
        updateIngredient(index, { amount: num, ...scaled });
      } else {
        updateIngredient(index, { amount: num });
      }
    },
    [ingredients, updateIngredient],
  );

  // Portion change — switch unit and recalculate macros
  const onPortionChange = useCallback(
    (index: number, portion: FoodPortion) => {
      const ing = ingredients[index];
      if (!ing) return;
      // When switching to g/ml, preserve the total gram weight as quantity; otherwise default to 1
      let qty: number;
      if (portion.label === "g" || portion.label === "ml") {
        const currentGrams = (ing.chosenPortion?.gramWeight ?? 1) * (ing.amount ?? 1);
        qty = Math.round(currentGrams * 10) / 10;
      } else {
        qty = 1;
      }
      const updates: Partial<VerifiableIngredient> = { chosenPortion: portion, unit: portion.label, amount: qty };
      if (ing.macrosPer100g && qty > 0) {
        const nextIng: VerifiableIngredient = { ...ing, ...updates, amount: qty };
        const grams = totalGramsForVerifyScale(nextIng, qty);
        Object.assign(updates, scaleMacros(ing.macrosPer100g, grams));
      }
      updateIngredient(index, updates);
    },
    [ingredients, updateIngredient],
  );

  // Batch 2.7 — add new user-added ingredient row. Persists via shared helper
  // and pushes the new row into local state so the user sees it immediately.
  const onAddIngredient = useCallback(
    async (payload: AddIngredientPayload) => {
      if (!recipeId) return;
      const res = await addUserIngredient(recipeId, {
        name: payload.name,
        amount: payload.amount,
        unit: payload.unit,
        calories: payload.calories,
        protein: payload.protein,
        carbs: payload.carbs,
        fat: payload.fat,
        fiberG: payload.fiberG,
        sugarG: payload.sugarG,
        sodiumMg: payload.sodiumMg,
        source: payload.source,
        confidence: payload.confidence,
        hasMatch: payload.hasMatch,
        overrideMacros: payload.overrideMacros,
      });
      if ("error" in res) {
        Alert.alert("Couldn't add ingredient", res.error);
        return;
      }
      setIngredients((prev) => [
        ...prev,
        {
          id: res.id,
          name: payload.name,
          amount: payload.amount,
          unit: payload.unit,
          calories: payload.calories,
          protein: payload.protein,
          carbs: payload.carbs,
          fat: payload.fat,
          fiberG: payload.fiberG,
          sugarG: payload.sugarG,
          sodiumMg: payload.sodiumMg,
          // F-74 cross-device (2026-05-08): user-added ingredients
          // don't carry per-100g caffeine/alcohol unless the
          // upstream Add-ingredient sheet learns to forward them
          // (currently no UI). Default to 0; verifier rollup keeps
          // working.
          caffeineMg: 0,
          alcoholG: 0,
          source: payload.source,
          confidence: payload.confidence,
          matchedName: payload.hasMatch ? payload.name : null,
          isVerified: payload.hasMatch && payload.confidence >= 0.5,
          isDirty: false,
          macrosPer100g: null,
          portions: [],
          chosenPortion: null,
          addedByUser: true,
          ...(payload.overrideMacros ? { overrideMacros: payload.overrideMacros } : {}),
        },
      ]);
      track(AnalyticsEvents.recipe_ingredient_added, {
        recipeId,
        hasMatch: payload.hasMatch,
        // L6 G4 (2026-04-18) — reuse the shared `classifyConfidence`
        // classifier so buckets mirror the existing ConfidenceDot UI.
        confidence_bucket: classifyConfidence(payload.confidence),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [recipeId],
  );

  // F-128 follow-up — handle AI-recognised items (voice/photo) by
  // appending each as a new user-added ingredient. Same persistence
  // path as AddIngredientSheet (per-item `addUserIngredient` write +
  // local-state push) so the rows participate in the verify save
  // pipeline alongside imported ones. Sequential writes so an early
  // failure surfaces clearly rather than mid-batch.
  const onAiItemsCommit = useCallback(
    async (items: AiLoggedItem[]) => {
      if (!recipeId || items.length === 0) {
        setVoiceLogOpen(false);
        setPhotoLogOpen(false);
        return;
      }
      const newRows: VerifiableIngredient[] = [];
      for (const item of items) {
        const amount =
          typeof item.grams === "number" && Number.isFinite(item.grams) && item.grams > 0
            ? item.grams
            : typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0
              ? item.quantity
              : 1;
        const unit =
          typeof item.grams === "number" && Number.isFinite(item.grams) && item.grams > 0
            ? "g"
            : item.unit?.trim() || "piece";
        const sourceLabel = item.source === "voice" ? "AI voice" : "AI photo";
        const hasMatch = item.confidence >= 0.5;
        const res = await addUserIngredient(recipeId, {
          name: item.name,
          amount,
          unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiberG: item.fiber ?? 0,
          sugarG: 0,
          sodiumMg: 0,
          source: sourceLabel,
          confidence: item.confidence,
          hasMatch,
        });
        if ("error" in res) {
          Alert.alert("Couldn't add ingredient", res.error);
          continue;
        }
        newRows.push({
          id: res.id,
          name: item.name,
          amount,
          unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiberG: item.fiber ?? 0,
          sugarG: 0,
          sodiumMg: 0,
          // F-74 cross-device (2026-05-08): AI-photo / voice-log
          // ingredient adds don't carry caffeine/alcohol per-100g
          // through the pipeline today. Default to 0; the next
          // verifier save can populate via a search-match swap.
          caffeineMg: 0,
          alcoholG: 0,
          source: sourceLabel,
          confidence: item.confidence,
          matchedName: hasMatch ? item.name : null,
          isVerified: hasMatch,
          isDirty: false,
          macrosPer100g: null,
          portions: [],
          chosenPortion: null,
          addedByUser: true,
        });
        track(AnalyticsEvents.recipe_ingredient_added, {
          recipeId,
          hasMatch,
          confidence_bucket: classifyConfidence(item.confidence),
        });
      }
      if (newRows.length > 0) {
        setIngredients((prev) => [...prev, ...newRows]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setVoiceLogOpen(false);
      setPhotoLogOpen(false);
    },
    [recipeId],
  );

  // Batch 2.7 — pin / clear a manual macro override on an existing row.
  const onOverrideSave = useCallback(
    async (index: number, override: IngredientOverride) => {
      const ing = ingredients[index];
      if (!ing) return;
      const res = await setIngredientOverride(ing.id, override);
      if ("error" in res) {
        Alert.alert("Couldn't save override", res.error);
        return;
      }
      const priorIng = ing;
      setIngredients((prev) =>
        prev.map((item, i) => (i === index ? { ...item, overrideMacros: override } : item)),
      );
      track(AnalyticsEvents.recipe_ingredient_overridden, {
        recipeId,
        ingredientPosition: index,
        // L6 G4 (2026-04-18) — bucket the row's PRE-override
        // confidence. `VerifiableIngredient.isVerified` is true iff
        // the pipeline returned a match with confidence >= 0.5,
        // mirroring the ConfidenceDot mapping in the UI.
        confidence_bucket: priorIng.isVerified ? "high" : "medium",
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [ingredients, recipeId],
  );

  const onDeleteIngredient = useCallback(
    (index: number) => {
      const ing = ingredients[index];
      if (!ing) return;
      Alert.alert(
        "Remove ingredient",
        `Remove "${decodeEntities(ing.name)}" from this recipe?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              const { error } = await supabase
                .from("recipe_ingredients")
                .delete()
                .eq("id", ing.id);
              if (error) {
                Alert.alert("Couldn't remove ingredient", error.message);
                return;
              }
              setIngredients((prev) => prev.filter((_, i) => i !== index));
              setExpandedIndex(null);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            },
          },
        ],
      );
    },
    [ingredients],
  );

  const onOverrideReset = useCallback(
    async (index: number) => {
      const ing = ingredients[index];
      if (!ing) return;
      const res = await setIngredientOverride(ing.id, null);
      if ("error" in res) {
        Alert.alert("Couldn't clear override", res.error);
        return;
      }
      const priorIng = ing;
      setIngredients((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;
          const { overrideMacros: _drop, ...rest } = item;
          return rest as VerifiableIngredient;
        }),
      );
      track(AnalyticsEvents.recipe_ingredient_override_cleared, {
        recipeId,
        ingredientPosition: index,
        // L6 G4 (2026-04-18) — same mapping as `_overridden` above.
        confidence_bucket: priorIng.isVerified ? "high" : "medium",
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [ingredients, recipeId],
  );

  // Save
  const onConfirm = useCallback(async () => {
    if (!recipeId || !recipe) return;
    setSaving(true);
    const result = await saveVerifiedIngredients(recipeId, ingredients, recipe.servings);
    setSaving(false);
    if ("error" in result) {
      Alert.alert("Save failed", result.error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/recipe/${recipeId}`);
  }, [recipeId, recipe, ingredients, router]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    topBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    backText: { color: colors.text, fontSize: 17, fontWeight: "600" },
    topTitle: { color: Accent.primary, fontSize: 13, fontWeight: "800", letterSpacing: 3 },
    scroll: { padding: Spacing.xl, paddingBottom: 120, gap: Spacing.sm },
    recipeName: { fontSize: 22, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md },

    claimBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: "#FEF3C7",
      borderColor: "#FDE68A",
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    claimBannerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: "#92400E",
      lineHeight: 18,
    },
    claimBannerBody: {
      fontSize: 12,
      color: "#92400E",
      marginTop: 2,
      lineHeight: 16,
    },

    // Totals card
    totalsCard: {
      backgroundColor: colors.card, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: Accent.primary + "30",
      padding: Spacing.lg, marginBottom: Spacing.sm,
    },
    totalsLabel: { fontSize: 12, color: colors.textTertiary, fontWeight: "600", marginBottom: Spacing.sm },
    totalsRow: { flexDirection: "row", justifyContent: "space-around" },
    totalItem: { alignItems: "center", gap: 2 },
    totalValue: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
    totalKey: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },

    // Ingredient row — Recime-style
    ingRow: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card, borderRadius: Radius.md,
      borderWidth: 1, borderColor: colors.border,
      padding: Spacing.lg, marginTop: Spacing.sm,
    },
    ingRowNeedsReview: { borderColor: Accent.warning + "60" },
    ingContent: { flex: 1, gap: 2 },
    ingMatchedName: { fontSize: 15, fontWeight: "600", color: colors.text },
    ingDetail: { fontSize: 13, color: colors.textSecondary },
    ingOriginal: { fontSize: 11, color: colors.textTertiary, fontStyle: "italic", marginTop: 2 },
    ingCals: { fontSize: 15, fontWeight: "700", color: colors.text, marginRight: Spacing.sm, fontVariant: ["tabular-nums"] },
    chevron: { marginLeft: Spacing.xs },

    // Expanded section
    expandedSection: {
      backgroundColor: colors.card, borderRadius: Radius.md,
      borderWidth: 1, borderColor: Accent.primary + "40",
      padding: Spacing.lg, marginTop: -1, gap: Spacing.md,
    },
    sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase" as const },
    macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
    macroItem: { width: "45%" as any, flexDirection: "row", justifyContent: "space-between" },
    macroLabel: { fontSize: 13, color: colors.textSecondary },
    macroValue: { fontSize: 13, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
    amountRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    amountLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },
    amountInput: {
      backgroundColor: colors.background, borderRadius: Radius.sm,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: Spacing.md, paddingVertical: 8,
      color: colors.text, fontSize: 14, width: 80, textAlign: "center",
    },
    unitInput: {
      backgroundColor: colors.background, borderRadius: Radius.sm,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: Spacing.md, paddingVertical: 8,
      color: colors.text, fontSize: 14, width: 60, textAlign: "center",
    },
    actionRow: { flexDirection: "row", gap: Spacing.md },
    actionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: Spacing.sm, paddingVertical: 12, borderRadius: Radius.md,
      borderWidth: 1, borderColor: Accent.primary + "40",
    },
    actionBtnText: { color: Accent.primary, fontSize: 13, fontWeight: "600" },

    // Footer
    footer: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: colors.background + "f0",
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
      paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
    },
    footerLabel: { fontSize: 12, color: Accent.primary, textAlign: "center", fontWeight: "600", marginBottom: Spacing.sm },
    // P2-35 (2026-04-25 ui-critic): Save/Confirm CTAs were green
    // (Accent.success), fighting the brand blue accent. Green is
    // reserved for confirmed-success states; primary actions are blue.
    confirmBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: Spacing.sm, backgroundColor: Accent.primary,
      borderRadius: Radius.md, paddingVertical: 16,
    },
    confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  }), [colors]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Accent.primary} />
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.topTitle}>VERIFY</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.centered}>
          <Text style={{ color: Accent.warning, textAlign: "center", marginHorizontal: 24 }}>
            {loadError}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>VERIFY</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.recipeName} numberOfLines={2}>{recipe?.title ?? "Recipe"}</Text>
        {hasUnverified && (
          <Text style={styles.subtitle}>
            Some ingredients need review — tap to check the match
          </Text>
        )}

        {(() => {
          if (!captionClaim) return null;
          const delta = nutritionDelta(captionClaim, totals.perServing.calories);
          if (!delta.materiallyDiverges || captionClaim.caloriesPerServing == null) return null;
          const over = (delta.caloriesDelta ?? 0) > 0;
          return (
            <View style={styles.claimBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color="#B45309"
                style={{ marginRight: 8, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.claimBannerTitle}>
                  Creator says {captionClaim.caloriesPerServing} kcal/serving — we calculated{" "}
                  {totals.perServing.calories}.
                </Text>
                <Text style={styles.claimBannerBody}>
                  {over ? "Likely an over-match" : "Likely a missed ingredient"} — tap ingredients
                  below to check.
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Live totals */}
        <View style={styles.totalsCard}>
          <Text style={styles.totalsLabel}>
            {totals.perServing.calories} calories per serving – {recipe?.servings ?? 1} servings
          </Text>
          <View style={styles.totalsRow}>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: MacroColors.protein }]}>{totals.perServing.protein}g</Text>
              <Text style={styles.totalKey}>protein</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: MacroColors.carbs }]}>{totals.perServing.carbs}g</Text>
              <Text style={styles.totalKey}>carbs</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: MacroColors.fat }]}>{totals.perServing.fat}g</Text>
              <Text style={styles.totalKey}>fat</Text>
            </View>
            {totals.perServing.fiberG > 0 && (
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: MacroColors.fiber }]}>{totals.perServing.fiberG}g</Text>
                <Text style={styles.totalKey}>fibre</Text>
              </View>
            )}
          </View>
        </View>

        {/* Ingredient list */}
        {ingredients.map((ing, i) => {
          const expanded = expandedIndex === i;
          const needsReview =
            !ing.isVerified || ing.confidence < RECIPE_INGREDIENT_REVIEW_CONFIDENCE;
          const displayName = decodeEntities(ing.matchedName ?? ing.name);
          const amountStr =
            ing.amount != null && ing.unit
              ? `${ing.amount} × ${ing.unit}`
              : ing.amount != null
                ? String(ing.amount)
                : "";
          const rowHasOverride = hasOverride(ing);
          const rowAdded = Boolean(ing.addedByUser);
          // When an override is present we show the effective calories so the
          // row reflects the user's authoritative number, not the stale match.
          const rowEff = effectiveMacros(ing);
          const rowCal = rowHasOverride ? Math.round(rowEff.calories) : ing.calories;

          return (
            <View key={ing.id}>
              {/* Collapsed row */}
              <Pressable
                style={[styles.ingRow, needsReview && !rowHasOverride && styles.ingRowNeedsReview]}
                onPress={() => setExpandedIndex(expanded ? null : i)}
              >
                {needsReview && !rowHasOverride && (
                  <Ionicons name="alert-circle" size={18} color={Accent.warning} style={{ marginRight: Spacing.sm }} />
                )}
                <View style={styles.ingContent}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.ingMatchedName} numberOfLines={1}>{displayName}</Text>
                    {rowHasOverride ? (
                      <Badge
                        variant="override"
                        accessibilityLabel="Manual override pinned on this row"
                      >
                        Override
                      </Badge>
                    ) : null}
                    {rowAdded ? (
                      <Badge
                        variant="added"
                        accessibilityLabel="Row added by you after import"
                      >
                        Added
                      </Badge>
                    ) : null}
                  </View>
                  <Text style={styles.ingDetail}>
                    {amountStr ? `${amountStr}, ` : ""}{rowCal} calories
                  </Text>
                  {ing.matchedName && ing.matchedName !== ing.name && (
                    <Text style={styles.ingOriginal}>{`"${decodeEntities(ing.name)}"`}</Text>
                  )}
                </View>
                <Text style={styles.ingCals}>{rowCal}</Text>
                <Ionicons
                  name={expanded ? "chevron-down" : "chevron-forward"}
                  size={18}
                  color={colors.textTertiary}
                  style={styles.chevron}
                />
              </Pressable>

              {/* Expanded detail */}
              {expanded && (
                <View style={styles.expandedSection}>
                  {/* Nutrition facts */}
                  <Text style={styles.sectionTitle}>Nutrition Facts</Text>
                  <View style={styles.macroGrid}>
                    <View style={styles.macroItem}>
                      <Text style={styles.macroLabel}>Calories</Text>
                      <Text style={styles.macroValue}>{ing.calories}</Text>
                    </View>
                    <View style={styles.macroItem}>
                      <Text style={styles.macroLabel}>Protein</Text>
                      <Text style={styles.macroValue}>{ing.protein} g</Text>
                    </View>
                    <View style={styles.macroItem}>
                      <Text style={styles.macroLabel}>Carbs</Text>
                      <Text style={styles.macroValue}>{ing.carbs} g</Text>
                    </View>
                    <View style={styles.macroItem}>
                      <Text style={styles.macroLabel}>Fat</Text>
                      <Text style={styles.macroValue}>{ing.fat} g</Text>
                    </View>
                    {ing.fiberG > 0 && (
                      <View style={styles.macroItem}>
                        <Text style={styles.macroLabel}>Fiber</Text>
                        <Text style={styles.macroValue}>{ing.fiberG} g</Text>
                      </View>
                    )}
                    {ing.sugarG > 0 && (
                      <View style={styles.macroItem}>
                        <Text style={styles.macroLabel}>Sugar</Text>
                        <Text style={styles.macroValue}>{ing.sugarG} g</Text>
                      </View>
                    )}
                    {ing.sodiumMg > 0 && (
                      <View style={styles.macroItem}>
                        <Text style={styles.macroLabel}>Sodium</Text>
                        <Text style={styles.macroValue}>{ing.sodiumMg} mg</Text>
                      </View>
                    )}
                  </View>

                  {/* Serving size unit picker */}
                  <Text style={styles.sectionTitle}>Serving Size</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: Spacing.sm }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {(ing.portions.length > 0 ? ing.portions : STANDARD_UNITS).map((p, idx) => {
                      const isActive = ing.chosenPortion?.label === p.label
                        || (!ing.chosenPortion && p.label === (ing.unit ?? "g"));
                      return (
                        <Pressable
                          key={`${p.label}-${idx}`}
                          onPress={() => onPortionChange(i, p)}
                          style={{
                            paddingHorizontal: 10, paddingVertical: 6,
                            borderRadius: Radius.sm, borderWidth: 1,
                            borderColor: isActive ? Accent.success : colors.border,
                            backgroundColor: isActive ? Accent.success + "15" : "transparent",
                            minWidth: 44, alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: isActive ? "700" : "500", color: isActive ? Accent.success : colors.text }}>
                            {p.label}
                          </Text>
                          {p.gramWeight !== 1 && (
                            <Text style={{ fontSize: 9, color: colors.textTertiary }}>{p.gramWeight} g</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {/* Number of servings */}
                  <Text style={styles.sectionTitle}>Amount</Text>
                  <View style={styles.amountRow}>
                    <TextInput
                      style={styles.amountInput}
                      value={ing.amount != null ? String(ing.amount) : ""}
                      onChangeText={(t) => onAmountChange(i, t)}
                      keyboardType="decimal-pad"
                      placeholder="qty"
                      placeholderTextColor={colors.textTertiary}
                      selectTextOnFocus
                    />
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      {ing.chosenPortion?.label ?? ing.unit ?? "g"}
                    </Text>
                    {(() => {
                      // P0-2 (2026-04-25): density-aware gram resolution. Surface a
                      // "needs density" hint when ml refused (no resolved density),
                      // rather than rendering "= 0 g" silently.
                      // Polish D.8 (2026-04-25): the hint is now tappable —
                      // tapping it switches the portion to the standard "g"
                      // unit so the user doesn't have to manually scroll for
                      // it in the portion picker.
                      const detail = totalGramsForVerifyScaleDetailed(ing, ing.amount ?? 0);
                      if (detail.densityRefused) {
                        return (
                          <Pressable
                            onPress={() => {
                              const gPortion: FoodPortion = { label: "g", gramWeight: 1, amount: 1 };
                              onPortionChange(i, gPortion);
                              void Haptics.selectionAsync();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Needs density — tap to switch to grams and scale this ingredient"
                            hitSlop={6}
                          >
                            <Text style={{ fontSize: 11, color: Accent.warning, textDecorationLine: "underline" }}>
                              needs density — tap to switch to g
                            </Text>
                          </Pressable>
                        );
                      }
                      return (
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                          = {Math.round(detail.grams * 10) / 10} g
                        </Text>
                      );
                    })()}
                  </View>

                  {/* Search / Scan */}
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => { setSearchIndex(i); setExpandedIndex(null); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Search alternative for ${displayName}`}
                    >
                      <Ionicons name="search" size={16} color={Accent.primary} />
                      <Text style={styles.actionBtnText}>Search alternative</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => { setBarcodeIndex(i); setExpandedIndex(null); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Scan barcode for ${displayName}`}
                    >
                      <Ionicons name="barcode-outline" size={16} color={Accent.primary} />
                      <Text style={styles.actionBtnText}>Scan</Text>
                    </Pressable>
                  </View>
                  {/* Batch 2.7 — Override nutrition (pin label values) */}
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => { setOverrideIndex(i); setExpandedIndex(null); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit nutrition for ${displayName}`}
                    >
                      <Ionicons
                        name={rowHasOverride ? "create" : "create-outline"}
                        size={16}
                        color={Accent.primary}
                      />
                      <Text style={styles.actionBtnText}>
                        {rowHasOverride ? "Edit values" : "Edit nutrition"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, { borderColor: "#ff444440" }]}
                      onPress={() => onDeleteIngredient(i)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${displayName} from recipe`}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ff4444" />
                      <Text style={[styles.actionBtnText, { color: "#ff4444" }]}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Batch 2.7 — Add ingredient row at the bottom of the list. */}
        <Pressable
          onPress={() => setAddSheetOpen(true)}
          style={{
            marginTop: Spacing.md,
            padding: Spacing.lg,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: Accent.primary + "80",
            backgroundColor: Accent.primary + "10",
            alignItems: "center",
          }}
          accessibilityRole="button"
          accessibilityLabel="Add an ingredient the importer missed"
        >
          <Text style={{ color: Accent.primary, fontWeight: "700", fontSize: 15 }}>+ Add ingredient</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: "center" }}>
            Missed an ingredient during import? Add it here and totals update live.
          </Text>
        </Pressable>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Text style={styles.footerLabel}>
          {totals.perServing.calories} calories per serving – {recipe?.servings ?? 1} servings
        </Text>
        <Pressable
          style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
          onPress={onConfirm}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.confirmBtnText}>
                {hasDirty ? "Save Changes" : "Confirm All"}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Modals */}
      <FoodSearchModal
        visible={searchIndex != null}
        initialQuery={searchIndex != null ? parseIngredientForSearch(ingredients[searchIndex]?.name ?? "").searchTerm : ""}
        initialAmount={searchIndex != null ? ingredients[searchIndex]?.amount : null}
        initialUnit={searchIndex != null ? ingredients[searchIndex]?.unit : null}
        originalDescription={searchIndex != null ? [
          ingredients[searchIndex]?.amount,
          ingredients[searchIndex]?.unit,
          ingredients[searchIndex]?.name,
        ].filter(Boolean).join(" ") : null}
        onSelect={onFoodSelected}
        onClose={() => setSearchIndex(null)}
        // F-128 (Grace, 2026-05-07): pivot from search → barcode for
        // the SAME row. We hand off `searchIndex` to `barcodeIndex` so
        // the existing `onBarcodeScanned` handler updates the targeted
        // ingredient instead of appending.
        onScanBarcode={() => {
          if (searchIndex == null) return;
          const i = searchIndex;
          setSearchIndex(null);
          setBarcodeIndex(i);
        }}
        // F-128 follow-up — voice/photo APPEND new ingredients (no row
        // target). Multi-item AI doesn't fit replace-this-row semantics
        // anyway, so we just close the search and route the user to
        // the dedicated sheet.
        onVoiceLog={() => {
          setSearchIndex(null);
          setVoiceLogOpen(true);
        }}
        onPhotoLog={() => {
          setSearchIndex(null);
          setPhotoLogOpen(true);
        }}
      />
      <BarcodeScannerModal
        visible={barcodeIndex != null}
        onScan={onBarcodeScanned}
        onClose={() => setBarcodeIndex(null)}
      />

      <VoiceLogSheet
        visible={voiceLogOpen}
        onClose={() => setVoiceLogOpen(false)}
        activeSlot="recipe"
        accessToken={session?.access_token ?? null}
        apiBase={apiBase}
        onCommit={onAiItemsCommit}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
          inputBg: colors.inputBg,
          border: colors.border,
          primaryForeground: colors.primaryForeground,
        }}
      />

      <PhotoLogSheet
        visible={photoLogOpen}
        onClose={() => setPhotoLogOpen(false)}
        activeSlot="recipe"
        accessToken={session?.access_token ?? null}
        apiBase={apiBase}
        onCommit={onAiItemsCommit}
        onUpgradeRequired={() => setPhotoLogOpen(false)}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
          inputBg: colors.inputBg,
          border: colors.border,
          primaryForeground: colors.primaryForeground,
        }}
      />

      {/* Batch 2.7 — Add ingredient sheet */}
      <AddIngredientSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdd={onAddIngredient}
        recipeId={recipeId || undefined}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.border,
          background: colors.background,
          border: colors.border,
        }}
      />

      {/* Batch 2.7 — Per-ingredient override sheet */}
      {overrideIndex != null && ingredients[overrideIndex] ? (
        <OverrideIngredientSheet
          visible={overrideIndex != null}
          onClose={() => setOverrideIndex(null)}
          ingredientName={decodeEntities(
            ingredients[overrideIndex]!.matchedName ?? ingredients[overrideIndex]!.name,
          )}
          currentMacros={effectiveMacros(ingredients[overrideIndex]!)}
          hasExistingOverride={hasOverride(ingredients[overrideIndex]!)}
          onSave={(ov) => onOverrideSave(overrideIndex, ov)}
          onReset={() => onOverrideReset(overrideIndex)}
          colors={{
            text: colors.text,
            textSecondary: colors.textSecondary,
            textTertiary: colors.textTertiary,
            card: colors.card,
            cardBorder: colors.border,
            background: colors.background,
            border: colors.border,
          }}
        />
      ) : null}
    </View>
  );
}
