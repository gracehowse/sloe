import * as React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * SupprRadio — circular radio indicator (ENG-1662).
 *
 * Collapses the hand-rolled pair in `ResetPlanSheet` and
 * `PlanSourceSelector` into one geometry. Presentational only — the
 * parent owns `accessibilityRole="radio"` on the row.
 *
 * Web mirror: `src/app/components/ui/suppr-radio.tsx`.
 */
export interface SupprRadioProps {
  checked: boolean;
  /** Accent for the selected ring/dot. Defaults to theme tint. */
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SupprRadio({
  checked,
  accentColor,
  style,
  testID,
}: SupprRadioProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const accentInk = accentColor ?? colors.tint;

  return (
    <View
      testID={testID}
      style={[
        styles.outer,
        { borderColor: checked ? accentInk : colors.textTertiary },
        style,
      ]}
    >
      {checked ? (
        <View style={[styles.inner, { backgroundColor: accentInk }]} />
      ) : null}
    </View>
  );
}

const OUTER = 18;
const INNER = 8;

const styles = StyleSheet.create({
  outer: {
    width: OUTER,
    height: OUTER,
    borderRadius: Radius.full,
    borderWidth: 1.8,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
  },
});

export default SupprRadio;
