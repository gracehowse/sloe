"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { todayFreshDayLogPillLabel } from "../../../lib/copy/today";

/**
 * TodayFreshDayLogPill — ENG-1372 (empty-state grammar contract, law 2): the
 * Today hero's ONE filled, time-aware invitation action on a fresh (zero
 * logged entries) day. Renders "Log breakfast" / "Log lunch" / "Log dinner"
 * per `todayFreshDayLogPillLabel` (before 11 / 11–16 / after 16 local).
 *
 * Behind `empty_state_grammar_v1` — the host (`TodayHeroRing` /
 * `DesktopHeroStats`) only mounts this when the flag is on AND the day has
 * zero logged entries; this component itself carries no gating logic.
 *
 * Mobile parity: `apps/mobile/components/today/TodayFreshDayLogPill.tsx`.
 */
export interface TodayFreshDayLogPillProps {
  /** Current hour (0-23), local device time. Exposed as a prop (not read
   *  internally via `new Date()`) so the label is deterministic in tests. */
  hour: number;
  /** Opens the LogSheet already scoped to the time-appropriate meal slot. */
  onPress: () => void;
}

export function TodayFreshDayLogPill({ hour, onPress }: TodayFreshDayLogPillProps) {
  const label = todayFreshDayLogPillLabel(hour);
  return (
    <button
      type="button"
      data-testid="today-fresh-day-log-pill"
      onClick={onPress}
      aria-label={label}
      className="mt-2 inline-flex items-center gap-1.5 self-center rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Plus className="size-4" strokeWidth={2.25} aria-hidden />
      {label}
    </button>
  );
}

export default TodayFreshDayLogPill;
