import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  CookIngredientChecklist,
  type CookIngredientChecklistItem,
} from "@/components/cook/CookIngredientChecklist";

export interface CookIngredientPanelSheetProps {
  visible: boolean;
  recipeId: string;
  items: CookIngredientChecklistItem[];
  scaleLabel?: string | null;
  onClose: () => void;
}

/** ENG-942 — swipe-up ingredient peek during cook steps (mobile parity with web sidebar). */
export function CookIngredientPanelSheet({
  visible,
  recipeId,
  items,
  scaleLabel,
  onClose,
}: CookIngredientPanelSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
              maxHeight: "72%",
            },
          ]}
          accessibilityViewIsModal
          testID="cook-ingredient-panel-sheet"
        >
          <View style={styles.header}>
            <Text style={[Type.title, { color: colors.text, flex: 1 }]}>Ingredients</Text>
            <PressableScale onPress={onClose} haptic="selection" accessibilityRole="button" accessibilityLabel="Close ingredients">
              <X size={22} color={colors.textSecondary} strokeWidth={2} />
            </PressableScale>
          </View>
          {scaleLabel ? (
            <Text style={[Type.caption, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
              {scaleLabel}
            </Text>
          ) : null}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            <CookIngredientChecklist recipeId={recipeId} items={items} surface="cook" />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  list: {
    paddingBottom: Spacing.md,
  },
});
