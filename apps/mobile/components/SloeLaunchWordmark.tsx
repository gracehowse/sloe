import * as React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

/** Fraunces "sloe" wordmark raster — same transparent asset as the native splash logo. */
const SLOE_LAUNCH_WORDMARK = require("@/assets/images/splash-icon.png");

/** Intrinsic aspect of the wordmark asset (3088×1661 viewBox → height/width). */
const WORDMARK_ASPECT = 0.538;

export type SloeLaunchWordmarkProps = {
  /** Logical width of the wordmark on launch screens (default 200). */
  width?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
};

/**
 * Launch / boot wordmark — uses the Fraunces "sloe" PNG from `build:brand-icons`
 * (sourced from docs/brand/sloe/assets/gen/wordmark-final) so it matches the
 * native splash logo exactly. The height tracks the asset's true aspect so the
 * in-app launch wordmark renders at the same size as the native splash (no jump).
 */
export function SloeLaunchWordmark({
  width = 200,
  style,
  testID = "sloe-launch-wordmark",
}: SloeLaunchWordmarkProps) {
  const height = Math.round(width * WORDMARK_ASPECT);

  return (
    <Image
      testID={testID}
      source={SLOE_LAUNCH_WORDMARK}
      accessibilityRole="image"
      accessibilityLabel="Sloe"
      resizeMode="contain"
      style={[{ width, height }, style]}
    />
  );
}
