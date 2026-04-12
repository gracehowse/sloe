import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Neon, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  searchFoods,
  getFoodMacros,
  scaleMacros,
  type FoodSearchResult,
  type OffSearchResult,
  type FoodPortion,
} from "@/lib/verifyRecipe";

/** Standard units always available regardless of data source */
const STANDARD_UNITS: FoodPortion[] = [
  { label: "g", gramWeight: 1, amount: 1 },
  { label: "oz", gramWeight: 28.35, amount: 1 },
  { label: "tbsp", gramWeight: 14.79, amount: 1 },
  { label: "tsp", gramWeight: 4.93, amount: 1 },
  { label: "cup", gramWeight: 236.59, amount: 1 },
  { label: "ml", gramWeight: 1, amount: 1 },
];

type SelectedFood = {
  name: string;
  source: "USDA" | "OFF";
  /** per 100g */
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
  /** The portion the user chose */
  chosenPortion: FoodPortion;
  /** User-entered quantity (e.g. 2 for "2 medium", 15 for "15 g") */
  quantity: number;
  fdcId?: number;
  barcode?: string;
};

type Props = {
  visible: boolean;
  initialQuery: string;
  onSelect: (result: SelectedFood) => void;
  onClose: () => void;
};

type SectionData =
  | { type: "usda"; item: FoodSearchResult }
  | { type: "off"; item: OffSearchResult };

