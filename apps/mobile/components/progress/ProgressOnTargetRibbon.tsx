import { Text, View } from "react-native";
import { Radius, Spacing } from "@/constants/theme";
import { Award } from "lucide-react-native";
import { SupprCard } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * ProgressOnTargetRibbon — Sloe Figma `492:2` on-target-days ribbon.
 *
 * A calm cream card with a circular medal glyph (damson `sourceAi` tint) +
 * headline "N on-target days this week" and a supportive subtitle. The count
 * is REAL (derived from the host's per-day on-target booleans). Renders
 * nothing when the count is 0 — we don't show an empty achievement.
 *
 * Mirror: `src/app/components/suppr/progress-ontarget-ribbon.tsx`.
 */

export interface ProgressOnTargetRibbonProps {
  /** Number of on-target days this week (real count). */
  onTargetCount: number;
  /** Factual supportive subtitle (e.g. "That's 5 of 7 days."). */
  subtitle: string;
}

export function ProgressOnTargetRibbon({
  onTargetCount,
  subtitle,
}: ProgressOnTargetRibbonProps) {
  const colors = useThemeColors();
  if (onTargetCount <= 0) return null;
  const medal = colors.sourceAi;
  return (
    <SupprCard
      testID="progress-ontarget-ribbon"
      // One-card-treatment soft lift (2026-06-09): page-ground card → soft.
      // Mirrors web `elevation="card"`.
      lift="soft"
      padding="lg"
      innerStyle={{ flexDirection: "row", alignItems: "center", gap: Spacing.dense }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: Radius.full,
          backgroundColor: medal + "1F",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Award size={20} color={medal} strokeWidth={1.75} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
          {onTargetCount} on-target {onTargetCount === 1 ? "day" : "days"} this week
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          {subtitle}
        </Text>
      </View>
    </SupprCard>
  );
}

export default ProgressOnTargetRibbon;
