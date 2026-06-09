import { Pressable, StyleSheet, Text, View } from "react-native";
import { Coffee, Sun, UtensilsCrossed, Cookie } from "lucide-react-native";
import type { ComponentType } from "react";
import { Spacing, Radius, Type, Accent } from "@/constants/theme";
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
  // border, tint, glyph, and label.
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
            <Pressable
              key={opt.value}
              onPress={() => toggle(opt.value)}
              style={[
                styles.chip,
                {
                  borderColor: active ? accent.primary : colors.border,
                  backgroundColor: active ? accent.primary + "15" : "transparent",
                },
              ]}
            >
              <Icon size={14} color={active ? accent.primary : colors.textSecondary} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? "700" : "500",
                  color: active ? accent.primary : colors.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
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
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
});
