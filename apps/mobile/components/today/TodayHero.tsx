import React from "react";
import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Spacing } from "@/constants/theme";

import { TodayHeroRing } from "./TodayHeroRing";

/**
 * TodayHero — the canonical Today calorie hero, rendered as a ring.
 *
 * Phase 3 (2026-04-28): the three-variant picker (ring / bar / number)
 * was removed per D-2026-04-27-03 — "Three variants is design
 * indecision dressed as pluralism." `TodayHero` is now a thin wrapper
 * around `TodayHeroRing`.
 *
 * Phase 4 / Top-5 #2 (2026-04-28): the AI-estimated-meal sentinel
 * (formerly a standalone pill rendered between the hero and the
 * macro tiles) moved INSIDE the hero card as an inline caption row
 * below the ring. The pill above the macro tiles was one of the
 * 13 above-meals blocks the teardown's §F1 finding flagged; folding
 * it into the hero closes that block while preserving the user-
 * facing signal. Set `aiSourcedCount` from the host (counts AI
 * voice / photo / barcode meals on the active day); when 0 or
 * undefined, no caption renders. `sourceAiColor` should be
 * `colors.sourceAi` from `useThemeColors()` so the dot tints
 * correctly in light + dark.
 *
 * Web parity: web's `today-hero-ring.tsx` was already single-variant.
 */
export interface TodayHeroProps {
  consumed: number;
  goal: number;
  baseGoal?: number;

  /** Count of AI-sourced meals on the active day (voice / photo /
   *  AI-fallback). When > 0, an inline caption renders inside the
   *  hero card; when 0/undefined, no caption. */
  aiSourcedCount?: number;
  /** Tint for the AI sparkles dot — pass `colors.sourceAi` from the
   *  host's theme hook. Required when `aiSourcedCount > 0`. */
  sourceAiColor?: string;

  // Macro progress (0..1) for the inner rings when expanded
  proteinPct: number;
  carbsPct: number;
  fatPct: number;

  // Expand-macros state (host-owned)
  expanded: boolean;
  onToggleExpanded: () => void;

  // Remaining/consumed toggle (host-owned)
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
  const {
    consumed,
    goal,
    baseGoal,
    aiSourcedCount,
    sourceAiColor,
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

  const showAiSentinel =
    typeof aiSourcedCount === "number" && aiSourcedCount > 0;

  return (
    <View>
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
        footerContent={
          showAiSentinel ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "center",
                gap: Spacing.xs + 2,
                paddingTop: Spacing.xs,
              }}
              accessibilityRole="text"
              accessibilityLabel={`Today includes ${aiSourcedCount} AI-estimated meal${aiSourcedCount === 1 ? "" : "s"}`}
            >
              <Sparkles
                size={11}
                color={sourceAiColor ?? textSecondaryColor}
                strokeWidth={2.25}
              />
              <Text
                style={{
                  fontSize: 11,
                  color: textSecondaryColor,
                  fontWeight: "500",
                }}
              >
                Includes {aiSourcedCount} AI-estimated meal
                {aiSourcedCount === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

export default TodayHero;
