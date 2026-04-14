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
import { supabase } from "@/lib/supabase";
import {
  fetchIngredientsForVerification,
  saveVerifiedIngredients,
  scaleMacros,
  parseIngredientForSearch,
  sourceLabel,
  RECIPE_INGREDIENT_REVIEW_CONFIDENCE,
  type VerifiableIngredient,
  type BarcodeProduct,
  type FoodPortion,
} from "@/lib/verifyRecipe";
import FoodSearchModal from "@/components/FoodSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";

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
  const recipeId = typeof id === "string" ? id : "";

  const [recipe, setRecipe] = useState<{ title: string; servings: number } | null>(null);
  const [ingredients, setIngredients] = useState<VerifiableIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [searchIndex, setSearchIndex] = useState<number | null>(null);
  const [barcodeIndex, setBarcodeIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    (async () => {
      const [recipeRes, ings] = await Promise.all([
        supabase.from("recipes").select("title, servings").eq("id", recipeId).maybeSingle(),
        fetchIngredientsForVerification(recipeId),
      ]);
      if (cancelled) return;
      if (recipeRes.data) setRecipe(recipeRes.data as any);
      setIngredients(ings);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [recipeId]);

  // Live totals
  const totals = useMemo(() => {
    const sum = ingredients.reduce(
      (acc, i) => ({
        calories: acc.calories + i.calories,
        protein: acc.protein + i.protein,
        carbs: acc.carbs + i.carbs,
        fat: acc.fat + i.fat,
        fiberG: acc.fiberG + i.fiberG,
        sugarG: acc.sugarG + i.sugarG,
        sodiumMg: acc.sodiumMg + i.sodiumMg,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
    );
    const srv = recipe?.servings ?? 1;
    return {
      total: sum,
      perServing: {
        calories: Math.round(sum.calories / srv),
        protein: Math.round(sum.protein / srv),
        carbs: Math.round(sum.carbs / srv),
        fat: Math.round(sum.fat / srv),
        fiberG: Math.round((sum.fiberG / srv) * 10) / 10,
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
    (result: {
      name: string;
      source: "USDA" | "OFF";
      macrosPer100g: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
      portions: { label: string; gramWeight: number; amount: number }[];
      chosenPortion: { label: string; gramWeight: number; amount: number };
      quantity: number;
      fdcId?: number;
      barcode?: string;
    }) => {
      if (searchIndex == null) return;
      const grams = result.chosenPortion.gramWeight * result.quantity;
      const scaled = scaleMacros(result.macrosPer100g, grams);
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
    (barcode: string, product: BarcodeProduct) => {
      if (barcodeIndex == null) return;
      const ing = ingredients[barcodeIndex];
      if (!ing) return;
      const per100g = {
        calories: product.calories, protein: product.protein,
        carbs: product.carbs, fat: product.fat,
        fiberG: product.fiberG, sugarG: 0, sodiumMg: 0,
      };
      const grams = ing.unit === "g" && ing.amount ? ing.amount : product.servingSizeG ?? 100;
      const scaled = scaleMacros(per100g, grams);
      updateIngredient(barcodeIndex, {
        matchedName: product.name, source: "OFF",
        confidence: 1.0, isVerified: true,
        macrosPer100g: per100g, ...scaled,
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
      if (ing.macrosPer100g && num && num > 0) {
        const gramsPer = ing.chosenPortion?.gramWeight ?? 100;
        const grams = gramsPer * num;
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
        const grams = portion.gramWeight * qty;
        Object.assign(updates, scaleMacros(ing.macrosPer100g, grams));
      }
      updateIngredient(index, updates);
    },
    [ingredients, updateIngredient],
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
    topTitle: { color: Accent.success, fontSize: 13, fontWeight: "800", letterSpacing: 3 },
    scroll: { padding: Spacing.xl, paddingBottom: 120, gap: Spacing.sm },
    recipeName: { fontSize: 22, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md },

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
    confirmBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: Spacing.sm, backgroundColor: Accent.success,
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
          const amountStr = ing.amount != null ? `${ing.amount}${ing.unit ? ` ${ing.unit}` : ""}` : "";

          return (
            <View key={ing.id}>
              {/* Collapsed row */}
              <Pressable
                style={[styles.ingRow, needsReview && styles.ingRowNeedsReview]}
                onPress={() => setExpandedIndex(expanded ? null : i)}
              >
                {needsReview && (
                  <Ionicons name="alert-circle" size={18} color={Accent.warning} style={{ marginRight: Spacing.sm }} />
                )}
                <View style={styles.ingContent}>
                  <Text style={styles.ingMatchedName} numberOfLines={1}>{displayName}</Text>
                  <Text style={styles.ingDetail}>
                    {amountStr ? `${amountStr}, ` : ""}{ing.calories} calories
                  </Text>
                  {ing.matchedName && ing.matchedName !== ing.name && (
                    <Text style={styles.ingOriginal}>{`"${decodeEntities(ing.name)}"`}</Text>
                  )}
                </View>
                <Text style={styles.ingCals}>{ing.calories}</Text>
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
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                      = {Math.round((ing.chosenPortion?.gramWeight ?? 1) * (ing.amount ?? 1) * 10) / 10} g
                    </Text>
                  </View>

                  {/* Search / Scan */}
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => { setSearchIndex(i); setExpandedIndex(null); }}
                    >
                      <Ionicons name="search" size={16} color={Accent.primary} />
                      <Text style={styles.actionBtnText}>Search alternative</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => { setBarcodeIndex(i); setExpandedIndex(null); }}
                    >
                      <Ionicons name="barcode-outline" size={16} color={Accent.primary} />
                      <Text style={styles.actionBtnText}>Scan</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
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
      />
      <BarcodeScannerModal
        visible={barcodeIndex != null}
        onScan={onBarcodeScanned}
        onClose={() => setBarcodeIndex(null)}
      />
    </View>
  );
}
