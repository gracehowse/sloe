import React from "react";
import { Text, View } from "react-native";
import CalorieRing from "@/components/charts/CalorieRing";
import { Radius, Spacing } from "@/constants/theme";

/**
 * TodayHeroRing — ring hero variant.
 *
 * Originally extracted from `apps/mobile/app/(tabs)/index.tsx`
 * (audit H3, 2026-04-18) as a thin wrapper over `CalorieRing`.
 * Ported to match the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `HeroRing`) on 2026-04-20 — then pared back same day to drop the
 * in-card macro-row list + logged/burned/net mini-stats row that
 * duplicate the adherence bar + 2x2 macro tile grid shown below the
 * hero on Today (see `feedback_no_duplicate_today_hero_content.md`).
 *
 * Current behaviour:
 *   - Ring sits inside a bordered card.
 *   - Tap → expands into concentric protein/carbs/fat rings (handled
 *     by `CalorieRing`); no text row is added under the ring.
 *   - Long-press → toggles the central number between "Remaining" and
 *     "Logged" kcal.
 *   - Helper text below names both gestures.
 */
export interface TodayHeroRingProps {
  consumed: number;
  goal: number;
  baseGoal: number | undefined;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  cardBackgroundColor: string;
  borderColor: string;

  // Macro progress (0..1) for the inner rings when expanded
  proteinPct: number;
  carbsPct: number;
  fatPct: number;

  // Interaction — host-owned
  expanded: boolean;
  onToggleExpanded: () => void;
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;
  textTertiaryColor: string;
}

export function TodayHeroRing({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  cardBackgroundColor,
  borderColor,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onToggleDisplayMode,
  textTertiaryColor,
}: TodayHeroRingProps) {
  return (
    <View
      style={{
        backgroundColor: cardBackgroundColor,
        borderWidth: 1,
        borderColor: borderColor,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.lg,
        alignItems: "center",
        gap: Spacing.md,
      }}
    >
      <CalorieRing
        consumed={consumed}
        goal={goal}
        baseGoal={baseGoal}
        textColor={textColor}
        secondaryColor={secondaryColor}
        trackColor={trackColor}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        onToggle={onToggleExpanded}
        displayMode={displayMode}
        onToggleDisplayMode={onToggleDisplayMode}
      />
      <Text style={{ fontSize: 10, color: textTertiaryColor, textAlign: "center" }}>
        Tap for macros · hold to switch to {displayMode === "remaining" ? "logged" : "remaining"}
      </Text>
    </View>
  );
}

export default TodayHeroRing;
