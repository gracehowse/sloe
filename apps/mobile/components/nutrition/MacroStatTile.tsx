import * as React from "react";
import { PressableScale } from "@/components/ui/PressableScale";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useColorScheme } from "react-native";
import {
  macroStatCaption,
  macroStatProgressRatio,
  type MacroStatCaptionTone,
} from "@suppr/shared/nutrition/macroStatCaption";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";
import { SupprCard } from "@/components/ui/SupprCard";

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
  /** ENG-1099 — recipe-tier macro tile: drop the bar + caption, move the
   *  over/under signal onto the value colour. */
  tierV1?: boolean;
  /** ENG-1098 Calm mode — when on, neutralise the over-signal (value stays the
   *  macro-identity hue, no amber/weight) so the tile reads numeric-neutral. */
  calmMode?: boolean;
}

function captionColorForTone(
  tone: MacroStatCaptionTone,
  isDark: boolean,
  textTertiaryColor: string,
): string {
  switch (tone) {
    case "under":
      return isDark ? Accent.successLight : Accent.success;
    case "over":
      return isDark ? Accent.warningLight : Accent.warningSolid;
    case "reference":
    case "none":
      return textTertiaryColor;
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
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
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  barTrackColor,
  onPress,
  testID,
  style,
  tierV1 = false,
  calmMode = false,
}: MacroStatTileProps) {
  const isDark = useColorScheme() === "dark";
  const value = formatMacro(current, macroKey);
  const pct = macroStatProgressRatio(current, target) * 100;
  const { text: captionText, tone } = macroStatCaption({
    current,
    target,
    unit,
    referenceOnly,
    overIsFlag,
  });
  const captionColor = captionColorForTone(tone, isDark, textTertiaryColor);

  // ENG-1099 value-colour over/under signal (recipe-strip precedent): empty →
  // tertiary; on/under → the macro identity hue; over a flagged macro → amber +
  // a weight bump (the second channel so the Fat tile, whose identity hue is
  // already amber, still reads as "over"). Calm mode neutralises the over-signal.
  const overSignal = tierV1 && tone === "over" && !calmMode;
  const valueColor = tierV1
    ? current <= 0
      ? textTertiaryColor
      : overSignal
        ? isDark
          ? Accent.warningLight
          : Accent.warningSolid
        : color
    : current > 0
      ? textColor
      : textTertiaryColor;
  const valueWeight: "500" | "600" = overSignal ? "600" : "500";

  const body = (
    <SupprCard
      lift="flat"
      size="tile"
      padding="md"
      innerStyle={{
        minHeight: tierV1 ? 64 : 96,
        justifyContent: tierV1 ? "flex-start" : "space-between",
        gap: tierV1 ? Spacing.sm : 0,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: Spacing.sm,
        }}
      >
        <Text
          style={{
            ...Type.caption,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: "500",
            color: textSecondaryColor,
          }}
        >
          {label}
        </Text>
        <Icon size={18} color={color} strokeWidth={1.75} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <Text
          style={{
            ...(tierV1 ? Type.heroValue : Type.title),
            ...(tierV1 ? {} : { fontSize: 20, lineHeight: 24 }),
            color: valueColor,
            ...(tierV1 ? { fontWeight: valueWeight } : {}),
            fontVariant: ["tabular-nums"],
          }}
          numberOfLines={1}
        >
          {value}
          <Text style={{ ...Type.body, fontSize: 14, color: textSecondaryColor }}>
            {unit === "g" ? "g" : ` ${unit}`}
          </Text>
        </Text>
        <Text
          style={{ ...Type.caption, flexShrink: 1, color: textTertiaryColor }}
          numberOfLines={1}
        >
          / {target}
          {unit === "g" ? "g" : ` ${unit}`}
        </Text>
      </View>
      {/* ENG-1099: tier tile drops the bar + caption — the value colour
          carries the over/under signal (recipe-strip pattern). Flag-off keeps
          the pre-ENG-1099 bar + caption. */}
      {tierV1 ? null : (
        <>
          <View
            testID={`today-macro-tile-bar-${macroKey}`}
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
                backgroundColor: color,
                opacity: referenceOnly ? 0.45 : 1,
              }}
            />
          </View>
          <Text
            testID={`today-macro-tile-caption-${macroKey}`}
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
        </>
      )}
    </SupprCard>
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
