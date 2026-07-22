import { useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Sparkles } from "lucide-react-native";
import {
  smartSuggestionMacroFitLabel,
  type SmartSuggestion,
} from "@suppr/shared/planning/smartSuggestions";
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
  /** ENG-1634 v2 — one-tap add to the annotated plan slot. */
  onAddToPlan?: (suggestion: SmartSuggestion) => void;
  dayLabelForIndex?: (dayIndex: number) => string;
  v2Enabled?: boolean;
};

function SuggestionRow({
  suggestion,
  saved,
  onOpen,
  onSave,
  onAddToPlan,
  dayLabel,
  v2Enabled,
  colors,
  accent,
}: {
  suggestion: SmartSuggestion;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  onAddToPlan?: () => void;
  dayLabel?: string;
  v2Enabled: boolean;
  colors: ReturnType<typeof useThemeColors>;
  accent: ReturnType<typeof useAccent>;
}) {
  const overlap = suggestion.sharedIngredients.slice(0, 3).join(", ");
  const extra =
    suggestion.sharedIngredients.length > 3
      ? ` +${suggestion.sharedIngredients.length - 3} more`
      : "";
  const macroLabel =
    v2Enabled && suggestion.macroFit && dayLabel
      ? smartSuggestionMacroFitLabel(suggestion.macroFit, dayLabel)
      : null;

  return (
    <View
      style={[
        styles.row,
        v2Enabled ? styles.carouselRow : null,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
      ]}
    >
      <View style={styles.rowMain}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${suggestion.recipe.title}`}
        >
          <Text style={[Type.captionStrong, { color: colors.text }]} numberOfLines={2}>
            {suggestion.recipe.title}
          </Text>
        </Pressable>
        <Text
          style={[Type.caption, { color: colors.textSecondary, marginTop: Spacing.xs }]}
          numberOfLines={2}
        >
          Also uses {overlap}
          {extra}
        </Text>
        {macroLabel ? (
          <Text
            style={[Type.caption, { color: accent.primarySolid, marginTop: Spacing.xs }]}
            numberOfLines={1}
          >
            {macroLabel}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowAside}>
        <Text
          style={[Type.caption, { color: colors.textSecondary, fontVariant: ["tabular-nums"] }]}
        >
          {Math.round(suggestion.recipe.calories)} kcal
        </Text>
        {v2Enabled && onAddToPlan && suggestion.macroFit ? (
          <SupprButton
            variant="primary"
            haptic="selection"
            onPress={onAddToPlan}
            accessibilityLabel={`Add ${suggestion.recipe.title} to plan`}
            style={styles.addBtn}
          >
            Add to plan
          </SupprButton>
        ) : saved ? (
          <Text style={[Type.caption, styles.savedLabel, { color: colors.textSecondary }]}>
            Saved
          </Text>
        ) : (
          <SupprButton
            variant="ghost"
            haptic="selection"
            onPress={onSave}
            accessibilityLabel={`Save ${suggestion.recipe.title}`}
            style={styles.saveBtn}
          >
            Save
          </SupprButton>
        )}
      </View>
    </View>
  );
}

export function PlanSmartSuggestionsCard({
  userId,
  suggestions,
  onAddToPlan,
  dayLabelForIndex,
  v2Enabled = false,
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

  const renderRow = (s: SmartSuggestion) => {
    const saved = isSaved(s.recipe.id) || s.recipe.isSaved;
    const dayLabel =
      s.macroFit && dayLabelForIndex ? dayLabelForIndex(s.macroFit.dayIndex) : undefined;
    return (
      <SuggestionRow
        key={s.recipe.id}
        suggestion={s}
        saved={saved}
        colors={colors}
        accent={accent}
        v2Enabled={v2Enabled}
        dayLabel={dayLabel}
        onOpen={() => router.push(`/recipe/${s.recipe.id}` as Href)}
        onSave={() => handleSave(s.recipe.id)}
        onAddToPlan={
          onAddToPlan && s.macroFit
            ? () => onAddToPlan(s)
            : undefined
        }
      />
    );
  };

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
      {v2Enabled ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          testID="planner-smart-suggestions-carousel"
        >
          {suggestions.map(renderRow)}
        </ScrollView>
      ) : (
        <View style={styles.list}>{suggestions.map(renderRow)}</View>
      )}
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
  carousel: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
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
  carouselRow: {
    width: 280,
    flexShrink: 0,
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
  addBtn: {
    minHeight: 32,
    paddingHorizontal: Spacing.sm,
  },
});
