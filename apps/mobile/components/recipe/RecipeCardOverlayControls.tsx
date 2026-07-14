/**
 * RecipeCardOverlayControls — mobile Library card overlay: bookmark
 * (top-right, unconditional) + either the Draft badge or the ENG-1126
 * "add to collection" affordance (top-left, mutually exclusive slot).
 * Extracted from `library.tsx` (screen-line-budget pinned, zero slack) so
 * this cluster can grow without pushing the host over budget. Geometry
 * matches the pre-existing bookmark/draft overlays exactly.
 * Web mirror: `src/app/components/library/RecipeCardOverlayControls.tsx`.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Bookmark, FolderPlus } from "lucide-react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { withAlpha, Radius, Spacing, ShadowColor } from "@/constants/theme";
import { useThemeColors, type ThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import type { RecipeCollection } from "@suppr/shared/recipes/recipeCollections";
import { AddToCollectionSheet } from "./AddToCollectionSheet";

export function RecipeCardOverlayControls({
  recipeTitle,
  isSaved,
  onToggleSave,
  showDraft,
  collectionsEnabled,
  collections,
  memberOf,
  onToggleCollection,
}: {
  recipeTitle: string;
  isSaved: boolean;
  onToggleSave: () => void;
  showDraft: boolean;
  collectionsEnabled: boolean;
  collections: RecipeCollection[];
  memberOf: string[];
  onToggleCollection: (collectionId: string, member: boolean) => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const [sheetVisible, setSheetVisible] = useState(false);
  const styles = stylesFor(colors);

  return (
    <>
      <PressableScale
        haptic="selection"
        style={styles.bookmarkDot}
        onPress={onToggleSave}
        accessibilityRole="button"
        accessibilityState={{ selected: isSaved }}
        accessibilityLabel={isSaved ? `Saved: ${recipeTitle}. Tap to remove` : `Save ${recipeTitle}`}
        hitSlop={8}
      >
        <Bookmark
          size={15}
          color={isSaved ? accent.primary : colors.textSecondary}
          fill={isSaved ? accent.primary : "transparent"}
        />
      </PressableScale>
      {showDraft ? (
        <View style={styles.draftBadge} pointerEvents="none">
          <Text style={styles.draftBadgeText}>Draft</Text>
        </View>
      ) : collectionsEnabled && collections.length > 0 ? (
        <PressableScale
          haptic="selection"
          style={styles.collectionDot}
          onPress={() => setSheetVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${recipeTitle} to a collection`}
          hitSlop={8}
        >
          <FolderPlus size={15} color={colors.textSecondary} />
        </PressableScale>
      ) : null}
      {collectionsEnabled ? (
        <AddToCollectionSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          recipeTitle={recipeTitle}
          collections={collections}
          memberOf={memberOf}
          onToggle={onToggleCollection}
        />
      ) : null}
    </>
  );
}

function stylesFor(colors: ThemeColors) {
  return StyleSheet.create({
    bookmarkDot: {
      position: "absolute",
      top: Spacing.sm,
      right: Spacing.sm,
      width: 32,
      height: 32,
      borderRadius: Radius.full,
      backgroundColor: "rgba(255,255,255,0.9)",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: ShadowColor.cast,
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    collectionDot: {
      position: "absolute",
      top: Spacing.sm,
      left: Spacing.sm,
      width: 32,
      height: 32,
      borderRadius: Radius.full,
      backgroundColor: "rgba(255,255,255,0.9)",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: ShadowColor.cast,
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    draftBadge: {
      position: "absolute",
      top: Spacing.sm,
      left: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: withAlpha(colors.text, 0xCC),
    },
    draftBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.background,
    },
  });
}
