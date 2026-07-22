import * as React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { IconButtonSize, IconSize, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";

/**
 * IconButton — circular icon-only control (bell / calendar / kebab / close).
 *
 * ENG-1662 anatomy owner. Three tokenised diameters only — screens must not
 * restate 28/36/40 literals. Muted fill by default; `variant="ghost"` for
 * transparent chrome on sheets.
 *
 * Web mirror: `src/app/components/ui/icon-button.tsx`.
 */
export type IconButtonSizeKey = keyof typeof IconButtonSize;

export type IconButtonVariant = "muted" | "ghost";

export interface IconButtonProps {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  size?: IconButtonSizeKey;
  variant?: IconButtonVariant;
  /** Icon glyph size. Defaults to a size matched to the button diameter. */
  iconSize?: number;
  iconStrokeWidth?: number;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_ICON_SIZE: Record<IconButtonSizeKey, number> = {
  sm: IconSize.md,
  md: IconSize.base,
  lg: IconSize.xl,
};

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  size = "md",
  variant = "muted",
  iconSize,
  iconStrokeWidth = 2,
  disabled = false,
  testID,
  style,
}: IconButtonProps) {
  const colors = useThemeColors();
  const diameter = IconButtonSize[size];
  const glyph = iconSize ?? DEFAULT_ICON_SIZE[size];

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
          backgroundColor:
            variant === "ghost" ? "transparent" : colors.backgroundSecondary,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Icon size={glyph} color={colors.text} strokeWidth={iconStrokeWidth} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default IconButton;
