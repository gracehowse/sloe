/**
 * Storybook stub — expo-image → RN-web Image for Chromatic.
 * SmartImage (and any other caller) keeps the same import surface.
 */
import * as React from "react";
import {
  Image as RNImage,
  type ImageProps,
  type ImageStyle,
  type StyleProp,
} from "react-native";

type ExpoImageProps = ImageProps & {
  contentFit?: "cover" | "contain" | "fill" | "none";
  transition?: number;
  cachePolicy?: string;
  recyclingKey?: string | null;
  placeholder?: unknown;
};

const RESIZE_FROM_CONTENT_FIT = {
  cover: "cover",
  contain: "contain",
  fill: "stretch",
  none: "center",
} as const;

export function Image({
  contentFit = "cover",
  style,
  transition: _transition,
  cachePolicy: _cachePolicy,
  recyclingKey: _recyclingKey,
  placeholder: _placeholder,
  ...rest
}: ExpoImageProps) {
  return (
    <RNImage
      {...rest}
      style={style as StyleProp<ImageStyle>}
      resizeMode={RESIZE_FROM_CONTENT_FIT[contentFit] ?? "cover"}
    />
  );
}

export default { Image };
