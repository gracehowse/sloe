import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { classifySource, type SourceTier } from "@suppr/nutrition-core/classifySource";
import { formatNutritionTrustTierLabel } from "@suppr/nutrition-core/sourceLabel";
import { isFeatureEnabled } from "@/lib/analytics";

const CONFIG: Record<SourceTier, { label: string; abbr: string }> = {
  verified: { label: "Structured", abbr: "✓" },
  estimated: { label: "Estimated", abbr: "~" },
  manual: { label: "Manual", abbr: "✎" },
};

export default function NutritionSourceBadge({ source, compact = true }: { source?: string | null; compact?: boolean }) {
  const tier = classifySource(source);
  const cfg = CONFIG[tier];
  const label = isFeatureEnabled("trust_source_name_v1")
    ? formatNutritionTrustTierLabel(tier, source)
    : cfg.label;
  const colors = useThemeColors();
  // ENG-716 — `manual` previously used a cool-slate literal off the Sloe
  // palette. It now reads the warm-grey `sourceManual` provenance token (the
  // canonical "manual source" colour, #9B93A3 light / #857F8B dark), matching
  // web's `text-muted-foreground` manual badge and dark-swapping correctly.
  // Verified/estimated stay on the static Accent fills (value preserved).
  const color =
    tier === "manual"
      ? colors.sourceManual
      : tier === "verified"
        ? Accent.success
        : Accent.warning;
  // ENG-1521 — badge fill at the sanctioned Soft step (replaces `color + "18"`):
  // manual reads the scheme-resolved `sourceManualSoft` provenance tint;
  // verified/estimated stay on the static Accent family Softs, matching the
  // static Accent ink idiom above.
  const soft =
    tier === "manual"
      ? colors.sourceManualSoft
      : tier === "verified"
        ? Accent.successSoft
        : Accent.warningSoft;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          borderRadius: Radius.full, // tags census 2026-06-10
          paddingHorizontal: Spacing.xs,
          paddingVertical: 1,
          backgroundColor: soft,
        },
        abbr: { fontSize: 10, fontWeight: "700", color },
        label: { fontSize: 9, fontWeight: "600", color },
      }),
    [color, soft],
  );

  return (
    <View style={styles.badge} accessibilityLabel={`${label} nutrition data`}>
      <Text style={styles.abbr}>{cfg.abbr}</Text>
      {!compact && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

export { classifySource, type SourceTier };
