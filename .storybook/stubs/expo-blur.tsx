/** Storybook stub — BlurView is a plain View on RN-web Chromatic. */
import * as React from "react";
import { View, type ViewProps } from "react-native";

export type BlurViewProps = ViewProps & {
  intensity?: number;
  tint?: string;
  experimentalBlurMethod?: string;
};

export function BlurView({ intensity: _i, tint: _t, experimentalBlurMethod: _e, ...rest }: BlurViewProps) {
  return <View {...rest} />;
}

export default { BlurView };
