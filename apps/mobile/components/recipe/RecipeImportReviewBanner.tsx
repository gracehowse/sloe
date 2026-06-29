import { StyleSheet, Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";

import { SupprButton } from "@/components/ui/SupprButton";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { importReviewBannerCopy } from "@suppr/shared/nutrition/recipeImportReview";

export interface RecipeImportReviewBannerProps {
  sourceName?: string | null;
  sourceUrl?: string | null;
  onVerify: () => void;
}

/** ENG-1247 — prototype `.review-banner` on RecipeDetail when nutrition needs review. */
export function RecipeImportReviewBanner({
  sourceName,
  sourceUrl,
  onVerify,
}: RecipeImportReviewBannerProps) {
  const colors = useThemeColors();
  const copy = importReviewBannerCopy({ sourceName, sourceUrl });

  return (
    <View
      style={[styles.banner, { backgroundColor: Accent.warning + "22" }]}
      testID="recipe-import-review-banner"
      accessibilityRole="summary"
    >
      <View style={[styles.icon, { backgroundColor: Accent.warningSolid }]}>
        <AlertTriangle size={20} color="#fff" />
      </View>
      <View style={{ flex: 1, gap: Spacing.xs }}>
        <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{copy.body}</Text>
        <SupprButton variant="primary" label="Verify ingredients" onPress={onVerify} style={styles.cta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    gap: 13,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...Type.label, textTransform: "none", letterSpacing: 0, fontSize: 14 },
  body: { ...Type.body, fontSize: 13, lineHeight: 18 },
  cta: { marginTop: Spacing.sm, alignSelf: "flex-start" },
});

export default RecipeImportReviewBanner;
