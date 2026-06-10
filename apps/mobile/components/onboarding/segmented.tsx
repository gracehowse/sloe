import * as React from "react";
import { Pressable, Text, View, ViewStyle, StyleProp } from "react-native";
import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
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
  // Secondary accent (Frost flag → damson, else clay) for the selected
  // segment's soft fill + label. The unselected label keeps `textSecondary`.
  const accent = useAccent();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={ariaLabel}
      style={[
        {
          flexDirection: "row",
          alignSelf: "center",
          // Segments census (2026-06-10, §8): the shared inputBg rail —
          // this was the only bordered-card track of the five.
          backgroundColor: colors.inputBg,
          borderRadius: Radius.full,
          padding: 2,
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
              paddingHorizontal: Spacing.dense,
              paddingVertical: Spacing.sm,
              borderRadius: Radius.full, // §8 thumb (chips census 2026-06-10)
              // Canonical 2026-05-22: selected = soft fill + primary text,
              // NOT solid indigo. Solid reserved for primary action only.
              backgroundColor: on ? accent.primarySoft : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: on ? accent.primary : colors.textSecondary,
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
