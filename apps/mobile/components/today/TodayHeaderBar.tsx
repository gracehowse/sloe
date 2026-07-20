import React, { memo } from "react";
import { Pressable, View } from "react-native";
import { Bell } from "lucide-react-native";

import { GradientAvatar } from "@/components/GradientAvatar";
import { SloeHeaderWordmark } from "@/components/SloeHeaderWordmark";
import { Accent, IconSize, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { useUnreadNotificationsCount } from "@/lib/notifications";

export interface TodayHeaderBarProps {
  /** Auth user id — drives the unread-notifications dot (null when signed out). */
  userId: string | null;
  /** Avatar initial (first letter of the user's email, uppercased). */
  avatarInitial: string;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
}

/**
 * Today top header row (ENG-1247): wordmark (left) + notification-bell and
 * avatar (right). The bell conforms the v3 prototype `.t-head` + closes the
 * web↔mobile parity gap (web has a notifications bell; mobile had none) — it
 * surfaces the otherwise-unreachable `(tabs)/notifications` screen, with a
 * prototype `.t-bell-dot` unread indicator. The prototype's header *calendar*
 * is deliberately omitted: the week-strip already owns the calendar entry, so a
 * second one would duplicate it (Grace, 2026-06-28 — "add bell only").
 */
function TodayHeaderBarImpl({
  userId,
  avatarInitial,
  onOpenSettings,
  onOpenNotifications,
}: TodayHeaderBarProps) {
  const colors = useThemeColors();
  const unread = useUnreadNotificationsCount(userId);
  // ENG-1593 — Rule 7 (DESIGN-CONSTITUTION.md): serif initial + frost-ring,
  // default-OFF (see apps/mobile/lib/analytics.ts flag note).
  const avatarFrostRingV1 = isFeatureEnabled("avatar_monogram_frost_ring_v1");
  return (
    <View
      testID="today-hydrated"
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: Spacing.xs,
      }}
    >
      <SloeHeaderWordmark testID="today-wordmark" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
        <Pressable
          testID="today-notifications-bell"
          onPress={onOpenNotifications}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Bell size={IconSize.xl} color={colors.text} strokeWidth={1.75} />
          {unread > 0 ? (
            <View
              testID="today-notifications-unread-dot"
              style={{
                position: "absolute",
                top: -1,
                right: -1,
                width: 8,
                height: 8,
                borderRadius: Radius.full,
                backgroundColor: Accent.purple,
                borderWidth: 1,
                borderColor: colors.background,
              }}
            />
          ) : null}
        </Pressable>
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <GradientAvatar
            size={36}
            initial={avatarInitial}
            fontSize={13}
            gradientIdSuffix="today-wordmark-header"
            // Figma `654:6` — damson fill + white initial (not the grey ink default).
            fill={Accent.purple}
            textColor={colors.primaryForeground}
            treatment={avatarFrostRingV1 ? "frostRing" : "legacy"}
          />
        </Pressable>
      </View>
    </View>
  );
}

export const TodayHeaderBar = memo(TodayHeaderBarImpl);
