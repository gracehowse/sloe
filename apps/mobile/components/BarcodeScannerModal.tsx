import { useCallback, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { lookupBarcode, scaleMacros, submitFoodCorrection, type BarcodeProduct } from "@/lib/verifyRecipe";
import { scaleCorrectionToPer100g, type CorrectionBasis } from "@/lib/barcodeCorrection";
import { useAuth } from "@/context/auth";

type Props = {
  visible: boolean;
  onScan: (barcode: string, product: BarcodeProduct) => void;
  onClose: () => void;
};

export default function BarcodeScannerModal({ visible, onScan, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Serving size picker state
  const [gramsInput, setGramsInput] = useState("100");
  const grams = useMemo(() => {
    const n = Number.parseFloat(String(gramsInput).replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) return 100;
    return Math.min(10_000, Math.round(n * 10) / 10);
  }, [gramsInput]);

  // Manual entry state (when barcode not found)
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");
  const [manualServing, setManualServing] = useState("100");

  // Correction mode (edit scanned product data and save to DB)
  const [correctionMode, setCorrectionMode] = useState(false);
  const [corrName, setCorrName] = useState("");
  const [corrCalories, setCorrCalories] = useState("");
  const [corrProtein, setCorrProtein] = useState("");
  const [corrCarbs, setCorrCarbs] = useState("");
  const [corrFat, setCorrFat] = useState("");
  const [corrSaving, setCorrSaving] = useState(false);
  // F-20 (2026-04-19, TestFlight `AIOek8w6GKW5DdY1XK9avkE`) — many
  // products only list nutrition per serving (e.g. PBfit: per 16 g). The
  // tester typed per-serving numbers into a form that silently stored
  // them as per-100g, wildly inflating calories. New basis toggle lets
  // users choose "Per 100 g" (default) or "Per serving" with a
  // serving-size input; macros scale to per-100g before save so the DB
  // contract is unchanged. Matches Custom Food's established "Per 100 g /
  // Per serving" wording.
  const [corrBasis, setCorrBasis] = useState<CorrectionBasis>("per100g");
  const [corrServingG, setCorrServingG] = useState("");

  const scaled = useMemo(() => {
    if (!product) return null;
    return scaleMacros(
      { calories: product.calories, protein: product.protein, carbs: product.carbs, fat: product.fat, fiberG: product.fiberG },
      grams,
    );
  }, [product, grams]);

  const onBarcode = useCallback(
    async (e: { data: string }) => {
      if (loading || scanned === e.data) return;
      setScanned(e.data);
      setLoading(true);
      setError(null);
      setProduct(null);
      setManualMode(false);

      const result = await lookupBarcode(e.data);
      setLoading(false);
      if (result) {
        setProduct(result);
        if (result.servingSizeG && result.servingSizeG > 0) {
          setGramsInput(String(Math.round(result.servingSizeG)));
        } else {
          setGramsInput("100");
        }
      } else {
        setError("Product not found in database.");
      }
    },
    [loading, scanned],
  );

  // F-18 (2026-04-19, TestFlight `ABs9n0AyFkA8VeH7WPbwdGE`) — when OFF
  // gives no real label serving the builder falls back to a generic
  // `1 serving (N g)` chip. Saying "1 serving" is meaningless when the
  // product has no manufacturer serving, so collapse that display to
  // the gram weight alone. Pattern matches both the literal fallback
  // string and the close-paren form so we don't accidentally strip a
  // true label like "1 cup (240 g)".
  const GENERIC_1_SERVING_LABEL = /^1\s+serving\s*\(\s*\d+(?:\.\d+)?\s*g\s*\)\s*$/i;

  const displayServingLabel = useCallback((label: string, grams: number): string => {
    if (GENERIC_1_SERVING_LABEL.test(label.trim())) {
      return `${Math.round(grams)} g`;
    }
    return label;
  }, []);

  const portionSummary = useMemo(() => {
    const opts = product?.servingOptions ?? [];
    const hit = opts.find((o) => Math.abs(o.grams - grams) < 0.51);
    if (hit) return displayServingLabel(hit.label, hit.grams);
    return `${grams} g`;
  }, [product, grams, displayServingLabel]);

  const onConfirm = useCallback(() => {
    if (scanned && product && scaled) {
      // Pass a scaled product to the parent
      // F-13 (2026-04-19) — preserve caffeine/alcohol per 100 g from the
      // OFF lookup so the host screen can call `scaleCaffeineAlcohol` on
      // commit and auto-track the daily totals. These are NOT pre-scaled
      // — the per-100 g reference is what the commit path needs.
      const scaledProduct: BarcodeProduct = {
        ...product,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
        fiberG: scaled.fiberG ?? 0,
        servingSizeG: grams,
        portionSummary,
      };
      track(AnalyticsEvents.barcode_lookup, { barcode: scanned });
      onScan(scanned, scaledProduct);
      setScanned(null);
      setProduct(null);
      setGramsInput("100");
    }
  }, [scanned, product, scaled, grams, portionSummary, onScan]);

  const onManualSubmit = useCallback(() => {
    const cal = Number(manualCalories) || 0;
    if (!manualName.trim() || cal <= 0) return;
    const manualProduct: BarcodeProduct = {
      name: manualName.trim(),
      calories: Math.round(cal),
      protein: Math.round((Number(manualProtein) || 0) * 10) / 10,
      carbs: Math.round((Number(manualCarbs) || 0) * 10) / 10,
      fat: Math.round((Number(manualFat) || 0) * 10) / 10,
      fiberG: 0,
      servingSizeG: Number(manualServing) || 100,
    };
    onScan(scanned ?? "manual", manualProduct);
    // Reset
    setScanned(null);
    setProduct(null);
    setManualMode(false);
    setManualName("");
    setManualCalories("");
    setManualProtein("");
    setManualCarbs("");
    setManualFat("");
    setManualServing("100");
  }, [scanned, manualName, manualCalories, manualProtein, manualCarbs, manualFat, manualServing, onScan]);

  const openCorrectionMode = useCallback(() => {
    if (!product) return;
    setCorrName(product.name);
    setCorrCalories(String(product.calories));
    setCorrProtein(String(product.protein));
    setCorrCarbs(String(product.carbs));
    setCorrFat(String(product.fat));
    // F-20 — default to per-100g because that matches the DB contract
    // and the existing product fields we just copied in.
    setCorrBasis("per100g");
    setCorrServingG(
      product.servingSizeG && product.servingSizeG > 0
        ? String(Math.round(product.servingSizeG))
        : "",
    );
    setCorrectionMode(true);
  }, [product]);

  // F-20 — derived per-100g values from whatever basis the user picked.
  // Delegates to the pure `scaleCorrectionToPer100g` helper so mobile
  // and any future surface share the same rounding + validity rules.
  const corrPer100g = useMemo(
    () =>
      scaleCorrectionToPer100g({
        basis: corrBasis,
        calories: Number(corrCalories) || 0,
        protein: Number(corrProtein) || 0,
        carbs: Number(corrCarbs) || 0,
        fat: Number(corrFat) || 0,
        servingGrams: Number(corrServingG) || 0,
      }),
    [corrBasis, corrCalories, corrProtein, corrCarbs, corrFat, corrServingG],
  );

  const submitCorrection = useCallback(async () => {
    if (!scanned || !userId) return;
    if (!corrName.trim() || corrPer100g == null) return;
    setCorrSaving(true);
    const per100 = corrPer100g;
    const result = await submitFoodCorrection({
      barcode: scanned,
      name: corrName.trim(),
      calories: per100.calories,
      protein: per100.protein,
      carbs: per100.carbs,
      fat: per100.fat,
      userId,
    });
    setCorrSaving(false);
    if (result.ok) {
      // Update the product in place with corrected data (always stored
      // as per-100g so downstream scaling is consistent).
      const corrected: BarcodeProduct = {
        name: corrName.trim(),
        calories: per100.calories,
        protein: per100.protein,
        carbs: per100.carbs,
        fat: per100.fat,
        fiberG: product?.fiberG ?? 0,
        servingSizeG:
          corrBasis === "perServing" && Number(corrServingG) > 0
            ? Number(corrServingG)
            : (product?.servingSizeG ?? 100),
      };
      setProduct(corrected);
      setCorrectionMode(false);
      setGramsInput("100");
    }
  }, [scanned, userId, corrName, corrPer100g, corrBasis, corrServingG, product]);

  const onReset = useCallback(() => {
    setScanned(null);
    setProduct(null);
    setError(null);
    setManualMode(false);
    setCorrectionMode(false);
    setGramsInput("100");
  }, []);

  const handleClose = useCallback(() => {
    setScanned(null);
    setProduct(null);
    setError(null);
    setManualMode(false);
    setCorrectionMode(false);
    setGramsInput("100");
    onClose();
  }, [onClose]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    title: { fontSize: 18, fontWeight: "700", color: colors.text },
    centered: { alignItems: "center", justifyContent: "center", flex: 1, gap: Spacing.md, padding: Spacing.xl },
    permText: { color: colors.textSecondary, fontSize: 16, textAlign: "center" },
    permBtn: {
      backgroundColor: Accent.primary,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xxl,
      paddingVertical: 14,
    },
    permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    cameraWrap: { flex: 1, position: "relative" },
    camera: { flex: 1 },
    scanFrame: {
      position: "absolute",
      top: "25%",
      left: "10%",
      width: "80%",
      height: "50%",
      borderWidth: 2,
      borderColor: Accent.primary + "80",
      borderRadius: Radius.lg,
    },
    resultArea: { minHeight: 200, padding: Spacing.xl },
    lookupText: { color: colors.textSecondary, fontSize: 14 },
    errorText: { color: colors.textSecondary, fontSize: 14, textAlign: "center" },
    retryBtn: {
      borderWidth: 1,
      borderColor: Accent.primary + "55",
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
    },
    retryBtnText: { color: Accent.primary, fontWeight: "600" },
    productCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Accent.success + "40",
      padding: Spacing.lg,
      // F-18 (2026-04-19) — tighten vertical rhythm. `xs` between card
      // rows puts the chips closer to the Log button so the detected-
      // product card stops feeling tall below the camera preview.
      gap: Spacing.xs,
    },
    productName: { fontSize: 16, fontWeight: "600", color: colors.text },
    macroRow: { flexDirection: "row", gap: Spacing.lg },
    macroItem: { fontSize: 14, color: colors.textSecondary, fontWeight: "500" },
    per100g: { fontSize: 12, color: colors.textTertiary },
    servingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    servingLabel: { fontSize: 13, color: colors.textSecondary },
    servingInput: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 15,
      backgroundColor: colors.inputBg,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      minWidth: 56,
      textAlign: "center",
    },
    servingUnit: { fontSize: 13, color: colors.textSecondary },
    presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    presetChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Accent.primary + "40",
    },
    presetChipSelected: {
      backgroundColor: Accent.primary + "18",
      borderColor: Accent.primary,
    },
    presetChipText: { fontSize: 11, fontWeight: "600", color: Accent.primary },
    // F-18 (2026-04-19) — reduced top margin ~8px so the Log/Scan-again
    // pair sits tighter below the chip row.
    btnRow: { flexDirection: "row", gap: Spacing.md, marginTop: 0 },
    useBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      backgroundColor: Accent.success,
      borderRadius: Radius.md,
      paddingVertical: 14,
    },
    useBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    scanAgainBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
    },
    scanAgainText: { color: colors.textSecondary, fontWeight: "600" },
    hintText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      paddingTop: Spacing.lg,
    },
    // Manual entry styles
    manualCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    manualTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    manualSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: -4 },
    manualInput: {
      backgroundColor: colors.inputBg,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: colors.text,
      fontSize: 15,
    },
    manualInputRow: { flexDirection: "row", gap: Spacing.sm },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
      textTransform: "none",
    },
    manualSubmitBtn: {
      backgroundColor: Accent.primary,
      borderRadius: Radius.md,
      paddingVertical: 14,
      alignItems: "center",
    },
    manualSubmitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    manualEntryBtn: {
      borderWidth: 1,
      borderColor: Accent.primary + "55",
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
      marginTop: Spacing.xs,
    },
    manualEntryBtnText: { color: Accent.primary, fontWeight: "600", textAlign: "center" },
    // F-20 basis toggle — segmented-style chip row for Per 100 g / Per serving.
    basisRow: { flexDirection: "row", gap: Spacing.sm },
    basisChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      backgroundColor: colors.inputBg,
    },
    basisChipSelected: {
      borderColor: Accent.primary,
      backgroundColor: Accent.primary + "18",
    },
    basisChipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    basisChipTextSelected: { color: Accent.primary },
    basisReference: {
      fontSize: 12,
      color: colors.textTertiary,
      fontVariant: ["tabular-nums"],
    },
  }), [colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan Barcode</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {!permission?.granted ? (
          <View style={styles.centered}>
            <Ionicons name="camera-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.permText}>Camera access needed to scan barcodes</Text>
            <Pressable style={styles.permBtn} onPress={() => requestPermission()}>
              <Text style={styles.permBtnText}>Grant Permission</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.cameraWrap}>
              <BarcodeCameraView
                style={styles.camera}
                facing="back"
                barcodeScannerEnabled={!scanned}
                barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
                onBarcodeScanned={scanned ? undefined : onBarcode}
              />
              <View style={styles.scanFrame} />
            </View>

            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.resultArea}>
              {loading && (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={Accent.primary} />
                  <Text style={styles.lookupText}>Looking up product...</Text>
                </View>
              )}

              {error && !manualMode && (
                <View style={styles.centered}>
                  <Ionicons name="alert-circle" size={32} color={Accent.destructive} />
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable style={styles.retryBtn} onPress={onReset}>
                    <Text style={styles.retryBtnText}>Scan again</Text>
                  </Pressable>
                  <Pressable style={styles.manualEntryBtn} onPress={() => setManualMode(true)}>
                    <Text style={styles.manualEntryBtnText}>Enter manually instead</Text>
                  </Pressable>
                </View>
              )}

              {manualMode && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.manualCard}>
                      <Text style={styles.manualTitle}>Add Item Manually</Text>
                      <Text style={styles.manualSubtitle}>
                        {scanned ? `Barcode: ${scanned}` : "Enter the nutrition info from the label"}
                      </Text>
                      <TextInput
                        style={styles.manualInput}
                        placeholder="Food name"
                        placeholderTextColor={colors.textTertiary}
                        value={manualName}
                        onChangeText={setManualName}
                        autoFocus
                      />
                      <View style={styles.manualInputRow}>
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Calories"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualCalories}
                          onChangeText={setManualCalories}
                        />
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Serving (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualServing}
                          onChangeText={setManualServing}
                        />
                      </View>
                      <View style={styles.manualInputRow}>
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Protein (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualProtein}
                          onChangeText={setManualProtein}
                        />
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Carbs (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualCarbs}
                          onChangeText={setManualCarbs}
                        />
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Fat (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={manualFat}
                          onChangeText={setManualFat}
                        />
                      </View>
                      <Pressable
                        style={[styles.manualSubmitBtn, { opacity: manualName.trim() && Number(manualCalories) > 0 ? 1 : 0.4 }]}
                        onPress={onManualSubmit}
                        disabled={!manualName.trim() || !(Number(manualCalories) > 0)}
                      >
                        <Text style={styles.manualSubmitText}>Add to Tracker</Text>
                      </Pressable>
                      <Pressable style={styles.scanAgainBtn} onPress={onReset}>
                        <Text style={styles.scanAgainText}>Back to scanner</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              )}

              {product && scaled && !correctionMode && (
                <View style={styles.productCard}>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <View style={styles.macroRow}>
                    <Text style={styles.macroItem}>{Math.round(scaled.calories)} kcal</Text>
                    <Text style={styles.macroItem}>P: {Math.round(scaled.protein)}g</Text>
                    <Text style={styles.macroItem}>C: {Math.round(scaled.carbs)}g</Text>
                    <Text style={styles.macroItem}>F: {Math.round(scaled.fat)}g</Text>
                  </View>
                  {/* Serving size picker */}
                  <View style={styles.servingRow}>
                    <Text style={styles.servingLabel}>Amount:</Text>
                    <TextInput
                      style={styles.servingInput}
                      value={gramsInput}
                      onChangeText={setGramsInput}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      accessibilityLabel="Serving size in grams"
                    />
                    <Text style={styles.servingUnit}>g</Text>
                  </View>
                  {/* F-18 (2026-04-19) — simplified helper copy. The old
                      "macros scale from per 100 g" aside leaked internal
                      model onto the user; the chip row already tells them
                      what they need to know. */}
                  <Text style={[styles.per100g, { marginBottom: 2 }]}>Tap a chip or edit grams.</Text>
                  <View style={styles.presetRow}>
                    {(product.servingOptions ?? []).map((o) => {
                      const selected = Math.abs(o.grams - grams) < 0.51;
                      return (
                        <Pressable
                          key={`${o.label}-${o.grams}`}
                          style={[styles.presetChip, selected && styles.presetChipSelected]}
                          onPress={() => setGramsInput(String(o.grams))}
                        >
                          <Text style={styles.presetChipText}>{displayServingLabel(o.label, o.grams)}</Text>
                        </Pressable>
                      );
                    })}
                    {[50, 150, 200]
                      .filter(
                        (g) => !(product.servingOptions ?? []).some((o) => Math.abs(o.grams - g) < 0.51),
                      )
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
                  <View style={styles.btnRow}>
                    <Pressable style={styles.useBtn} onPress={onConfirm}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      {/* F-18 (2026-04-19) — replace nested-parens
                          "Log (1 serving (100 g))" with a mid-dot divider
                          so the serving context reads cleanly in one
                          pass. `portionSummary` is already collapsed via
                          `displayServingLabel` when the label is a
                          generic fallback. */}
                      <Text style={styles.useBtnText}>Log · {portionSummary}</Text>
                    </Pressable>
                    <Pressable style={styles.scanAgainBtn} onPress={onReset}>
                      <Text style={styles.scanAgainText}>Scan again</Text>
                    </Pressable>
                  </View>
                  {/* "This is wrong" link */}
                  <Pressable onPress={openCorrectionMode} style={{ alignItems: "center", paddingTop: Spacing.xs }}>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, textDecorationLine: "underline" }}>This is wrong — edit and update</Text>
                  </Pressable>
                </View>
              )}

              {/* Correction mode — edit scanned product and save to DB */}
              {product && correctionMode && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.manualCard}>
                      <Text style={styles.manualTitle}>Correct This Product</Text>
                      <Text style={styles.manualSubtitle}>
                        Update the nutrition info — your correction helps everyone.
                      </Text>
                      <TextInput
                        style={styles.manualInput}
                        placeholder="Product name"
                        placeholderTextColor={colors.textTertiary}
                        value={corrName}
                        onChangeText={setCorrName}
                        autoFocus
                      />

                      {/* F-20 — basis toggle. Mirrors the Custom Food
                          "Per 100 g / Per serving" convention so users
                          don't have to relearn the model across the two
                          entry surfaces. */}
                      <View style={styles.basisRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: corrBasis === "per100g" }}
                          accessibilityLabel="Enter nutrition per 100 g"
                          onPress={() => setCorrBasis("per100g")}
                          style={[
                            styles.basisChip,
                            corrBasis === "per100g" && styles.basisChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.basisChipText,
                              corrBasis === "per100g" && styles.basisChipTextSelected,
                            ]}
                          >
                            Per 100 g
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: corrBasis === "perServing" }}
                          accessibilityLabel="Enter nutrition per serving"
                          onPress={() => setCorrBasis("perServing")}
                          style={[
                            styles.basisChip,
                            corrBasis === "perServing" && styles.basisChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.basisChipText,
                              corrBasis === "perServing" && styles.basisChipTextSelected,
                            ]}
                          >
                            Per serving
                          </Text>
                        </Pressable>
                      </View>

                      {/* F-20 — serving-size input appears only in the
                          per-serving branch. Required when per-serving is
                          active (submit stays disabled until > 0). */}
                      {/* F-22 (2026-04-21): persistent labels above each
                          field. Placeholders disappear on first keystroke so
                          users lost context on which cell is calories/protein
                          (TestFlight AJlhpO020UK-). */}
                      {corrBasis === "perServing" && (
                        <View>
                          <Text style={styles.fieldLabel}>Serving size (g)</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="e.g. 16"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrServingG}
                            onChangeText={setCorrServingG}
                            accessibilityLabel="Serving size in grams"
                          />
                        </View>
                      )}

                      <View style={styles.manualInputRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>{corrBasis === "perServing" ? "Calories (kcal / serving)" : "Calories (kcal / 100 g)"}</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="kcal"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrCalories}
                            onChangeText={setCorrCalories}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Protein (g)</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrProtein}
                            onChangeText={setCorrProtein}
                          />
                        </View>
                      </View>
                      <View style={styles.manualInputRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Carbs (g)</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrCarbs}
                            onChangeText={setCorrCarbs}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Fat (g)</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrFat}
                            onChangeText={setCorrFat}
                          />
                        </View>
                      </View>

                      {/* F-20 — live per-100g reference so the user can
                          sanity-check that what they typed maps to a
                          sensible per-100g figure. Only shown for the
                          per-serving branch where the scaling is
                          non-identity. */}
                      {corrBasis === "perServing" && corrPer100g != null && (
                        <Text
                          accessibilityLiveRegion="polite"
                          style={styles.basisReference}
                        >
                          = {corrPer100g.calories} kcal / 100 g
                        </Text>
                      )}

                      <Pressable
                        style={[
                          styles.manualSubmitBtn,
                          { opacity: corrName.trim() && corrPer100g != null ? 1 : 0.4 },
                        ]}
                        onPress={submitCorrection}
                        disabled={!corrName.trim() || corrPer100g == null || corrSaving}
                      >
                        <Text style={styles.manualSubmitText}>{corrSaving ? "Saving..." : "Save Correction"}</Text>
                      </Pressable>
                      <Pressable style={styles.scanAgainBtn} onPress={() => setCorrectionMode(false)}>
                        <Text style={styles.scanAgainText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              )}

              {!loading && !error && !product && !manualMode && (
                <Text style={styles.hintText}>
                  Point your camera at a barcode on any food product
                </Text>
              )}
            </View>
            </TouchableWithoutFeedback>
          </>
        )}
      </View>
    </Modal>
  );
}
