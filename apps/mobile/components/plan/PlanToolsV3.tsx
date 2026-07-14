import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Flame, ShoppingCart } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PlanToolsV3 — the Sloe v3 Plan "plan tool" rows at the foot of the meal body
 * (prototype `plan-tool` ~L4820-4826): a tinted icon box + title + count
 * subtitle. Ships Batch cook + Shopping list (ENG-1255 / B3). Behind sloe_v3_plan.
 */
export interface PlanToolsV3Props {
  /** Batch-cook subtitle (e.g. "4 portions · scale shopping"). */
  batchCookSubtitle: string;
  /** Current shopping-list item count (0 → a "build your basket" nudge). */
  shoppingItemCount: number;
  /** Household serving count (>1 appends "· for N"). */
  servingCount: number;
  onOpenBatchCook: () => void;
  onOpenShopping: () => void;
}

function ToolRow({
  icon,
  title,
  subtitle,
  onPress,
  a11yLabel,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  a11yLabel: string;
}) {
  const colors = useThemeColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.iconBox, { backgroundColor: Accent.primarySoft }]}>{icon}</View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.sub, { color: colors.textTertiary }]}>{subtitle}</Text>
      </View>
    </PressableScale>
  );
}

export function PlanToolsV3({
  batchCookSubtitle,
  shoppingItemCount,
  servingCount,
  onOpenBatchCook,
  onOpenShopping,
}: PlanToolsV3Props) {
  const colors = useThemeColors();
  const forN = servingCount > 1 ? ` · for ${servingCount}` : "";
  const shopSub =
    shoppingItemCount > 0
      ? `${shoppingItemCount} item${shoppingItemCount === 1 ? "" : "s"}${forN}`
      : `Build your basket${forN}`;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.overline, { color: colors.textTertiary }]}>THIS WEEK</Text>
      <View style={styles.toolRow}>
        <View style={styles.toolCell}>
          <ToolRow
            icon={<Flame size={18} color={colors.navPrimary} strokeWidth={1.9} />}
            title="Batch cook"
            subtitle={batchCookSubtitle}
            onPress={onOpenBatchCook}
            a11yLabel={`Batch cook, ${batchCookSubtitle}`}
          />
        </View>
        <View style={styles.toolCell}>
          <ToolRow
            icon={<ShoppingCart size={18} color={colors.navPrimary} strokeWidth={1.9} />}
            title="Shopping list"
            subtitle={shopSub}
            onPress={onOpenShopping}
            a11yLabel={`Shopping list, ${shopSub}`}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.md, gap: Spacing.sm },
  overline: { ...Type.caption, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" as const },
  toolRow: { flexDirection: "row", gap: Spacing.sm },
  toolCell: { flex: 1, minWidth: 0 },
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
  title: { ...Type.label, textTransform: "none", letterSpacing: 0, fontSize: 13 },
  sub: { ...Type.caption, fontVariant: ["tabular-nums"], marginTop: 1 },
});

export default PlanToolsV3;
