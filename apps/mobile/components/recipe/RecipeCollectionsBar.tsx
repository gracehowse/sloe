/**
 * RecipeCollectionsBar — ENG-1126 user-created collections pill row.
 * Extracted from `library.tsx` (screen-line-budget pinned, zero slack).
 * Matches the existing category/provenance pill grammar exactly (`filterPill`
 * / `categoryPillActive` geometry, canonical across Library + Discover).
 * Web mirror: `src/app/components/library/LibraryCollectionsBar.tsx`.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors, type ThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import type { RecipeCollection } from "@suppr/shared/recipes/recipeCollections";

type AccentPalette = ReturnType<typeof useAccent>;

export function RecipeCollectionsBar({
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
}: {
  collections: RecipeCollection[];
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onCreateCollection: (name: string) => Promise<boolean>;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const styles = stylesFor(colors);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  const submit = async () => {
    const name = draftName.trim();
    if (!name) {
      setCreating(false);
      setDraftName("");
      return;
    }
    const ok = await onCreateCollection(name);
    if (ok) {
      setDraftName("");
      setCreating(false);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScrollStyle}
      contentContainerStyle={styles.filterScroll}
    >
      {collections.length > 0 ? (
        <Pressable
          testID="library-collection-all"
          onPress={() => onSelectCollection(null)}
          style={[styles.filterPill, selectedCollectionId === null && collectionActive(accent)]}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedCollectionId === null }}
          accessibilityLabel="All collections"
        >
          <Text
            style={[styles.filterPillText, selectedCollectionId === null && collectionActiveText(accent)]}
          >
            All
          </Text>
        </Pressable>
      ) : null}
      {collections.map((c) => {
        const active = selectedCollectionId === c.id;
        return (
          <Pressable
            key={c.id}
            testID={`library-collection-${c.id}`}
            onPress={() => onSelectCollection(active ? null : c.id)}
            style={[styles.filterPill, active && collectionActive(accent)]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Collection: ${c.name}`}
          >
            <Text style={[styles.filterPillText, active && collectionActiveText(accent)]} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
      {creating ? (
        <TextInput
          autoFocus
          testID="library-new-collection-input"
          value={draftName}
          onChangeText={setDraftName}
          onBlur={() => void submit()}
          onSubmitEditing={() => void submit()}
          placeholder="Collection name"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="New collection name"
          style={styles.newCollectionInput}
        />
      ) : (
        <Pressable
          testID="library-new-collection"
          onPress={() => setCreating(true)}
          style={styles.filterPill}
          accessibilityRole="button"
          accessibilityLabel="Create a collection"
        >
          <Text style={styles.filterPillText}>
            {collections.length === 0 ? "+ New collection" : "+ New"}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function collectionActive(accent: AccentPalette) {
  return { backgroundColor: accent.primarySoft, borderColor: accent.primarySoft };
}

function collectionActiveText(accent: AccentPalette) {
  return { color: accent.primarySolid, fontWeight: "700" as const };
}

function stylesFor(colors: ThemeColors) {
  return StyleSheet.create({
    filterScrollStyle: { flexGrow: 0, minHeight: 44 },
    filterScroll: {
      paddingLeft: Spacing.xl,
      paddingRight: Spacing.xl * 2,
      alignItems: "center",
      gap: Spacing.sm,
    },
    filterPill: {
      paddingHorizontal: Spacing.dense,
      paddingVertical: Spacing.sm,
      minHeight: 36,
      borderRadius: Radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    filterPillText: {
      // ENG-1002 mobile type-scale ratchet — a new file gets zero off-ramp
      // allowance, unlike the pre-existing (grandfathered) 12px pill text in
      // `library.tsx` itself. Nearest legal rung is `Type.caption` (11/14).
      fontSize: Type.caption.fontSize,
      lineHeight: 18,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    newCollectionInput: {
      minHeight: 36,
      minWidth: 160,
      paddingHorizontal: Spacing.dense,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      fontSize: Type.caption.fontSize,
      color: colors.text,
    },
  });
}
