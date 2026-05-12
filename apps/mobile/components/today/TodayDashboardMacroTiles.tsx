import React from "react";
import { Pressable, Text, View } from "react-native";
import {
  Beef,
  Candy,
  ChevronRight,
  Droplet,
  Droplets,
  Gauge,
  Leaf,
  Wheat,
  type LucideIcon,
} from "lucide-react-native";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import type { JournalMeal } from "@/lib/nutritionJournal";
import { carbsLabel, netCarbsForRow } from "../../../../src/lib/nutrition/netCarbs";
import { formatMacro } from "../../../../src/lib/nutrition/formatMacro";

/**
 * TodayDashboardMacroTiles — macro tiles grid for Today.
 *
 * Originally a 4-across strip of cramped tiles; rewritten 2026-04-20
 * to match the 2026-04-19 Claude Design prototype's 2-column bigger
 * tile treatment (see
 * `docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `MacroTile`). Each tile now has: uppercase name + emoji icon →
 * big value + unit → progress bar → "X g remaining" or "X g over"
 * caption. Emoji per macro matches the prototype's lucide icon
 * choice (beef / wheat / droplets / leaf + equivalents for
 * sugar/sodium/water).
 */
export interface TodayDashboardMacroTilesProps {
  trackedMacros: string[];
  totals: { protein: number; carbs: number; fat: number; fiber: number };
  targets: { protein: number; carbs: number; fat: number; fiber: number };
  totalWaterMl: number;
  waterGoalMl: number;
  mealsToday: JournalMeal[];
  onPressMacro: (macro: string) => void;
  cardColor: string;
  cardBorderColor: string;
  borderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  mutedColor: string;
  /** P3-30 (2026-04-25): when true, the carbs tile shows "Net carbs"
   *  with the value computed via `netCarbsForRow(carbs, fibre, true)`.
   *  Helpers refuse the "Net carbs" label when fibre is unknown. */
  netCarbsLensEnabled?: boolean;
  /** Phase 4 / Top-5 #2 (2026-04-28) — when `true`, render a small
   *  right-aligned "Nutrients" link in a header row above the tiles
   *  that opens the all-nutrients modal. Replaces the standalone
   *  centred link that previously floated between the tiles and the
   *  meals section. */
  showNutrientsLink?: boolean;
  /** Required when `showNutrientsLink` is `true`. */
  onPressNutrients?: () => void;
}

type MacroDef = {
  label: string;
  current: number;
  target: number;
  color: string;
  unit: string;
  Icon: LucideIcon;
  /** When true, display a reference (not a target) — "ref Xg" rather
   *  than "X g remaining"/"X g over". Used for sugar/sodium where we
   *  don't claim a personal target. */
  referenceOnly?: boolean;
};

