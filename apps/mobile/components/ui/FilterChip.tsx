/**
 * FilterChip — §7 filter / option chip (mobile).
 *
 * The chip ruling (2026-07-10, ENG-1375 S1 —
 * `docs/decisions/2026-07-10-chip-grammar-soft-tint.md`): soft tint carries
 * selection on ALL filter/option chips. Fully round; rest = quiet card /
 * secondary fill with NO border; selected = `accent.primarySoft` tint fill +
 * `accent.primarySolid` semibold label (the ENG-1022 grammar). Solid primary
 * fill is reserved for DAY CELLS (week strips, date pills) only.
 *
 * Web mirror: `src/app/components/ui/filter-chip.tsx`.
 */
import * as React from "react";
import { Text } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import {
  FontFamily,
  FontWeight,
  Radius,
  Spacing,
  Type,
} from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Leading slot — e.g. a 14px lucide glyph. Caller owns its colour. */
  leading?: React.ReactNode;
  /** Trailing slot — e.g. the chevron on sheet-opening setting chips. */
  trailing?: React.ReactNode;
  /** Rest fill. `card` (default) on page-ground rows; `secondary` when the
   *  chip sits ON a card-coloured surface (sheets), where a card fill would
   *  vanish. Both are legal §7 quiet fills. */
  restFill?: "card" | "secondary";
  /** `sm` = captionSmall (12), `md` = body (14). Mirrors the web sizes. */
  size?: "sm" | "md";
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function FilterChip({
  label,
  selected = false,
  onPress,
  leading,
  trailing,
  restFill = "card",
  size = "sm",
  disabled = false,
  accessibilityLabel,
  testID,
}: FilterChipProps) {
  const colors = useThemeColors();
  const accent = useAccent();

  const restFillColor =
    restFill === "secondary" ? colors.backgroundSecondary : colors.card;
  const typeRole = size === "md" ? Type.body : Type.captionSmall;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: Spacing.xs,
        paddingHorizontal: Spacing.dense,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.full,
        backgroundColor: selected ? accent.primarySoft : restFillColor,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {leading}
      <Text
        style={{
          fontSize: typeRole.fontSize,
          lineHeight: typeRole.lineHeight,
          fontFamily: selected ? FontFamily.sansSemibold : FontFamily.sansMedium,
          fontWeight: selected ? FontWeight.semibold : FontWeight.medium,
          color: selected ? accent.primarySolid : colors.textSecondary,
        }}
      >
        {label}
      </Text>
      {trailing}
    </PressableScale>
  );
}

export default FilterChip;
