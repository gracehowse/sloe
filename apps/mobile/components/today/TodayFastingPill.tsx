import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing } from "@/constants/theme";

/**
 * TodayFastingPill — "Fasting — Xh Ym" CTA linking to the fasting timer.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). The pill itself is stateless — the host passes the
 * active fast's `startedAt` + `nowTick` so elapsed time recalculates
 * once per minute via the host's existing interval.
 */
export interface TodayFastingPillProps {
  startedAt: string;
  nowTick: number;
  onPress: () => void;
}

export function TodayFastingPill({ startedAt, nowTick, onPress }: TodayFastingPillProps) {
  const elapsedH = Math.max(0, (nowTick - new Date(startedAt).getTime()) / 3600_000);
  const h = Math.floor(elapsedH);
  const m = Math.floor((elapsedH - h) * 60);
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: Spacing.lg,
        alignSelf: "center",
        backgroundColor: Accent.primary + "18",
        borderRadius: Radius.md,
        marginVertical: Spacing.xs,
      }}
    >
      <Ionicons name="time" size={16} color={Accent.primary} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primary }}>
        Fasting — {h}h {m}m
      </Text>
    </Pressable>
  );
}

export default TodayFastingPill;
