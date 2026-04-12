import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Neon, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { lookupBarcode, type BarcodeProduct } from "@/lib/verifyRecipe";

type Props = {
  visible: boolean;
  onScan: (barcode: string, product: BarcodeProduct) => void;
  onClose: () => void;
};

export default function BarcodeScannerModal({ visible, onScan, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onBarcode = useCallback(
    async (e: { data: string }) => {
      if (loading || scanned === e.data) return;
      setScanned(e.data);
      setLoading(true);
      setError(null);
      setProduct(null);

      const result = await lookupBarcode(e.data);
      setLoading(false);
      if (result) {
        setProduct(result);
      } else {
        setError("Product not found in database. Try another barcode.");
      }
    },
    [loading, scanned],
  );

  const onConfirm = useCallback(() => {
    if (scanned && product) {
      onScan(scanned, product);
      setScanned(null);
      setProduct(null);
    }
  }, [scanned, product, onScan]);

  const onReset = useCallback(() => {
    setScanned(null);
    setProduct(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    setScanned(null);
    setProduct(null);
    setError(null);
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
      backgroundColor: Neon.purple,
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
      borderColor: Neon.purple + "80",
      borderRadius: Radius.lg,
    },
    resultArea: { minHeight: 200, padding: Spacing.xl },
    lookupText: { color: colors.textSecondary, fontSize: 14 },
    errorText: { color: colors.textSecondary, fontSize: 14, textAlign: "center" },
    retryBtn: {
      borderWidth: 1,
      borderColor: Neon.purple + "55",
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
    },
    retryBtnText: { color: Neon.purple, fontWeight: "600" },
    productCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Neon.green + "40",
      padding: Spacing.xl,
      gap: Spacing.sm,
    },
    productName: { fontSize: 16, fontWeight: "600", color: colors.text },
    macroRow: { flexDirection: "row", gap: Spacing.lg },
    macroItem: { fontSize: 14, color: colors.textSecondary, fontWeight: "500" },
    per100g: { fontSize: 12, color: colors.textTertiary },
    btnRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm },
    useBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      backgroundColor: Neon.green,
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
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerEnabled={!scanned}
                barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
                onBarcodeScanned={scanned ? undefined : onBarcode}
              />
              <View style={styles.scanFrame} />
            </View>

            <View style={styles.resultArea}>
              {loading && (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={Neon.purple} />
                  <Text style={styles.lookupText}>Looking up product...</Text>
                </View>
              )}

              {error && (
                <View style={styles.centered}>
                  <Ionicons name="alert-circle" size={32} color={Neon.pink} />
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable style={styles.retryBtn} onPress={onReset}>
                    <Text style={styles.retryBtnText}>Scan again</Text>
                  </Pressable>
                </View>
              )}

              {product && (
                <View style={styles.productCard}>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <View style={styles.macroRow}>
                    <Text style={styles.macroItem}>{product.calories} kcal</Text>
                    <Text style={styles.macroItem}>P: {product.protein}g</Text>
                    <Text style={styles.macroItem}>C: {product.carbs}g</Text>
                    <Text style={styles.macroItem}>F: {product.fat}g</Text>
                  </View>
                  <Text style={styles.per100g}>per 100g</Text>
                  <View style={styles.btnRow}>
                    <Pressable style={styles.useBtn} onPress={onConfirm}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.useBtnText}>Use this</Text>
                    </Pressable>
                    <Pressable style={styles.scanAgainBtn} onPress={onReset}>
                      <Text style={styles.scanAgainText}>Scan again</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {!loading && !error && !product && (
                <Text style={styles.hintText}>
                  Point your camera at a barcode on any food product
                </Text>
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
