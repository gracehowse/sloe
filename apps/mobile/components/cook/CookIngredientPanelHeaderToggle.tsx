import { StyleSheet } from "react-native";
import { ListChecks } from "lucide-react-native";
import { Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";

export type CookIngredientPanelHeaderToggleProps = {
  open: boolean;
  onOpen: () => void;
  accentInk: string;
};

/** ENG-942 — ListChecks header control for the in-step ingredient sheet. */
export function CookIngredientPanelHeaderToggle({
  open,
  onOpen,
  accentInk,
}: CookIngredientPanelHeaderToggleProps) {
  const colors = useThemeColors();
  // ENG-1521 — the open-state wash is the primary family's sanctioned Soft
  // step (the `accentInk` prop stays the icon INK; tints derive from tokens).
  const accent = useAccent();

  return (
    <PressableScale
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel="Ingredients"
      accessibilityState={{ expanded: open }}
      testID="cook-ingredient-panel-toggle"
      onPress={onOpen}
      hitSlop={8}
      style={[styles.toggle, { backgroundColor: colors.card }, open && { backgroundColor: accent.primarySoft }]}
    >
      <ListChecks
        size={20}
        color={open ? accentInk : colors.textSecondary}
        strokeWidth={2}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: 40,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
