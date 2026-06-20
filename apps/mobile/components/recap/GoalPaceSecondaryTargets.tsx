/**
 * GoalPaceSecondaryTargets — goal weight + fibre inputs for the post-
 * onboarding goal-pace editor. Extracted from `GoalPaceEditorSheet` to
 * keep the sheet shell under the 400-line budget (ENG-621 / ENG-846).
 */

import { Text, TextInput, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export interface GoalPaceSecondaryTargetsProps {
  weightUnit: string;
  goalWeightInput: string;
  setGoalWeightInput: (v: string) => void;
  fiberInput: string;
  setFiberInput: (v: string) => void;
  previewFiberG: number | null;
}

export function GoalPaceSecondaryTargets({
  weightUnit,
  goalWeightInput,
  setGoalWeightInput,
  fiberInput,
  setFiberInput,
  previewFiberG,
}: GoalPaceSecondaryTargetsProps) {
  const colors = useThemeColors();

  const sectionLabel = (txt: string) => (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: colors.textTertiary,
        letterSpacing: 0.88,
        textTransform: "uppercase",
        marginBottom: Spacing.sm,
      }}
    >
      {txt}
    </Text>
  );

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
    marginBottom: Spacing.xs,
  } as const;

  const hintStyle = {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: Spacing.lg,
    lineHeight: 17,
  } as const;

  return (
    <View>
      {sectionLabel(`Goal weight (${weightUnit})`)}
      <TextInput
        value={goalWeightInput}
        onChangeText={setGoalWeightInput}
        keyboardType="decimal-pad"
        placeholder={`Target weight in ${weightUnit}`}
        placeholderTextColor={colors.textTertiary}
        testID="goal-weight-input"
        style={inputStyle}
      />
      <Text style={hintStyle}>
        Used for your projected reach-date only — it doesn&apos;t change your calorie
        target.
      </Text>

      {sectionLabel("Daily fibre (g)")}
      <TextInput
        value={fiberInput}
        onChangeText={setFiberInput}
        keyboardType="number-pad"
        placeholder={
          previewFiberG != null
            ? `Recommended ${previewFiberG}g`
            : "Daily fibre target in grams"
        }
        placeholderTextColor={colors.textTertiary}
        testID="goal-fiber-input"
        style={inputStyle}
      />
      <Text style={hintStyle}>
        Your fibre goal stays put when you change pace — unless you edit it here.
      </Text>
    </View>
  );
}

export default GoalPaceSecondaryTargets;
