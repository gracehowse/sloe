import { Text, View } from "react-native";
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
  /** Supportive subtitle (e.g. "Your most consistent week this month."). */
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
      padding="lg"
      innerStyle={{ flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
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
