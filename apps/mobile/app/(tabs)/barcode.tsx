import { useCallback, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";

import { lookupBarcode, scaleMacros, submitFoodCorrection, type BarcodeProduct } from "@/lib/verifyRecipe";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Spacing, Radius, Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { dateKeyFromDate, newMealId } from "@/lib/nutritionJournal";

export default function BarcodeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [permission, requestPermission] = useCameraPermissions();
  const [last, setLast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gramsInput, setGramsInput] = useState("100");
  const [logging, setLogging] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");

  // Correction mode state (edit scanned product data and save to DB)
  const [correctionMode, setCorrectionMode] = useState(false);
  const [corrName, setCorrName] = useState("");
  const [corrCalories, setCorrCalories] = useState("");
  const [corrProtein, setCorrProtein] = useState("");
  const [corrCarbs, setCorrCarbs] = useState("");
  const [corrFat, setCorrFat] = useState("");
  const [corrSaving, setCorrSaving] = useState(false);

  const grams = Math.max(1, parseInt(gramsInput, 10) || 100);

  const scaled = useMemo(() => {
    if (!product) return null;
    return scaleMacros(
      { calories: product.calories, protein: product.protein, carbs: product.carbs, fat: product.fat, fiberG: product.fiberG },
      grams,
    );
  }, [product, grams]);

  const onBarcode = useCallback(
    async (e: { data: string }) => {
      if (loading || last === e.data) return;
      setLast(e.data);
      setLoading(true);
      setError(null);
      setProduct(null);
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
        setError("Product not found. Try a different barcode or enter it manually.");
      }
    },
    [loading, last],
  );

  const handleLog = useCallback(async () => {
    if (!scaled || !product || !userId) {
      if (!userId) Alert.alert("Sign in", "Sign in to log food to your tracker.");
      return;
    }
    setLogging(true);
    const dateKey = dateKeyFromDate(new Date());
    const mealId = newMealId();
    const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const { error: dbErr } = await supabase.from("nutrition_entries").insert({
      id: mealId,
      user_id: userId,
      date_key: dateKey,
      name: "Snack",
      recipe_title: product.name,
      time_label: timeLabel,
      calories: Math.min(32767, Math.round(scaled.calories)),
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      fiber_g: scaled.fiberG ?? null,
      portion_multiplier: 1,
      source: "Open Food Facts",
    });
    setLogging(false);
    if (dbErr) {
      Alert.alert("Could not log", dbErr.message);
    } else {
      Alert.alert("Logged", `${product.name} (${grams}g) added to today's tracker.`, [
        { text: "Scan another", onPress: () => { setLast(null); setProduct(null); setError(null); } },
        { text: "Go to tracker", onPress: () => router.push("/(tabs)/index" as Href) },
      ]);
    }
  }, [scaled, product, userId, grams, router]);

  const handleManualLog = useCallback(async () => {
    const cal = Number(manualCalories) || 0;
    if (!manualName.trim() || cal <= 0 || !userId) {
      if (!userId) Alert.alert("Sign in", "Sign in to log food to your tracker.");
      return;
    }
    setLogging(true);
    const dateKey = dateKeyFromDate(new Date());
    const mealId = newMealId();
    const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const { error: dbErr } = await supabase.from("nutrition_entries").insert({
      id: mealId,
      user_id: userId,
      date_key: dateKey,
      name: "Snack",
      recipe_title: manualName.trim(),
      time_label: timeLabel,
      calories: Math.min(32767, Math.round(cal)),
      protein: Math.round((Number(manualProtein) || 0) * 10) / 10,
      carbs: Math.round((Number(manualCarbs) || 0) * 10) / 10,
      fat: Math.round((Number(manualFat) || 0) * 10) / 10,
      portion_multiplier: 1,
      source: "Manual barcode entry",
    });
    setLogging(false);
    if (dbErr) {
      Alert.alert("Could not log", dbErr.message);
    } else {
      Alert.alert("Logged", `${manualName.trim()} added to today's tracker.`, [
        { text: "Scan another", onPress: () => { setLast(null); setProduct(null); setError(null); setManualMode(false); setManualName(""); setManualCalories(""); setManualProtein(""); setManualCarbs(""); setManualFat(""); } },
        { text: "Go to tracker", onPress: () => router.push("/(tabs)/index" as Href) },
      ]);
    }
  }, [manualName, manualCalories, manualProtein, manualCarbs, manualFat, userId, router]);

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
      };
      setProduct(corrected);
      setCorrectionMode(false);
      setGramsInput("100");
    }
  }, [last, userId, corrName, corrCalories, corrProtein, corrCarbs, corrFat, product]);

  const resetScan = useCallback(() => {
    setLast(null);
    setProduct(null);
    setError(null);
    setManualMode(false);
    setCorrectionMode(false);
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        fill: { flex: 1, backgroundColor: colors.background },
        camera: { flex: 1 },
        reticle: {
          position: "absolute",
          top: "25%",
          left: "10%",
          width: "80%",
          height: "30%",
          borderWidth: 2,
          borderColor: Accent.primary + "80",
          borderRadius: Radius.lg,
        },
        overlay: {
          position: "absolute",
          left: Spacing.lg,
          right: Spacing.lg,
          bottom: insets.bottom + Spacing.lg,
          padding: Spacing.xl,
          borderRadius: Radius.lg,
          backgroundColor: Colors.dark.overlay,
          gap: Spacing.sm,
        },
        overlayTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
        hint: { color: Colors.dark.textSecondary, fontSize: 13 },
        dim: { color: Colors.dark.textTertiary },
        centered: { flex: 1, padding: Spacing.xl, justifyContent: "center", alignItems: "center", gap: Spacing.md },
        permIcon: { marginBottom: Spacing.sm },
        permText: { color: colors.textSecondary, fontSize: 16, textAlign: "center", maxWidth: 280 },
        permBtn: {
          backgroundColor: Accent.primary,
          paddingHorizontal: Spacing.xxl,
          paddingVertical: 14,
          borderRadius: Radius.md,
        },
        permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
        productName: { color: "#fff", fontWeight: "700", fontSize: 16, textAlign: "center" },
        macroRow: { flexDirection: "row", justifyContent: "center", gap: Spacing.lg },
        macroChip: { alignItems: "center" },
        macroValue: { color: "#fff", fontWeight: "700", fontSize: 14 },
        macroLabel: { color: Colors.dark.textTertiary, fontSize: 11 },
        source: { color: Colors.dark.textTertiary, fontSize: 11, textAlign: "center" },
        servingRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
        },
        servingLabel: { color: Colors.dark.textSecondary, fontSize: 13 },
        servingInput: {
          color: "#fff",
          fontWeight: "600",
          fontSize: 15,
          backgroundColor: "rgba(255,255,255,0.12)",
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 4,
          minWidth: 56,
          textAlign: "center",
        },
        servingUnit: { color: Colors.dark.textSecondary, fontSize: 13 },
        btnRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
        logBtn: {
          flex: 2,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
          backgroundColor: Accent.success,
          borderRadius: Radius.md,
          paddingVertical: 14,
        },
        logBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
        secondaryBtn: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.2)",
          paddingVertical: 14,
        },
        secondaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
        errorIcon: { marginBottom: Spacing.xs },
        errorText: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: "center", maxWidth: 260 },
        retryBtn: {
          borderWidth: 1,
          borderColor: Accent.primary + "55",
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.xl,
          paddingVertical: 12,
          marginTop: Spacing.sm,
        },
        retryBtnText: { color: Accent.primary, fontWeight: "600" },
        manualEntryBtn: {
          borderWidth: 1,
          borderColor: Accent.primary + "55",
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.xl,
          paddingVertical: 12,
          marginTop: Spacing.xs,
        },
        manualEntryBtnText: { color: Accent.primary, fontWeight: "600" },
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
        manualTitle: { color: "#fff", fontWeight: "700", fontSize: 18 },
        manualSub: { color: Colors.dark.textSecondary, fontSize: 13, marginTop: -4 },
        manualInput: {
          backgroundColor: "rgba(255,255,255,0.12)",
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          color: "#fff",
          fontSize: 15,
        },
        manualInputRow: { flexDirection: "row", gap: Spacing.sm },
        corrLink: { color: Accent.primary, fontSize: 13, textDecorationLine: "underline" as const, textAlign: "center" as const, paddingTop: Spacing.xs },
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
        corrTitle: { color: "#fff", fontWeight: "700" as const, fontSize: 18 },
        corrSub: { color: Colors.dark.textSecondary, fontSize: 13, marginTop: -4 },
      }),
    [colors, insets.bottom],
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Accent.primary} />
        <Text style={styles.permText}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={48} color={colors.textSecondary} style={styles.permIcon} />
        <Text style={styles.permText}>
          Platemate needs your camera to scan product barcodes and look up nutrition info.
        </Text>
        <Pressable style={styles.permBtn} onPress={() => void requestPermission()} accessibilityLabel="Grant camera permission">
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <BarcodeCameraView
        style={styles.camera}
        facing="back"
        barcodeScannerEnabled={!product && !manualMode && !correctionMode}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
        onBarcodeScanned={product || manualMode || correctionMode ? undefined : onBarcode}
      />

      {!product && <View style={styles.reticle} />}

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.overlay}>
        {loading && (
          <>
            <ActivityIndicator size="small" color={Accent.primary} />
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
            <Text style={styles.source}>
              {product.verified ? "✓ Verified" : product.source === "user" ? "Community submitted" : "via Open Food Facts"}
            </Text>
            <View style={styles.btnRow}>
              <Pressable
                style={styles.logBtn}
                onPress={handleLog}
                disabled={logging}
                accessibilityLabel={`Log ${product.name} to tracker`}
              >
                {logging ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="add-circle" size={20} color="#fff" />
                )}
                <Text style={styles.logBtnText}>{logging ? "Logging…" : "Log to Tracker"}</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={resetScan} accessibilityLabel="Scan another barcode">
                <Text style={styles.secondaryBtnText}>Scan again</Text>
              </Pressable>
            </View>
            {/* "This is wrong" link */}
            <Pressable onPress={openCorrectionMode} style={{ alignItems: "center", paddingTop: Spacing.xs }}>
              <Text style={styles.corrLink}>This is wrong — edit &amp; update</Text>
            </Pressable>
          </>
        )}

        {error && !manualMode && (
          <>
            <Ionicons name="alert-circle" size={32} color={Accent.destructive} style={styles.errorIcon} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={resetScan} accessibilityLabel="Try scanning again">
              <Text style={styles.retryBtnText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.manualEntryBtn} onPress={() => setManualMode(true)}>
              <Text style={styles.manualEntryBtnText}>Enter manually instead</Text>
            </Pressable>
          </>
        )}

        {!loading && !product && !error && !manualMode && (
          <>
            <Text style={styles.overlayTitle}>Barcode Scanner</Text>
            <Text style={styles.hint}>Point at a product barcode to look up nutrition</Text>
          </>
        )}
      </View>
      </TouchableWithoutFeedback>

      {/* Manual entry overlay */}
      {manualMode && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.manualOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md, paddingBottom: insets.bottom + 40 }}>
            <Text style={styles.manualTitle}>Add Item Manually</Text>
            <Text style={styles.manualSub}>
              {last ? `Barcode: ${last}` : "Enter the nutrition info from the label"}
            </Text>
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
            <Pressable
              style={[styles.logBtn, { opacity: manualName.trim() && Number(manualCalories) > 0 ? 1 : 0.4 }]}
              onPress={handleManualLog}
              disabled={!manualName.trim() || !(Number(manualCalories) > 0) || logging}
            >
              {logging ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="add-circle" size={20} color="#fff" />
              )}
              <Text style={styles.logBtnText}>{logging ? "Logging..." : "Add to Tracker"}</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={resetScan}>
              <Text style={styles.secondaryBtnText}>Back to scanner</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Correction overlay */}
      {correctionMode && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.corrOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md, paddingBottom: insets.bottom + 40 }}>
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
