/**
 * FatSecretBadge — mandatory attribution component for FatSecret Platform API.
 *
 * Authority: FatSecret Platform API Attribution Policy (contract requirement).
 * Decision: docs/decisions/2026-04-27-fatsecret-attribution-policy.md
 *
 * Renders the official "Powered by fatsecret Platform API" attribution.
 * On mobile we use the text variant as the primary form — the badge
 * image (SVG, 90×15) is served from FatSecret's CDN which requires a
 * network hit; the text form works offline and avoids a cold-load flash.
 *
 * Usage rules (from FatSecret ToS):
 *   - Must appear wherever FatSecret-sourced content is displayed.
 *   - Must not be modified from the official wording.
 *
 * Props:
 *   - variant="badge"   Remote badge image via <Image> (default).
 *   - variant="text"    Plain text attribution (recommended for lists
 *                       and barcode contexts — no network dependency).
 *   - show              When false renders nothing. Pass
 *                       `show={hasFatSecretContent}` at call sites.
 *
 * Mirror: src/app/components/ui/FatSecretBadge.tsx
 */

import * as React from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useThemeColors } from "@/hooks/use-theme-colors";

export interface FatSecretBadgeProps {
  /**
   * "badge"  — remote badge image (default).
   * "text"   — plain-text attribution (offline-safe).
   */
  variant?: "badge" | "text";
  /**
   * When false the component renders null.
   * Convenience prop so callers can write
   *   <FatSecretBadge show={recipe.verified_source === "FatSecret"} />
   */
  show?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const BADGE_IMAGE_URL =
  "https://platform.fatsecret.com/api/static/images/powered_by_fatsecret.svg";
const FATSECRET_URL = "https://www.fatsecret.com";

export function FatSecretBadge({
  variant = "badge",
  show = true,
  style,
  testID,
}: FatSecretBadgeProps) {
  const colors = useThemeColors();

  if (!show) return null;

  const handlePress = () => {
    Linking.openURL(FATSECRET_URL).catch(() => {/* ignore */});
  };

  if (variant === "text") {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="link"
        accessibilityLabel="Powered by fatsecret Platform API"
        testID={testID ?? "fatsecret-badge"}
        style={[styles.textContainer, style]}
      >
        <Text style={[styles.text, { color: colors.textTertiary }]}>
          Powered by fatsecret Platform API
        </Text>
      </Pressable>
    );
  }

  /* Badge variant — official image. Must not be modified per ToS. */
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="link"
      accessibilityLabel="Powered by fatsecret Platform API"
      testID={testID ?? "fatsecret-badge"}
      style={[styles.badgeContainer, style]}
    >
      <View style={styles.badgeWrap}>
        <Image
          source={{ uri: BADGE_IMAGE_URL }}
          style={styles.badgeImage}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  textContainer: {
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 10,
    lineHeight: 14,
  },
  badgeContainer: {
    alignSelf: "flex-start",
  },
  badgeWrap: {
    backgroundColor: "transparent",
  },
  badgeImage: {
    width: 90,
    height: 15,
  },
});

export default FatSecretBadge;
