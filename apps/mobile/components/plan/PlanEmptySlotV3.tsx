import { StyleSheet, Text, View } from "react-native";
import { Plus } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PlanEmptySlotV3 — Sloe v3 Plan empty-slot row (prototype `plan-empty`
 * ~L4787): a dashed card with the slot label and an "Add {slot}" affordance.
 * Behind sloe_v3_plan (Block 3).
 */
export interface PlanEmptySlotV3Props {
  /** Slot label, e.g. "Dinner". */
  slot: string;
  onPress: () => void;
}

export function PlanEmptySlotV3({ slot, onPress }: PlanEmptySlotV3Props) {
  const colors = useThemeColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`Add ${slot.toLowerCase()}`}
      style={[styles.row, { borderColor: colors.borderStrong }]}
    >
      <Text style={[styles.slot, { color: colors.textTertiary }]}>{slot}</Text>
      <View style={styles.add}>
        <Plus size={15} color={colors.navPrimary} strokeWidth={2.25} />
        <Text style={[styles.addText, { color: colors.navPrimary }]}>
          Add {slot.toLowerCase()}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: Spacing.dense,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  slot: { ...Type.statLabel, fontSize: 10 },
  add: { flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { ...Type.label, textTransform: "none", letterSpacing: 0, fontSize: 13 },
});

export default PlanEmptySlotV3;
