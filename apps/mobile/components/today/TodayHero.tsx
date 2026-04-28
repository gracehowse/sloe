import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Radius } from "@/constants/theme";

import { TodayHeroRing } from "./TodayHeroRing";
import { TodayHeroBar } from "./TodayHeroBar";
import { TodayHeroNumber } from "./TodayHeroNumber";
import {
  TodayHeroVariantPicker,
  type TodayHeroVariant,
} from "./TodayHeroVariantPicker";

/**
 * TodayHero — dispatches between ring / bar / number variants and
 * renders the "change hero style" affordance in the card's corner.
 *
 * Phase 2 / B1.2 (D-2026-04-27-03, 2026-04-27): the canonical Today
 * locks the variant to "ring" and hides the picker affordance via
 * `hidePicker`. The bar / number variants and the
 * `<TodayHeroVariantPicker>` component remain in the tree so deep
 * branch tests / archived screenshots still resolve, but no
 * production caller surfaces the picker. Phase 3 removes the unused
 * variants entirely.
 *
 * Ported from the 2026-04-19 Claude Design prototype and trimmed
 * 2026-04-20 (see
 * `feedback_no_duplicate_today_hero_content.md`).
 */
export interface TodayHeroProps {
  variant: TodayHeroVariant;
  onVariantChange: (next: TodayHeroVariant) => void;
  /** Phase 2 / B1.2 — when `true`, the corner grid affordance and
   *  the variant picker modal are hidden entirely. Today now sets
   *  this to `true` so the canonical hero ships without the picker. */
  hidePicker?: boolean;

  consumed: number;
  goal: number;
  baseGoal?: number;

  // Ring-only: macro progress (0..1) for the inner rings when expanded
  proteinPct: number;
  carbsPct: number;
  fatPct: number;

  // Ring-only: expand-macros state (host-owned)
  expanded: boolean;
  onToggleExpanded: () => void;

  // All variants: remaining/consumed toggle (host-owned)
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;

  // Theme colours (from host's theme hook)
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  cardBackgroundColor: string;
  borderColor: string;
  trackColor: string;
}

export function TodayHero(props: TodayHeroProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const {
    variant,
    onVariantChange,
    hidePicker = false,
    consumed,
    goal,
    baseGoal,
    proteinPct,
    carbsPct,
    fatPct,
    expanded,
    onToggleExpanded,
    displayMode,
    onToggleDisplayMode,
    textColor,
    textSecondaryColor,
    textTertiaryColor,
    cardBackgroundColor,
    borderColor,
    trackColor,
  } = props;

  return (
    <View style={{ position: "relative" }}>
      {variant === "ring" && (
        <TodayHeroRing
          consumed={consumed}
          goal={goal}
          baseGoal={baseGoal}
          textColor={textColor}
          secondaryColor={textSecondaryColor}
          trackColor={trackColor}
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          proteinPct={proteinPct}
          carbsPct={carbsPct}
          fatPct={fatPct}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
          displayMode={displayMode}
          onToggleDisplayMode={onToggleDisplayMode}
          textTertiaryColor={textTertiaryColor}
        />
      )}
      {variant === "bar" && (
        <TodayHeroBar
          consumed={consumed}
          goal={goal}
          displayMode={displayMode}
          onToggleDisplayMode={onToggleDisplayMode}
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textSecondaryColor={textSecondaryColor}
          textTertiaryColor={textTertiaryColor}
          trackColor={trackColor}
        />
      )}
      {variant === "number" && (
        <TodayHeroNumber
          consumed={consumed}
          goal={goal}
          displayMode={displayMode}
          onToggleDisplayMode={onToggleDisplayMode}
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
          textSecondaryColor={textSecondaryColor}
          textTertiaryColor={textTertiaryColor}
        />
      )}

      {/* Picker affordance — hidden when `hidePicker` is `true` (set
          by the canonical Today composition root, Phase 2 / B1.2).
          Phase 3 will remove the picker + bar/number variants
          entirely; until then we keep the code path so legacy
          surfaces (e.g. unused screens-mobile prototypes) still
          render. */}
      {!hidePicker ? (
        <>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Change hero style"
            hitSlop={12}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 28,
              height: 28,
              borderRadius: Radius.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${textSecondaryColor}14`,
            }}
          >
            <Ionicons name="grid-outline" size={13} color={textSecondaryColor} />
          </Pressable>

          <TodayHeroVariantPicker
            visible={pickerOpen}
            active={variant}
            onSelect={onVariantChange}
            onClose={() => setPickerOpen(false)}
            cardBackgroundColor={cardBackgroundColor}
            borderColor={borderColor}
            textColor={textColor}
            textTertiaryColor={textTertiaryColor}
          />
        </>
      ) : null}
    </View>
  );
}

export default TodayHero;
