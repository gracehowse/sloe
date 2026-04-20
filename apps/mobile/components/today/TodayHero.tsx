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
 * Ported from the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `TodayScreen` + `HeroRing` / `HeroBar` / `HeroNumber`).
 *
 * Host (`apps/mobile/app/(tabs)/index.tsx`) owns:
 *   - `variant` state, persisted under `suppr.hero.variant` in
 *     AsyncStorage so the user's choice survives reload.
 *   - `expanded` + `displayMode` for the ring variant (existing state —
 *     unchanged by T12-design-port).
 *
 * This component is presentation-only: render the chosen hero, render
 * the picker trigger, render the picker modal. No async, no writes.
 */
export interface TodayHeroProps {
  // Variant selection
  variant: TodayHeroVariant;
  onVariantChange: (next: TodayHeroVariant) => void;

  // Calorie math
  consumed: number;
  goal: number;
  baseGoal?: number;
  burned?: number | null;
  mealCount: number;

  // Ring-specific: macro progress (0..1 for the inner rings)
  proteinPct: number;
  carbsPct: number;
  fatPct: number;

  // Ring-specific: macro gram values for the expanded-state rows
  loggedProtein: number;
  targetProtein: number;
  loggedCarbs: number;
  targetCarbs: number;
  loggedFat: number;
  targetFat: number;
  loggedFiber: number;
  targetFiber: number;

  // Ring-specific: expand-macros state (host-owned)
  expanded: boolean;
  onToggleExpanded: () => void;

  // All variants: remaining/consumed toggle (host-owned)
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;

  // Colors (pulled from host's theme hook — no theme import here)
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
    burned,
    mealCount,
    proteinPct,
    carbsPct,
    fatPct,
    loggedProtein,
    targetProtein,
    loggedCarbs,
    targetCarbs,
    loggedFat,
    targetFat,
    loggedFiber,
    targetFiber,
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
          burned={burned}
          textColor={textColor}
          secondaryColor={textSecondaryColor}
          trackColor={trackColor}
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          proteinPct={proteinPct}
          carbsPct={carbsPct}
          fatPct={fatPct}
          loggedProtein={loggedProtein}
          targetProtein={targetProtein}
          loggedCarbs={loggedCarbs}
          targetCarbs={targetCarbs}
          loggedFat={loggedFat}
          targetFat={targetFat}
          loggedFiber={loggedFiber}
          targetFiber={targetFiber}
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
          burned={burned}
          mealCount={mealCount}
          displayMode={displayMode}
          onToggleDisplayMode={onToggleDisplayMode}
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
          textSecondaryColor={textSecondaryColor}
          textTertiaryColor={textTertiaryColor}
          trackColor={trackColor}
        />
      )}
      {variant === "number" && (
        <TodayHeroNumber
          consumed={consumed}
          goal={goal}
          burned={burned}
          displayMode={displayMode}
          onToggleDisplayMode={onToggleDisplayMode}
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
          textSecondaryColor={textSecondaryColor}
          textTertiaryColor={textTertiaryColor}
        />
      )}

      {/* Picker affordance — small grid icon absolute top-right of the
          hero area. Uses the card background + visible border so the
          button reads in both light + dark mode (an earlier tint-only
          treatment disappeared on a light background). */}
      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Change hero style"
        hitSlop={12}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 34,
          height: 34,
          borderRadius: Radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cardBackgroundColor,
          borderWidth: 1,
          borderColor: borderColor,
        }}
      >
        <Ionicons name="grid-outline" size={16} color={textColor} />
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
