import * as React from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
import { FontFamily, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { StepperCircleButton } from "@/components/ui/StepperCircleButton";

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
  const btnSizeKey = big ? "lg" : "md";
  const numSize = big ? 56 : 36;

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: big ? Spacing.xl : Spacing.md,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.lg,
          padding: big ? 24 : 16,
        },
        style,
      ]}
    >
      <StepperCircleButton
        onPress={dec}
        disabled={value <= min}
        accessibilityLabel={`Decrement ${ariaLabel.toLowerCase()}`}
        size={btnSizeKey}
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
      </StepperCircleButton>

      <View style={{ alignItems: "center", minWidth: big ? 140 : 100 }}>
        <Text
          accessibilityLabel={ariaLabel}
          accessibilityValue={{ now: value, min, max }}
          accessibilityRole="adjustable"
          style={{
            // SLOE Phase 0: the onboarding stepper hero value reads in
            // Newsreader serif (family carries the weight; sans 800 dropped).
            // The +/− glyphs above/below stay sans.
            fontFamily: FontFamily.serifRegular,
            fontSize: numSize,
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
              marginTop: Spacing.xs,
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

      <StepperCircleButton
        onPress={inc}
        disabled={value >= max}
        accessibilityLabel={`Increment ${ariaLabel.toLowerCase()}`}
        size={btnSizeKey}
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
      </StepperCircleButton>
    </View>
  );
}
