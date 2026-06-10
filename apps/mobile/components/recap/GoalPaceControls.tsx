/**
 * GoalPaceControls — the goal-type option list and the Cancel/Save CTA
 * footer for the mobile GoalPaceEditorSheet. Extracted to keep the sheet
 * file under the 400-line limit (ENG-621). Pure presentation; all state
 * lives in `useGoalPaceEditor`.
 */

import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { EditorDbGoal } from "@suppr/shared/nutrition/goalEditorPace";

export const GOAL_OPTIONS: { value: EditorDbGoal; label: string; desc: string }[] = [
  { value: "cut", label: "Lose weight", desc: "Eat in a deficit" },
  { value: "maintain", label: "Maintain", desc: "Hold your weight" },
  { value: "bulk", label: "Gain weight", desc: "Eat in a surplus" },
];

export function GoalOptionList({
  goal,
  onChange,
}: {
  goal: EditorDbGoal;
  onChange: (g: EditorDbGoal) => void;
}) {
  const accent = useAccent();
  const colors = useThemeColors();
  // Selected goal option — aubergine edge + soft tint + aubergine check (Sloe
  // treatment #7/#8, 2026-06-08). `accent.primarySolid` carries the edge/check
  // (AA on the card); `accent.primarySoft` is the selected wash.
  return (
    <View
      style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}
      testID="goal-pace-editor-goal-options"
    >
      {GOAL_OPTIONS.map((opt) => {
        const selected = goal === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityLabel={`${opt.label} — ${selected ? "selected" : "tap to select"}`}
            onPress={() => onChange(opt.value)}
            testID={`goal-option-${opt.value}`}
            style={{
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.md,
              borderRadius: Radius.md,
              borderWidth: 1.5,
              borderColor: selected ? accent.primarySolid : colors.cardBorder,
              backgroundColor: selected ? accent.primarySoft : colors.card,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: selected ? "700" : "500",
                  color: selected ? colors.text : colors.textSecondary,
                }}
              >
                {opt.label}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                {opt.desc}
              </Text>
            </View>
            {selected ? <Check size={18} color={accent.primarySolid} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function GoalPaceFooter({
  saving,
  dirty,
  onCancel,
  onSave,
}: {
  saving: boolean;
  dirty: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const accent = useAccent();
  const colors = useThemeColors();
  // Save — aubergine OUTLINE (Sloe treatment #1, 2026-06-08). The goal/pace
  // Save is an everyday primary CTA: transparent fill, 1.5px
  // `accent.primarySolid` border + label, sitting alongside the neutral
  // grey-outline Cancel.
  return (
    <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        onPress={onCancel}
        disabled={saving}
        testID="goal-pace-editor-cancel"
        style={{
          flex: 1,
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1.5,
          borderColor: colors.cardBorder,
          alignItems: "center",
          justifyContent: "center",
          opacity: saving ? 0.5 : 1,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>Cancel</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save goal and pace"
        onPress={onSave}
        disabled={saving || !dirty}
        testID="goal-pace-editor-save"
        style={{
          flex: 2,
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: accent.primarySolid,
          alignItems: "center",
          justifyContent: "center",
          opacity: saving || !dirty ? 0.5 : 1,
        }}
      >
        {saving ? (
          <ActivityIndicator color={accent.primarySolid} />
        ) : (
          <Text style={{ fontSize: 15, fontWeight: "700", color: accent.primarySolid }}>Save</Text>
        )}
      </Pressable>
    </View>
  );
}
