import { Text, TextInput, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Compact numeric target field for the manual-targets bridge card
 * (kcal / P / C / F). Extracted from `data-bridges.tsx` (ENG-120 line-budget
 * claw-back) — pure, self-contained, no behaviour change.
 */
export function TargetInput({
  label,
  value,
  onChangeText,
  onBlur,
  color,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  onBlur: () => void;
  color: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.inputBg,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType="numeric"
        accessibilityLabel={`Manual ${label} target`}
        style={{
          fontSize: 16,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
          color: colors.text,
          paddingVertical: 0,
          marginTop: 2,
        }}
      />
    </View>
  );
}
