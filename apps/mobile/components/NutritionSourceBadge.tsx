import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";

type SourceTier = "verified" | "estimated" | "manual";

function classifySource(source?: string | null): SourceTier {
  if (source == null || typeof source !== "string") return "manual";
  const s = source.trim().toLowerCase();
  if (!s) return "manual";
  if (s.includes("usda") || s.includes("fdc") || s.includes("openfoodfacts") || s.includes("off")) return "verified";
  if (s.includes("ai") || s.includes("photo") || s.includes("voice") || s.includes("import") || s.includes("openai") || s.includes("recipe")) return "estimated";
  return "manual";
}

const CONFIG: Record<SourceTier, { label: string; abbr: string; color: string }> = {
  verified: { label: "Structured", abbr: "✓", color: Accent.success },
  estimated: { label: "Estimated", abbr: "~", color: Accent.warning },
  manual: { label: "Manual", abbr: "✎", color: "#94a3b8" },
};

export default function NutritionSourceBadge({ source, compact = true }: { source?: string | null; compact?: boolean }) {
  const tier = classifySource(source);
  const cfg = CONFIG[tier];
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
          backgroundColor: cfg.color + "18",
        },
        abbr: { fontSize: 10, fontWeight: "700", color: cfg.color },
        label: { fontSize: 9, fontWeight: "600", color: cfg.color },
      }),
    [cfg.color],
  );

  return (
    <View style={styles.badge} accessibilityLabel={`${cfg.label} nutrition data`}>
      <Text style={styles.abbr}>{cfg.abbr}</Text>
      {!compact && <Text style={styles.label}>{cfg.label}</Text>}
    </View>
  );
}

export { classifySource, type SourceTier };
