import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import { BarcodeCameraView } from "@/components/BarcodeCameraView";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";

import { lookupBarcode, scaleMacros, type BarcodeProduct } from "@/lib/verifyRecipe";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Neon, Spacing, Radius, Colors } from "@/constants/theme";
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

  const resetScan = useCallback(() => {
    setLast(null);
    setProduct(null);
    setError(null);
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
          borderColor: Neon.violet + "80",
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
          backgroundColor: Neon.violet,
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
          backgroundColor: Neon.green,
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
          borderColor: Neon.violet + "55",
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.xl,
          paddingVertical: 12,
          marginTop: Spacing.sm,
        },
        retryBtnText: { color: Neon.violet, fontWeight: "600" },
      }),
    [colors, insets.bottom],
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Neon.violet} />
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
        barcodeScannerEnabled={!product}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
        onBarcodeScanned={product ? undefined : onBarcode}
      />

      {!product && <View style={styles.reticle} />}

      <View style={styles.overlay}>
        {loading && (
          <>
            <ActivityIndicator size="small" color={Neon.violet} />
            <Text style={styles.hint}>Looking up product…</Text>
          </>
        )}

        {product && scaled && (
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
                accessibilityLabel="Serving size in grams"
              />
              <Text style={styles.servingUnit}>g</Text>
            </View>
            <Text style={styles.source}>via Open Food Facts</Text>
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
          </>
        )}

        {error && (
          <>
            <Ionicons name="alert-circle" size={32} color={Neon.red} style={styles.errorIcon} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={resetScan} accessibilityLabel="Try scanning again">
              <Text style={styles.retryBtnText}>Try again</Text>
            </Pressable>
          </>
        )}

        {!loading && !product && !error && (
          <>
            <Text style={styles.overlayTitle}>Barcode Scanner</Text>
            <Text style={styles.hint}>Point at a product barcode to look up nutrition</Text>
          </>
        )}
      </View>
    </View>
  );
}
