"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

/**
 * PlanHouseholdBannerV3 — Sloe v3 Plan household context banner.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanHouseholdBannerV3.tsx`
 * (prototype `plan-hh2` ~L4736-4743): stacked avatars (first 3, owner tinted
 * plum) + "Cooking for N · [names]" + a chevron, or a "M× — match" flag when
 * the serving count doesn't match the number of eaters. Behind sloe_v3_plan;
 * the host renders it only when the household is enabled.
 */
export interface PlanHouseholdMember {
  /** Single-letter avatar initial. */
  initial: string;
  isOwner: boolean;
}

export interface PlanHouseholdBannerV3Props {
  /** Eating members (the first 3 render as avatars). */
  members: PlanHouseholdMember[];
  servingCount: number;
  /** First names joined, e.g. "Grace, Sam, Mia". */
  names: string;
  /** Eater count when it mismatches `servingCount`, else null (→ chevron). */
  mismatchEaters: number | null;
  onPress: () => void;
}

export function PlanHouseholdBannerV3({
  members,
  servingCount,
  names,
  mismatchEaters,
  onPress,
}: PlanHouseholdBannerV3Props) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`Cooking for ${servingCount}: ${names}`}
      className="mt-3 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:bg-[var(--border-strong)] active:scale-[0.99]"
      style={{
        backgroundColor: "var(--background-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <span className="flex items-center">
        {members.slice(0, 3).map((m, i) => (
          <span
            key={i}
            className="flex size-[26px] items-center justify-center rounded-full border-2 text-[11px] font-bold text-white"
            style={{
              marginLeft: i === 0 ? 0 : -8,
              backgroundColor: m.isOwner
                ? "var(--primary)"
                : "var(--accent-success-solid)",
              borderColor: "var(--background-secondary)",
            }}
          >
            {m.initial}
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
        Cooking for {servingCount} · {names}
      </span>
      {mismatchEaters != null ? (
        <span
          className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.04em]"
          style={{ color: "var(--accent-warning-solid)" }}
        >
          {mismatchEaters}× — match
        </span>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-foreground-tertiary" />
      )}
    </button>
  );
}

export default PlanHouseholdBannerV3;
