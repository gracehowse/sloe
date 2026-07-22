import * as React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { Radius, StepperCircleSize } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";

/**
 * StepperCircleButton — ± circle for numeric steppers (ENG-1662).
 *
 * Three tokenised diameters (`sm` 32 / `md` 40 / `lg` 44) replace the
 * ad-hoc builds in ServingStepper, NumberStepper, and PortionStepper.
 *
 * Web mirror: `src/app/components/ui/stepper-circle-button.tsx`.
 */
export type StepperCircleSizeKey = keyof typeof StepperCircleSize;

export interface StepperCircleButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  size?: StepperCircleSizeKey;
  /** When true, draws a hairline border (PortionStepper style). */
  bordered?: boolean;
  children: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function StepperCircleButton({
  onPress,
  accessibilityLabel,
  disabled = false,
  size = "md",
  bordered = false,
  children,
  testID,
  style,
}: StepperCircleButtonProps) {
  const colors = useThemeColors();
  const diameter = StepperCircleSize[size];

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.base,
        {
          width: diameter,
          height: diameter,
          borderRadius: Radius.full,
          backgroundColor: colors.inputBg,
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.35 : 1,
        },
        style,
      ]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default StepperCircleButton;
