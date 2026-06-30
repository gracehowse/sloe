import * as React from "react";
import { Alert, Modal, Pressable, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { supabase } from "@/lib/supabase";
import { cancelWeeklyRecapPush } from "@/lib/weeklyRecapPush";

/**
 * Weekly recap push picker — extracted from `SettingsBundleContent` (ENG-955)
 * to keep that legacy file under its pinned screen budget when the new
 * weigh-in reminder row landed. Behaviour is byte-for-byte unchanged: the
 * toggle controls `profiles.weekly_recap_push_enabled`, OFF cancels any stale
 * local OS schedule, and the committed change emits
 * `weekly_recap_push_enabled_toggled`. Row testID / ordering and the toggle
 * a11y label are unchanged (pinned by `settingsBundleParity.test.ts`).
 */
export function WeeklyRecapPushPicker({
  visible,
  onClose,
  enabled,
  setEnabled,
  userId,
  weekStartDay,
}: {
  visible: boolean;
  onClose: () => void;
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  userId: string | null;
  weekStartDay: "monday" | "sunday";
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
              marginBottom: 4,
            }}
          >
            Weekly recap
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginBottom: Spacing.lg,
            }}
          >
            Get a one-tap summary of your week on{" "}
            {weekStartDay === "monday" ? "Sunday" : "Saturday"} evening. Off by
            choice — no reminder will be sent.
          </Text>
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
                Send weekly recap
              </Text>
              <Text
                style={{ fontSize: 12, color: colors.textSecondary, marginTop: Spacing.xs }}
              >
                {enabled
                  ? "On · next push lands at the end of your week"
                  : "Off · no push will be scheduled"}
              </Text>
            </View>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel="Weekly recap push notifications"
              accessibilityState={{ checked: enabled }}
              value={enabled}
              onValueChange={(next) => {
                const previous = enabled;
                if (previous === next) return;
                setEnabled(next);
                if (!userId) {
                  setEnabled(previous);
                  Alert.alert(
                    "Sign in required",
                    "Sign in to change this preference.",
                  );
                  return;
                }
                void (async () => {
                  const { error } = await supabase
                    .from("profiles")
                    .update({ weekly_recap_push_enabled: next })
                    .eq("id", userId);
                  if (error) {
                    setEnabled(previous);
                    Alert.alert(
                      "Could not save",
                      "We couldn't save your preference. Please try again.",
                    );
                    return;
                  }
                  // Server cron at /api/push/weekly-recap owns delivery
                  // since 2026-04-20; OFF still cancels any stale local
                  // schedule lingering in the OS queue.
                  if (!next) {
                    try {
                      await cancelWeeklyRecapPush();
                    } catch {
                      // captureException inside the helper already
                      // routes OS errors; never revert the DB toggle.
                    }
                  }
                  track(AnalyticsEvents.weekly_recap_push_enabled_toggled, {
                    enabled: next,
                  });
                })();
              }}
              trackColor={{ false: colors.border, true: accent.primary }}
            />
          </View>
          {/* Done — GHOST (Sloe button canon, 2026-06-12). Inline picker
              dismiss action: transparent, no border, plum label. */}
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
