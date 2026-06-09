import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Check, Sparkles } from "lucide-react-native";
import { Accent, Radius } from "@/constants/theme";
import type { TrustChipVariant } from "@suppr/shared/types/trust";

/**
 * Mobile `<TrustChip>` — production design spec §1.6.
 *
 * Six variants, full-width radius pill. Mirror of
 * `src/app/components/ui/trust-chip.tsx`.
 *
 * Geometry: 22pt height, padding 3 x 8, radius `Radius.full`.
 *
 * Every variant fg — including `off-adjusted`'s `Accent.primary` — is a SOURCE /
 * provenance / confidence signal, not a CTA, so it reads the static clay
 * `Accent.primary` directly and is intentionally NOT routed through
 * `useAccent()`. (The Frost secondary-colour exploration was retired 2026-06-08,
 * ENG-997 — clay is now the unconditional accent regardless.)
 */

export type { TrustChipVariant } from "@suppr/shared/types/trust";

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
    bg: "rgba(98, 179, 90, 0.08)",
    fg: Accent.success,
    glyph: "check",
    label: "USDA verified",
  },
  "off-adjusted": {
    bg: "rgba(76, 108, 224, 0.12)",
    fg: Accent.primary,
    glyph: "check",
    label: "OFF · adjusted",
  },
  estimated: {
    bg: "rgba(224, 168, 56, 0.10)",
    fg: Accent.warning,
    glyph: "sparkles",
    label: "Estimated · verify",
  },
  manual: {
    bg: "rgba(140, 131, 120, 0.12)",
    fg: "#5e574e",
    glyph: null,
    label: "Manual",
  },
  "gluten-high-conf": {
    bg: "rgba(98, 179, 90, 0.08)",
    fg: Accent.success,
    // ENG-748 (legal-reviewer P0): the gluten chip must NOT read as a
    // verified safety guarantee on a coeliac surface. The `check` glyph
    // is the "verified" mark — swapped to `sparkles` (the "estimated"
    // glyph, shared with `gluten-uncertain`) so the chip reads as an
    // ingredient-name estimate, paired with the persistent disclaimer
    // caption rendered beneath it on the recipe-detail heroes.
    glyph: "sparkles",
    label: "No gluten-containing ingredients",
  },
  "gluten-uncertain": {
    bg: "rgba(224, 168, 56, 0.10)",
    fg: Accent.warning,
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
