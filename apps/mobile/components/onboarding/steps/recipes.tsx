/**
 * MobileRecipePickerStep — onboarding step 15, "Pick 5 recipes" (mobile).
 *
 * Production design spec — 2026-04-27 Surface F.
 * Authority: D-2026-04-27-14 + the onboarding-candidate-source decision.
 *
 * Mirrors `src/app/components/onboarding/steps/recipes.tsx` (web).
 * Owns the mobile presentation; persist is owned by the mobile shell
 * (`apps/mobile/app/onboarding.tsx`) once it lands the terminal-step
 * handler equivalent of web-flow.tsx.
 */

import * as React from "react";
import { ScrollView, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { Accent, IconSize, Spacing } from "@/constants/theme";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";
import { RecipePickerGrid } from "../../../components/onboarding/RecipePickerGrid";

export function MobileRecipePickerStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();

  const picked = React.useMemo(
    () => new Set<string>(state.pickedRecipeSlugs ?? []),
    [state.pickedRecipeSlugs],
  );

  const onPickedChange = React.useCallback(
    (next: ReadonlySet<string>) => {
      set({ pickedRecipeSlugs: Array.from(next) });
    },
    [set],
  );

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Pick 5 recipes you'd actually cook"
        subtitle="We'll seed your library and build your first weekly plan from these. You can change everything later."
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: Spacing.sm,
        }}
      >
        <Sparkles size={IconSize.xs} color={Accent.primary} />
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: Accent.primary,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          Last step
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Spacing.lg }}
      >
        <RecipePickerGrid
          diet={state.diet}
          allergies={state.allergies}
          picked={picked}
          onPickedChange={onPickedChange}
        />
      </ScrollView>
    </MobileStepBody>
  );
}

export default MobileRecipePickerStep;
