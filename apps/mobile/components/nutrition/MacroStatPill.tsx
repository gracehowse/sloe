import * as React from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Check } from "lucide-react-native";
import { withAlpha, Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { macroStatProgressRatio } from "@suppr/nutrition-core/macroStatCaption";

export type MacroStatPillVariant = "delta" | "ratio" | "value";

export interface MacroStatPillProps {
  label: string;
  current: number;
  target?: number;
  unit?: string;
  color: string;
  variant?: MacroStatPillVariant;
  /** Within ±15% of target reads as on-track (planner default). */
  closeBand?: number;
  showProgressFill?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

/** Compact macro pill — ENG-1014 derivative for dense surfaces. */
export function MacroStatPill({
  label,
  current,
  target,
  unit = "g",
  color,
  variant = "delta",
  closeBand = 0.15,
  showProgressFill = false,
  style,
  testID,
  accessibilityLabel,
}: MacroStatPillProps) {
  const colors = useThemeColors();
  const rounded = Math.round(current);
  const hasTarget = typeof target === "number" && target > 0;
  const diff = hasTarget ? current - (target as number) : 0;
  const pct = hasTarget ? Math.abs(diff) / (target as number) : 0;
  const isClose = hasTarget && pct < closeBand;
  const fillPct = hasTarget ? macroStatProgressRatio(current, target as number) * 100 : 0;

  let primary = `${label} ${rounded}${unit}`;
  if (variant === "ratio" && hasTarget) {
    primary = `${label} ${rounded}/${Math.round(target as number)}${unit}`;
  } else if (variant === "value") {
    primary = `${rounded}${unit} ${label}`;
  }

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flex: 1,
          minWidth: 0,
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.xs,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.xs,
          borderRadius: Radius.lg,
          backgroundColor: colors.backgroundSecondary,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {showProgressFill && hasTarget ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${fillPct}%`,
            backgroundColor: withAlpha(color, 0x18),
          }}
        />
      ) : null}
      <Text style={{ fontSize: 13, fontWeight: "700", color, fontVariant: ["tabular-nums"] }}>
        {primary}
      </Text>
      {variant === "delta" && hasTarget ? (
        isClose ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
            <Check size={10} color={Accent.success} strokeWidth={3} />
            <Text style={{ fontSize: 10, fontWeight: "600", color: Accent.success }}>On track</Text>
          </View>
        ) : (
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: Accent.warningSolid,
              fontVariant: ["tabular-nums"],
            }}
          >
            {diff > 0 ? `+${Math.round(diff)}` : `${Math.round(diff)}`}g
          </Text>
        )
      ) : null}
    </View>
  );
}

export default MacroStatPill;
