import { useState, type ReactNode } from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

/**
 * Discover cover image with on-error fallback. If `uri` is empty or 404s,
 * renders `fallback` (typically a `RecipeHeroFallback` tile). Extracted from
 * `app/(tabs)/discover.tsx` (ENG-695) so the cuisine-rail cards share the exact
 * same image-with-fallback behaviour as the flat feed rows.
 *
 * (expo-image adoption here is tracked separately under ENG-685 — this keeps the
 * current RN Image behaviour verbatim.)
 */
export function DiscoverCoverImage({
  uri,
  style,
  fallback,
}: {
  uri: string | null | undefined;
  style: StyleProp<ImageStyle>;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const trimmed = (uri ?? "").trim();
  if (!trimmed || broken) return <>{fallback}</>;
  return (
    <Image
      source={{ uri: trimmed }}
      style={style}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      onError={() => setBroken(true)}
    />
  );
}
