import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  searchFoods,
  getFoodMacros,
  scaleMacros,
  type UnifiedSearchResult,
  type FoodPortion,
} from "@/lib/verifyRecipe";
import {
  projectRemaining,
  type MacroConsumed,
  type MacroTargets,
} from "../../../src/lib/nutrition/remainingMacros";

/** Standard units always available regardless of data source */
const STANDARD_UNITS: FoodPortion[] = [
  { label: "g", gramWeight: 1, amount: 1 },
  { label: "oz", gramWeight: 28.35, amount: 1 },
  { label: "lb", gramWeight: 453.59, amount: 1 },
  { label: "tbsp", gramWeight: 14.79, amount: 1 },
  { label: "tsp", gramWeight: 4.93, amount: 1 },
  { label: "cup", gramWeight: 236.59, amount: 1 },
  { label: "ml", gramWeight: 1, amount: 1 },
];

type SelectedFood = {
  name: string;
  source: "USDA" | "OFF";
  macrosPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  };
  portions: FoodPortion[];
  chosenPortion: FoodPortion;
  quantity: number;
  fdcId?: number;
  barcode?: string;
};

type Props = {
  visible: boolean;
  initialQuery: string;
  /** Original recipe amount (e.g. 2 for "2 chicken breasts") */
  initialAmount?: number | null;
  /** Original recipe unit (e.g. "lb", "cup", "g") */
  initialUnit?: string | null;
  /** Original ingredient description shown as context (e.g. "1 lb chicken breast") */
  originalDescription?: string | null;
  /**
   * Optional daily budget context. When provided together with `macroConsumed`,
   * the portion preview shows a fit-this-in hint:
   * "If you log this: N kcal / P / C / F left" using the shared
   * remainingMacros helper. Omit in verify-ingredient flows where there
   * is no tracker budget context.
   */
  macroTargets?: MacroTargets;
  macroConsumed?: MacroConsumed;
  onSelect: (result: SelectedFood) => void;
  onClose: () => void;
};

