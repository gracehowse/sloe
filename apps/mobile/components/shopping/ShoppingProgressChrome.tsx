import { View, Text, type TextStyle, type ViewStyle } from "react-native";
import { Spacing, Type } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";

type ShoppingProgressChromeProps = {
  densityV1: boolean;
  checkedGroupCount: number;
  totalGroupCount: number;
  checkedCount: number;
  progress: number;
  onClearChecked: () => void;
  styles: {
    card: ViewStyle;
    progressRow: ViewStyle;
    progressLabel: TextStyle;
    progressCount: TextStyle;
    progressTrack: ViewStyle;
    progressFill: ViewStyle;
    progressStrip: ViewStyle;
    progressStripTrack: ViewStyle;
    progressStripFill: ViewStyle;
    progressStripCount: TextStyle;
  };
  accentPrimarySolid: string;
};

/**
 * ENG-1669 — Mob-flat density drops progress chrome (count lives in
 * "Shopping list (N)" title). Flag-off keeps the legacy Progress card.
 */
export function ShoppingProgressChrome({
  densityV1,
  checkedGroupCount,
  totalGroupCount,
  checkedCount,
  progress,
  onClearChecked,
  styles,
  accentPrimarySolid,
}: ShoppingProgressChromeProps) {
  if (densityV1) {
    return null;
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressCount}>
            {checkedGroupCount}/{totalGroupCount}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      {checkedCount > 0 ? (
        <PressableScale
          haptic="selection"
          onPress={onClearChecked}
          style={{
            alignSelf: "center",
            paddingVertical: 8,
            paddingHorizontal: Spacing.xl,
          }}
        >
          <Text style={{ ...Type.body, fontWeight: "600", color: accentPrimarySolid }}>
            Remove {checkedCount} checked item{checkedCount !== 1 ? "s" : ""}
          </Text>
        </PressableScale>
      ) : null}
    </>
  );
}
