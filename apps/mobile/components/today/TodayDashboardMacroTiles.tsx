import React from "react";
import { Pressable, Text, View } from "react-native";
// App-resolved scheme (NOT the raw OS scheme) — see hooks/use-color-scheme.
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  Candy,
  ChevronRight,
  Droplet,
  Dumbbell,
  Gauge,
  Sprout,
  Wheat,
  type LucideIcon,
} from "lucide-react-native";
import { Layout } from "@/constants/layout";
import { Accent, Colors, Radius, Spacing, Type } from "@/constants/theme";
import { SupprCard } from "@/components/ui/SupprCard";
import { macroColorFor } from "@/lib/macroColors";
import type { JournalMeal } from "@/lib/nutritionJournal";
import { carbsLabel, netCarbsForRow } from "@suppr/shared/nutrition/netCarbs";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";

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
  // Progress-bar track tone. Light: Sloe `line` (#E8E2EC) per Figma `654:2`.
  // Dark: theme hairline so the light track hex doesn't glare.
  const barTrackColor = isDark ? cardBorderColor : Colors.light.border;
  // Caption colours (audit gap 4). Success (sage) when under target; amber for
  // over — `warningSolid` is the AA-safe-as-TEXT amber (the base `warning`
  // #C9892C fails AA as text, per the theme contrast note), dark-lifted on the
  // dark surface. Mirrors the locked macro over-budget rule (design-system §1.2
  // — macros over-budget use amber, never the ring's destructive red).
  const captionUnderColor = isDark ? Accent.successLight : Accent.success;
  const captionOverColor = isDark ? Accent.warningLight : Accent.warningSolid;
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
    protein: { label: "Protein", current: totals.protein, target: targets.protein, color: macroColorFor("protein"), unit: "g", Icon: Dumbbell },
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
    fat: { label: "Fat", current: totals.fat, target: targets.fat, color: macroColorFor("fat"), unit: "g", Icon: Droplet },
    fiber: { label: "Fibre", current: totals.fiber, target: targets.fiber, color: macroColorFor("fiber"), unit: "g", Icon: Sprout },
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
        // Polish (2026-04-25) — formatMacro centralises per-macro rounding.
        // protein/carbs/fat now keep 1 decimal (no more "105.80000000000001g"),
        // calories+sodium stay integer. Trailing ".0" trimmed for readability.
        const value = formatMacro(def.current, macro);
        // Progress bar (2026-06-04). barColor stays the macro IDENTITY colour
        // (matches the mock + the bars variant; never flips to amber/red on
        // over — over-budget signalling is the calorie ring's job, not the
        // macro tiles). Pinned by `macroColorConsistency.test.ts`.
        const barColor = def.color;
        const pct =
          def.target > 0
            ? Math.min(1, Math.max(0, def.current / def.target)) * 100
            : 0;

        // Per-tile caption (audit gap 4 — today.md §3.3 / §4 "warm-coaching
        // payoff"). Web parity: same shape as the web tiles' caption
        // (`plainRemainingCaption`).
        //   - referenceOnly (sugar/sodium): muted "ref N unit" — no remaining
        //     claim, since there's a generic reference not a personal target.
        //   - unlogged (current ≤ 0, real target): suppress — the "0 / target"
        //     line already says everything.
        //   - over target: "N {unit} over" in amber.
        //   - under target: "N {unit} remaining" in success/sage.
        let captionText = "";
        let captionColor = textTertiaryColor;
        if (def.referenceOnly) {
          captionText = `ref ${def.target}${def.unit === "g" ? "g" : ` ${def.unit}`}`;
          captionColor = textTertiaryColor;
        } else if (def.target > 0 && def.current > 0) {
          const remain = def.target - def.current;
          const magnitude = Math.round(Math.abs(remain));
          const unitSuffix = def.unit === "g" ? "g" : ` ${def.unit}`;
          if (remain >= 0) {
            captionText = `${magnitude}${unitSuffix} remaining`;
            captionColor = captionUnderColor;
          } else {
            captionText = `${magnitude}${unitSuffix} over`;
            captionColor = captionOverColor;
          }
        }
        // Gap 8 — soften the serif value while it's a zero so the editorial
        // numeral only earns its full ink weight when there's data. Empty
        // accounts otherwise show four heavy serif zeros that invert the
        // cold-open hierarchy (the faint empty ring whispers while the zeros
        // shout). Muted until current > 0.
        const valueColor = def.current > 0 ? textColor : textTertiaryColor;

        return (
          // The 2×2 macro tiles are the `size="tile"` variant of the shared
          // <SupprCard lift="flat"> shell (radius 24, matching the full card, with tighter `md`
          // padding) — they're small tiles, not full cards, so they get the one
          // documented size variant rather than being a bespoke exception
          // (Grace 2026-06-04 consolidation; no silent divergence). The
          // Pressable is the thin tap + press-feedback layer; the SupprCard
          // owns ALL chrome (fill #F6F5F2, radius, soft lift, clip).
          <Pressable
            key={macro}
            testID={`today-macro-tile-${macro}`}
            onPress={() => onPressMacro(macro)}
            accessibilityRole="button"
            accessibilityLabel={`${def.label}: ${value} of ${def.target} ${def.unit}. Tap for detail.`}
            style={({ pressed }) => ({
              // 2x2 grid: fixed half-width cells. `flexGrow: 0` stops a
              // lone tile on the last row stretching full width (was
              // reading as one "wide screen" card).
              width: "48%",
              maxWidth: "48%",
              flexGrow: 0,
              flexShrink: 0,
              opacity: pressed ? 0.85 : 1,
            })}
          >
          <SupprCard
            // Tile-class rule (2026-06-10 A/B, docs/decisions/2026-06-10-
            // sheet-radius-and-nested-inset-standard.md amendment): small
            // stat TILES stay flat-tonal; soft lift is the CARD class's.
            // Rendered A/B (tile-ab-2026-06-10/A3 vs B3): four mini-shadows
            // read as noise and flatten the hero's anchor lift.
            lift="flat"
            size="tile"
            padding="md"
            innerStyle={{ minHeight: 96, justifyContent: "space-between" }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm }}>
                <Text
                  style={{
                    // SLOE (2026-06-04, Grace "card style off"): Title case
                    // ("Protein"), not the uppercase Type.label ("PROTEIN") —
                    // matches the Figma 01 tile labels.
                    ...Type.caption,
                    fontSize: 12,
                    lineHeight: 16,
                    fontWeight: "500",
                    color: textSecondaryColor,
                  }}
                >
                  {def.label}
                </Text>
                <def.Icon size={18} color={def.color} strokeWidth={1.75} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                {/* SLOE redesign (2026-06-03): macro value reads in
                    Newsreader (serif) to match the `01 · Today` frame's
                    `font-headline text-2xl` macro-tile numeral, with a
                    smaller inline unit. Was Inter (`Type.macroValue`). */}
                <Text
                  style={{
                    ...Type.title,
                    fontSize: 20,
                    lineHeight: 24,
                    color: valueColor,
                    fontVariant: ["tabular-nums"],
                  }}
                  numberOfLines={1}
                >
                  {value}
                  <Text style={{ ...Type.body, fontSize: 14, color: textSecondaryColor }}>
                    {def.unit === "g" ? "g" : ` ${def.unit}`}
                  </Text>
                </Text>
                <Text
                  style={{ ...Type.caption, flexShrink: 1, color: textTertiaryColor }}
                  numberOfLines={1}
                >
                  / {def.target}{def.unit === "g" ? "g" : ` ${def.unit}`}
                </Text>
              </View>
              {/* Progress bar — mock's `h-1 … rounded-full` tile bar. Track is
                  frost-mist (#EDEAF1) above the grey card; fill is the macro
                  identity colour at min(current/target, 1). reference-only
                  macros (sugar/sodium) get a quieter fill so the bar never
                  reads as a HIT target where there's only a generic reference. */}
              <View
                testID={`today-macro-tile-bar-${macro}`}
                style={{
                  height: 4,
                  borderRadius: Radius.full,
                  backgroundColor: barTrackColor,
                  overflow: "hidden",
                  marginTop: Spacing.sm,
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: Radius.full,
                    backgroundColor: barColor,
                    opacity: def.referenceOnly ? 0.45 : 1,
                  }}
                />
              </View>
              {/* Per-tile caption (audit gap 4) — "N g remaining" (sage) /
                  "N g over" (amber) / muted "ref N" for reference-only macros.
                  The at-a-glance "how much left" read today.md §3.3/§4 calls
                  the warm-coaching payoff. Reserve the row's height even when
                  the caption is suppressed (unlogged tile) so the grid stays
                  even. */}
              <Text
                testID={`today-macro-tile-caption-${macro}`}
                style={{
                  ...Type.caption,
                  fontSize: 11,
                  lineHeight: 14,
                  color: captionColor,
                  marginTop: Spacing.xs,
                  minHeight: 14,
                  fontVariant: ["tabular-nums"],
                }}
                numberOfLines={1}
              >
                {captionText}
              </Text>
          </SupprCard>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

export default TodayDashboardMacroTiles;
