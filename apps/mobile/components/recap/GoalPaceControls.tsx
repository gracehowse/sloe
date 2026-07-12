/**
 * GoalPaceControls — the goal-type option list and the Cancel/Save CTA
 * footer for the mobile GoalPaceEditorSheet. Extracted to keep the sheet
 * file under the 400-line limit (ENG-621). Pure presentation; all state
 * lives in `useGoalPaceEditor`.
 */

import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { EditorDbGoal } from "@suppr/nutrition-core/goalEditorPace";
import type { DayTargetScheduleId } from "@suppr/nutrition-core/dayTargetSchedule";

export const GOAL_OPTIONS: { value: EditorDbGoal; label: string; desc: string }[] = [
  { value: "cut", label: "Lose weight", desc: "Eat in a deficit" },
  { value: "maintain", label: "Maintain", desc: "Hold your weight" },
  { value: "bulk", label: "Gain weight", desc: "Eat in a surplus" },
];

export function GoalOptionList({
  goal,
  onChange,
}: {
  /** ENG-1507 — `null` = unknown goal on the row; no option renders selected. */
  goal: EditorDbGoal | null;
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
                  fontFamily: Type.bodyLarge.fontFamily,
                  fontSize: Type.bodyLarge.fontSize,
                  lineHeight: Type.bodyLarge.lineHeight,
                  fontWeight: selected ? "700" : "500",
                  color: selected ? colors.text : colors.textSecondary,
                }}
              >
                {opt.label}
              </Text>
              <Text style={{ ...Type.captionSmall, color: colors.textTertiary, marginTop: 2 }}>
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

// ENG-960 — opt-in day-target schedule presets. "same" clears the schedule.
export const SCHEDULE_OPTIONS: {
  value: DayTargetScheduleId | "same";
  label: string;
  desc: string;
}[] = [
  { value: "same", label: "Same every day", desc: "One steady target" },
  { value: "weekend_lift", label: "More at weekends", desc: "Higher Sat/Sun" },
  { value: "lighter_weekdays", label: "Lighter weekdays", desc: "Bigger weekends" },
];

export function CalorieScheduleOptionList({
  value,
  onChange,
}: {
  value: DayTargetScheduleId | "same";
  onChange: (v: DayTargetScheduleId | "same") => void;
}) {
  const accent = useAccent();
  const colors = useThemeColors();
  return (
    <View
      style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}
      testID="goal-pace-editor-schedule-options"
    >
      {SCHEDULE_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityLabel={`${opt.label} — ${selected ? "selected" : "tap to select"}`}
            onPress={() => onChange(opt.value)}
            testID={`calorie-schedule-option-${opt.value}`}
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
                  fontSize: 14,
                  fontWeight: selected ? "700" : "500",
                  color: selected ? colors.text : colors.textSecondary,
                }}
              >
                {opt.label}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: Spacing.xs }}>
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
  canSave = true,
}: {
  saving: boolean;
  dirty: boolean;
  onCancel: () => void;
  onSave: () => void;
  /** ENG-1027 — false when the live target is below the safety floor and
   *  the user hasn't acknowledged yet. Disables Save (the ack toggle in
   *  the sheet body is the next action). Defaults true (above-floor). */
  canSave?: boolean;
}) {
  // Sloe button-system canon (2026-06-12): Save = the footer's ONE commit
  // action → SupprButton variant="primary" (solid aubergine pill). Cancel =
  // secondary sibling → variant="ghost" (transparent, plum label). The
  // flex 1 / 2 split is preserved as a layout-only style override.
  return (
    <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm }}>
      <SupprButton
        variant="ghost"
        accessibilityLabel="Cancel"
        onPress={onCancel}
        disabled={saving}
        testID="goal-pace-editor-cancel"
        label="Cancel"
        style={{ flex: 1 }}
      />
      <SupprButton
        variant="primary"
        accessibilityLabel="Save goal and pace"
        onPress={onSave}
        disabled={saving || !dirty || !canSave}
        loading={saving}
        testID="goal-pace-editor-save"
        label="Save"
        style={{ flex: 2 }}
      />
    </View>
  );
}
