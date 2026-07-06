import * as React from "react";
import { PressableScale } from "@/components/ui/PressableScale";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useColorScheme } from "react-native";
import {
  macroStatCaption,
  macroStatProgressRatio,
} from "@suppr/nutrition-core/macroStatCaption";
import { formatMacro } from "@suppr/nutrition-core/formatMacro";

export interface MacroStatTileProps {
  macroKey: string;
  label: string;
  Icon: LucideIcon;
  current: number;
  target: number;
  unit: "g" | "mg" | "ml" | "kcal" | string;
  color: string;
  referenceOnly?: boolean;
  overIsFlag?: boolean;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  barTrackColor: string;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** ENG-1098 Calm mode — when on, neutralise the over-signal (value stays the
   *  macro-identity hue, no amber/weight) so the tile reads numeric-neutral. */
  calmMode?: boolean;
}

/** Canonical Today macro tile — ENG-1014 leaf primitive. */
export function MacroStatTile({
  macroKey,
  label,
  Icon,
  current,
  target,
  unit,
  color,
  referenceOnly = false,
  overIsFlag = true,
  textColor: _textColor,
  textSecondaryColor,
  textTertiaryColor,
  barTrackColor,
  onPress,
  testID,
  style,
  calmMode = false,
}: MacroStatTileProps) {
  const isDark = useColorScheme() === "dark";
  const value = formatMacro(current, macroKey);
  const pct = macroStatProgressRatio(current, target) * 100;
  const { tone } = macroStatCaption({
    current,
    target,
    unit,
    referenceOnly,
    overIsFlag,
  });

  // ENG-1099 value-colour over/under signal (recipe-strip precedent): empty →
  // tertiary; on/under → the macro identity hue; over a flagged macro → amber +
  // a weight bump (the second channel so the Fat tile, whose identity hue is
  // already amber, still reads as "over"). Calm mode neutralises the over-signal.
  const overSignal = tone === "over" && !calmMode;
  const valueColor =
    current <= 0
      ? textTertiaryColor
      : overSignal
        ? isDark
          ? Accent.warningLight
          : Accent.warningSolid
        : color;
  const valueWeight: "500" | "600" = overSignal ? "600" : "500";

  // Proto `.mtile` cell (Grace 2026-06-25 full conform): NO card — a hairline-
  // divided grid cell. Top row = colored icon (left) + value/goal + label; a
  // full-width COLORED progress bar below. The dividing borders + the cell's
  // horizontal padding come from the grid wrapper (`style`, from
  // TodayDashboardMacroTiles); this owns the vertical padding + content.
  const body = (
    <View style={{ paddingVertical: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.dense }}>
        <Icon size={18} color={color} strokeWidth={1.75} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...Type.title,
              fontSize: 18,
              lineHeight: 22,
              color: valueColor,
              fontWeight: valueWeight,
              fontVariant: ["tabular-nums"],
            }}
            numberOfLines={1}
          >
            {value}
            <Text style={{ ...Type.body, fontSize: 13, color: textTertiaryColor }}>
              {" / "}
              {target}
              {unit === "g" ? "g" : ` ${unit}`}
            </Text>
          </Text>
          <Text
            style={{
              ...Type.caption,
              ...Type.captionSmall,
              lineHeight: 16,
              color: textSecondaryColor,
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </View>
      {/* Proto `.mtile-track`: the COLORED progress bar (colour + fill = the
          macro's progress) — the prototype's defining tile element, full-width
          under the icon+value row. No caption row (the proto tile drops it —
          the over/under signal lives in the value colour above). */}
      <View
        testID={`today-macro-tile-bar-${macroKey}`}
        style={{
          height: 4,
          borderRadius: Radius.full,
          backgroundColor: barTrackColor,
          overflow: "hidden",
          marginTop: 11,
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: Radius.full,
            backgroundColor: color,
            opacity: referenceOnly ? 0.45 : 1,
          }}
        />
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View style={style} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value} of ${target} ${unit}. Tap for detail.`}
      testID={testID}
      style={style}
    >
      {body}
    </PressableScale>
  );
}

export default MacroStatTile;
