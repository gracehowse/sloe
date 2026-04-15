import { useCallback, useMemo, useState } from "react";
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
  const grams = Math.max(1, parseInt(gramsInput, 10) || 100);

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

  const onConfirm = useCallback(() => {
    if (scanned && product && scaled) {
      // Pass a scaled product to the parent
      const scaledProduct: BarcodeProduct = {
        ...product,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
        fiberG: scaled.fiberG ?? 0,
        servingSizeG: grams,
      };
      onScan(scanned, scaledProduct);
      setScanned(null);
      setProduct(null);
      setGramsInput("100");
    }
  }, [scanned, product, scaled, grams, onScan]);

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
    setCorrectionMode(true);
  }, [product]);

  const submitCorrection = useCallback(async () => {
    if (!scanned || !userId) return;
    const cal = Number(corrCalories) || 0;
    if (!corrName.trim() || cal <= 0) return;
    setCorrSaving(true);
    const result = await submitFoodCorrection({
      barcode: scanned,
      name: corrName.trim(),
      calories: Math.round(cal),
      protein: Math.round((Number(corrProtein) || 0) * 10) / 10,
      carbs: Math.round((Number(corrCarbs) || 0) * 10) / 10,
      fat: Math.round((Number(corrFat) || 0) * 10) / 10,
      userId,
    });
    setCorrSaving(false);
    if (result.ok) {
      // Update the product in place with corrected data
      const corrected: BarcodeProduct = {
        name: corrName.trim(),
        calories: Math.round(cal),
        protein: Math.round((Number(corrProtein) || 0) * 10) / 10,
        carbs: Math.round((Number(corrCarbs) || 0) * 10) / 10,
        fat: Math.round((Number(corrFat) || 0) * 10) / 10,
        fiberG: product?.fiberG ?? 0,
        servingSizeG: product?.servingSizeG ?? 100,
      };
      setProduct(corrected);
      setCorrectionMode(false);
      setGramsInput("100");
    }
  }, [scanned, userId, corrName, corrCalories, corrProtein, corrCarbs, corrFat, product]);

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
      padding: Spacing.xl,
      gap: Spacing.sm,
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
    presetRow: { flexDirection: "row", gap: 6 },
    presetChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Accent.primary + "40",
    },
    presetChipText: { fontSize: 11, fontWeight: "600", color: Accent.primary },
    btnRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm },
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
                    <Text style={styles.servingLabel}>Serving:</Text>
                    <TextInput
                      style={styles.servingInput}
                      value={gramsInput}
                      onChangeText={setGramsInput}
                      keyboardType="numeric"
                      selectTextOnFocus
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      accessibilityLabel="Serving size in grams"
                    />
                    <Text style={styles.servingUnit}>g</Text>
                  </View>
                  {/* Quick presets */}
                  <View style={styles.presetRow}>
                    {[50, 100, 150, 200].map((g) => (
                      <Pressable key={g} style={styles.presetChip} onPress={() => setGramsInput(String(g))}>
                        <Text style={styles.presetChipText}>{g}g</Text>
                      </Pressable>
                    ))}
                    {product.servingSizeG && product.servingSizeG > 0 && product.servingSizeG !== 100 && (
                      <Pressable style={styles.presetChip} onPress={() => setGramsInput(String(Math.round(product.servingSizeG!)))}>
                        <Text style={styles.presetChipText}>1 serving</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.btnRow}>
                    <Pressable style={styles.useBtn} onPress={onConfirm}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.useBtnText}>Log {grams}g</Text>
                    </Pressable>
                    <Pressable style={styles.scanAgainBtn} onPress={onReset}>
                      <Text style={styles.scanAgainText}>Scan again</Text>
                    </Pressable>
                  </View>
                  {/* "This is wrong" link */}
                  <Pressable onPress={openCorrectionMode} style={{ alignItems: "center", paddingTop: Spacing.xs }}>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, textDecorationLine: "underline" }}>This is wrong — edit &amp; update</Text>
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
                      <View style={styles.manualInputRow}>
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Calories (per 100g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={corrCalories}
                          onChangeText={setCorrCalories}
                        />
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Protein (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={corrProtein}
                          onChangeText={setCorrProtein}
                        />
                      </View>
                      <View style={styles.manualInputRow}>
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Carbs (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={corrCarbs}
                          onChangeText={setCorrCarbs}
                        />
                        <TextInput
                          style={[styles.manualInput, { flex: 1 }]}
                          placeholder="Fat (g)"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                          value={corrFat}
                          onChangeText={setCorrFat}
                        />
                      </View>
                      <Pressable
                        style={[styles.manualSubmitBtn, { opacity: corrName.trim() && Number(corrCalories) > 0 ? 1 : 0.4 }]}
                        onPress={submitCorrection}
                        disabled={!corrName.trim() || !(Number(corrCalories) > 0) || corrSaving}
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
