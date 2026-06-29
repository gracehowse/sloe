import * as React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";

/** The exact splash logotype asset (Fraunces "sloe", high-opsz, transparent). */
const SLOE_WORDMARK = require("@/assets/images/splash-icon.png");
/** Intrinsic aspect of the wordmark asset (3088×1661 → height / width). */
const WORDMARK_ASPECT = 1661 / 3088;

export type SloeHeaderWordmarkProps = {
  /** Default 22 — matches Today header; use ~48 on launch screen. The image's
   *  drawn height ≈ this value (cap+ascender), so it visually matches the prior
   *  text wordmark's footprint. */
  fontSize?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
};

/**
 * Sloe header wordmark — the **canonical splash logotype** (`splash-icon.png`,
 * the high-optical-size Fraunces "sloe" built by `build:brand-icons` from
 * `docs/brand/sloe/assets/gen/wordmark-final/sloe-fraunces-base.svg`), NOT a
 * live-font approximation. A static Fraunces face (even Bold) can't reproduce
 * the splash's dramatic stroke-contrast (opsz 144), so the only thing that
 * truly matches the splash is the splash's own asset (Grace 2026-06-26 — the
 * font-weight match still "looked nothing like" the splash). The transparent
 * asset is re-tinted to the scheme-resolved plum so it stays legible on the
 * dark header (ENG-1010). Web parity: `src/app/components/ui/suppr-mark.tsx`.
 */
export function SloeHeaderWordmark({
  fontSize = 22,
  style,
  testID = "sloe-header-wordmark",
}: SloeHeaderWordmarkProps) {
  const colors = useThemeColors();
  // Draw at ~the requested cap height; width follows the asset's true aspect.
  const height = Math.round(fontSize * 1.15);
  const width = Math.round(height / WORDMARK_ASPECT);
  return (
    <Image
      testID={testID}
      accessibilityRole="header"
      // Accessible name stays the proper-noun brand; the lowercase logotype is
      // a purely visual treatment.
      accessibilityLabel="Sloe"
      source={SLOE_WORDMARK}
      // The asset ships plum; re-tint to the scheme-resolved nav ink so it reads
      // on both the light and dark Today header.
      tintColor={colors.navPrimary}
      resizeMode="contain"
      style={[{ width, height }, style]}
    />
  );
}
