import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Search } from "lucide-react-native";
import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";

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

export function TodayAddFoodForm(props: TodayAddFoodFormProps) {
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
  // toggle + the Search CTA fill.
  const accent = useAccent();

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
              paddingVertical: 6,
              borderRadius: Radius.sm,
              alignItems: "center",
              backgroundColor: activeMealSlot === s ? accent.primary : borderColor + "30",
            }}
          >
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, fontWeight: "700", color: activeMealSlot === s ? "#fff" : textSecondaryColor }}
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
        <Pressable style={[styles.submitBtn, { flex: 1 }]} onPress={onSubmit}>
          <Text style={styles.submitBtnText}>Add to Today</Text>
        </Pressable>
        <Pressable
          style={[styles.submitBtn, { flex: 1, backgroundColor: accent.primary }]}
          onPress={onOpenSearch}
        >
          <Search size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.submitBtnText}>Search</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default TodayAddFoodForm;
