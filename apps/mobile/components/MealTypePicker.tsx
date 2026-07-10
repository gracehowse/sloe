import { StyleSheet, Text, View } from "react-native";
import { Coffee, Sun, UtensilsCrossed, Cookie } from "lucide-react-native";
import type { ComponentType } from "react";
import { Spacing, Type, Accent } from "@/constants/theme";
import { FilterChip } from "@/components/ui/FilterChip";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

type LucideRnIcon = ComponentType<{ size?: number; color?: string }>;

// Lucide line-icon set (§0.1(b)) — replaces the prior Ionicons mix so the
// create-recipe meal chips share one icon family with Library / Detail.
// Breakfast → Coffee, Lunch → Sun, Dinner → UtensilsCrossed, Snacks → Cookie.
const MEAL_OPTIONS = [
  { value: "breakfast", label: "Breakfast", Icon: Coffee as LucideRnIcon },
  { value: "lunch", label: "Lunch", Icon: Sun as LucideRnIcon },
  { value: "dinner", label: "Dinner", Icon: UtensilsCrossed as LucideRnIcon },
  { value: "snack", label: "Snacks", Icon: Cookie as LucideRnIcon },
] as const;

type Props = {
  selected: string[];
  onChange: (tags: string[]) => void;
  label?: string;
};

export default function MealTypePicker({ selected, onChange, label }: Props) {
  const colors = useThemeColors();
  // Functional accent (clay/aubergine) for the selected meal-type chips'
  // glyph (fill + label live in the shared FilterChip).
  const accent = useAccent();

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      {label && (
        // Section eyebrow token (§2.2 rule 6 / §10.11): Inter ~10–11pt 600,
        // +0.08em tracking, sage `--secondary`. Type.label carries the
        // uppercase + tracking; sage is the eyebrow role colour (Accent.success
        // is the Sloe sage token), not tertiary grey.
        <Text style={[Type.label, { color: Accent.success }]}>{label}</Text>
      )}
      <View style={styles.row}>
        {MEAL_OPTIONS.map((opt) => {
          const active = selected.includes(opt.value);
          const Icon = opt.Icon;
          return (
            // Chip ruling 2026-07-10 (ENG-1375 S1): shared §7 FilterChip —
            // soft-tint selection, borderless quiet rest fill.
            <FilterChip
              key={opt.value}
              label={opt.label}
              selected={active}
              onPress={() => toggle(opt.value)}
              leading={
                <Icon
                  size={14}
                  color={active ? accent.primarySolid : colors.textSecondary}
                />
              }
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
});
