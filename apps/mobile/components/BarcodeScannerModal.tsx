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
import { clampRememberedToServingOptions, getRememberedPortion, recordPortion } from "@/lib/barcodePortionMemory";

type Props = {
  visible: boolean;
  onScan: (barcode: string, product: BarcodeProduct) => void;
  onClose: () => void;
  /**
   * Audit 2026-04-30 (Lose It "Closer" parity, Fix 2). When a barcode
   * resolves to "not found", surface a primary "Snap the label
   * instead" CTA that hands off to the AI photo-log path. The host
   * is responsible for closing this scanner and opening
   * `<PhotoLogSheet>` (so Pro gating + analytics stay in one place).
   * Optional — when omitted the fallback button is hidden and the
   * legacy "Enter manually instead" button stays primary.
   */
  onPhotoFallback?: () => void;
};

export default function BarcodeScannerModal({ visible, onScan, onClose, onPhotoFallback }: Props) {
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
  // Audit/2026-04-30 — when this barcode has been logged before,
  // surface "You usually log {n} g — using that" near the picker.
  const [rememberedPortion, setRememberedPortion] = useState<number | null>(null);
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
  // F-28 (2026-04-21): fiber correction — DB already has `fiber_g`, just
  // wasn't exposed in the form.
  // F-30 (2026-04-21): sugar / sodium / saturated fat — added via migration
  // 20260430100000_user_foods_micros.sql. Empty/zero inputs are dropped from
  // the upsert payload to stay compatible with pre-migration projects.
  const [corrFiber, setCorrFiber] = useState("");
  const [corrSugar, setCorrSugar] = useState("");
  const [corrSodium, setCorrSodium] = useState("");
  const [corrSatFat, setCorrSatFat] = useState("");
  const [corrSaving, setCorrSaving] = useState(false);
  // F-138 (`AcUlNw_4ZTCMGcjmETcQUaJ`, 2026-05-08): post-submit success state.
  // Pre-fix the form silently closed after Save Correction → users had no
  // confirmation their submission was received. We don't claim "verified by
  // team" because there's no live verification pipeline producing verified
  // rows yet (schema exists, workflow doesn't). Honest copy: it applies to
  // your scans now and goes into the review queue for everyone else.
  const [corrSubmitted, setCorrSubmitted] = useState(false);
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
        // Audit/2026-04-30 — barcode portion memory.
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

  // F-135 (`ADU-JU-1zRIm2WQBeovKEjA`, 2026-05-08): "11.33 rice papers"
  // chip uses absurd decimal precision. When the leading number on a
  // count label has a small fractional residual (e.g. 11.03 / 11.97),
  // collapse to the integer. Keeps meaningful halves (1.5 cups,
  // 0.5 tablespoon) intact via the > 0.1 && < 0.9 guard.
  const TIDY_COUNT_LABEL_RE = /^(\d+)\.(\d+)(\s+\S.*)$/;
  const tidyDecimalCount = useCallback((label: string): string => {
    const m = TIDY_COUNT_LABEL_RE.exec(label.trim());
    if (!m) return label;
    const intPart = Number(m[1]);
    const frac = Number(`0.${m[2]}`);
    if (!Number.isFinite(intPart) || !Number.isFinite(frac)) return label;
    if (frac < 0.1) return `${intPart}${m[3]}`;
    if (frac > 0.9) return `${intPart + 1}${m[3]}`;
    return label;
  }, []);

  const displayServingLabel = useCallback((label: string, grams: number): string => {
    if (GENERIC_1_SERVING_LABEL.test(label.trim())) {
      return `${Math.round(grams)} g`;
    }
    return tidyDecimalCount(label);
  }, [tidyDecimalCount]);

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
      // Audit/2026-04-30 — remember this portion for the next scan.
      // The host LogSheet does the actual nutrition_entries insert
      // (and runs `writeMealToHealthKitIfEnabled` when wired); the
      // memory only needs the barcode + grams the user committed to.
      void recordPortion(scanned, grams);
      onScan(scanned, scaledProduct);
      setScanned(null);
      setProduct(null);
      setGramsInput("100");
      setRememberedPortion(null);
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
    setCorrFiber(product.fiberG != null ? String(product.fiberG) : "");
    setCorrSugar(product.sugarG != null ? String(product.sugarG) : "");
    setCorrSodium(product.sodiumMg != null ? String(product.sodiumMg) : "");
    setCorrSatFat(product.saturatedFatG != null ? String(product.saturatedFatG) : "");
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
    // F-28 + F-30 — micros are entered per the user's chosen basis (same as
    // macros) and scaled to per-100g using the serving-size when basis=perServing.
    const scaleMicro = (val: number, roundTo: 0 | 1): number => {
      const factor = roundTo === 0 ? 1 : 10;
      if (corrBasis === "perServing" && Number(corrServingG) > 0) {
        return Math.round(((val / Number(corrServingG)) * 100) * factor) / factor;
      }
      return Math.round(val * factor) / factor;
    };
    const fiberPer100g = scaleMicro(Number(corrFiber) || 0, 1);
    const sugarPer100g = scaleMicro(Number(corrSugar) || 0, 1);
    const sodiumPer100g = scaleMicro(Number(corrSodium) || 0, 0); // mg, whole numbers
    const satFatPer100g = scaleMicro(Number(corrSatFat) || 0, 1);
    const result = await submitFoodCorrection({
      barcode: scanned,
      name: corrName.trim(),
      calories: per100.calories,
      protein: per100.protein,
      carbs: per100.carbs,
      fat: per100.fat,
      fiberG: fiberPer100g > 0 ? fiberPer100g : undefined,
      sugarG: sugarPer100g > 0 ? sugarPer100g : undefined,
      sodiumMg: sodiumPer100g > 0 ? sodiumPer100g : undefined,
      saturatedFatG: satFatPer100g > 0 ? satFatPer100g : undefined,
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
        fiberG: fiberPer100g > 0 ? fiberPer100g : (product?.fiberG ?? 0),
        sugarG: sugarPer100g > 0 ? sugarPer100g : (product?.sugarG ?? null),
        sodiumMg: sodiumPer100g > 0 ? sodiumPer100g : (product?.sodiumMg ?? null),
        saturatedFatG: satFatPer100g > 0 ? satFatPer100g : (product?.saturatedFatG ?? null),
        servingSizeG:
          corrBasis === "perServing" && Number(corrServingG) > 0
            ? Number(corrServingG)
            : (product?.servingSizeG ?? 100),
      };
      setProduct(corrected);
      // F-138 — show success state in place of the form. User taps Done
      // to dismiss back to the product card with their corrected values.
      setCorrSubmitted(true);
    }
  }, [scanned, userId, corrName, corrPer100g, corrBasis, corrServingG, product]);

  const onReset = useCallback(() => {
    setScanned(null);
    setProduct(null);
    setError(null);
    setManualMode(false);
    setCorrectionMode(false);
    setCorrSubmitted(false);
    setGramsInput("100");
    setRememberedPortion(null);
  }, []);

  const handleClose = useCallback(() => {
    setScanned(null);
    setProduct(null);
    setError(null);
    setManualMode(false);
    setCorrectionMode(false);
    setCorrSubmitted(false);
    setGramsInput("100");
    setRememberedPortion(null);
    onClose();
  }, [onClose]);

  // F-138 — dismiss the success state back to the product card with the
  // user's corrected values applied (already set by submitCorrection).
  const handleCorrectionDone = useCallback(() => {
    setCorrSubmitted(false);
    setCorrectionMode(false);
    setGramsInput("100");
  }, []);

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
    // F-134 (2026-05-08): when the camera collapses on result, the
    // resultArea takes over the freed space so content doesn't float
    // at the top of the screen with a big empty void below.
    resultArea: { flex: 1, minHeight: 200, padding: Spacing.xl },
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
    // Audit 2026-04-30 — primary "Snap the label instead" CTA in the
    // not-found branch. Filled tint marks it as the recommended next
    // step; manual entry stays one tap away as a tinted-border ghost.
    photoFallbackBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      backgroundColor: Accent.primary,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
    },
    photoFallbackBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
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
    // F-138 — post-submit success card (replaces the form, not the whole
    // sheet). White-card + soft success ring + Done button. Mirrors the
    // F-139 goals-hit banner restyle so the language stays consistent
    // across the product.
    correctionSuccessCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Accent.success + "40",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.xxl,
      alignItems: "center",
      gap: Spacing.md,
    },
    correctionSuccessIconRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: Accent.success + "18",
      alignItems: "center",
      justifyContent: "center",
    },
    correctionSuccessTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    correctionSuccessBody: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: "center",
    },
    correctionSuccessDoneBtn: {
      marginTop: Spacing.sm,
      backgroundColor: Accent.success,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xxl,
      paddingVertical: 14,
      alignSelf: "stretch",
      alignItems: "center",
    },
    correctionSuccessDoneText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    basisReference: {
      fontSize: 12,
      color: colors.textTertiary,
      fontVariant: ["tabular-nums"],
    },
  }), [colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
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
            {/*
              F-134 (`AH2YKLI84Fc` + 3 siblings, 2026-05-08): hide the
              camera + scanFrame entirely when there's any result state
              (loading / error / product / manualMode / correctionMode).
              Pre-fix the camera kept rendering as a thin strip when the
              productCard pushed up; the absolute-positioned `scanFrame`
              (top:25%, height:50% of cameraWrap) became a tiny floating
              rounded rectangle above the result — Grace called this
              "everything is overlapping and ugly" on 4 of 11 build-44
              screenshots. Once the user has a result, the camera adds
              no value (scanning is disabled via `!scanned`); collapsing
              the area gives the result the full surface.
            */}
            {!scanned && !manualMode && !correctionMode && (
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
            )}

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
                  {/* F-136 (`AG5LqMGUpER2Gqi5N03_ytc`, 2026-05-08): the
                      "Product not found" branch isn't a real error — it
                      surfaces information ("we don't have this in our
                      DB yet"). Pre-fix used red `alert-circle` icon,
                      which read as a failure to the tester. Use a
                      neutral information icon for the not-found case;
                      keep the red destructive icon for genuine
                      errors (network, etc.) where the raw `error`
                      string is shown. */}
                  {error === "Product not found in database." ? (
                    <Ionicons name="search-outline" size={32} color={Accent.primary} />
                  ) : (
                    <Ionicons name="alert-circle" size={32} color={Accent.destructive} />
                  )}
                  {/* Audit 2026-04-30 — friendlier "not found" copy. */}
                  <Text style={styles.errorText}>
                    {error === "Product not found in database."
                      ? "We don't have this product yet."
                      : error}
                  </Text>
                  {/* F-136: 3-CTA decision fatigue — "Snap the label"
                      (primary, recommended), "Enter manually" (kept as
                      secondary text-link below). "Scan again" demoted
                      to a tertiary chevron-style link since the user
                      already knows the barcode wasn't found, and
                      re-scanning the same item won't help. */}
                  {onPhotoFallback ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Snap the label instead"
                      testID="barcode-not-found-photo-fallback"
                      style={styles.photoFallbackBtn}
                      onPress={() => {
                        onReset();
                        onPhotoFallback();
                      }}
                    >
                      <Ionicons name="camera" size={18} color="#fff" />
                      <Text style={styles.photoFallbackBtnText}>Snap the label instead</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => setManualMode(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Enter manually instead"
                    style={{ paddingTop: Spacing.md }}
                  >
                    <Text style={{ color: Accent.primary, fontSize: 13, fontWeight: "600" }}>
                      Enter manually
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onReset}
                    accessibilityRole="button"
                    accessibilityLabel="Scan a different barcode"
                    style={{ paddingTop: Spacing.xs }}
                  >
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                      Scan a different barcode
                    </Text>
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
                  {rememberedPortion != null && rememberedPortion > 0 ? (
                    <Text style={[styles.per100g, { marginBottom: 2, color: Accent.primary }]}>
                      You usually log {Math.round(rememberedPortion)} g — using that.
                    </Text>
                  ) : (
                    <Text style={[styles.per100g, { marginBottom: 2 }]}>Tap a chip or edit grams.</Text>
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
                          generic fallback.
                          F-135 (2026-05-08): strip the "(~Ng)" parenthetical
                          from the button (the Amount field above already
                          shows grams) so long labels like
                          "1 rice paper (~9 g)" don't wrap mid-word.
                          numberOfLines + ellipsizeMode is the safety net. */}
                      <Text
                        style={styles.useBtnText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        Log · {portionSummary.replace(/\s*\(~?[\d.]+\s*g\)\s*$/, "")}
                      </Text>
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
              {product && correctionMode && corrSubmitted && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.correctionSuccessCard}>
                      <View style={styles.correctionSuccessIconRing}>
                        <Ionicons name="checkmark-circle" size={48} color={Accent.success} />
                      </View>
                      <Text style={styles.correctionSuccessTitle}>Correction saved</Text>
                      <Text style={styles.correctionSuccessBody}>
                        Your numbers apply to your scans of this barcode now.
                        We{"’"}re building out a review process — once it{"’"}s
                        live, the best corrections will roll out to everyone.
                      </Text>
                      <Pressable
                        style={styles.correctionSuccessDoneBtn}
                        onPress={handleCorrectionDone}
                        accessibilityRole="button"
                        accessibilityLabel="Done"
                      >
                        <Text style={styles.correctionSuccessDoneText}>Done</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              )}
              {product && correctionMode && !corrSubmitted && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.manualCard}>
                      <Text style={styles.manualTitle}>Correct This Product</Text>
                      <Text style={styles.manualSubtitle}>
                        Help us build a better database. Your numbers will
                        apply to your scans straight away.
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
                      <View style={styles.manualInputRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Fiber (g) — optional</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrFiber}
                            onChangeText={setCorrFiber}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Sugar (g) — optional</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrSugar}
                            onChangeText={setCorrSugar}
                          />
                        </View>
                      </View>
                      <View style={styles.manualInputRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Sodium (mg) — optional</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="mg"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrSodium}
                            onChangeText={setCorrSodium}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Saturated fat (g) — optional</Text>
                          <TextInput
                            style={styles.manualInput}
                            placeholder="g"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            value={corrSatFat}
                            onChangeText={setCorrSatFat}
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
