/**
 * AddRowButton — the ONE add-row / AddControl grammar (mobile).
 *
 * The AddControl ruling (2026-07-10, ENG-1375 S4 —
 * `docs/decisions/2026-07-10-chip-grammar-soft-tint.md` §AddControl): every
 * in-card "add another X" affordance is a quiet-fill row —
 * `colors.fillQuiet` fill, radius 12 (`Radius.xl` — the 12-inside-24 inset
 * standard), Plus glyph + `accent.primarySolid` semibold label, full-width
 * in-card. NO border, NO second card. DASHED borders are upload dropzones
 * ONLY (photo-log, RecipeUpload) — never an add-row action.
 *
 * ENG-1662 / anatomy program: under `ui_anatomy_owners_v1` the row is
 * LEFT-ALIGNED (panel form) so it reads as an InsetPanel-with-action, not a
 * squashed centred pill next to radius-full chips. Flag-off keeps the
 * legacy centred label (kill switch).
 *
 * Extracted from the canonical pair: `TodayMealsSection` "Add food" pill
 * (mobile) ↔ `today-meals-section.tsx` (web) — the FIRST quiet-fill adoption
 * (F-160 / flat-card surfaces, 2026-06-12).
 *
 * Web mirror: `src/app/components/ui/add-row-button.tsx`.
 */
import * as React from "react";
import {
  ActivityIndicator,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Plus } from "lucide-react-native";

import {
  PressableScale,
  type PressableScaleHaptic,
} from "@/components/ui/PressableScale";
import { FontFamily, FontWeight, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";

export interface AddRowButtonProps {
  label: string;
  onPress?: () => void;
  /** Leading glyph override — defaults to the Plus. Caller owns its colour. */
  icon?: React.ReactNode;
  /** Async commit in flight — swaps the glyph for a spinner + blocks press. */
  loading?: boolean;
  disabled?: boolean;
  /** `md` (default) = body 14 semibold; `sm` = captionSmall 12 semibold for
   *  dense multi-control rows (planner add-slot chips). */
  size?: "md" | "sm";
  /** Haptic weight. `selection` (default) for open-a-sheet adds; `confirm`
   *  when the press itself commits data (ENG-1016 — e.g. planner add-slot). */
  haptic?: PressableScaleHaptic;
  /** Layout-only overrides (flex, margins). Fill / radius / type are the
   *  grammar — never restyle them here. */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function AddRowButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  size = "md",
  haptic = "selection",
  style,
  accessibilityLabel,
  testID,
}: AddRowButtonProps) {
  const colors = useThemeColors();
  const accent = useAccent();

  const isDisabled = disabled || loading;
  const typeRole = size === "md" ? Type.body : Type.captionSmall;
  const glyphSize = size === "md" ? 15 : 12;
  // ENG-1662 — panel form (left-aligned) so the 12-radius inset row doesn't
  // read as a squashed pill next to radius-full chips.
  const panelForm = isFeatureEnabled("ui_anatomy_owners_v1");

  return (
    <PressableScale
      // Guard here as well as via `disabled` — a loading control must never
      // double-fire its commit even if the wrapper's disabled handling drifts.
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: panelForm ? "flex-start" : "center",
          gap: size === "md" ? Spacing.sm : Spacing.xs,
          paddingVertical: Spacing.sm,
          paddingHorizontal: size === "md" ? Spacing.dense : Spacing.xs,
          borderRadius: Radius.xl,
          backgroundColor: colors.fillQuiet,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={accent.primarySolid} />
      ) : (
        icon ?? (
          <Plus size={glyphSize} color={accent.primarySolid} strokeWidth={2.25} />
        )
      )}
      <Text
        numberOfLines={1}
        style={{
          fontSize: typeRole.fontSize,
          lineHeight: typeRole.lineHeight,
          fontFamily: FontFamily.sansSemibold,
          fontWeight: FontWeight.semibold,
          color: accent.primarySolid,
        }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

export default AddRowButton;
