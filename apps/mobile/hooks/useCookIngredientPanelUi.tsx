import { useState } from "react";
import { View } from "react-native";
import { CookIngredientPanelHeaderToggle } from "@/components/cook/CookIngredientPanelHeaderToggle";
import { CookIngredientPanelSheet } from "@/components/cook/CookIngredientPanelSheet";
import {
  useCookIngredientPanelGate,
  type UseCookIngredientPanelInput,
} from "@/hooks/useCookIngredientPanelGate";
import { useCookMisePhaseBootstrap } from "@/hooks/useCookMisePhaseBootstrap";

type Input = UseCookIngredientPanelInput & {
  recipeId: string;
  accentInk: string;
  handsfreeVisible: boolean;
  recipeIdForMise?: string;
  onMiseBootstrap: (phase: "mise" | "steps") => void;
};

/** ENG-942 — header toggle + sheet wiring extracted from cook.tsx. */
export function useCookIngredientPanelUi({
  recipeId,
  accentInk,
  handsfreeVisible,
  recipeIdForMise,
  onMiseBootstrap,
  ...gateInput
}: Input) {
  const [open, setOpen] = useState(false);
  const { showPanel, scaleLabel } = useCookIngredientPanelGate(gateInput);

  useCookMisePhaseBootstrap(
    recipeIdForMise,
    gateInput.checklistEnabled,
    gateInput.checklistItems.length,
    onMiseBootstrap,
  );

  const headerToggle = showPanel ? (
    <CookIngredientPanelHeaderToggle
      open={open}
      onOpen={() => setOpen(true)}
      accentInk={accentInk}
    />
  ) : null;

  const headerSpacer =
    !showPanel && !handsfreeVisible ? (
      <View style={{ width: 40, height: 32 }} testID="cook-handsfree-toggle-placeholder" />
    ) : null;

  const sheet = showPanel ? (
    <CookIngredientPanelSheet
      visible={open}
      recipeId={recipeId}
      items={gateInput.checklistItems}
      scaleLabel={scaleLabel}
      onClose={() => setOpen(false)}
    />
  ) : null;

  return { headerToggle, headerSpacer, sheet };
}
