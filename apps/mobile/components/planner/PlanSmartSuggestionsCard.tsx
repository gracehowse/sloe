import { useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Sparkles } from "lucide-react-native";
import type { SmartSuggestion } from "@suppr/shared/planning/smartSuggestions";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { SupprButton } from "@/components/ui/SupprButton";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { useSavedRecipes } from "@/lib/recipes";
import { track } from "@/lib/analytics";
import { Spacing, Radius, Type } from "@/constants/theme";

type PlanSmartSuggestionsCardProps = {
  userId: string | null;
  suggestions: SmartSuggestion[];
};

export function PlanSmartSuggestionsCard({
  userId,
  suggestions,
}: PlanSmartSuggestionsCardProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const router = useRouter();
  const { isSaved, toggleSave } = useSavedRecipes(userId);

  const handleSave = useCallback(
    (recipeId: string) => {
      if (isSaved(recipeId)) return;
      void toggleSave(recipeId);
      track(AnalyticsEvents.smart_suggestion_saved, {
        recipeId,
        platform: "mobile",
      });
    },
    [isSaved, toggleSave],
  );

  if (suggestions.length === 0) return null;

  return (
    <View
      testID="planner-smart-suggestions"
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Sparkles size={16} color={accent.primarySolid} strokeWidth={1.75} />
        <View style={styles.headerCopy}>
          <Text style={[Type.button, { color: colors.text }]}>Smart suggestions</Text>
          <Text style={[Type.caption, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
            Recipes that share ingredients already in your plan — less waste, fewer one-off buys.
          </Text>
        </View>
      </View>
      <View style={styles.list}>
        {suggestions.map((s) => {
          const overlap = s.sharedIngredients.slice(0, 3).join(", ");
          const extra =
            s.sharedIngredients.length > 3 ? ` +${s.sharedIngredients.length - 3} more` : "";
          const saved = isSaved(s.recipe.id) || s.recipe.isSaved;
          return (
            <View
              key={s.recipe.id}
              style={[
                styles.row,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <View style={styles.rowMain}>
                <Pressable
                  onPress={() => router.push(`/recipe/${s.recipe.id}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${s.recipe.title}`}
                >
                  <Text
                    style={[Type.captionStrong, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {s.recipe.title}
                  </Text>
                </Pressable>
                <Text
                  style={[Type.caption, { color: colors.textSecondary, marginTop: Spacing.xs }]}
                  numberOfLines={2}
                >
                  Also uses {overlap}
                  {extra}
                </Text>
              </View>
              <View style={styles.rowAside}>
                <Text style={[Type.caption, { color: colors.textSecondary, fontVariant: ["tabular-nums"] }]}>
                  {Math.round(s.recipe.calories)} kcal
                </Text>
                {saved ? (
                  <Text style={[Type.caption, styles.savedLabel, { color: colors.textSecondary }]}>
                    Saved
                  </Text>
                ) : (
                  <SupprButton
                    variant="ghost"
                    haptic="selection"
                    onPress={() => handleSave(s.recipe.id)}
                    accessibilityLabel={`Save ${s.recipe.title}`}
                    style={styles.saveBtn}
                  >
                    Save
                  </SupprButton>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  list: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowAside: {
    alignItems: "flex-end",
    gap: Spacing.xs,
    flexShrink: 0,
  },
  savedLabel: {
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  saveBtn: {
    minHeight: 32,
    paddingHorizontal: Spacing.sm,
  },
});
