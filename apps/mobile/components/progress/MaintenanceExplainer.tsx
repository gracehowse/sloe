import { Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";

import { Spacing } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { buildMaintenanceChain } from "@suppr/nutrition-core/maintenanceChain";
import type { ResolvedMaintenance } from "@suppr/nutrition-core/resolveMaintenance";
import type { PlanPace, Sex, ActivityLevel } from "@suppr/nutrition-core/tdee";

/**
 * G-4 (2026-04-19, TestFlight `ALcwMFPjfmJvyBLjs4CRt1k`) — Maintenance card's
 * "How this works" expandable (mobile). Shows the chain BMR → Maintenance →
 * Calorie goal → projected weekly loss. No new DB reads — numbers come from the
 * same state the card already holds.
 *
 * Extracted from `(tabs)/progress.tsx` (ENG-953 touch) to keep that legacy
 * screen under its line budget while a new sibling card lands.
 * Behaviour-preserving: same chain, same collapsed-by-default toggle. Parity:
 * web `MaintenanceExplainer` renders the identical expandable.
 */
export function MaintenanceExplainer({
  sex,
  weightKg,
  heightCm,
  age,
  activityLevel,
  resolved,
  planPace,
  userGoal,
  goalCalories,
  open,
  onToggle,
  colors,
}: {
  /** Profile `sex` as stored on the screen (a free string, coerced below). */
  sex: string;
  weightKg: number | null;
  heightCm: number;
  age: number;
  /** Profile `activity_level` as stored on the screen (coerced below). */
  activityLevel: string;
  resolved: ResolvedMaintenance;
  planPace: PlanPace;
  userGoal: string | null;
  goalCalories: number;
  open: boolean;
  onToggle: () => void;
  colors: { accentSolid: string; text: string; sub: string; border: string };
}) {
  const chain = buildMaintenanceChain(
    {
      sex: sex as Sex,
      weight_kg: weightKg ?? 70,
      height_cm: heightCm,
      age,
      activity_level: activityLevel as ActivityLevel,
    },
    resolved,
    planPace,
    userGoal,
    goalCalories,
  );
  if (!chain) return null;

  return (
    <View style={{ marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
      <PressableScale
        haptic="selection"
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={open ? "Hide explanation" : "Show how this works"}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
      >
        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accentSolid }}>
          {open ? "Hide" : "How this works"}
        </Text>
        {open ? (
          <ChevronUp size={14} color={colors.accentSolid} strokeWidth={1.75} />
        ) : (
          <ChevronDown size={14} color={colors.accentSolid} strokeWidth={1.75} />
        )}
      </PressableScale>
      {open && (
        <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
          {chain.steps.map((step, i) => {
            const isSummary = step.kind === "summary" || step.kind === "weeklyLoss";
            return (
              <View
                key={`${step.kind}-${i}`}
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: Spacing.dense }}
              >
                <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: isSummary ? colors.sub : colors.text, fontWeight: step.emphasis ? "700" : "500" }}>
                  {step.label}
                </Text>
                {step.value ? (
                  <Text style={{ fontSize: 12, color: step.emphasis ? colors.text : colors.sub, fontWeight: step.emphasis ? "700" : "500", fontVariant: ["tabular-nums"] }}>
                    {step.value}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default MaintenanceExplainer;
