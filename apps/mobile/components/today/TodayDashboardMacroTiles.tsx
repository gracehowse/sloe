import React from "react";
import { Pressable, Text, View } from "react-native";
// App-resolved scheme (NOT the raw OS scheme) — see hooks/use-color-scheme.
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  Candy,
  ChevronRight,
  Droplet,
  Gauge,
  type LucideIcon,
} from "lucide-react-native";
import { Layout } from "@/constants/layout";
import { Colors, Spacing, Type } from "@/constants/theme";
import { MacroStatTile } from "@/components/nutrition/MacroStatTile";
import { macroColorFor } from "@/lib/macroColors";
import { MACRO_ICONS } from "@/lib/macroIconsLucide";
import { isFeatureEnabled } from "@/lib/analytics";
import { useCalmMode } from "@/lib/calmMode";
import type { JournalMeal } from "@/lib/nutritionJournal";
import { carbsLabel, netCarbsForRow } from "@suppr/shared/nutrition/netCarbs";
import { isMacroDetailSupported } from "@/lib/macroDetailConfig";

/**
 * TodayDashboardMacroTiles — macro tiles grid for Today.
 *
 * SLOE redesign (2026-06-03, `01 · Today` frame): each tile is a clean
 * card — Title-case macro name + lucide glyph on top, then the big
 * Newsreader (serif) value with a smaller inline unit and a muted
 * `/ target`. The per-macro glyph is a `lucide-react-native` icon (beef /
 * wheat / droplets / leaf + equivalents for sugar/sodium/water) — never a
 * functional emoji, per the icon strategy
 * (`docs/decisions/2026-05-31-icon-strategy.md`, ENG-808).
 *
 * Progress bar (RE-ADDED 2026-06-04, Grace measured-spec pass — the #1
 * structural gap vs the Stitch `today.html` reference): under the value row
 * each tile shows a thin rounded bar — a frost-mist (#EDEAF1) track with a
 * macro-coloured fill at `min(current/target, 1) · 100%`, matching the
 * mock's `h-1 … rounded-full` tile bar. The bar was briefly dropped in the
 * 2026-06-03 "Figma 01" pass; the Stitch mock (the canonical Today
 * reference) keeps it, so it's back. For `referenceOnly` macros
 * (sugar/sodium, which have a generic reference, not a personal target) the
 * fill is rendered at reduced opacity so it never reads as a HIT goal — an
 * honest, de-emphasised position indicator rather than a progress claim.
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
  /** When true, display a reference (not a target) — sugar/sodium where
   *  we don't claim a personal target. */
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
  // Tile fill is owned by the shared <SupprCard lift="soft" size="tile"> shell now; the
  // prop stays in the API for call-site stability but no longer drives chrome.
  cardColor: _cardColor,
  cardBorderColor,
  borderColor: _borderColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  mutedColor: _mutedColor,
  netCarbsLensEnabled,
  showNutrientsLink,
  onPressNutrients,
}: TodayDashboardMacroTilesProps) {
  const isDark = useColorScheme() === "dark";
  // ENG-1099 — recipe-tier macro tiles (bar+caption stripped, value-colour
  // over-signal). ENG-1098 Calm mode neutralises the over-signal.
  const tierV1 = isFeatureEnabled("today_tracker_tier_v1");
  const [calmMode] = useCalmMode();
  // Progress-bar track tone. Light: Sloe `line` (#E8E2EC) per Figma `654:2`.
  // Dark: theme hairline so the light track hex doesn't glare.
  const barTrackColor = isDark ? cardBorderColor : Colors.light.border;
  const microSum = mealsToday.reduce(
    (a, m) => ({
      sugarG: a.sugarG + ((m.micros as { sugarG?: number } | null | undefined)?.sugarG ?? 0),
      sodiumMg: a.sodiumMg + ((m.micros as { sodiumMg?: number } | null | undefined)?.sodiumMg ?? 0),
    }),
    { sugarG: 0, sodiumMg: 0 },
  );

  // Figma `654:2` macro glyphs (rendered-verified): protein=Dumbbell,
  // carbs=Wheat, fat=Droplet, fibre=Sprout.
  const macroMap: Record<string, MacroDef> = {
    protein: { label: "Protein", current: totals.protein, target: targets.protein, color: macroColorFor("protein"), unit: "g", Icon: MACRO_ICONS.protein },
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
      Icon: MACRO_ICONS.carbs,
    },
    fat: { label: "Fat", current: totals.fat, target: targets.fat, color: macroColorFor("fat"), unit: "g", Icon: MACRO_ICONS.fat },
    fiber: { label: "Fibre", current: totals.fiber, target: targets.fiber, color: macroColorFor("fiber"), unit: "g", Icon: MACRO_ICONS.fiber },
    sugar: { label: "Sugar", current: Math.round(microSum.sugarG * 10) / 10, target: 50, color: macroColorFor("sugar"), unit: "g", Icon: Candy, referenceOnly: true },
    sodium: { label: "Sodium", current: Math.round(microSum.sodiumMg), target: 2300, color: macroColorFor("sodium"), unit: "mg", Icon: Gauge, referenceOnly: true },
    water: { label: "Water", current: totalWaterMl, target: waterGoalMl, color: macroColorFor("water"), unit: "ml", Icon: Droplet },
  };

  // 2-col grid via flexbox gap + flex-basis (49%) instead of the
  // earlier negative-margin hack, which relied on compensating parent
  // padding that Today's scroll container doesn't guarantee.
  return (
    <View style={{ marginBottom: Spacing.sm }}>
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
            style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}
          >
            <Text
              style={{
                ...Type.caption,
                color: textSecondaryColor,
              }}
            >
              All nutrients
            </Text>
            <ChevronRight size={12} color={textTertiaryColor} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Layout.macroTileGridGap }}>
      {trackedMacros.map((macro) => {
        const def = macroMap[macro];
        if (!def) return null;

        // ENG-1213 — only macros with an actual breakdown open the detail
        // screen. Reference-only tiles (sugar/sodium) have no breakdown
        // (`MACRO_CONFIG` on macro-detail.tsx doesn't define them), so they must
        // render as plain, non-interactive tiles — no Pressable, no "Tap for
        // detail." a11y label, no scale-press affordance. `isMacroDetailSupported`
        // is the single source of truth shared with the macro bars and the
        // macro-detail screen's own guard, so a tappable tile can never resolve
        // to a macro the screen would render wrong (protein) data for.
        const interactive = isMacroDetailSupported(macro);

        return (
          <MacroStatTile
            key={macro}
            macroKey={macro}
            label={def.label}
            Icon={def.Icon}
            current={def.current}
            target={def.target}
            unit={def.unit}
            color={def.color}
            referenceOnly={def.referenceOnly}
            overIsFlag={macro !== "fiber" && macro !== "water"}
            textColor={textColor}
            textSecondaryColor={textSecondaryColor}
            textTertiaryColor={textTertiaryColor}
            barTrackColor={barTrackColor}
            tierV1={tierV1}
            calmMode={calmMode}
            onPress={interactive ? () => onPressMacro(macro) : undefined}
            testID={`today-macro-tile-${macro}`}
            style={{
              width: "48%",
              maxWidth: "48%",
              flexGrow: 0,
              flexShrink: 0,
            }}
          />
        );
      })}
      </View>
    </View>
  );
}

export default TodayDashboardMacroTiles;
