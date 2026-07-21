import { StyleSheet, Text, TextInput, View } from "react-native";
import { Info } from "lucide-react-native";

import { SupprButton } from "@/components/ui/SupprButton";
import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import type { LabelLogReviewFields } from "@suppr/nutrition-core/labelLogging";

export type LabelLogReviewTheme = {
  text: string;
  textSecondary: string;
  card: string;
  cardBorder: string;
  background: string;
  inputBg: string;
};

function ReviewField({
  label,
  value,
  onChange,
  colors,
  testID,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors: LabelLogReviewTheme;
  testID: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.cardBorder,
            backgroundColor: colors.inputBg,
          },
        ]}
      />
    </View>
  );
}

export function LabelLogReview({
  fields,
  warning,
  error,
  saving,
  activeSlot,
  colors,
  onUpdate,
  onCapture,
  onCommit,
}: {
  fields: LabelLogReviewFields;
  warning: string;
  error: string | null;
  saving: boolean;
  activeSlot: string;
  colors: LabelLogReviewTheme;
  onUpdate: (key: keyof LabelLogReviewFields, value: string) => void;
  onCapture: () => void;
  onCommit: () => void;
}) {
  const accent = useAccent();
  return (
    <View style={styles.review}>
      <View style={[styles.warning, { backgroundColor: accent.warningSoft }]}>
        <Info size={IconSize.base} color={Accent.warningSolid} />
        <Text style={[styles.warningText, { color: Accent.warningSolid }]}>{warning}</Text>
      </View>
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Food name</Text>
        <TextInput
          testID="label-log-name"
          accessibilityLabel="Food name"
          value={fields.name}
          onChangeText={(value) => onUpdate("name", value)}
          placeholder="Name this food"
          placeholderTextColor={colors.textSecondary}
          autoFocus
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.cardBorder,
              backgroundColor: colors.inputBg,
            },
          ]}
        />
      </View>
      <ReviewField
        label="Serving size (g)"
        value={fields.servingSizeG}
        onChange={(value) => onUpdate("servingSizeG", value)}
        colors={colors}
        testID="label-log-serving"
      />
      <View style={styles.macroGrid}>
        <ReviewField label="Calories" value={fields.calories} onChange={(value) => onUpdate("calories", value)} colors={colors} testID="label-log-calories" />
        <ReviewField label="Protein (g)" value={fields.protein} onChange={(value) => onUpdate("protein", value)} colors={colors} testID="label-log-protein" />
        <ReviewField label="Carbs (g)" value={fields.carbs} onChange={(value) => onUpdate("carbs", value)} colors={colors} testID="label-log-carbs" />
        <ReviewField label="Fat (g)" value={fields.fat} onChange={(value) => onUpdate("fat", value)} colors={colors} testID="label-log-fat" />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SupprButton
        variant="ghost"
        label="Scan again"
        onPress={onCapture}
        disabled={saving}
        style={styles.fullWidth}
      />
      <SupprButton
        variant="primary"
        label={`Log to ${activeSlot}`}
        onPress={onCommit}
        loading={saving}
        testID="label-log-commit"
        style={styles.fullWidth}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  review: { gap: Spacing.md },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.dense,
    borderRadius: Radius.lg,
  },
  warningText: { ...Type.captionSmall, flex: 1 },
  field: { flex: 1, gap: Spacing.xs },
  fieldLabel: { ...Type.captionStrong },
  input: {
    ...Type.body,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.dense,
    paddingVertical: Spacing.dense,
  },
  macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.dense },
  error: { ...Type.captionSmall, color: Accent.destructive, textAlign: "center" },
  fullWidth: { width: "100%" },
});
