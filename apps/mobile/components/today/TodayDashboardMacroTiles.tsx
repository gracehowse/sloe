import React from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

// 2026-05-12 (premium-bar audit motion polish): use the reanimated
// `createAnimatedComponent` pattern so the resolved component goes
// through React's normal forwardRef pipeline rather than relying on
// `Animated.View` resolving correctly on every renderer. Mirrors
// `PressableScale.tsx`.
const AnimatedView = Animated.createAnimatedComponent(View);
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
import { Accent, Colors, Radius, Spacing } from "@/constants/theme";
import { macroColorFor } from "@/lib/macroColors";
import type { JournalMeal } from "@/lib/nutritionJournal";
import { carbsLabel, netCarbsForRow } from "@suppr/shared/nutrition/netCarbs";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";

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
  const colorScheme = useColorScheme();
  const destructiveRed = Accent.destructive;
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
    protein: { label: "Protein", current: totals.protein, target: targets.protein, color: macroColorFor("protein"), unit: "g", Icon: Beef },
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
      color: macroColorFor("carbs"),
      unit: "g",
      Icon: Wheat,
    },
    fat: { label: "Fat", current: totals.fat, target: targets.fat, color: macroColorFor("fat"), unit: "g", Icon: Droplets },
    fiber: { label: "Fiber", current: totals.fiber, target: targets.fiber, color: macroColorFor("fiber"), unit: "g", Icon: Leaf },
    sugar: { label: "Sugar", current: Math.round(microSum.sugarG * 10) / 10, target: 50, color: macroColorFor("sugar"), unit: "g", Icon: Candy, referenceOnly: true },
    sodium: { label: "Sodium", current: Math.round(microSum.sodiumMg), target: 2300, color: macroColorFor("sodium"), unit: "mg", Icon: Gauge, referenceOnly: true },
    water: { label: "Water", current: totalWaterMl, target: waterGoalMl, color: macroColorFor("water"), unit: "ml", Icon: Droplet },
  };

  // 2-col grid via flexbox gap + flex-basis (49%) instead of the
  // earlier negative-margin hack, which relied on compensating parent
  // padding that Today's scroll container doesn't guarantee.
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      {/* "Nutrients >" upgraded to an outlined chip reading
          "All nutrients ›" so it reads as an action affordance, not
          an orphaned floating link. Renders only when the host flags
          it (i.e. there are non-macro nutrient rows worth surfacing
          for the active day). */}
      {showNutrientsLink && onPressNutrients ? (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: Spacing.xs }}>
          <Pressable
            onPress={onPressNutrients}
            accessibilityRole="button"
            accessibilityLabel="View all nutrients for today"
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: textSecondaryColor,
              }}
            >
              All nutrients
            </Text>
            <ChevronRight size={12} color={textTertiaryColor} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.md }}>
      {trackedMacros.map((macro) => {
        const def = macroMap[macro];
        if (!def) return null;
        // Polish (2026-04-25) — formatMacro centralises per-macro rounding.
        // protein/carbs/fat now keep 1 decimal (no more "105.80000000000001g"),
        // calories+sodium stay integer. Trailing ".0" trimmed for readability.
        const value = formatMacro(def.current, macro);
        const pct = def.target > 0 ? Math.min(100, Math.round((def.current / def.target) * 100)) : 0;
        // Over-budget: keep the macro's identity colour on the bar;
        // caption uses red when over.
        const isOverBudget =
          !def.referenceOnly && def.target > 0 && def.current > def.target;
        const barColor = def.color;
        const barTrackColor = `${def.color}24`;
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
        // Suppress caption on unlogged tiles — the `0 / target g`
        // numerator already says everything the user needs.
        const isUnloggedTile =
          !def.referenceOnly && def.current <= 0 && def.target > 0;
        const captionText = isUnloggedTile
          ? ""
          : def.referenceOnly
            ? `ref ${def.target} ${def.unit}`
            : remainDisplayed >= 0
              ? `${overBy} ${def.unit} left`
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
              padding: Spacing.lg,
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
                <def.Icon size={14} color={def.color} strokeWidth={1.75} />
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
                  user logs through the day.

                  2026-05-12 (premium-bar audit Today F4 #4 — 200ms
                  ease-out bar fill on log): wrapped the fill in a
                  reanimated View that tweens to the new pct over
                  300ms with `Easing.out(cubic)`. Apple Watch + Cal AI
                  parity — the bar grows visibly as the user logs,
                  reinforcing the "you just made progress" beat. */}
              {/* Hide the bar entirely when nothing's been logged —
                  the empty track is noise on the empty state. */}
              {!isUnloggedTile ? (
                <View
                  style={{
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: barTrackColor,
                    marginTop: Spacing.sm + 2,
                    overflow: "hidden",
                  }}
                >
                  <MacroTileFill pct={pct} color={barColor} />
                </View>
              ) : null}
              {captionText ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: isOverBudget ? destructiveRed : textSecondaryColor,
                    fontWeight: isOverBudget ? "700" : "400",
                    marginTop: Spacing.xs + 2,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {captionText}
                </Text>
              ) : null}
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

/**
 * MacroTileFill — animated fill bar for a macro tile (audit Today F4
 * #4, 2026-05-12). 300ms `Easing.out(cubic)` tween so the bar grows
 * visibly when the user logs a meal. Pure reanimated — no JS-thread
 * width interpolation. The track + the dim background sit in the
 * parent View (this only owns the coloured fill).
 */
function MacroTileFill({ pct, color }: { pct: number; color: string }) {
  const target = Math.max(0, Math.min(100, pct));
  const animPct = useSharedValue(target);
  React.useEffect(() => {
    animPct.value = withTiming(target, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [target, animPct]);
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animPct.value}%`,
  }));
  return (
    <AnimatedView
      style={[
        {
          height: "100%",
          borderRadius: 999,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default TodayDashboardMacroTiles;
