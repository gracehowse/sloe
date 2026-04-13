import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { lookupBarcode, type BarcodeProduct } from "@/lib/verifyRecipe";
import { Neon } from "@/constants/theme";

export default function BarcodeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [last, setLast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onBarcode = useCallback(async (e: { data: string }) => {
    if (loading || last === e.data) return;
    setLast(e.data);
    setLoading(true);
    setError(null);
    setProduct(null);
    const result = await lookupBarcode(e.data);
    setLoading(false);
    if (result) {
      setProduct(result);
    } else {
      setError("Product not found. Try another barcode.");
    }
  }, [loading, last]);

  if (!permission) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Checking camera permission…</ThemedText>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.mb}>Camera access is needed to scan barcodes.</ThemedText>
        <Pressable style={styles.btn} onPress={() => void requestPermission()}>
          <ThemedText style={styles.btnText}>Grant permission</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerEnabled
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a"] }}
        onBarcodeScanned={onBarcode}
      />
      <View style={styles.overlay}>
        <ThemedText type="subtitle" style={styles.overlayTitle}>
          Barcode Scanner
        </ThemedText>
        <ThemedText style={styles.hint}>Point at a product barcode</ThemedText>
        {loading && <ActivityIndicator size="small" color={Neon.purple} />}
        {product && (
          <View style={{ gap: 4, alignItems: "center" }}>
            <ThemedText style={{ fontWeight: "700", fontSize: 16, textAlign: "center" }}>{product.name}</ThemedText>
            <ThemedText style={styles.dim}>
              {product.calories} kcal · P:{product.protein}g · C:{product.carbs}g · F:{product.fat}g
            </ThemedText>
            <ThemedText style={[styles.dim, { fontSize: 11 }]}>per 100g</ThemedText>
            <Pressable
              style={[styles.btn, { marginTop: 8 }]}
              onPress={() => { setLast(null); setProduct(null); setError(null); }}
            >
              <ThemedText style={styles.btnText}>Scan another</ThemedText>
            </Pressable>
          </View>
        )}
        {error && <ThemedText style={{ color: "#f87171" }}>{error}</ThemedText>}
        {!loading && !product && !error && !last && (
          <ThemedText style={styles.dim}>No scan yet</ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.88)",
    gap: 6,
  },
  overlayTitle: { color: "#fff" },
  hint: { color: "#e2e8f0", fontSize: 13 },
  code: { color: "#fff", fontSize: 16, fontWeight: "600" },
  dim: { color: "#94a3b8" },
  centered: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center", gap: 12 },
  mb: { textAlign: "center" },
  btn: { backgroundColor: "#7c3aed", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: "#fff", fontWeight: "600" },
});
