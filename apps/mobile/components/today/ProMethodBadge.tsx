/**
 * ENG-1312 — PRO chip for locked AI log methods (Voice / Photo / Describe).
 * Shared by `LogSheetInputModeRow` and `LogSheetDescribeFlow`.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Accent, Radius } from "@/constants/theme";

export function ProMethodBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.proBadge, style]}>
      <Text style={styles.proBadgeText}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  proBadge: {
    backgroundColor: Accent.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    color: Accent.primaryForeground,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
