import * as React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * SupprNotice — inline / block notice chrome (ENG-1662).
 *
 * Absorbs the census drift across NorthStar tints, offline pill, insight
 * banners, import/empty-week cards, and invite banners. One radius + fill
 * recipe per `variant`; screens supply content only.
 *
 * Variants (radius):
 *   - `block` — Radius.card (24), full-width cards (empty-week, north-star tint)
 *   - `inline` — Radius.xl (12), nested panels (implausible macros, warnings)
 *   - `pill` — Radius.full, slim offline / status strip
 *
 * Tones map to sanctioned soft fills — no per-screen hexes.
 *
 * Web mirror: `src/app/components/ui/suppr-notice.tsx`.
 */
export type SupprNoticeTone = "primary" | "warning" | "neutral" | "offline" | "destructive";

export type SupprNoticeVariant = "block" | "inline" | "pill";

export interface SupprNoticeProps {
  tone?: SupprNoticeTone;
  variant?: SupprNoticeVariant;
  children: React.ReactNode;
  /** Optional leading icon row slot (caller renders the glyph). */
  leading?: React.ReactNode;
  testID?: string;
  accessibilityRole?: "alert" | "text" | "none";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

function radiusForVariant(variant: SupprNoticeVariant): number {
  switch (variant) {
    case "block":
      return Radius.card;
    case "inline":
      return Radius.xl;
    case "pill":
      return Radius.full;
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

function toneColors(
  tone: SupprNoticeTone,
  colors: ReturnType<typeof useThemeColors>,
  accent: ReturnType<typeof useAccent>,
): { backgroundColor: string; borderColor: string } {
  switch (tone) {
    case "primary":
      return {
        backgroundColor: accent.primarySoft,
        borderColor: accent.primarySoftStrong,
      };
    case "warning":
      return {
        backgroundColor: Accent.warningSoft,
        borderColor: Accent.warningSolid,
      };
    case "destructive":
      return {
        backgroundColor: Accent.destructiveSoft,
        borderColor: Accent.destructiveSoftStrong,
      };
    case "offline":
      return {
        backgroundColor: colors.card,
        borderColor: accent.primarySoftStrong,
      };
    case "neutral":
    default:
      return {
        backgroundColor: colors.card,
        borderColor: colors.border,
      };
  }
}

export function SupprNotice({
  tone = "neutral",
  variant = "inline",
  children,
  leading,
  testID,
  accessibilityRole = "text",
  accessibilityLabel,
  style,
}: SupprNoticeProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const palette = toneColors(tone, colors, accent);
  const corner = radiusForVariant(variant);
  const isPill = variant === "pill";
  const isBlock = variant === "block";

  return (
    <View
      testID={testID}
      accessibilityRole={accessibilityRole === "none" ? undefined : accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        isPill ? styles.pill : styles.panel,
        isBlock && !leading ? styles.blockStack : null,
        {
          borderRadius: corner,
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        style,
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  panel: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  blockStack: {
    flexDirection: "column",
    alignItems: "center",
    gap: Spacing.xs,
  },
  leading: {
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
});

export default SupprNotice;
