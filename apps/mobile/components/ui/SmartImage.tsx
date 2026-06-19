import * as React from "react";
import { Image as RNImage, type ImageStyle, type StyleProp } from "react-native";
import { Image as ExpoImage } from "expo-image";

import { isFeatureEnabled } from "@/lib/analytics";

/**
 * SmartImage — flag-gated remote-image wrapper that kills the "pop-in"
 * snap on recipe cards / heroes / Discover rails (ENG-685).
 *
 * Under the `expo_image_adoption_v1` flag it renders `expo-image` with a
 * 200 ms cross-fade (`transition`) over a solid DS-token tint placeholder,
 * a `memory-disk` cache so re-scrolled cards don't refetch, and a
 * `recyclingKey` so recycled list rows never flash a stale neighbour's
 * photo. With the flag OFF it renders the **verbatim** React-Native
 * `Image` (same `source`/`style`/`resizeMode`/`onError`) — a true
 * kill-switch with zero visual change, so callers can be migrated ahead of
 * the ramp.
 *
 * Scope note: the ticket's "blurhash" is deliberately NOT implemented —
 * there is no blurhash/thumbhash field in the recipe schema (web ships
 * none either). A solid-tint placeholder + fade matches web's
 * no-pop-in / no-layout-shift outcome; real blurhash is a separate
 * import-time hash-generation ticket.
 *
 * Keep each caller's own no-URI / onError → fallback branch (e.g.
 * `RecipeHeroFallback`, `FoodFallbackThumb`) — SmartImage only renders the
 * happy-path photo; it does not own the fallback.
 */
const RESIZE_TO_CONTENT_FIT = {
  cover: "cover",
  contain: "contain",
  stretch: "fill",
  center: "none",
} as const;

export type SmartImageProps = {
  source: { uri: string };
  style?: StyleProp<ImageStyle>;
  /** RN-style fit; mapped to expo-image `contentFit` on the flagged path. Default "cover". */
  resizeMode?: keyof typeof RESIZE_TO_CONTENT_FIT;
  /** Called (no args) when the image fails to load — drives the caller's fallback. */
  onError?: () => void;
  /** Called (no args) when the image finishes loading. */
  onLoad?: () => void;
  /**
   * Stable identity for recycled list/grid rows so expo-image never shows a
   * neighbour's cached photo during fast scroll. Defaults to the URI.
   */
  recyclingKey?: string | null;
  /** Solid placeholder tint shown under the fade (flagged path only). */
  placeholderColor?: string;
  /** ms cross-fade on the flagged path. Default 200. */
  transitionMs?: number;
  accessibilityIgnoresInvertColors?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function SmartImage({
  source,
  style,
  resizeMode = "cover",
  onError,
  onLoad,
  recyclingKey,
  placeholderColor,
  transitionMs = 200,
  accessibilityIgnoresInvertColors,
  accessibilityLabel,
  testID,
}: SmartImageProps) {
  if (isFeatureEnabled("expo_image_adoption_v1")) {
    return (
      <ExpoImage
        source={source}
        style={[placeholderColor ? { backgroundColor: placeholderColor } : null, style]}
        contentFit={RESIZE_TO_CONTENT_FIT[resizeMode]}
        transition={transitionMs}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey ?? source.uri}
        onError={onError ? () => onError() : undefined}
        onLoad={onLoad ? () => onLoad() : undefined}
        accessibilityIgnoresInvertColors={accessibilityIgnoresInvertColors}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      />
    );
  }
  // Kill-switch: verbatim RN Image (current behaviour, no visual change).
  return (
    <RNImage
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={onError ? () => onError() : undefined}
      onLoad={onLoad ? () => onLoad() : undefined}
      accessibilityIgnoresInvertColors={accessibilityIgnoresInvertColors}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  );
}
