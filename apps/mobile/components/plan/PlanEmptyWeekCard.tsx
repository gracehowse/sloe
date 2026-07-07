import { Sparkles } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { SupprButton } from "@/components/ui/SupprButton";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PlanEmptyWeekCard — ENG-1372 (empty-state grammar, Plan empty-week). When
 * the whole week has zero planned meals, this ONE warm invitation card
 * replaces:
 *   - the dashed-box wall (`PlanEmptySlotV3` × every slot × every day), and
 *   - the "0 of 7 days land" verdict row (`PlanHeaderV3`) + the "0 / 1,900" /
 *     "P 0g C 0g F 0g" zero-triad (`PlanDayDetailBandV3`) — derived numbers
 *     with nothing behind them yet (law 3).
 *
 * Ground is the warm-tint elevation token (law 1 — never a bare/dashed void).
 * ONE filled action inside it (law 2): "Generate this week", wired to the
 * host's existing generate handler (same action `PlanHeaderV3`'s Sparkles
 * button already fires) + a quiet ghost fallback for users who'd rather add
 * meals one at a time.
 *
 * Behind `empty_state_grammar_v1` — the host (`PlanV3Surface`) only mounts
 * this when the flag is on AND {@link isPlanWeekEmpty} is true; this
 * component itself carries no gating logic.
 *
 * Web parity: `src/app/components/plan/PlanEmptyWeekCard.tsx`.
 */
export interface PlanEmptyWeekCardProps {
  onGenerate: () => void;
  onAddMealsAsYouGo: () => void;
}

export function PlanEmptyWeekCard({ onGenerate, onAddMealsAsYouGo }: PlanEmptyWeekCardProps) {
  const colors = useThemeColors();
  return (
    <View
      testID="plan-empty-week-card"
      style={[styles.card, { backgroundColor: colors.surfaceWarm }]}
    >
      <Sparkles size={22} color={colors.navPrimary} strokeWidth={1.75} />
      <Text style={[styles.headline, { color: colors.text }]}>Nothing planned yet</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Generate a full week from your saved recipes, or build it meal by meal.
      </Text>
      <SupprButton
        variant="primary"
        label="Generate this week"
        onPress={onGenerate}
        style={{ marginTop: Spacing.sm, alignSelf: "center" }}
      />
      <SupprButton
        variant="ghost"
        label="or add meals as you go"
        onPress={onAddMealsAsYouGo}
        style={{ marginTop: Spacing.xs, alignSelf: "center" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  headline: { ...Type.headline, marginTop: Spacing.xs, textAlign: "center" },
  body: { ...Type.caption, textAlign: "center", paddingHorizontal: Spacing.sm },
});

export default PlanEmptyWeekCard;
