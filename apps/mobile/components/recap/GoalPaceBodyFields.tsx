/**
 * GoalPaceBodyFields — editable current-weight + height inputs for the
 * mobile GoalPaceEditorSheet. Respects the user's measurement_system
 * (kg/cm vs lb/ft-in), mirroring onboarding + /profile. Changes feed the
 * recompute in `useGoalPaceEditor`. Extracted to keep the sheet under the
 * 400-line limit (ENG-621).
 */

import { Text, TextInput, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export interface GoalPaceBodyFieldsProps {
  measurementSystem: "metric" | "imperial";
  weightUnit: string;
  weightInput: string;
  setWeightInput: (v: string) => void;
  heightCmInput: string;
  setHeightCmInput: (v: string) => void;
  heightFeetInput: string;
  setHeightFeetInput: (v: string) => void;
  heightInchesInput: string;
  setHeightInchesInput: (v: string) => void;
}

export function GoalPaceBodyFields(props: GoalPaceBodyFieldsProps) {
  const colors = useThemeColors();
  const {
    measurementSystem,
    weightUnit,
    weightInput,
    setWeightInput,
    heightCmInput,
    setHeightCmInput,
    heightFeetInput,
    setHeightFeetInput,
    heightInchesInput,
    setHeightInchesInput,
  } = props;

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  } as const;

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

  return (
    <View>
      {/* Current weight */}
      {sectionLabel(`Current weight (${weightUnit})`)}
      <TextInput
        value={weightInput}
        onChangeText={setWeightInput}
        keyboardType="decimal-pad"
        placeholder={`Weight in ${weightUnit}`}
        placeholderTextColor={colors.textTertiary}
        testID="goal-pace-editor-weight-input"
        style={{ ...inputStyle, marginBottom: Spacing.lg }}
      />

      {/* Height */}
      {sectionLabel(measurementSystem === "imperial" ? "Height (ft / in)" : "Height (cm)")}
      {measurementSystem === "imperial" ? (
        <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg }}>
          <TextInput
            value={heightFeetInput}
            onChangeText={setHeightFeetInput}
            keyboardType="number-pad"
            placeholder="ft"
            placeholderTextColor={colors.textTertiary}
            testID="goal-pace-editor-height-feet"
            style={{ ...inputStyle, flex: 1 }}
          />
          <TextInput
            value={heightInchesInput}
            onChangeText={setHeightInchesInput}
            keyboardType="number-pad"
            placeholder="in"
            placeholderTextColor={colors.textTertiary}
            testID="goal-pace-editor-height-inches"
            style={{ ...inputStyle, flex: 1 }}
          />
        </View>
      ) : (
        <TextInput
          value={heightCmInput}
          onChangeText={setHeightCmInput}
          keyboardType="number-pad"
          placeholder="Height in cm"
          placeholderTextColor={colors.textTertiary}
          testID="goal-pace-editor-height-cm"
          style={{ ...inputStyle, marginBottom: Spacing.lg }}
        />
      )}
    </View>
  );
}

export default GoalPaceBodyFields;
