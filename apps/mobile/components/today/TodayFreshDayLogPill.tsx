import React, { memo } from "react";
import { Text } from "react-native";
import { Plus } from "lucide-react-native";

import { Accent, Spacing, Type } from "@/constants/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import { todayFreshDayLogPillLabel } from "@suppr/shared/copy/today";

/**
 * TodayFreshDayLogPill — ENG-1372 (empty-state grammar contract, law 2): the
 * Today hero's ONE filled, time-aware invitation action on a fresh (zero
 * logged entries) day. Renders "Log breakfast" / "Log lunch" / "Log dinner"
 * per {@link todayFreshDayLogPillLabel} (before 11 / 11–16 / after 16 local).
 *
 * Behind `empty_state_grammar_v1` — the host (`TodayHero`) only mounts this
 * when the flag is on AND the day has zero logged entries; this component
 * itself carries no gating logic.
 *
 * Web parity: `src/app/components/suppr/today-fresh-day-log-pill.tsx`.
 */
export interface TodayFreshDayLogPillProps {
  /** Current hour (0-23), local device time. Exposed as a prop (not read
   *  internally via `new Date()`) so the label is deterministic in tests. */
  hour: number;
  /** Opens the LogSheet already scoped to the time-appropriate meal slot. */
  onPress: () => void;
}

function TodayFreshDayLogPillImpl({ hour, onPress }: TodayFreshDayLogPillProps) {
  const label = todayFreshDayLogPillLabel(hour);
  return (
    <SupprButton
      variant="primary"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ marginTop: Spacing.sm, alignSelf: "center" }}
    >
      <Plus size={16} color={Accent.primaryForeground} />
      <Text style={{ ...Type.button, color: Accent.primaryForeground, marginLeft: Spacing.sm }}>
        {label}
      </Text>
    </SupprButton>
  );
}

export const TodayFreshDayLogPill = memo(TodayFreshDayLogPillImpl);

export default TodayFreshDayLogPill;
