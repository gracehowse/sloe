import * as React from "react";
import { Modal, Pressable, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { WeekdayIndex } from "@suppr/shared/push/weighInReminder";

/**
 * ENG-955 — weigh-in reminder cadence picker (bottom sheet). Presentational:
 * the opt-in state + persistence live in the parent `WeighInReminderRow`; this
 * file owns the modal layout so the row stays under the 400-line cap. Copy is
 * warm and trend-framed — never a streak/badge/threat.
 */

export const WEEKDAY_LABELS: Record<WeekdayIndex, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/** Cadence hour choices — a small, calm set rather than a free 0–23 spinner.
 *  Morning-leaning because the copy nudges toward a morning weigh-in. */
export const HOUR_CHOICES = [7, 8, 9, 18] as const;

export function formatHour(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  const suffix = hour < 12 ? "am" : "pm";
  return `${h}${suffix}`;
}

/** Selectable cadence chip — shared by the Day + Time pickers so both pills
 *  render identically (near-duplicate rule). */
function CadenceChip({
  label,
  a11yLabel,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  a11yLabel: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
      style={{
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: selected ? accent.primary : colors.cardBorder,
        backgroundColor: selected ? accent.primarySoft : colors.background,
      }}
    >
      <Text
        style={{
          fontFamily: Type.captionSmall.fontFamily,
          fontSize: Type.captionSmall.fontSize,
          lineHeight: Type.captionSmall.lineHeight,
          fontWeight: selected ? "700" : "500",
          color: selected ? accent.primary : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function WeighInReminderPicker({
  visible,
  onClose,
  enabled,
  weekday,
  hour,
  onToggle,
  onPickCadence,
}: {
  visible: boolean;
  onClose: () => void;
  enabled: boolean;
  weekday: WeekdayIndex;
  hour: number;
  onToggle: (next: boolean) => void;
  onPickCadence: (weekday: WeekdayIndex, hour: number) => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: Radius.sm,
              backgroundColor: colors.border,
              alignSelf: "center",
              marginBottom: Spacing.lg,
            }}
          />
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.text,
              marginBottom: Spacing.xs,
            }}
          >
            Weigh-in reminder
          </Text>
          <Text
            style={{ ...Type.captionSmall, color: colors.textSecondary, marginBottom: Spacing.lg }}
          >
            A gentle weekly nudge to weigh in — only when you haven&apos;t
            already this week. Mornings give the steadiest trend. Off by
            choice; no nudge will be sent.
          </Text>

          {/* Master opt-in toggle */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: Spacing.dense,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
                Send weigh-in reminder
              </Text>
              <Text
                style={{ ...Type.captionSmall, color: colors.textSecondary, marginTop: Spacing.xs }}
              >
                {enabled
                  ? "On · skipped automatically if you've already weighed in"
                  : "Off · no nudge will be scheduled"}
              </Text>
            </View>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel="Weigh-in reminder notifications"
              accessibilityState={{ checked: enabled }}
              value={enabled}
              onValueChange={onToggle}
              trackColor={{ false: colors.border, true: accent.primary }}
            />
          </View>

          {/* Cadence — visible at reduced emphasis when off so it can be set
              before flipping on. */}
          <View style={{ opacity: enabled ? 1 : 0.5, marginTop: Spacing.lg }}>
            <Text
              style={{
                fontFamily: Type.captionSmall.fontFamily,
                fontSize: Type.captionSmall.fontSize,
                lineHeight: Type.captionSmall.lineHeight,
                fontWeight: "600",
                color: colors.textSecondary,
                marginBottom: Spacing.sm,
              }}
            >
              Day
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
              {(Object.keys(WEEKDAY_LABELS) as unknown as string[]).map((k) => {
                const wd = Number(k) as WeekdayIndex;
                return (
                  <CadenceChip
                    key={wd}
                    label={WEEKDAY_LABELS[wd].slice(0, 3)}
                    a11yLabel={`Weigh in on ${WEEKDAY_LABELS[wd]}`}
                    selected={wd === weekday}
                    disabled={!enabled}
                    onPress={() => onPickCadence(wd, hour)}
                  />
                );
              })}
            </View>

            <Text
              style={{
                fontFamily: Type.captionSmall.fontFamily,
                fontSize: Type.captionSmall.fontSize,
                lineHeight: Type.captionSmall.lineHeight,
                fontWeight: "600",
                color: colors.textSecondary,
                marginTop: Spacing.lg,
                marginBottom: Spacing.sm,
              }}
            >
              Time
            </Text>
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              {HOUR_CHOICES.map((h) => (
                <CadenceChip
                  key={h}
                  label={formatHour(h)}
                  a11yLabel={`Weigh in at ${formatHour(h)}`}
                  selected={h === hour}
                  disabled={!enabled}
                  onPress={() => onPickCadence(weekday, h)}
                />
              ))}
            </View>
          </View>

          <SupprButton
            variant="ghost"
            onPress={onClose}
            label="Done"
            style={{ marginTop: Spacing.lg }}
          />
        </View>
      </View>
    </Modal>
  );
}
