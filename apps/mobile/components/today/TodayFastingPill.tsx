import React, { memo } from "react";
import { Text } from "react-native";
import { Clock } from "lucide-react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * TodayFastingPill — fasting state CTA on the Today surface.
 *
 * Two render modes:
 * - `active`: "Fasting — Xh Ym" with the live elapsed counter. Shown
 *   when the user has an in-flight fast (`startedAt` set). Stateless;
 *   host passes `nowTick` and recalculates per minute.
 * - `idle`:   "Start fast" — shown when the user has opted in to
 *   intermittent fasting (`profiles.fasting_window != null`) but is
 *   not currently fasting. Tapping the pill opens the fasting page,
 *   where Start Fast lives. F-109 (TestFlight `AFHtAQRAWad1w8bDvSgZkUg`,
 *   2026-05-06): tester reported "Can't see how to turn fasting on
 *   and off" — the active-only pill meant there was no entry from
 *   Today when the user was idle. The host gates this mode on the IF
 *   opt-in signal so it never appears for non-IF users (Grace,
 *   2026-05-07): "we only want to show that fast pill if they said in
 *   onboarding/changed in settings that they want to do intermittent
 *   fasting."
 *
 * Original (audit H3, 2026-04-18) was stateless-active-only; this
 * widens the API to add the idle mode without breaking existing
 * callers.
 */
export type TodayFastingPillProps =
  | {
      mode?: "active";
      startedAt: string;
      nowTick: number;
      onPress: () => void;
    }
  | {
      mode: "idle";
      onPress: () => void;
    };

function TodayFastingPillImpl(props: TodayFastingPillProps) {
  const accent = useAccent();
  const colors = useThemeColors();
  if (props.mode === "idle") {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Start fast"
        onPress={props.onPress}
        haptic="selection"
        testID="today-fasting-pill-idle"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.lg,
          alignSelf: "center",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.full,
          marginVertical: Spacing.xs,
        }}
      >
        <Clock size={16} color={colors.textSecondary} strokeWidth={2.25} />
        <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
          Start fast
        </Text>
      </PressableScale>
    );
  }

  const elapsedH = Math.max(0, (props.nowTick - new Date(props.startedAt).getTime()) / 3600_000);
  const h = Math.floor(elapsedH);
  const m = Math.floor((elapsedH - h) * 60);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Fasting — ${h} hours ${m} minutes elapsed`}
      onPress={props.onPress}
      haptic="selection"
      testID="today-fasting-pill-active"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        alignSelf: "center",
        backgroundColor: accent.primary + "18",
        borderRadius: Radius.full,
        marginVertical: Spacing.xs,
      }}
    >
      <Clock size={16} color={accent.primarySolid} strokeWidth={2.25} />
      <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 13, fontWeight: "600", color: accent.primarySolid }}>
        Fasting — {h}h {m}m
      </Text>
    </PressableScale>
  );
}

export const TodayFastingPill = memo(TodayFastingPillImpl);

export default TodayFastingPill;
