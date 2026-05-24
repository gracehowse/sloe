import * as React from "react";
import { Pressable, Text, View, ViewStyle, StyleProp } from "react-native";
import { Accent, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useHaptics } from "@/hooks/useHaptics";

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
  const haptics = useHaptics();
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
          borderRadius: Radius.md,
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
            onPress={() => {
              if (!on) haptics.select();
              onChange(opt.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: Radius.sm,
              // Canonical 2026-05-22: selected = soft fill + primary text,
              // NOT solid indigo. Solid reserved for primary action only.
              backgroundColor: on ? Accent.primarySoft : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: on ? Accent.primary : colors.textSecondary,
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
