import { StyleSheet, Text, View } from "react-native";
import { ChevronRight, ShoppingCart } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PlanToolsV3 — the Sloe v3 Plan "plan tool" rows at the foot of the meal body
 * (prototype `plan-tool` ~L4820-4826): a tinted icon box + title + count
 * subtitle. Ships the Shopping list row (cart → the existing /shopping screen),
 * which also RESTORES shopping access removed when the legacy PlanTabChrome was
 * hidden under sloe_v3_plan. The prototype's Batch cook row is a tracked
 * follow-up (mobile has no batch-cook sheet yet — ENG-1225). Behind sloe_v3_plan.
 */
export interface PlanToolsV3Props {
  /** Current shopping-list item count (0 → a "build your basket" nudge). */
  shoppingItemCount: number;
  /** Household serving count (>1 appends "· for N"). */
  servingCount: number;
  onOpenShopping: () => void;
}

export function PlanToolsV3({
  shoppingItemCount,
  servingCount,
  onOpenShopping,
}: PlanToolsV3Props) {
  const colors = useThemeColors();
  const forN = servingCount > 1 ? ` · for ${servingCount}` : "";
  const sub =
    shoppingItemCount > 0
      ? `${shoppingItemCount} item${shoppingItemCount === 1 ? "" : "s"}${forN}`
      : `Build your basket${forN}`;
  return (
    <View style={styles.wrap}>
      <PressableScale
        onPress={onOpenShopping}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel={`Shopping list, ${sub}`}
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.iconBox, { backgroundColor: Accent.primarySoft }]}>
          <ShoppingCart size={18} color={colors.navPrimary} strokeWidth={1.9} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>Shopping list</Text>
          <Text style={[styles.sub, { color: colors.textTertiary }]}>{sub}</Text>
        </View>
        <ChevronRight size={18} color={colors.textTertiary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.dense,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  title: { ...Type.label, textTransform: "none", letterSpacing: 0, fontSize: 14 },
  sub: { ...Type.caption, fontVariant: ["tabular-nums"], marginTop: 1 },
});

export default PlanToolsV3;
