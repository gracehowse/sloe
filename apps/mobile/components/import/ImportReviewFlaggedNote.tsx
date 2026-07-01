import { Text, View } from "react-native";
import { AlertCircle } from "lucide-react-native";

import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  importFlaggedReviewLine,
  importFlaggedSummary,
  type ImportQualityRecipe,
} from "@suppr/shared/recipes/importQualitySignal";

/**
 * ENG-1283 — the calm, honest "some ingredients need review" note on the import
 * review card. Renders NOTHING when nothing is flagged (a clean import stays a
 * silent success). Derives from the SHARED `importFlaggedSummary` predicate —
 * no nutrition recompute, no parser / floor / legal / persistence touch.
 *
 * Body-neutral, non-alarming, and non-blocking: it informs the under-count, it
 * never stops the user saving. Flag-gating is the caller's job so flag-OFF is
 * today's render exactly.
 */
export function ImportReviewFlaggedNote({ recipe }: { recipe: ImportQualityRecipe }) {
  const colors = useThemeColors();
  const summary = importFlaggedSummary(recipe);
  const line = importFlaggedReviewLine(summary);
  if (!line) return null;
  return (
    <View
      testID="import-review-flagged-note"
      accessibilityRole="text"
      accessibilityLabel={line}
      style={{
        alignSelf: "stretch",
        marginTop: Spacing.md,
        padding: Spacing.md,
        borderRadius: Radius.md,
        backgroundColor: colors.inputBg,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: Spacing.dense,
      }}
    >
      <AlertCircle size={18} color={Accent.warningSolid} />
      <Text style={{ ...Type.body, color: colors.textSecondary, flex: 1 }}>{line}</Text>
    </View>
  );
}
