"use client";

import { Icons } from "../ui/icons";
import { useHousehold } from "../../../context/HouseholdContext";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "../../../lib/household/memberAccents";

/**
 * TodayHouseholdGlanceBar — slim, one-row household summary rendered
 * by `TodayDesktopFrame` as full-width chrome above the tracker at
 * `lg:` (ENG-1495). Replaces the full `<HouseholdPanel>` the ENG-1494
 * frame mounted there, which pushed the calorie ring ~1100px below
 * the fold at 1280×800 (violates the Today-centre decision).
 *
 * Data comes from `useHousehold()` — the app-level `HouseholdProvider`
 * already runs the `getMyHousehold` fan-out once per session, so the
 * bar adds ZERO queries (the ENG-1494 attempt re-fetched it itself).
 *
 * Glance-only — no member filter pills, no manage flows. The whole bar
 * is one press target routing to the Household settings view, where
 * the full panel (create / join / invite / members) still lives.
 * Hides itself entirely when signed out, still resolving, or solo —
 * never skeleton chrome (matches `HouseholdBar` on Plan/Progress).
 */

export type TodayHouseholdGlanceBarProps = {
  /**
   * Navigation override. Defaults to the App shell's `?view=` route
   * for Household settings (same default as HouseholdBar's Manage).
   */
  onOpen?: () => void;
  className?: string;
};

const BAR_TEST_ID = "today-household-glance-bar";

export function TodayHouseholdGlanceBar({ onOpen, className }: TodayHouseholdGlanceBarProps) {
  const { activeHouseholdId, members } = useHousehold();

  // No household (or still resolving — the provider holds `members`
  // empty until the fetch lands) → no bar. Never skeleton.
  if (!activeHouseholdId || members.length === 0) return null;

  const firstNames = members
    .map((m) => householdMemberFirstName(m.displayName))
    .join(", ");

  const handleOpen = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    if (typeof window !== "undefined") {
      // Route into the App shell's ?view= system — HouseholdSettingsPage
      // mounts on `household-settings` (same default as HouseholdBar).
      window.location.href = "/home?view=household-settings";
    }
  };

  return (
    <button
      type="button"
      data-testid={BAR_TEST_ID}
      onClick={handleOpen}
      aria-label={`Cooking for ${members.length} — open household settings`}
      // Card grammar (2026-07-10): resting card = flat + hairline, token
      // corner; elevation only on interaction states (hover/active tint).
      className={[
        "flex w-full items-center gap-3 rounded-card border border-border bg-card p-3 text-left",
        "transition-colors hover:bg-muted/40 active:bg-muted/60",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className ?? "",
      ].join(" ")}
    >
      <span aria-hidden className="flex shrink-0 -space-x-2">
        {members.slice(0, 4).map((m, idx) => (
          <span
            key={m.userId}
            className="inline-grid h-6 w-6 place-items-center rounded-full border border-card text-[11px] font-bold text-foreground"
            style={{ backgroundColor: householdMemberAccent(idx) }}
          >
            {householdMemberInitials(m.displayName)}
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">
          Cooking for {members.length}
        </span>
        {firstNames ? <span aria-hidden> · {firstNames}</span> : null}
      </span>
      <Icons.forward aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
