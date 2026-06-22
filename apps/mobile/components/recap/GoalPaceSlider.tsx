/**
 * GoalPaceSlider — the continuous kg/week pace control for the mobile
 * GoalPaceEditorSheet. Reuses the onboarding `MobileMiniSlider` + the
 * onboarding `PACE_RANGES` (passed in via `min/max/step`) so the editor
 * and onboarding share the exact same slider behaviour (target-recompute
 * unification, 2026-05-26). Extracted to keep the sheet under the
 * 400-line limit (ENG-621).
 */

import { Text, View } from "react-native";

import { FontFamily, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useMacroColors } from "@/lib/macroColors";
import type { Goal } from "@suppr/nutrition-core/goalEditorPace";
import { MobileMiniSlider } from "../onboarding/slider";

const MACRO_KEY_BY_GOAL: Record<Exclude<Goal, "maintain">, "fat" | "protein" | "carbs"> = {
  lose: "fat",
  gain: "protein",
  recomp: "carbs",
};

export interface GoalPaceSliderProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  /** Onboarding goal — drives the accent tint (lose/gain/recomp). */
  sliderGoal: Goal;
}

export function GoalPaceSlider({
  value,
  onChange,
  min,
  max,
  step,
  sliderGoal,
}: GoalPaceSliderProps) {
  const colors = useThemeColors();
  const { colors: macro } = useMacroColors();
  const accent =
    sliderGoal === "maintain"
      ? macro.fat
      : macro[MACRO_KEY_BY_GOAL[sliderGoal]];

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: Radius.lg,
        padding: 16,
        marginBottom: 16,
      }}
      testID="goal-pace-editor-pace-slider"
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 1,
          color: colors.textTertiary,
          marginBottom: 4,
        }}
      >
        Rate
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        {/* SLOE Phase 0: the kg/week pace hero numeral reads in Newsreader
            serif (big numerals are a serif moment). Family carries the weight,
            so the sans `fontWeight: 800` is dropped; the `kg / week` unit stays
            sans below. */}
        <Text
          style={{
            fontFamily: FontFamily.serifRegular,
            fontSize: 34,
            letterSpacing: -1,
            color: colors.text,
            fontVariant: ["tabular-nums"],
            lineHeight: 38,
            includeFontPadding: false,
          }}
        >
          {value.toFixed(value < 0.1 ? 3 : 2)}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: "600" }}>
          kg / week
        </Text>
      </View>
      <View style={{ marginTop: 8 }}>
        <MobileMiniSlider
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          accent={accent}
          ariaLabel="Weekly rate"
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <Text
          style={{ fontSize: 10, color: colors.textTertiary, fontVariant: ["tabular-nums"] }}
        >
          {min} kg / wk
        </Text>
        <Text
          style={{ fontSize: 10, color: colors.textTertiary, fontVariant: ["tabular-nums"] }}
        >
          {max} kg / wk
        </Text>
      </View>
    </View>
  );
}

export default GoalPaceSlider;
