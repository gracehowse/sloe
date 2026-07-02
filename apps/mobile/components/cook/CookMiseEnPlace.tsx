import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { Accent, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";
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
  onContinueToSteps: () => void;
  testID?: string;
}

/** Optional pre-step "Gather your ingredients" screen (ENG-946). */
export function CookMiseEnPlace({
  recipeId,
  recipeTitle,
  items,
  onContinueToSteps,
  testID = "cook-mise-en-place",
}: CookMiseEnPlaceProps) {
  // Keep the screen awake during the mise-en-place phase (ENG-959 — web parity).
  // The inline cook overlay in `recipe/[id].tsx` renders EITHER this checklist
  // ("mise" phase) OR `CookStepSwipeSurface` ("steps" phase), never both — so
  // each phase holds its own keep-awake tag, matching web's whole-session
  // `navigator.wakeLock` in `src/app/components/CookMode.tsx`.
  useKeepAwake();

  const colors = useThemeColors();
  // ENG-1311 — the cook screen's v3 shell is `Accent.primaryDeep` (gated
  // on the same flag in `app/cook.tsx`). The light-theme ink tokens are
  // dark-on-dark there: match the shell siblings (headerExit/stepText =
  // frostBright, headerCounter = frost) — serif H1 = `Accent.frostBright`
  // (#efe9f2 on #241733, ≈14.1:1), muted copy = `Accent.frost` (≈9.8:1).
  // Flag OFF keeps the light-shell theme colours.
  const cookV3 = isFeatureEnabled("recipe_detail_v3_conformance");
  const mutedColor = cookV3 ? Accent.frost : colors.textSecondary;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      <Text style={[styles.eyebrow, { color: cookV3 ? Accent.frost : colors.textTertiary }]}>
        Before you start
      </Text>
      <Text style={[styles.title, { color: cookV3 ? Accent.frostBright : colors.text }]}>
        Gather your ingredients
      </Text>
      {recipeTitle ? (
        <Text style={[styles.subtitle, { color: mutedColor }]}>{recipeTitle}</Text>
      ) : null}
      <Text style={[styles.hint, { color: mutedColor }]}>
        Tap each line as you add it — so you never wonder whether the salt went in.
      </Text>
      <CookIngredientChecklist recipeId={recipeId} items={items} surface="mise" />
      <SupprButton
        variant="primary"
        style={styles.cta}
        label="Start cooking"
        onPress={onContinueToSteps}
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
