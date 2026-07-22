import { View, Text, StyleSheet } from "react-native";
import { Check, Sparkles } from "lucide-react-native";
import type { ShoppingSmartSuggestion } from "@suppr/shared/planning/shoppingSmartSuggestions";
import { formatOverlapSummary } from "@suppr/shared/planning/shoppingSmartSuggestions";
import { SupprButton } from "@/components/ui/SupprButton";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { Radius, Spacing, Type } from "@/constants/theme";

/**
 * ENG-1634 — presentational "Smart suggestions" card (mobile). Hosts wire
 * data via `ShoppingSmartSuggestions`; stories render this view directly.
 */
export type ShoppingSmartSuggestionsViewProps = {
  suggestions: readonly ShoppingSmartSuggestion[];
  addingRecipeId?: string | null;
  addedRecipeIds?: ReadonlySet<string>;
  onAddToPlan?: (suggestion: ShoppingSmartSuggestion) => void;
};

export function ShoppingSmartSuggestionsView({
  suggestions,
  addingRecipeId = null,
  addedRecipeIds,
  onAddToPlan,
}: ShoppingSmartSuggestionsViewProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  if (suggestions.length === 0) return null;
  const added = addedRecipeIds ?? new Set<string>();

  return (
    <View
      testID="shopping-smart-suggestions"
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
            Recipes that reuse what's already on your list.
          </Text>
        </View>
      </View>
      <View style={styles.list}>
        {suggestions.map((s) => {
          const busy = addingRecipeId === s.recipeId;
          const isAdded = added.has(s.recipeId);
          return (
            <View
              key={s.recipeId}
              testID={`shopping-smart-suggestion-${s.recipeId}`}
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <View style={styles.rowMain}>
                <Text style={[Type.captionStrong, { color: colors.text }]} numberOfLines={2}>
                  {s.title}
                </Text>
                <Text
                  style={[Type.caption, { color: colors.textSecondary, marginTop: Spacing.xs }]}
                  numberOfLines={2}
                >
                  Also uses {formatOverlapSummary(s.overlapIngredientNames)}
                </Text>
                {s.macroFit ? (
                  <Text
                    style={[Type.captionSmall, { color: colors.textTertiary, marginTop: Spacing.xs }]}
                  >
                    {s.macroFit.label}
                  </Text>
                ) : null}
              </View>
              {isAdded ? (
                <View style={styles.addedChip}>
                  <Check size={13} color={colors.textSecondary} strokeWidth={2.5} />
                  <Text style={[Type.caption, { color: colors.textSecondary }]}>Added</Text>
                </View>
              ) : (
                <SupprButton
                  variant="ghost"
                  haptic="confirm"
                  loading={busy}
                  onPress={() => onAddToPlan?.(s)}
                  accessibilityLabel={`Add ${s.title} to plan`}
                  testID={`shopping-smart-suggestion-add-${s.recipeId}`}
                  style={styles.addBtn}
                >
                  Add to plan
                </SupprButton>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  list: { gap: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, minWidth: 0 },
  addBtn: { minHeight: 32, paddingHorizontal: Spacing.sm, flexShrink: 0 },
  addedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexShrink: 0,
  },
});

export default ShoppingSmartSuggestionsView;
