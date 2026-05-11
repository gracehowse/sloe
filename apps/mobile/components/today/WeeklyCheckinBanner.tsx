/**
 * WeeklyCheckinBanner — Sunday-morning prompt on Today that routes to
 * the Weekly Recap surface (which hosts the TDEE delta + goal-pace
 * re-tune).
 *
 * Spec: extended-competitor-audit task (2026-04-30, Step 3).
 *
 * Visibility rules (the host wires these — banner is presentational):
 *   - Today's local day-of-week matches the user's `weekStartDay`
 *     boundary (i.e. it's the first day of a fresh week — Sunday for
 *     Sunday-start, Monday for Monday-start).
 *   - The banner has not been dismissed for the current `weekKey`.
 *   - The user has logged at least one day in the previous week (so
 *     there's something to recap). The host computes this against the
 *     existing `byDay` map.
 *
 * Posture: same calm rules as the Digest. No emoji, no celebration, no
 * "Don't break your streak" copy. The banner is a quiet pointer.
 *
 * Mobile-only — web does not surface this banner because the Digest
 * card already lives on the web Progress dashboard (the Sunday cadence
 * is built into the Digest's `shouldShowRecap` gate).
 */

import { Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";

export interface WeeklyCheckinBannerProps {
  textColor: string;
  textSecondaryColor: string;
  onOpen: () => void;
  onDismiss: () => void;
}

export function WeeklyCheckinBanner({
  textColor,
  textSecondaryColor,
  onOpen,
  onDismiss,
}: WeeklyCheckinBannerProps) {
  return (
    <View
      testID="weekly-checkin-banner"
      style={{
        marginBottom: Spacing.md,
        backgroundColor: `${Accent.primary}08`,
        borderWidth: 1,
        borderColor: `${Accent.primary}30`,
        borderRadius: Radius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: Accent.primary,
            letterSpacing: 1,
          }}
        >
          WEEKLY CHECK-IN
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: textColor,
            marginTop: 2,
          }}
        >
          Your weekly check-in is ready.
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: textSecondaryColor,
            marginTop: 2,
            lineHeight: 15,
          }}
        >
          See last week&rsquo;s intake, weight delta, and adjust your goal pace.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open weekly check-in"
        onPress={onOpen}
        testID="weekly-checkin-banner-open"
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: Radius.sm,
          backgroundColor: Accent.primary,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: "#fff",
            letterSpacing: 0.5,
          }}
        >
          OPEN
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss weekly check-in banner"
        onPress={onDismiss}
        hitSlop={8}
        testID="weekly-checkin-banner-dismiss"
        style={{ padding: 4 }}
      >
        <X size={18} color={textSecondaryColor} />
      </Pressable>
    </View>
  );
}

export default WeeklyCheckinBanner;