export function TodayDashboardMacroTiles({
  trackedMacros,
  totals,
  targets,
  totalWaterMl,
  waterGoalMl,
  mealsToday,
  onPressMacro,
  cardColor,
  cardBorderColor,
  borderColor: _borderColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  mutedColor,
  netCarbsLensEnabled,
  showNutrientsLink,
  onPressNutrients,
}: TodayDashboardMacroTilesProps) {
  const microSum = mealsToday.reduce(
    (a, m) => ({
      sugarG: a.sugarG + ((m.micros as { sugarG?: number } | null | undefined)?.sugarG ?? 0),
      sodiumMg: a.sodiumMg + ((m.micros as { sodiumMg?: number } | null | undefined)?.sodiumMg ?? 0),
    }),
    { sugarG: 0, sodiumMg: 0 },
  );

  // Icons mirror the 2026-04-19 prototype's lucide choices exactly:
  // protein=Beef, carbs=Wheat, fat=Droplets, fiber=Leaf. Extensible
  // macros (sugar/sodium/water) pick sensible lucide neighbours.
  const macroMap: Record<string, MacroDef> = {
    protein: { label: "Protein", current: totals.protein, target: targets.protein, color: MacroColors.protein, unit: "g", Icon: Beef },
    carbs: {
      // P3-30 (2026-04-25): apply net-carbs lens. Helpers refuse "Net
      // carbs" when fibre is unknown so a misleading headline never
      // ships.
      // 2026-04-30 (#1): label now uses `targets.fiber`, not
      // `totals.fiber`. Pre-fix the tile rendered as "CARBS 0 / 75 g"
      // because totals.fiber was 0 with no meals logged → label fell
      // back to "Carbs" — but the *target value* was already net
      // (91 − 16 = 75), creating an apparent Today=75g vs Targets=91g
      // divergence. The lens always has fibre data behind it via the
      // target, so the label can honestly say "Net carbs" from the
      // first render. The fall-back to "Carbs" still triggers when
      // the user has no fibre target set at all (target.fiber == 0).
      label: carbsLabel(targets.fiber, Boolean(netCarbsLensEnabled)),
      current: netCarbsForRow(totals.carbs, totals.fiber, Boolean(netCarbsLensEnabled)),
      target: netCarbsForRow(targets.carbs, targets.fiber, Boolean(netCarbsLensEnabled)),
      color: MacroColors.carbs,
      unit: "g",
      Icon: Wheat,
    },
    fat: { label: "Fat", current: totals.fat, target: targets.fat, color: MacroColors.fat, unit: "g", Icon: Droplets },
    fiber: { label: "Fiber", current: totals.fiber, target: targets.fiber, color: Accent.success, unit: "g", Icon: Leaf },
    sugar: { label: "Sugar", current: Math.round(microSum.sugarG * 10) / 10, target: 50, color: Accent.warning, unit: "g", Icon: Candy, referenceOnly: true },
    sodium: { label: "Sodium", current: Math.round(microSum.sodiumMg), target: 2300, color: MacroColors.sodium, unit: "mg", Icon: Gauge, referenceOnly: true },
    water: { label: "Water", current: totalWaterMl, target: waterGoalMl, color: MacroColors.water ?? Accent.info, unit: "ml", Icon: Droplet },
  };

  // 2-col grid via flexbox gap + flex-basis (49%) instead of the
  // earlier negative-margin hack, which relied on compensating parent
  // padding that Today's scroll container doesn't guarantee.
  return (
    <View style={{ marginBottom: Spacing.md }}>
      {/* Phase 4 / Top-5 #2 (2026-04-28) — optional right-aligned
          "Nutrients" link replaces the standalone centred link that
          used to float below the tiles. Renders only when the host
          flags it (i.e. there are non-macro nutrient rows worth
          surfacing for the active day). */}
      {showNutrientsLink && onPressNutrients ? (
        <Pressable
          onPress={onPressNutrients}
          accessibilityRole="button"
          accessibilityLabel="View all nutrients for today"
          hitSlop={6}
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 2,
            paddingVertical: Spacing.xs,
            marginBottom: Spacing.xs,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: Accent.primary,
              letterSpacing: 0.4,
            }}
          >
            Nutrients
          </Text>
          <ChevronRight size={12} color={Accent.primary} strokeWidth={2.25} />
        </Pressable>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
      {trackedMacros.map((macro) => {
        const def = macroMap[macro];
        if (!def) return null;
        // Polish (2026-04-25) — formatMacro centralises per-macro rounding.
        // protein/carbs/fat now keep 1 decimal (no more "105.80000000000001g"),
        // calories+sodium stay integer. Trailing ".0" trimmed for readability.
        const value = formatMacro(def.current, macro);
        const pct = def.target > 0 ? Math.min(100, Math.round((def.current / def.target) * 100)) : 0;
        // Audit T03 (2026-05-05) — caption "X g remaining" used to
        // round `def.target − def.current` directly, which produced
        // off-by-≤1g drift vs the displayed `value / target g` numerator
        // (formatMacro rounds protein/carbs/fat to 1 decimal). Compute
        // remaining from the rounded displayed values so what the
        // caption claims matches what the user reads above it.
        const displayedCurrent = parseFloat(value);
        const displayedTarget = def.target;
        const remainDisplayed = displayedTarget - (Number.isFinite(displayedCurrent) ? displayedCurrent : def.current);
        const overBy = Math.round(Math.abs(remainDisplayed));
        const captionText = def.referenceOnly
          ? `ref ${def.target} ${def.unit}`
          : remainDisplayed >= 0
            ? `${overBy} ${def.unit} remaining`
            : `${overBy} ${def.unit} over`;

        return (
          <Pressable
            key={macro}
            onPress={() => onPressMacro(macro)}
            accessibilityRole="button"
            accessibilityLabel={`${def.label}: ${value} of ${def.target} ${def.unit}. Tap for detail.`}
            style={{
              // `flexBasis: 49%` + gap gives a stable 2-col layout
              // that survives odd parent paddings.
              flexBasis: "48.5%",
              flexGrow: 1,
              backgroundColor: cardColor,
              borderWidth: 1,
              borderColor: cardBorderColor,
              borderRadius: Radius.lg,
              padding: Spacing.lg - 2,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: textTertiaryColor,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  {def.label}
                </Text>
                {/* 2026-05-12 (premium-bar audit, Today F4 #2):
                    chevron-right affordance signals each tile is
                    tappable (deep-links to /macro-detail). Was just
                    the macro icon — Cronometer / MacroFactor both
                    show an explicit "tap for detail" cue. Kept the
                    macro icon next to the chevron so colour-coding
                    stays. */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <def.Icon size={13} color={def.color} strokeWidth={1.75} />
                  <ChevronRight size={11} color={textTertiaryColor} strokeWidth={2} />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "700",
                    letterSpacing: -0.4,
                    color: textColor,
                    fontVariant: ["tabular-nums"],
                  }}
                  numberOfLines={1}
                >
                  {value}
                </Text>
                <Text
                  style={{ flexShrink: 1, fontSize: 12, color: textSecondaryColor, marginLeft: 3 }}
                  numberOfLines={1}
                >
                  / {def.target} {def.unit}
                </Text>
              </View>
              {/* Premium-feel papercut #4 (audit 2026-04-29): the bar
                  exists but at 0% the fill is invisible against a
                  near-grey track, so empty tiles read as having a
                  divider, not a progress bar. Tint the track with the
                  macro's brand colour at 14% opacity so each tile is
                  legible as "your X progress" even before any logging
                  — and the brighter fill stands out cleanly as the
                  user logs through the day. */}
              <View
                style={{
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: `${def.color}24`,
                  marginTop: Spacing.sm + 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: def.color,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 11,
                  color: textSecondaryColor,
                  marginTop: Spacing.xs + 2,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {captionText}
              </Text>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

export default TodayDashboardMacroTiles;
