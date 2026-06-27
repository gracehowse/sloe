import * as React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

import { FontFamily, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export type SloeHeaderWordmarkProps = {
  /** Default 22 — matches Today header; use ~48 on launch screen. */
  fontSize?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * Sloe header wordmark — lowercase "sloe" in **Fraunces Light** + scheme-
 * resolved plum, per the v3 prototype's LOCKED type-split (Fraunces = wordmark
 * only; `docs/ux/redesign/v3/Sloe-App.html` `.wordmark` = `text-transform:
 * lowercase`, Fraunces opsz 144 / light ~360, calm low weight). Supersedes the
 * 2026-06-08 Newsreader-semibold capital-"Sloe" Figma treatment (Figma is no
 * longer the source of truth — 2026-06-24). Web parity:
 * `src/app/components/ui/suppr-mark.tsx`.
 */
export function SloeHeaderWordmark({
  fontSize = 22,
  style,
  testID = "sloe-header-wordmark",
}: SloeHeaderWordmarkProps) {
  // ENG-1010 (2026-06-10): scheme-resolved plum. The static plum wordmark
  // measured ~1.4:1 on the dark Today header — the first thing on a dark
  // cold-open was near-invisible. The Fraunces Light face is thinner than the
  // old semibold, so this scheme-resolved colour stays load-bearing for
  // dark-header contrast.
  const colors = useThemeColors();
  return (
    <Text
      testID={testID}
      accessibilityRole="header"
      // Accessible name stays the proper-noun brand ("Sloe"); the lowercase
      // is a purely visual wordmark treatment.
      accessibilityLabel="Sloe"
      style={[
        Type.title,
        {
          fontFamily: FontFamily.brand,
          // Fraunces Bold (700) — matches the splash logotype (Grace
          // 2026-06-26). Explicit value keeps RN from synthesising a fallback.
          fontWeight: "700",
          fontSize,
          // Scale lineHeight with fontSize — `Type.title` hard-codes
          // lineHeight 28 (for its 24px size), which clips the serif's
          // bottom when the wordmark is enlarged (e.g. login `fontSize={40}`).
          // ×1.25 → 28 at the default 22px (no regression), 50 at 40px.
          lineHeight: Math.round(fontSize * 1.25),
          // Tightened tracking per the prototype `.wordmark` (-0.01em).
          letterSpacing: fontSize * -0.01,
          color: colors.navPrimary,
        },
        style,
      ]}
    >
      sloe
    </Text>
  );
}
