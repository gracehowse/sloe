import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Check, Sparkles } from "lucide-react-native";
import { Radius } from "@/constants/theme";

/**
 * Mobile `<TrustChip>` — production design spec §1.6.
 *
 * Six variants, full-width radius pill. Mirror of
 * `src/app/components/ui/trust-chip.tsx`.
 *
 * Geometry: 22pt height, padding 3 x 8, radius `Radius.full`.
 */

export type TrustChipVariant =
  | "usda"
  | "off-adjusted"
  | "estimated"
  | "manual"
  | "gluten-high-conf"
  | "gluten-uncertain";

export interface TrustChipProps {
  variant: TrustChipVariant;
  /** Optional override for the visible label. Defaults to spec copy. */
  label?: string;
  style?: ViewStyle;
  testID?: string;
}

interface VariantConfig {
  bg: string;
  fg: string;
  glyph: "check" | "sparkles" | null;
  label: string;
}

const config: Record<TrustChipVariant, VariantConfig> = {
  usda: {
    bg: "rgba(34, 168, 96, 0.08)",
    fg: "#22a860",
    glyph: "check",
    label: "USDA verified",
  },
  "off-adjusted": {
    bg: "rgba(76, 108, 224, 0.08)",
    fg: "#4c6ce0",
    glyph: "check",
    label: "OFF · adjusted",
  },
  estimated: {
    bg: "rgba(232, 160, 32, 0.10)",
    fg: "#e8a020",
    glyph: "sparkles",
    label: "Estimated · verify",
  },
  manual: {
    bg: "rgba(148, 163, 184, 0.10)",
    fg: "#475569",
    glyph: null,
    label: "Manual",
  },
  "gluten-high-conf": {
    bg: "rgba(34, 168, 96, 0.08)",
    fg: "#22a860",
    glyph: "check",
    label: "No gluten-containing ingredients",
  },
  "gluten-uncertain": {
    bg: "rgba(232, 160, 32, 0.10)",
    fg: "#e8a020",
    glyph: "sparkles",
    label: "Contains potential gluten · review",
  },
};

export function TrustChip({ variant, label, style, testID }: TrustChipProps) {
  const cfg = config[variant];
  const displayLabel = label ?? cfg.label;

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={displayLabel}
      style={[
        styles.chip,
        { backgroundColor: cfg.bg },
        style,
      ]}
    >
      {cfg.glyph === "check" ? (
        <Check size={10} color={cfg.fg} strokeWidth={2.5} />
      ) : null}
      {cfg.glyph === "sparkles" ? (
        <Sparkles size={10} color={cfg.fg} strokeWidth={2} />
      ) : null}
      <Text style={[styles.label, { color: cfg.fg }]} numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },
});

export default TrustChip;
