import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function BarcodeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [last, setLast] = useState<string | null>(null);

  const onBarcode = useCallback((e: { data: string }) => {
    setLast(e.data);
  }, []);

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
          Barcode
        </ThemedText>
        <ThemedText style={styles.hint}>Point at a product barcode. Result is shown below.</ThemedText>
        {last ? (
          <ThemedText selectable style={styles.code}>
            {last}
          </ThemedText>
        ) : (
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