function buildPortionList(apiPortions: FoodPortion[]): FoodPortion[] {
  const seen = new Set<string>();
  const result: FoodPortion[] = [];
  for (const u of STANDARD_UNITS) {
    seen.add(u.label.toLowerCase());
    result.push(u);
  }
  for (const p of apiPortions) {
    const key = p.label.toLowerCase().trim();
    if (!seen.has(key) && key !== "100 g") {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

/** Find the best matching portion for the original recipe unit, returning portion + quantity */
function resolveInitialPortion(
  portions: FoodPortion[],
  amount: number | null | undefined,
  unit: string | null | undefined,
): { portion: FoodPortion; quantity: number } {
  const amt = amount != null && amount > 0 ? amount : 1;
  const u = (unit ?? "").trim().toLowerCase();

  if (!u) {
    // No unit — default to grams with the amount
    const gPortion = portions.find((p) => p.label === "g");
    return { portion: gPortion ?? portions[0], quantity: amt > 10 ? amt : 100 };
  }

  // Map common unit names to portion labels
  const UNIT_TO_LABEL: Record<string, string[]> = {
    g: ["g"],
    gram: ["g"], grams: ["g"],
    oz: ["oz"],
    ounce: ["oz"], ounces: ["oz"],
    lb: ["lb"],
    pound: ["lb"], pounds: ["lb"],
    cup: ["cup"], cups: ["cup"],
    tbsp: ["tbsp"], tablespoon: ["tbsp"], tablespoons: ["tbsp"],
    tsp: ["tsp"], teaspoon: ["tsp"], teaspoons: ["tsp"],
    ml: ["ml"],
    "fl oz": ["fl oz"],
    kg: ["g"], // convert kg → g with multiplied amount
  };

  const labels = UNIT_TO_LABEL[u];
  if (labels) {
    for (const label of labels) {
      const match = portions.find((p) => p.label.toLowerCase() === label);
      if (match) {
        const qty = u === "kg" ? amt * 1000 : amt;
        return { portion: match, quantity: qty };
      }
    }
  }

  // Try matching portion labels directly (handles USDA-specific portions like "1 RACC")
  const directMatch = portions.find((p) => p.label.toLowerCase() === u);
  if (directMatch) {
    return { portion: directMatch, quantity: amt };
  }

  // Fallback: convert to grams using known weights
  const UNIT_GRAMS: Record<string, number> = {
    lb: 453.6, pound: 453.6, pounds: 453.6,
    oz: 28.35, ounce: 28.35, ounces: 28.35,
    kg: 1000,
    cup: 236.59, cups: 236.59,
    tbsp: 14.79, tablespoon: 14.79,
    tsp: 4.93, teaspoon: 4.93,
    ml: 1,
    "fl oz": 29.57,
    breast: 200, thigh: 120, drumstick: 90, wing: 40, fillet: 170,
    chop: 150, steak: 225, leg: 250,
    medium: 110, large: 180, small: 80,
    slice: 25, rasher: 28, clove: 4,
    tin: 400, can: 400,
  };

  const gPerUnit = UNIT_GRAMS[u];
  if (gPerUnit) {
    const gPortion = portions.find((p) => p.label === "g");
    if (gPortion) {
      return { portion: gPortion, quantity: Math.round(amt * gPerUnit) };
    }
  }

  // Last resort: use first portion with the amount
  return { portion: portions[0], quantity: amt };
}

export default function FoodSearchModal({
  visible,
  initialQuery,
  initialAmount,
  initialUnit,
  originalDescription,
  macroTargets,
  macroConsumed,
  onSelect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    source: "USDA" | "OFF";
    macrosPer100g: SelectedFood["macrosPer100g"];
    portions: FoodPortion[];
    chosenPortion: FoodPortion;
    quantity: number;
    quantityText: string;
    fdcId?: number;
    barcode?: string;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backfillRef = useRef(0);

  /** Fetch full macros for USDA results that are missing inline nutrients */
  const backfillMissingMacros = useCallback((items: UnifiedSearchResult[]) => {
    const id = ++backfillRef.current;
    const missing = items
      .filter((r) => r._source === "USDA" && r._fdcId && !r.macrosPer100g && !(r.calsPer100g && r.calsPer100g > 0))
      .slice(0, 2); // Limit to avoid burning USDA API quota
    if (missing.length === 0) return;

    for (const item of missing) {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      Promise.race([getFoodMacros(item._fdcId!), timeout])
        .then((detail) => {
          if (!detail || backfillRef.current !== id) return;
          setResults((prev) =>
            prev.map((r) =>
              r.key === item.key
                ? {
                    ...r,
                    macrosPer100g: detail.macrosPer100g,
                    calsPer100g: detail.macrosPer100g.calories,
                  }
                : r,
            ),
          );
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setResults([]);
      setPreview(null);
      backfillRef.current++;
      if (initialQuery.trim()) {
        setLoading(true);
        searchFoods(initialQuery, (partial) => setResults(partial)).then((r) => {
          setResults(r);
          setLoading(false);
          backfillMissingMacros(r);
        });
      }
    }
  }, [visible, initialQuery, backfillMissingMacros]);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    backfillRef.current++;
    const q = text.trim();
    if (!q) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await searchFoods(q, (partial) => setResults(partial));
      setResults(r);
      setLoading(false);
      backfillMissingMacros(r);
    }, 400);
  }, [backfillMissingMacros]);

  const onPickResult = useCallback(
    async (item: UnifiedSearchResult) => {
      setLoadingKey(item.key);

      if (item._source === "USDA" && item._fdcId) {
        const result = await getFoodMacros(item._fdcId);
        setLoadingKey(null);
        if (!result) return;
        const allPortions = buildPortionList(result.portions);
        const { portion, quantity } = resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "USDA",
          macrosPer100g: result.macrosPer100g,
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
          fdcId: item._fdcId,
        });
      } else if (item._source === "OFF" && item.macrosPer100g) {
        setLoadingKey(null);
        const allPortions = buildPortionList([]);
        const { portion, quantity } = resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "OFF",
          macrosPer100g: item.macrosPer100g,
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
          barcode: item._offCode,
        });
      } else {
        setLoadingKey(null);
      }
    },
    [initialAmount, initialUnit],
  );

  const parseQuantityText = useCallback((text: string): number => {
    const t = text.trim();
    if (!t) return 0;
    const fracMatch = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fracMatch) {
      const num = parseInt(fracMatch[1], 10);
      const den = parseInt(fracMatch[2], 10);
      if (den > 0) return num / den;
    }
    const mixedMatch = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1], 10);
      const num = parseInt(mixedMatch[2], 10);
      const den = parseInt(mixedMatch[3], 10);
      if (den > 0) return whole + num / den;
    }
    const n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }, []);

  const onQuantityTextChange = useCallback((text: string) => {
    const num = parseQuantityText(text);
    setPreview((p) => p ? { ...p, quantityText: text, quantity: Math.max(0, num) } : p);
  }, [parseQuantityText]);

  const onConfirmPreview = useCallback(() => {
    if (preview) {
      onSelect({
        name: preview.name,
        source: preview.source,
        macrosPer100g: preview.macrosPer100g,
        portions: preview.portions,
        chosenPortion: preview.chosenPortion,
        quantity: preview.quantity,
        fdcId: preview.fdcId,
        barcode: preview.barcode,
      });
      setPreview(null);
    }
  }, [preview, onSelect]);

  const previewMacros = useMemo(() => {
    if (!preview) return null;
    const grams = preview.chosenPortion.gramWeight * preview.quantity;
    return scaleMacros(preview.macrosPer100g, grams);
  }, [preview]);

  const totalGrams = useMemo(() => {
    if (!preview) return 0;
    return Math.round(preview.chosenPortion.gramWeight * preview.quantity * 10) / 10;
  }, [preview]);

  /**
   * "If you log this" — fit-this-in projection. Null unless caller
   * provided both daily targets and today's running totals AND we have
   * scaled macros to project. Over-budget → destructive colour + "over".
   */
  const fitHint = useMemo(() => {
    if (!macroTargets || !macroConsumed || !previewMacros) return null;
    return projectRemaining(macroTargets, macroConsumed, {
      calories: previewMacros.calories,
      protein: previewMacros.protein,
      carbs: previewMacros.carbs,
      fat: previewMacros.fat,
      fiber: previewMacros.fiberG,
    });
  }, [macroTargets, macroConsumed, previewMacros]);

  const renderItem = useCallback(
    ({ item }: { item: UnifiedSearchResult }) => {
      const isLoading = loadingKey === item.key;
      const hasMacros = item.macrosPer100g && item.macrosPer100g.calories > 0;
      const cals = item.calsPer100g ?? item.macrosPer100g?.calories;

      return (
        <Pressable
          style={styles.resultRow}
          onPress={() => onPickResult(item)}
          disabled={isLoading}
        >
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {item.verified && (
                <Ionicons name="checkmark-circle" size={14} color={Accent.success} />
              )}
              <Text style={styles.resultName} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
            {hasMacros ? (
              <View style={styles.macroPreview}>
                <Text style={styles.macroPreviewText}>{item.macrosPer100g!.calories} kcal</Text>
                <Text style={[styles.macroPreviewText, { color: MacroColors.protein }]}>P:{item.macrosPer100g!.protein}g</Text>
                <Text style={[styles.macroPreviewText, { color: MacroColors.carbs }]}>C:{item.macrosPer100g!.carbs}g</Text>
                <Text style={[styles.macroPreviewText, { color: MacroColors.fat }]}>F:{item.macrosPer100g!.fat}g</Text>
              </View>
            ) : cals != null && cals > 0 ? (
              <Text style={styles.macroPreviewText}>{cals} kcal</Text>
            ) : (
              <Text style={styles.per100g}>Tap for nutrition info</Text>
            )}
            {(hasMacros || (cals != null && cals > 0)) && (
              <Text style={styles.per100g}>per 100g</Text>
            )}
          </View>
          {cals != null && cals > 0 && !isLoading && (
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"], marginRight: 4 }}>{cals}</Text>
          )}
          {isLoading ? (
            <ActivityIndicator size="small" color={Accent.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          )}
        </Pressable>
      );
    },
    [loadingKey, onPickResult, colors],
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    title: { fontSize: 18, fontWeight: "700", color: colors.text },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: Spacing.xl,
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
    },
    searchIcon: { marginRight: Spacing.sm },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 14,
    },
    centered: { alignItems: "center", paddingTop: 60, gap: Spacing.md },
    hint: { color: colors.textSecondary, fontSize: 14 },
    list: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: Spacing.md,
    },
    productImage: {
      width: 40,
      height: 40,
      borderRadius: Radius.sm,
      backgroundColor: colors.card,
    },
    resultName: { fontSize: 14, color: colors.text, fontWeight: "500" },
    macroPreview: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: 4,
    },
    macroPreviewText: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
    per100g: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      paddingTop: 40,
    },
  }), [colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Search Foods</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={onChangeText}
            placeholder="Search foods..."
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Preview card */}
        {preview && previewMacros && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{
              backgroundColor: colors.card, borderRadius: Radius.lg,
              borderWidth: 1, borderColor: Accent.success + "40",
              padding: Spacing.xl, gap: Spacing.md,
            }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{preview.name}</Text>

              {originalDescription ? (
                <Text style={{ fontSize: 13, fontStyle: "italic", color: colors.textSecondary }}>
                  Recipe calls for: {originalDescription}
                </Text>
              ) : null}

              {/* Serving size */}
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1 }}>
                SERVING SIZE
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: Spacing.sm }}
                keyboardShouldPersistTaps="handled"
              >
                {preview.portions.map((p, idx) => {
                  const isActive = preview.chosenPortion.label === p.label;
                  return (
                    <Pressable
                      key={`${p.label}-${idx}`}
                      onPress={() => {
                        setPreview((prev) => {
                          if (!prev) return prev;
                          const defaultQty = p.label === "g" || p.label === "ml" ? 100 : 1;
                          return { ...prev, chosenPortion: p, quantity: defaultQty, quantityText: String(defaultQty) };
                        });
                      }}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8,
                        borderRadius: Radius.md, borderWidth: 1,
                        borderColor: isActive ? Accent.success : colors.border,
                        backgroundColor: isActive ? Accent.success + "15" : "transparent",
                        minWidth: 50, alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: isActive ? "700" : "500", color: isActive ? Accent.success : colors.text }}>
                        {p.label}
                      </Text>
                      {p.gramWeight !== 1 && (
                        <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                          {p.gramWeight} g
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Number of servings */}
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1 }}>
                NUMBER OF SERVINGS
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <Pressable
                  onPress={() => {
                    setPreview((p) => {
                      if (!p || p.quantity <= 0.25) return p;
                      const step = p.chosenPortion.label === "g" || p.chosenPortion.label === "ml" ? 5 : 0.25;
                      const newQ = Math.max(0, Math.round((p.quantity - step) * 100) / 100);
                      return { ...p, quantity: newQ, quantityText: String(newQ) };
                    });
                  }}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
                <TextInput
                  value={preview.quantityText}
                  onChangeText={onQuantityTextChange}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: colors.background, borderRadius: Radius.sm,
                    borderWidth: 1, borderColor: colors.border,
                    paddingHorizontal: Spacing.md, paddingVertical: 8,
                    color: colors.text, fontSize: 16, fontWeight: "700",
                    width: 80, textAlign: "center",
                  }}
                  selectTextOnFocus
                />
                <Pressable
                  onPress={() => {
                    setPreview((p) => {
                      if (!p) return p;
                      const step = p.chosenPortion.label === "g" || p.chosenPortion.label === "ml" ? 5 : 0.25;
                      const newQ = Math.round((p.quantity + step) * 100) / 100;
                      return { ...p, quantity: newQ, quantityText: String(newQ) };
                    });
                  }}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
                <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                  = {totalGrams} g
                </Text>
              </View>

              {/* Nutrition */}
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1, marginTop: Spacing.xs }}>
                NUTRITION
              </Text>
              <View style={{ gap: Spacing.sm }}>
                {[
                  ["Calories", `${previewMacros.calories} kcal`],
                  ["Protein", `${previewMacros.protein} g`],
                  ["Carbohydrates", `${previewMacros.carbs} g`],
                  ["Fat", `${previewMacros.fat} g`],
                  ...(previewMacros.fiberG > 0 ? [["Fibre", `${previewMacros.fiberG} g`]] : []),
                  ...(previewMacros.sugarG > 0 ? [["Sugar", `${previewMacros.sugarG} g`]] : []),
                  ...(previewMacros.sodiumMg > 0 ? [["Sodium", `${previewMacros.sodiumMg} mg`]] : []),
                ].map(([label, val]) => (
                  <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{val}</Text>
                  </View>
                ))}
              </View>
              {fitHint ? (
                <View
                  accessible
                  accessibilityRole="summary"
                  accessibilityLabel="Projected remaining macros after logging this portion"
                  style={{
                    marginTop: Spacing.sm,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: colors.textTertiary, marginBottom: 4, textTransform: "uppercase" }}>
                    If you log this
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
                    {[
                      { label: "kcal", value: fitHint.calories, delta: fitHint.deltas.calories, over: fitHint.overCalories, unit: "" as string },
                      { label: "P", value: fitHint.protein, delta: fitHint.deltas.protein, over: fitHint.overProtein, unit: "g" },
                      { label: "C", value: fitHint.carbs, delta: fitHint.deltas.carbs, over: fitHint.overCarbs, unit: "g" },
                      { label: "F", value: fitHint.fat, delta: fitHint.deltas.fat, over: fitHint.overFat, unit: "g" },
                      ...(fitHint.fiber != null
                        ? [{ label: "Fi", value: fitHint.fiber, delta: fitHint.deltas.fiber ?? 0, over: fitHint.overFiber, unit: "g" }]
                        : []),
                    ].map((m) => (
                      <View key={m.label} style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            fontVariant: ["tabular-nums"],
                            color: m.over ? Accent.destructive : colors.text,
                          }}
                        >
                          {m.over ? `+${Math.abs(m.delta)}` : m.value}{m.unit}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{m.label}</Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>{m.over ? "over" : "left"}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm }}>
                <Pressable
                  style={{ flex: 1, backgroundColor: Accent.success, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: Spacing.sm }}
                  onPress={onConfirmPreview}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Use this</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 1, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
                  onPress={() => setPreview(null)}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Back to results</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {loading && results.length === 0 && !preview && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Accent.primary} />
            <Text style={styles.hint}>Searching...</Text>
          </View>
        )}

        {!preview && (
          <FlatList
            data={results}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !loading && query.trim() ? (
                <Text style={styles.emptyText}>
                  No results for &quot;{query}&quot;. Try a simpler or more specific term.
                </Text>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
}