function buildPortionList(apiPortions: FoodPortion[]): FoodPortion[] {
  // Combine standard units + API-specific portions (like "1 medium", "1 large")
  // Deduplicate by label
  const seen = new Set<string>();
  const result: FoodPortion[] = [];
  // Standard units first
  for (const u of STANDARD_UNITS) {
    seen.add(u.label.toLowerCase());
    result.push(u);
  }
  // API portions (skip if label matches a standard unit)
  for (const p of apiPortions) {
    const key = p.label.toLowerCase().trim();
    if (!seen.has(key) && key !== "100 g") {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

export default function FoodSearchModal({
  visible,
  initialQuery,
  onSelect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [query, setQuery] = useState(initialQuery);
  const [usdaResults, setUsdaResults] = useState<FoodSearchResult[]>([]);
  const [offResults, setOffResults] = useState<OffSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    source: "USDA" | "OFF";
    macrosPer100g: SelectedFood["macrosPer100g"];
    portions: FoodPortion[];
    chosenPortion: FoodPortion;
    quantity: number;
    /** Raw text in the servings input (allows typing "1/2", ".5", etc.) */
    quantityText: string;
    fdcId?: number;
    barcode?: string;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setUsdaResults([]);
      setOffResults([]);
      setPreview(null);
      if (initialQuery.trim()) {
        setLoading(true);
        searchFoods(initialQuery).then((r) => {
          setUsdaResults(r.usda);
          setOffResults(r.off);
          setLoading(false);
        });
      }
    }
  }, [visible, initialQuery]);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = text.trim();
    if (!q) {
      setUsdaResults([]);
      setOffResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await searchFoods(q);
      setUsdaResults(r.usda);
      setOffResults(r.off);
      setLoading(false);
    }, 400);
  }, []);

  const onPickUsda = useCallback(
    async (item: FoodSearchResult) => {
      const key = `usda-${item.fdcId}`;
      setLoadingId(key);
      const result = await getFoodMacros(item.fdcId);
      setLoadingId(null);
      if (!result) return;
      const allPortions = buildPortionList(result.portions);
      const defaultPortion = allPortions[0]; // "g"
      setPreview({
        name: item.description,
        source: "USDA",
        macrosPer100g: result.macrosPer100g,
        portions: allPortions,
        chosenPortion: defaultPortion,
        quantity: 100,
        quantityText: "100",
        fdcId: item.fdcId,
      });
    },
    [],
  );

  const onPickOff = useCallback(
    (item: OffSearchResult) => {
      const allPortions = buildPortionList([]);
      const defaultPortion = allPortions[0]; // "g"
      setPreview({
        name: [item.brand, item.name].filter(Boolean).join(" · "),
        source: "OFF",
        macrosPer100g: {
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiberG: item.fiberG,
          sugarG: item.sugarG,
          sodiumMg: item.sodiumMg,
        },
        portions: allPortions,
        chosenPortion: defaultPortion,
        quantity: 100,
        quantityText: "100",
        barcode: item.code,
      });
    },
    [],
  );

  /** Parse fraction/decimal text to a number */
  const parseQuantityText = useCallback((text: string): number => {
    const t = text.trim();
    if (!t) return 0;
    // Fraction: "1/2", "3/4"
    const fracMatch = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fracMatch) {
      const num = parseInt(fracMatch[1], 10);
      const den = parseInt(fracMatch[2], 10);
      if (den > 0) return num / den;
    }
    // Mixed: "1 1/2"
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

  // Compute scaled macros for the current preview selection
  const previewMacros = useMemo(() => {
    if (!preview) return null;
    const grams = preview.chosenPortion.gramWeight * preview.quantity;
    return scaleMacros(preview.macrosPer100g, grams);
  }, [preview]);

  const totalGrams = useMemo(() => {
    if (!preview) return 0;
    return Math.round(preview.chosenPortion.gramWeight * preview.quantity * 10) / 10;
  }, [preview]);

  const sections = [
    ...(offResults.length > 0
      ? [{ title: "Products & Brands", data: offResults.map((item) => ({ type: "off" as const, item })) }]
      : []),
    ...(usdaResults.length > 0
      ? [{ title: "Whole Foods (USDA)", data: usdaResults.map((item) => ({ type: "usda" as const, item })) }]
      : []),
  ];

  const renderItem = useCallback(
    ({ item: entry }: { item: SectionData }) => {
      if (entry.type === "off") {
        const item = entry.item;
        return (
          <Pressable style={styles.resultRow} onPress={() => onPickOff(item)}>
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName} numberOfLines={2}>
                {item.brand ? `${item.brand} · ` : ""}{item.name}
              </Text>
              <View style={styles.macroPreview}>
                <Text style={styles.macroPreviewText}>{item.calories} kcal</Text>
                <Text style={[styles.macroPreviewText, { color: MacroColors.protein }]}>P:{item.protein}g</Text>
                <Text style={[styles.macroPreviewText, { color: MacroColors.carbs }]}>C:{item.carbs}g</Text>
                <Text style={[styles.macroPreviewText, { color: MacroColors.fat }]}>F:{item.fat}g</Text>
              </View>
              <Text style={styles.per100g}>per 100g</Text>
            </View>
            <View style={styles.sourceBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Neon.green} />
            </View>
          </Pressable>
        );
      }

      const item = entry.item;
      const isLoading = loadingId === `usda-${item.fdcId}`;
      return (
        <Pressable
          style={styles.resultRow}
          onPress={() => onPickUsda(item)}
          disabled={isLoading}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.resultName} numberOfLines={2}>
              {item.description}
            </Text>
            {item.dataType && (
              <Text style={styles.resultType}>{item.dataType}</Text>
            )}
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={Neon.purple} />
          ) : (
            <View style={[styles.sourceBadge, { borderColor: Neon.blue + "50" }]}>
              <Text style={[styles.sourceBadgeText, { color: Neon.blue }]}>USDA</Text>
            </View>
          )}
        </Pressable>
      );
    },
    [loadingId, onPickUsda, onPickOff],
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
    sectionHeader: {
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.sm,
    },
    sectionHeaderText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textTertiary,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
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
    resultType: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
    macroPreview: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: 4,
    },
    macroPreviewText: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
    per100g: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
    sourceBadge: {
      borderWidth: 1,
      borderColor: Neon.green + "50",
      borderRadius: Radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    sourceBadgeText: { fontSize: 10, fontWeight: "700", color: Neon.green },
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
            placeholder="Search products & whole foods..."
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Preview card — shown when user taps a food before confirming */}
        {preview && previewMacros && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{
              backgroundColor: colors.card, borderRadius: Radius.lg,
              borderWidth: 1, borderColor: Neon.green + "40",
              padding: Spacing.xl, gap: Spacing.md,
            }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{preview.name}</Text>

              {/* Serving size — unit selector (horizontal scroll) */}
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
                          // When switching to "g", default to 100; for other units default to 1
                          const defaultQty = p.label === "g" || p.label === "ml" ? 100 : 1;
                          return { ...prev, chosenPortion: p, quantity: defaultQty, quantityText: String(defaultQty) };
                        });
                      }}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8,
                        borderRadius: Radius.md, borderWidth: 1,
                        borderColor: isActive ? Neon.green : colors.border,
                        backgroundColor: isActive ? Neon.green + "15" : "transparent",
                        minWidth: 50, alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: isActive ? "700" : "500", color: isActive ? Neon.green : colors.text }}>
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

              {/* Number of servings — free-form input with +/- */}
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

              {/* Scaled nutrition */}
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
              <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm }}>
                <Pressable
                  style={{ flex: 1, backgroundColor: Neon.green, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: Spacing.sm }}
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

        {loading && usdaResults.length === 0 && offResults.length === 0 && !preview && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Neon.purple} />
            <Text style={styles.hint}>Searching USDA + Open Food Facts...</Text>
          </View>
        )}

        {!preview ? (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) =>
              item.type === "off" ? `off-${item.item.code}-${index}` : `usda-${item.item.fdcId}`
            }
            renderItem={renderItem}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              !loading && query.trim() ? (
                <Text style={styles.emptyText}>
                  No results for &quot;{query}&quot;. Try a simpler or more specific term.
                </Text>
              ) : null
            }
          />
        ) : null}
      </View>
    </Modal>
  );
}
