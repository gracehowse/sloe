import { StyleSheet, Text, View } from "react-native";

import { Accent, Spacing, Type } from "@/constants/theme";

interface StatProps {
  label: string;
  value: string;
  valueColor: string;
  labelColor?: string;
  textSecondaryColor: string;
  /** Sloe redesign: a hairline divider on the left of the 2nd/3rd cells
   *  (`divide-x divide-line` in the `01 · Today` frame). */
  dividerColor?: string;
  testID?: string;
}

/**
 * Goal / Eaten / Bonus stat cell. SLOE redesign (2026-06-03, `01 · Today`
 * frame): label `text-[10px] uppercase` above a Newsreader (serif) `text-xl`
 * value, cells separated by a `divide-x divide-line` hairline. The value colour
 * still links each stat to its ring segment where it carries meaning (Bonus →
 * sage when positive).
 */
function Stat({ label, value, valueColor, labelColor, textSecondaryColor, dividerColor, testID }: StatProps) {
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        alignItems: "center",
        gap: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        borderLeftWidth: dividerColor ? StyleSheet.hairlineWidth : 0,
        borderLeftColor: dividerColor,
      }}
    >
      <Text style={{ ...Type.statLabel, color: labelColor ?? textSecondaryColor }}>{label}</Text>
      <Text
        style={{
          ...Type.statValue,
          color: valueColor,
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export interface TodayHeroStatsProps {
  goal: number;
  consumed: number;
  baseGoal: number | undefined;
  textColor: string;
  secondaryColor: string;
  borderColor: string;
  isDark: boolean;
  /** ENG-1372 (empty-state grammar, law 3) — hide the BONUS cell when it
   *  would show a bare "0" (host gates this on `empty_state_grammar_v1` AND
   *  a true fresh day). Goal/Eaten stay — those are honest earned zeros
   *  (Grace 2026-06-10); BONUS at 0 on a day with nothing logged yet is a
   *  derived non-fact with nothing to show, so it collapses to a 2-cell row. */
  suppressZeroBonus?: boolean;
}

/**
 * The Goal / Eaten / Bonus stat row beneath the calorie ring. Shared by both the
 * carded hero (`TodayHeroRing`) and the de-carded v3 hero so the two layouts
 * never drift. Renders on EMPTY days too — Eaten 0 / Bonus +0 are honest numbers
 * (Grace 2026-06-10, supersedes the calm-empty divergence) — EXCEPT the BONUS
 * cell specifically, which `suppressZeroBonus` hides when it would read 0 on a
 * fresh day (ENG-1372 law 3: numbers suppressed until earned). The right stat
 * is otherwise ALWAYS Bonus: the over amount already reads in the centre +
 * status line.
 */
export function TodayHeroStats({
  goal,
  consumed,
  baseGoal,
  textColor,
  secondaryColor,
  borderColor,
  isDark,
  suppressZeroBonus = false,
}: TodayHeroStatsProps) {
  if (goal <= 0) return null;
  const hasBonus = !!baseGoal && baseGoal < goal;
  const bonusColor = hasBonus ? (isDark ? Accent.successLight : Accent.success) : secondaryColor;
  const hideBonus = suppressZeroBonus && !hasBonus;
  return (
    <View
      style={{
        width: "100%",
        flexDirection: "row",
        paddingTop: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: borderColor,
      }}
    >
      <Stat
        label="Goal"
        value={Math.round(goal).toLocaleString()}
        valueColor={textColor}
        labelColor={secondaryColor}
        textSecondaryColor={secondaryColor}
      />
      <Stat
        label="Eaten"
        value={Math.round(consumed).toLocaleString()}
        valueColor={textColor}
        labelColor={secondaryColor}
        textSecondaryColor={secondaryColor}
        dividerColor={borderColor}
      />
      {hideBonus ? null : (
        <Stat
          label="Bonus"
          testID="today-ring-bonus"
          value={hasBonus ? `+${Math.round(goal - baseGoal!).toLocaleString()}` : "0"}
          labelColor={bonusColor}
          valueColor={bonusColor}
          textSecondaryColor={secondaryColor}
          dividerColor={borderColor}
        />
      )}
    </View>
  );
}
