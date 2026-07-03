/**
 * AddToCollectionSheet — ENG-1126 per-recipe collection membership sheet.
 * A recipe can belong to multiple collections at once — a checklist, not a
 * radio. Same chrome as `ReportRecipeSheet` (scrim + rounded sheet).
 * Web mirror: `src/app/components/library/AddToCollectionMenu.tsx`.
 */
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import type { RecipeCollection } from "@suppr/shared/recipes/recipeCollections";

export function AddToCollectionSheet({
  visible,
  onClose,
  recipeTitle,
  collections,
  memberOf,
  onToggle,
}: {
  visible: boolean;
  onClose: () => void;
  recipeTitle: string;
  collections: RecipeCollection[];
  memberOf: string[];
  onToggle: (collectionId: string, member: boolean) => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            padding: Spacing.lg,
            paddingBottom: Spacing.xl,
            maxHeight: "70%",
          }}
        >
          <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
            <View
              style={{ width: 36, height: 4, borderRadius: Radius.full, backgroundColor: colors.cardBorder }}
            />
          </View>
          <Text style={{ ...Type.navTitle, color: colors.text, marginBottom: Spacing.xs }}>
            Add to collection
          </Text>
          <Text
            style={{ ...Type.bodyMuted, color: colors.textSecondary, marginBottom: Spacing.md }}
            numberOfLines={1}
          >
            {recipeTitle}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {collections.map((c) => {
              const checked = memberOf.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onToggle(c.id, checked)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={c.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.dense,
                    paddingVertical: Spacing.dense,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: Radius.sm,
                      borderWidth: 1.5,
                      borderColor: checked ? accent.primarySolid : colors.cardBorder,
                      backgroundColor: checked ? accent.primarySolid : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {checked ? <Check size={14} color={colors.primaryForeground} /> : null}
                  </View>
                  <Text style={{ ...Type.body, color: colors.text, flex: 1 }} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
