import { Pressable, StyleSheet } from "react-native";
import { ListChecks } from "lucide-react-native";
import { Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ingredients"
      accessibilityState={{ expanded: open }}
      testID="cook-ingredient-panel-toggle"
      onPress={onOpen}
      hitSlop={8}
      style={[styles.toggle, { backgroundColor: colors.card }, open && { backgroundColor: accentInk + "18" }]}
    >
      <ListChecks
        size={20}
        color={open ? accentInk : colors.textSecondary}
        strokeWidth={2}
      />
    </Pressable>
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
