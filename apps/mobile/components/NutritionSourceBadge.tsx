import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { classifySource, type SourceTier } from "@suppr/nutrition-core/classifySource";

const CONFIG: Record<SourceTier, { label: string; abbr: string }> = {
  verified: { label: "Structured", abbr: "✓" },
  estimated: { label: "Estimated", abbr: "~" },
  manual: { label: "Manual", abbr: "✎" },
};

export default function NutritionSourceBadge({ source, compact = true }: { source?: string | null; compact?: boolean }) {
  const tier = classifySource(source);
  const cfg = CONFIG[tier];
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
          backgroundColor: color + "18",
        },
        abbr: { fontSize: 10, fontWeight: "700", color },
        label: { fontSize: 9, fontWeight: "600", color },
      }),
    [color],
  );

  return (
    <View style={styles.badge} accessibilityLabel={`${cfg.label} nutrition data`}>
      <Text style={styles.abbr}>{cfg.abbr}</Text>
      {!compact && <Text style={styles.label}>{cfg.label}</Text>}
    </View>
  );
}

export { classifySource, type SourceTier };
