import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Radius, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";

export function CreatorStatsCard({
  recipeCount,
  followerCount,
  followingCount = 0,
}: {
  recipeCount: number;
  followerCount: number;
  followingCount?: number;
}) {
  const colors = useThemeColors();
  if (!isFeatureEnabled("creator_profile_v3")) return null;

  const cells = [
    { value: recipeCount, label: "Recipes" },
    { value: followerCount, label: "Followers" },
    { value: followingCount, label: "Following" },
  ];

  return (
    <View
      testID="creator-stats-card"
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
    >
      {cells.map((cell, idx) => (
        <View
          key={cell.label}
          style={[
            styles.cell,
            idx > 0 ? { borderLeftWidth: 1, borderLeftColor: colors.cardBorder } : null,
          ]}
        >
          <Text style={[styles.value, { color: colors.text }]}>{cell.value}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{cell.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
    marginTop: Spacing.md,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  value: { ...Type.title, fontWeight: "600" },
  label: { ...Type.captionSmall, marginTop: Spacing.xs },
});
