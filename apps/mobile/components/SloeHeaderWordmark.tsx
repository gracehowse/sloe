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
 * Sloe header wordmark — Newsreader semibold in plum (`MacroColors.calories`),
 * rendered as "Sloe" (capital S) to match the canonical Figma `654:2` Today
 * frame (`font-headline text-xl font-semibold text-plum`). Updated 2026-06-08
 * from the earlier lowercase "sloe" / regular weight so Today, login, and the
 * launch screen all read the wordmark identically (web parity:
 * `src/app/components/ui/suppr-mark.tsx`).
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
          fontFamily: FontFamily.serifSemibold,
          fontWeight: "600",
          fontSize,
          // Scale lineHeight with fontSize — `Type.title` hard-codes
          // lineHeight 28 (for its 24px size), which clips the serif's
          // bottom when the wordmark is enlarged (e.g. login `fontSize={40}`).
          // ×1.25 → 28 at the default 22px (no regression), 50 at 40px.
          lineHeight: Math.round(fontSize * 1.25),
          color: MacroColors.calories,
        },
        style,
      ]}
    >
      Sloe
    </Text>
  );
}
