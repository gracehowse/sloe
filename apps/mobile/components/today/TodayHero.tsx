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
 * Ported from the 2026-04-19 Claude Design prototype and trimmed
 * 2026-04-20 (see
 * `feedback_no_duplicate_today_hero_content.md`) — hero variants are
 * intentionally minimal because the adherence / macro widgets below
 * the hero on Today cover the same data more cleanly.
 */
export interface TodayHeroProps {
  variant: TodayHeroVariant;
  onVariantChange: (next: TodayHeroVariant) => void;

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

      {/* Picker affordance — 28x28 subtle tinted square, matches
          the prototype's subdued treatment (screens-mobile.jsx:91-97).
          Earlier 34x34 bordered circle overlapped the ring's upper-
          right arc on narrow devices (ui-critic, 2026-04-20). */}
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
    </View>
  );
}

export default TodayHero;
