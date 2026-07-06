import React from "react";
import { Pressable, Text, View } from "react-native";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { todayStatusChip } from "@suppr/shared/copy/today";

/**
 * TodayHeroChips — the small status/entry chips that live around the Today
 * hero ring. Extracted from `TodayHeroRing.tsx` (ENG-1293) so the ring file
 * stays under the 400-line screen budget:
 *
 *   - `StatusChip`     — the calm state pill above the carded ring.
 *   - `RingStatusLine` — the de-carded v3 status dot + label below the ring.
 *   - `TodayCoachChip` — the always-present labelled Coach entry (ENG-1293,
 *     sweep decision #3 2026-07-01).
 */

/**
 * StatusChip — the calm state pill above the ring (SLOE `01 · Today`
 * frame, chip-left). Three states with Sloe tints + a lucide glyph:
 *   - empty → "Fresh start" (plum text; fill only when tier-v1 flag OFF)
 *   - under → "Under budget" (sage tint, circle-check)
 *   - over  → "Over budget"  (over-budget AMBER tint, circle-alert —
 *     ENG-1453; red retired product-wide per ENG-1296, this chip was
 *     the surviving red. Same tokens as the web pill: overBudgetFg /
 *     overBudgetSoft ↔ --over-budget-fg / --over-budget-soft.)
 * Copy comes from the shared `todayStatusChip` helper (Figma `01 · Today`).
 */
export function StatusChip({
  state,
  overByKcal,
  isDark,
  onPress,
}: {
  state: "empty" | "under" | "over";
  overByKcal: number;
  isDark: boolean;
  onPress?: () => void;
}) {
  // Solid sage (#466046, 6.95:1) carries the label/icon — the base sage
  // (#5E7C5A) is only 4.0:1 as text, borderline for AA (design-director
  // 2026-06-16: the "Under budget" state cue should read at a glance).
  const sageInk = isDark ? Accent.successLight : Accent.successSolid;
  const colors = useThemeColors();
  const plum = colors.navPrimary; // ENG-1010: one scheme-resolved plum source
  const config =
    state === "over"
      ? { fg: colors.overBudgetFg, bg: colors.overBudgetSoft, Icon: CircleAlert }
      : state === "empty"
        ? {
            fg: plum,
            bg: "transparent",
            Icon: Sparkles,
          }
        : {
            fg: sageInk,
            bg: "transparent",
            Icon: CircleCheck,
          };
  const { fg, bg, Icon } = config;
  const label = todayStatusChip(state, overByKcal);
  const chipStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.xs,
    backgroundColor: bg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  };
  const chipContent = (
    <>
      <Icon size={14} color={fg} strokeWidth={2} />
      <Text style={{ fontSize: 11, fontWeight: "600", color: fg }}>{label}</Text>
    </>
  );
  if (!onPress) {
    return (
      <View testID="today-ring-status-chip" style={chipStyle}>
        {chipContent}
      </View>
    );
  }
  return (
    <Pressable
      testID="today-ring-status-chip"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, see how your calorie target was set`}
      style={chipStyle}
    >
      {chipContent}
    </Pressable>
  );
}

/**
 * RingStatusLine — the de-carded v3 hero's status indicator (ENG-1247): a
 * centered dot + label BELOW the ring (prototype `.ring-status`), replacing the
 * carded hero's chip-above-the-ring. Sage when under budget, over-budget AMBER
 * when over (ENG-1453 — red retired product-wide per ENG-1296; matches the ring
 * itself + the web status line); hidden on empty days. Copy from the shared
 * `todayStatusChip` helper (no drift).
 */
export function RingStatusLine({
  state,
  overByKcal,
  isDark,
}: {
  state: "empty" | "under" | "over";
  overByKcal: number;
  isDark: boolean;
}) {
  const colors = useThemeColors();
  if (state === "empty") return null;
  const color =
    state === "over"
      ? colors.overBudgetFg
      : isDark
        ? Accent.successLight
        : Accent.successSolid;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs }}>
      <View style={{ width: 7, height: 7, borderRadius: Radius.full, backgroundColor: color }} />
      <Text style={{ fontSize: 13, fontWeight: "600", color, letterSpacing: 0.1 }}>
        {todayStatusChip(state, overByKcal)}
      </Text>
    </View>
  );
}

/**
 * TodayCoachChip — the always-present labelled Coach entry in the Today hero
 * chip row (ENG-1293, sweep decision #3 2026-07-01: the only /coach entries
 * were welded to the conditional deficit line and vanished over-budget /
 * <50 kcal / on past days / while fasting). Renders in EVERY hero state; the
 * host gates it on `coach_screen_v1` (same flag as the Coach screen itself).
 *
 * Grammar: the "Coach" pill from `CoachScreenView` ("Today's read" header) —
 * same element, same treatment: quiet fill, tint Sparkles + caption label.
 * Web mirror: `HeroCoachChip` in `src/app/components/suppr/today-hero-ring.tsx`.
 */
export function TodayCoachChip({ onPress }: { onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <PressableScale
      testID="today-coach-chip"
      haptic="selection"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open your coach"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
        backgroundColor: colors.fillQuiet,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.full,
      }}
    >
      <Sparkles size={12} color={colors.tint} />
      <Text style={{ ...Type.caption, color: colors.tint, fontWeight: "600" }}>Coach</Text>
    </PressableScale>
  );
}
