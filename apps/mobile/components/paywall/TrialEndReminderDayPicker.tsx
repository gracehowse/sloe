import { Text, View, StyleSheet } from "react-native";

import { MobileSegmented } from "@/components/onboarding/segmented";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  DEFAULT_TRIAL_END_REMINDER_DAY,
  TRIAL_END_REMINDER_DAY_OPTIONS,
  trialEndReminderDayLabel,
  type TrialEndReminderDay,
} from "@suppr/shared/push/trialEndReminder";

export interface TrialEndReminderDayPickerProps {
  visible: boolean;
  value: TrialEndReminderDay;
  onChange: (day: TrialEndReminderDay) => void;
}

/**
 * ENG-968 — Duolingo-style trial-end reminder day picker below the paywall
 * timeline. Hidden when notifications permission is denied (spec: silent).
 */
export function TrialEndReminderDayPicker({
  visible,
  value,
  onChange,
}: TrialEndReminderDayPickerProps) {
  const colors = useThemeColors();

  if (!visible) return null;

  const options = TRIAL_END_REMINDER_DAY_OPTIONS.map((day) => ({
    value: String(day) as `${TrialEndReminderDay}`,
    label: trialEndReminderDayLabel(day),
  }));

  return (
    <View style={styles.wrap} testID="trial-end-reminder-picker">
      <Text style={[Type.caption, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
        We&apos;ll remind you before your trial ends — choose when.
      </Text>
      <MobileSegmented
        ariaLabel="Trial reminder day"
        options={options}
        value={String(value)}
        onChange={(next) => {
          const day = Number.parseInt(next, 10);
          if (day === 5 || day === 6 || day === 7) onChange(day);
        }}
        style={styles.segmented}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.md },
  segmented: { alignSelf: "stretch" },
});

export { DEFAULT_TRIAL_END_REMINDER_DAY };
