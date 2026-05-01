import * as React from "react";
import { Pressable, Text, View, ViewStyle, StyleProp } from "react-native";
import { Accent, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Mobile Segmented — small pill toggle for the metric/imperial switch
 * on Height + Weight. Mirrors the web primitive at
 * `src/app/components/onboarding/segmented.tsx`.
 */

export interface MobileSegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
}

export interface MobileSegmentedProps<T extends string = string> {
  options: MobileSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function MobileSegmented<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel = "Toggle",
  style,
}: MobileSegmentedProps<T>) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={ariaLabel}
      style={[
        {
          flexDirection: "row",
          alignSelf: "center",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md - 2,
          padding: 3,
          gap: 2,
        },
        style,
      ]}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 7,
              backgroundColor: on ? Accent.primary : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: on ? "#0a0a0f" : colors.textSecondary,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
