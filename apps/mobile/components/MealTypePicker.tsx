import { Pressable, StyleSheet, Text, View } from "react-native";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

const MEAL_OPTIONS = [
  { value: "breakfast", label: "Breakfast", emoji: "\u2600\uFE0F" },
  { value: "lunch", label: "Lunch", emoji: "\uD83C\uDF1E" },
  { value: "dinner", label: "Dinner", emoji: "\uD83C\uDF19" },
  { value: "snack", label: "Snack", emoji: "\uD83C\uDF7F" },
] as const;

type Props = {
  selected: string[];
  onChange: (tags: string[]) => void;
  label?: string;
};

export default function MealTypePicker({ selected, onChange, label }: Props) {
  const colors = useThemeColors();

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
                  borderColor: active ? Accent.primary : colors.border,
                  backgroundColor: active ? Accent.primary + "15" : "transparent",
                },
              ]}
            >
              <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? "700" : "500",
                  color: active ? Accent.primary : colors.text,
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
