import React from "react";
import { Text, View, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import {
  Clock,
  type LucideIcon,
} from "lucide-react-native";

import { MacroColors } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { MACRO_ICONS } from "@/lib/macroIconsLucide";

/**
 * MacroIconRow — canonical at-a-glance macro display.
 *
 * Shared by Library, Discover, and Today (slot header) so the same
 * row reads identically across the app: small lucide icon coloured to
 * the macro's TF49 hue, followed by the value in grams (or kcal for
 * calories). Compact, no card chrome — designed to drop into any row.
 *
 * Icon set (matches `feedback_prototype_icons_exact.md`):
 *   - Flame    → calories (`MacroColors.calories`)
 *   - Dumbbell → protein  (`MacroColors.protein`) — Figma `654:101`
 *   - Wheat    → carbs    (`MacroColors.carbs`)
 *   - Droplet  → fat      (`MacroColors.fat`)
 *   - Sprout   → fibre    (`MacroColors.fiber`)
 *   - Clock  → cook time (optional, `accent.primary` via `useAccent()`)
 *
 * Macro letter labels ("P", "C", "F") render at tertiary opacity so
 * the row is self-explanatory without the icon row reading as "memorise
 * the order" — per customer-lens audit 2026-05-04 #15.
 *
 * Fiber + cook time only render when their value is meaningfully > 0.
 */
export interface MacroIconRowProps {
  kcal: number | null | undefined;
  protein: number | null | undefined;
  carbs: number | null | undefined;
  fat: number | null | undefined;
  fiber?: number | null | undefined;
  /** Optional cook time string ("20 min" / "1h 30") rendered with clock icon. */
  cookTime?: string | null | undefined;
  /** Text colour for the value digits. Defaults to secondary. */
  textColor: string;
  /** Tertiary colour for the macro-letter suffix ("P" / "C" / "F"). */
  textTertiaryColor: string;
  /** Show macro letters after the gram value. Default true. */
  showMacroLetters?: boolean;
  /** Icon + text glyph size. Default 11 (Library/Discover); use 12 for hero rows. */
  iconSize?: number;
  /**
   * Give protein a slightly heavier weight + ink colour than the other
   * macros, so the row reads "this is a tracker" with one visual accent
   * (recipes.md §3.1 — "one visual emphasis per card"). Off by default
   * so Today / Discover hero rows keep their even weighting. The Library
   * card opts in. Pass `proteinTextColor` to set the emphasised ink.
   */
  emphasiseProtein?: boolean;
  /** Ink colour used for the protein value when `emphasiseProtein`. */
  proteinTextColor?: string;
  /** Optional override for the outer container style (gap, flexWrap, etc.). */
  style?: StyleProp<ViewStyle>;
  /** Optional override for the inner value-text style. */
  textStyle?: StyleProp<TextStyle>;
}

interface ChunkProps {
  Icon: LucideIcon;
  iconColor: string;
  value: string;
  letter?: string;
  textColor: string;
  textTertiaryColor: string;
  iconSize: number;
  textStyle?: StyleProp<TextStyle>;
}

function Chunk({
  Icon,
  iconColor,
  value,
  letter,
  textColor,
  textTertiaryColor,
  iconSize,
  textStyle,
}: ChunkProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon size={iconSize} color={iconColor} />
      <Text style={[{ fontSize: 12, color: textColor, fontVariant: ["tabular-nums"] }, textStyle]}>
        {value}
        {letter ? (
          <Text style={{ color: textTertiaryColor }}> {letter}</Text>
        ) : null}
      </Text>
    </View>
  );
}

export function MacroIconRow({
  kcal,
  protein,
  carbs,
  fat,
  fiber,
  cookTime,
  textColor,
  textTertiaryColor,
  showMacroLetters = true,
  iconSize = 11,
  emphasiseProtein = false,
  proteinTextColor,
  style,
  textStyle,
}: MacroIconRowProps) {
  // Clock icon uses the scheme-resolved accent primary so it stays
  // legible on dark (deep plum `#3B2A4D` is invisible on near-black).
  const accent = useAccent();
  return (
    <View
      style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }, style]}
    >
      {typeof kcal === "number" && Number.isFinite(kcal) ? (
        <Chunk
          Icon={MACRO_ICONS.calories}
          iconColor={MacroColors.calories}
          value={`${Math.round(kcal)} kcal`}
          textColor={textColor}
          textTertiaryColor={textTertiaryColor}
          iconSize={iconSize}
          textStyle={textStyle}
        />
      ) : null}
      {typeof protein === "number" && Number.isFinite(protein) ? (
        <Chunk
          Icon={MACRO_ICONS.protein}
          iconColor={MacroColors.protein}
          value={`${Math.round(protein)}g`}
          letter={showMacroLetters ? "P" : undefined}
          textColor={emphasiseProtein ? (proteinTextColor ?? textColor) : textColor}
          textTertiaryColor={textTertiaryColor}
          iconSize={iconSize}
          textStyle={[textStyle, emphasiseProtein ? { fontWeight: "700" } : null]}
        />
      ) : null}
      {typeof carbs === "number" && Number.isFinite(carbs) ? (
        <Chunk
          Icon={MACRO_ICONS.carbs}
          iconColor={MacroColors.carbs}
          value={`${Math.round(carbs)}g`}
          letter={showMacroLetters ? "C" : undefined}
          textColor={textColor}
          textTertiaryColor={textTertiaryColor}
          iconSize={iconSize}
          textStyle={textStyle}
        />
      ) : null}
      {typeof fat === "number" && Number.isFinite(fat) ? (
        <Chunk
          Icon={MACRO_ICONS.fat}
          iconColor={MacroColors.fat}
          value={`${Math.round(fat)}g`}
          letter={showMacroLetters ? "F" : undefined}
          textColor={textColor}
          textTertiaryColor={textTertiaryColor}
          iconSize={iconSize}
          textStyle={textStyle}
        />
      ) : null}
      {typeof fiber === "number" && Number.isFinite(fiber) && fiber > 0 ? (
        <Chunk
          Icon={MACRO_ICONS.fiber}
          iconColor={MacroColors.fiber}
          value={`${Math.round(fiber * 10) / 10}g`}
          textColor={textColor}
          textTertiaryColor={textTertiaryColor}
          iconSize={iconSize}
          textStyle={textStyle}
        />
      ) : null}
      {cookTime ? (
        <Chunk
          Icon={Clock}
          iconColor={accent.primary}
          value={cookTime}
          textColor={textColor}
          textTertiaryColor={textTertiaryColor}
          iconSize={iconSize}
          textStyle={textStyle}
        />
      ) : null}
    </View>
  );
}

export default MacroIconRow;
