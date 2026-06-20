import { Pressable, Text, View, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCookIngredientChecklist } from "@/hooks/useCookIngredientChecklist";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";

export type CookIngredientChecklistItem = {
  name: string;
  amountLabel?: string | null;
};

export interface CookIngredientChecklistProps {
  recipeId: string;
  items: CookIngredientChecklistItem[];
  /** Analytics surface tag — where the checklist is rendered. */
  surface: "recipe_detail" | "mise" | "cook";
  testID?: string;
}

/** Tap-to-check ingredient rows for cook mode + recipe detail (ENG-946). */
export function CookIngredientChecklist({
  recipeId,
  items,
  surface,
  testID = "cook-ingredient-checklist",
}: CookIngredientChecklistProps) {
  const colors = useThemeColors();
  const { isChecked, toggle } = useCookIngredientChecklist(recipeId);

  if (items.length === 0) return null;

  return (
    <View style={styles.list} testID={testID}>
      {items.map((item, index) => {
        const checked = isChecked(index);
        return (
          <Pressable
            key={`${index}:${item.name}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`${item.name}${item.amountLabel ? `, ${item.amountLabel}` : ""}`}
            onPress={() => {
              const next = toggle(index);
              void Haptics.selectionAsync();
              try {
                track(AnalyticsEvents.cook_ingredient_checked, {
                  recipeId,
                  index,
                  checked: next,
                  surface,
                  platform: "ios",
                });
              } catch {
                /* analytics fire-and-forget */
              }
            }}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? colors.card : colors.backgroundSecondary,
                borderColor: colors.border,
              },
            ]}
            testID={`cook-ingredient-check-${index}`}
          >
            <View
              style={[
                styles.check,
                {
                  borderColor: checked ? Accent.success : colors.border,
                  backgroundColor: checked ? Accent.success + "18" : colors.card,
                },
              ]}
            >
              {checked ? (
                <Check size={14} color={Accent.success} strokeWidth={2.5} />
              ) : null}
            </View>
            <View style={styles.textCol}>
              <Text
                style={[
                  styles.name,
                  {
                    color: checked ? colors.textTertiary : colors.text,
                    textDecorationLine: checked ? "line-through" : "none",
                  },
                ]}
              >
                {item.name}
              </Text>
              {item.amountLabel ? (
                <Text
                  style={[
                    styles.amount,
                    {
                      color: colors.textTertiary,
                      textDecorationLine: checked ? "line-through" : "none",
                    },
                  ]}
                >
                  {item.amountLabel}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Type.body,
    fontWeight: "600",
  },
  amount: {
    fontSize: 13,
    lineHeight: 18,
  },
});
