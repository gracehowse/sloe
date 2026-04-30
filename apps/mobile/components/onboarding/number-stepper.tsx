import * as React from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Mobile NumberStepper — used by the Age step. Mirrors the web
 * primitive at `src/app/components/onboarding/number-stepper.tsx`.
 */

export interface MobileNumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  big?: boolean;
  suffix?: string;
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function MobileNumberStepper({
  value,
  onChange,
  min = 0,
  max = 120,
  step = 1,
  big = false,
  suffix,
  ariaLabel = "Value",
  style,
}: MobileNumberStepperProps) {
  const colors = useThemeColors();
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const btnSize = big ? 48 : 40;
  const numSize = big ? 56 : 36;

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: big ? 28 : 18,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.lg,
          padding: big ? 24 : 16,
        },
        style,
      ]}
    >
      <Pressable
        onPress={dec}
        disabled={value <= min}
        accessibilityLabel={`Decrement ${ariaLabel.toLowerCase()}`}
        style={({ pressed }) => ({
          width: btnSize,
          height: btnSize,
          borderRadius: btnSize / 2,
          backgroundColor: colors.inputBg,
          alignItems: "center",
          justifyContent: "center",
          opacity: value <= min ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 22,
            color: colors.text,
            includeFontPadding: false,
          }}
        >
          −
        </Text>
      </Pressable>

      <View style={{ alignItems: "center", minWidth: big ? 140 : 100 }}>
        <Text
          accessibilityLabel={ariaLabel}
          accessibilityValue={{ now: value, min, max }}
          accessibilityRole="adjustable"
          style={{
            fontSize: numSize,
            fontWeight: "800",
            letterSpacing: -1.5,
            lineHeight: numSize,
            color: colors.text,
            fontVariant: ["tabular-nums"],
            includeFontPadding: false,
          }}
        >
          {value}
        </Text>
        {suffix ? (
          <Text
            style={{
              marginTop: big ? 6 : 4,
              fontSize: big ? 11 : 10,
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: 1,
              color: colors.textTertiary,
            }}
          >
            {suffix}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={inc}
        disabled={value >= max}
        accessibilityLabel={`Increment ${ariaLabel.toLowerCase()}`}
        style={({ pressed }) => ({
          width: btnSize,
          height: btnSize,
          borderRadius: btnSize / 2,
          backgroundColor: colors.inputBg,
          alignItems: "center",
          justifyContent: "center",
          opacity: value >= max ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 22,
            color: colors.text,
            includeFontPadding: false,
          }}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}
