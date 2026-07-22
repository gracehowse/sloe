import React from "react";
import { View, type ViewStyle } from "react-native";

import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export function MobileStoryFrame({
  children,
  style,
  width = 360,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  width?: number;
}) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        {
          width,
          padding: Spacing.md,
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
