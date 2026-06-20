import { ScrollView, Text, View, StyleSheet } from "react-native";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprButton } from "@/components/ui/SupprButton";
import {
  CookIngredientChecklist,
  type CookIngredientChecklistItem,
} from "@/components/cook/CookIngredientChecklist";

export interface CookMiseEnPlaceProps {
  recipeId: string;
  recipeTitle?: string;
  items: CookIngredientChecklistItem[];
  onStartCooking: () => void;
  testID?: string;
}

/** Optional pre-step "Gather your ingredients" screen (ENG-946). */
export function CookMiseEnPlace({
  recipeId,
  recipeTitle,
  items,
  onStartCooking,
  testID = "cook-mise-en-place",
}: CookMiseEnPlaceProps) {
  const colors = useThemeColors();

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>
        Before you start
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>Gather your ingredients</Text>
      {recipeTitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{recipeTitle}</Text>
      ) : null}
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Tap each line as you add it — so you never wonder whether the salt went in.
      </Text>
      <CookIngredientChecklist recipeId={recipeId} items={items} surface="mise" />
      <SupprButton
        variant="primary"
        style={styles.cta}
        label="Start cooking"
        onPress={onStartCooking}
        haptic="selection"
        accessibilityLabel="Start cooking steps"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    ...Type.title,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  cta: {
    marginTop: Spacing.lg,
    alignSelf: "stretch",
  },
});
