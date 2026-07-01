import * as React from "react";
import { StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";
import { Accent, Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";

/**
 * Mobile `<Badge>` primitive — the single compact-pill abstraction used
 * across the RN app to tag rows with a short semantic label. Mirrors the
 * web primitive at `src/app/components/suppr/badge.tsx` (same variants,
 * same default aria-labels, same shape).
 *
 * Extending: add a new variant here + to `variantColors`. Do not roll a
 * new inline `<View>+<Text>` pill elsewhere.
 */

export type BadgeVariant =
  | "neutral"
  | "info"
  | "warn"
  | "pro"
  | "ai"
  | "added"
  | "override"
  | "leftover"
  | "custom"
  | "freeze";

/** Anchor colour per variant. Backgrounds/borders are derived from the
 *  anchor via alpha-mix so every variant renders with identical shape. */
const variantColors: Record<BadgeVariant, string> = {
  neutral: "#94a3b8", // slate-400 — matches NutritionSourceBadge "manual" tone
  info: Accent.info,
  warn: Accent.warning,
  pro: Accent.primary, // overridden in-component via useAccent (scheme-resolved)
  // AI — violet/purple. Mirrors web --chart-5.
  ai: "#9679D9",
  added: Accent.success,
  override: Accent.warning,
  leftover: Accent.warning,
  custom: Accent.primary, // overridden in-component via useAccent
  freeze: Accent.cyan,
};

const defaultAccessibilityLabel: Partial<Record<BadgeVariant, string>> = {
  pro: "Pro feature",
  override: "Manual override",
  leftover: "Leftover meal",
  freeze: "Streak freeze",
  ai: "AI estimated",
  added: "Added by you",
  custom: "Custom food",
};

export interface BadgeProps {
  variant?: BadgeVariant;
  accessibilityLabel?: string;
  /** Optional leading node rendered before the label (e.g. an Ionicon). */
  icon?: React.ReactNode;
  /** Badge label text. */
  children: React.ReactNode;
  /** Optional style escape hatch for layout (margin, alignSelf). Avoid
   *  using this to override colour or shape. */
  style?: StyleProp<ViewStyle>;
  /** Optional style escape hatch for the label text (fontSize etc.). Same
   *  caveat as `style`. */
  textStyle?: StyleProp<TextStyle>;
}

/** 14% alpha suffix — matches the web `color-mix(... 14%, transparent)` fill. */
const BG_ALPHA = "24";
/** 35% alpha suffix for the border — matches the web border rule. */
const BORDER_ALPHA = "59";

export function Badge({
  variant = "neutral",
  accessibilityLabel,
  icon,
  children,
  style,
  textStyle,
}: BadgeProps) {
  const accent = useAccent();
  // pro/custom anchor follows the scheme-resolved accent (module map can't hook).
  const isPrimaryVariant = variant === "pro" || variant === "custom";
  const color = isPrimaryVariant ? accent.primary : variantColors[variant];
  // ENG-828 / ENG-1275 — the fill/border anchor (`color`) is the raw FILL hue,
  // but several raw hues read below AA 4.5:1 as small TEXT on their own 14%
  // tint. The text ink reads the scheme-resolved AA-safe `-solid` per variant
  // (the same pattern as `pro`/`custom` → `primarySolid`); the fill/border keep
  // the raw hue. Mirrors web `badge.tsx`:
  //   pro/custom → primarySolid (#3B2A4D light / #C4ACD0 dark)
  //   freeze/info → cyanSolid    (#3C5F6B light / #7FAAB8 dark) — web --macro-water-solid
  //   added      → successSolid  (#466046 light / #83A57E dark) — web --accent-success-solid
  // Raw cyan #4A7878 was 4.14:1 light / 2.98:1 dark; raw success #5E7C5A was
  // 3.93:1 light / 3.12:1 dark — both AA FAIL. The `-solid` inks clear AA.
  const textColor = isPrimaryVariant
    ? accent.primarySolid
    : variant === "freeze" || variant === "info"
      ? accent.cyanSolid
      : variant === "added"
        ? accent.successSolid
        : color;
  const label = accessibilityLabel ?? defaultAccessibilityLabel[variant];

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: Radius.full,
          borderWidth: 1,
          borderColor: color + BORDER_ALPHA,
          backgroundColor: color + BG_ALPHA,
          gap: 4,
        },
        style,
      ]}
    >
      {icon ? (
        <View style={{ alignItems: "center", justifyContent: "center" }}>{icon}</View>
      ) : null}
      <Text
        style={[
          {
            fontSize: 10,
            fontWeight: "700",
            color: textColor,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            includeFontPadding: false,
          },
          textStyle,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

export default Badge;
