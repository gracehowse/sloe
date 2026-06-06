import * as React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

import { FontFamily, MacroColors, Type } from "@/constants/theme";

export type SloeHeaderWordmarkProps = {
  /** Default 22 — matches Today header; use ~48 on launch screen. */
  fontSize?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * Sloe header wordmark — the same treatment as Today’s top-left title:
 * Newsreader (`Type.title`) in plum (`MacroColors.calories`).
 */
export function SloeHeaderWordmark({
  fontSize = 22,
  style,
  testID = "sloe-header-wordmark",
}: SloeHeaderWordmarkProps) {
  return (
    <Text
      testID={testID}
      accessibilityRole="header"
      accessibilityLabel="Sloe"
      style={[
        Type.title,
        {
          fontFamily: FontFamily.serifRegular,
          fontSize,
          color: MacroColors.calories,
        },
        style,
      ]}
    >
      sloe
    </Text>
  );
}
