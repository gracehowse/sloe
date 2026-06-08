import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Spacing, Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

const MEAL_OPTIONS = [
  { value: "breakfast", label: "Breakfast", icon: "cafe-outline" as const },
  { value: "lunch", label: "Lunch", icon: "sunny-outline" as const },
  { value: "dinner", label: "Dinner", icon: "restaurant-outline" as const },
  { value: "snack", label: "Snacks", icon: "cafe-outline" as const },
] as const;

type Props = {
  selected: string[];
  onChange: (tags: string[]) => void;
  label?: string;
};

export default function MealTypePicker({ selected, onChange, label }: Props) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the selected meal-type
  // chips' border, tint, glyph, and label.
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
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1 }}>
          {label}
        </Text>
      )}
      <View style={styles.row}>
        {MEAL_OPTIONS.map((opt) => {
          const active = selected.includes(opt.value);
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
              <Ionicons name={opt.icon} size={14} color={active ? accent.primary : colors.textSecondary} />
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
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
