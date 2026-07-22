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
import { track } from "@/lib/analytics";
import { Spacing, Radius, Type } from "@/constants/theme";

type ShoppingSmartSuggestionsCarouselProps = {
  suggestions: SmartSuggestion[];
  onAddToPlan?: (suggestion: SmartSuggestion) => void;
  dayLabelForIndex?: (dayIndex: number) => string;
};

export function ShoppingSmartSuggestionsCarousel({
  suggestions,
  onAddToPlan,
  dayLabelForIndex,
}: ShoppingSmartSuggestionsCarouselProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const router = useRouter();

  const handleAdd = useCallback(
    (s: SmartSuggestion) => {
      onAddToPlan?.(s);
      track(AnalyticsEvents.smart_suggestion_added_to_plan, {
        recipeId: s.recipe.id,
        dayIndex: s.macroFit?.dayIndex ?? -1,
        mealIndex: s.macroFit?.mealIndex ?? -1,
        platform: "mobile",
        surface: "shopping",
      });
    },
    [onAddToPlan],
  );

  if (suggestions.length === 0) return null;

  return (
    <View
      testID="shopping-smart-suggestions"
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Sparkles size={16} color={accent.primarySolid} strokeWidth={1.75} />
        <View style={styles.headerCopy}>
          <Text style={[Type.button, { color: colors.text }]}>Smart suggestions</Text>
          <Text style={[Type.caption, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
            Also uses items already in your list
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        testID="shopping-smart-suggestions-carousel"
      >
        {suggestions.map((s) => {
          const overlap = s.sharedIngredients.slice(0, 2).join(", ");
          const dayLabel =
            s.macroFit && dayLabelForIndex ? dayLabelForIndex(s.macroFit.dayIndex) : undefined;
          const macroLabel =
            s.macroFit && dayLabel
              ? smartSuggestionMacroFitLabel(s.macroFit, dayLabel)
              : null;
          return (
            <View
              key={s.recipe.id}
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Pressable
                onPress={() => router.push(`/recipe/${s.recipe.id}` as Href)}
                accessibilityRole="button"
              >
                <Text style={[Type.captionStrong, { color: colors.text }]} numberOfLines={2}>
                  {s.recipe.title}
                </Text>
              </Pressable>
              <Text
                style={[Type.caption, { color: colors.textSecondary, marginTop: Spacing.xs }]}
                numberOfLines={2}
              >
                Also uses {overlap}
              </Text>
              {macroLabel ? (
                <Text
                  style={[Type.caption, { color: accent.primarySolid, marginTop: Spacing.xs }]}
                  numberOfLines={1}
                >
                  {macroLabel}
                </Text>
              ) : null}
              <View style={styles.rowFooter}>
                <Text style={[Type.caption, { color: colors.textSecondary }]}>
                  {Math.round(s.recipe.calories)} kcal
                </Text>
                {onAddToPlan && s.macroFit ? (
                  <SupprButton
                    variant="primary"
                    haptic="selection"
                    onPress={() => handleAdd(s)}
                    style={styles.addBtn}
                  >
                    Add to plan
                  </SupprButton>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
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
  carousel: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  row: {
    width: 240,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  addBtn: {
    minHeight: 32,
    paddingHorizontal: Spacing.sm,
  },
});
