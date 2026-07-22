import React, { memo } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Search } from "lucide-react-native";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprButton } from "@/components/ui/SupprButton";

/**
 * TodayAddFoodForm — inline quick-add card with slot toggle + 4 macro
 * inputs, plus a "Search" hand-off to the search modal.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18).
 */
export interface TodayAddFoodFormProps {
  slots: readonly string[];
  activeMealSlot: string;
  onActiveMealSlotChange: (slot: string) => void;
  title: string;
  onTitleChange: (v: string) => void;
  kcal: string;
  onKcalChange: (v: string) => void;
  protein: string;
  onProteinChange: (v: string) => void;
  carbs: string;
  onCarbsChange: (v: string) => void;
  fat: string;
  onFatChange: (v: string) => void;
  onSubmit: () => void;
  onOpenSearch: () => void;
  styles: Record<string, any>;
  borderColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

function TodayAddFoodFormImpl(props: TodayAddFoodFormProps) {
  const {
    slots,
    activeMealSlot,
    onActiveMealSlotChange,
    title,
    onTitleChange,
    kcal,
    onKcalChange,
    protein,
    onProteinChange,
    carbs,
    onCarbsChange,
    fat,
    onFatChange,
    onSubmit,
    onOpenSearch,
    styles,
    borderColor,
    textSecondaryColor,
    textTertiaryColor,
  } = props;

  // Secondary accent (Frost flag → damson, else clay) for the active slot
  // toggle. The off-white "Search" secondary uses the neutral card token.
  const accent = useAccent();
  const colors = useThemeColors();
  // `borderColor` is retained on the public contract for caller
  // compatibility; the slot pills now derive their fill from the accent +
  // card tokens (Sloe treatment system, 2026-06-08) so it's unused here.
  void borderColor;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Log to {activeMealSlot}</Text>
      <View style={{ flexDirection: "row", gap: Spacing.xs }}>
        {slots.map((s) => (
          <Pressable
            key={s}
            onPress={() => onActiveMealSlotChange(s)}
            style={{
              flex: 1,
              paddingVertical: Spacing.sm,
              borderRadius: Radius.sm,
              alignItems: "center",
              // Sloe treatment system (2026-06-08): filter pill selected =
              // aubergine soft-tint + primarySolid label, NOT a solid fill;
              // unselected = off-white (colors.card) + textSecondary.
              backgroundColor: activeMealSlot === s ? accent.primarySoft : colors.card,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, fontWeight: "700", color: activeMealSlot === s ? accent.primarySolid : textSecondaryColor }}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        placeholder="Food name"
        placeholderTextColor={textTertiaryColor}
        value={title}
        onChangeText={onTitleChange}
        style={styles.input}
      />
      <View style={styles.inputRow}>
        <TextInput
          placeholder="Calories"
          placeholderTextColor={textTertiaryColor}
          keyboardType="number-pad"
          value={kcal}
          onChangeText={onKcalChange}
          style={[styles.input, { flex: 1 }]}
        />
        <TextInput
          placeholder="Protein"
          placeholderTextColor={textTertiaryColor}
          keyboardType="number-pad"
          value={protein}
          onChangeText={onProteinChange}
          style={[styles.input, { flex: 1 }]}
        />
      </View>
      <View style={styles.inputRow}>
        <TextInput
          placeholder="Carbs"
          placeholderTextColor={textTertiaryColor}
          keyboardType="number-pad"
          value={carbs}
          onChangeText={onCarbsChange}
          style={[styles.input, { flex: 1 }]}
        />
        <TextInput
          placeholder="Fat"
          placeholderTextColor={textTertiaryColor}
          keyboardType="number-pad"
          value={fat}
          onChangeText={onFatChange}
          style={[styles.input, { flex: 1 }]}
        />
      </View>
      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
        {/* Button system (2026-06-12,
            `docs/decisions/2026-06-12-button-system-solid-primary.md`):
            "Add to Today" is this quick-add card's ONE primary action →
            `SupprButton` variant="primary" (solid aubergine fill, white
            label, pill, no shadow). Its "Search" sibling is the SECONDARY
            action → variant="ghost" (transparent, plum label, no border).
            Supersedes the old aubergine-OUTLINE + beige `colors.card` pair.
            Mirror of web `today-add-meal-dialog.tsx`. */}
        <SupprButton
          variant="primary"
          accessibilityLabel="Add to Today"
          label="Add to Today"
          onPress={onSubmit}
          style={{ flex: 1 }}
        />
        <SupprButton
          variant="ghost"
          haptic="selection"
          accessibilityLabel="Search"
          onPress={onOpenSearch}
          style={{ flex: 1 }}
        >
          <Search size={16} color={accent.primarySolid} style={{ marginRight: Spacing.xs }} />
          <Text style={{ ...Type.button, color: accent.primarySolid }}>Search</Text>
        </SupprButton>
      </View>
    </View>
  );
}

export const TodayAddFoodForm = memo(TodayAddFoodFormImpl);

export default TodayAddFoodForm;
