"use client";

/**
 * HouseholdBar — compact horizontal pill bar.
 *
 * 2026-04-20 Claude Design prototype port
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 * `HouseholdBar` ~L4). Rendered at the top of the Plan + Progress
 * surfaces when the signed-in user has a household. Lets the user
 * pivot the view between "All" and a single member without leaving
 * the tab; tapping "Manage" opens the dedicated Household settings
 * page (`HouseholdSettingsPage.tsx`).
 *
 * Only the compact *bar* renders data fetched through
 * `getMyHousehold` — the heavier HouseholdPanel (create / join /
 * leave / invite code / detailed members) still owns those flows and
 * continues to live on the Plan tab below the bar.
 *
 * Selection state is kept locally. When a host surface wants to
 * filter planner rows or progress cards by member, it provides
 * `onSelect` + `selected`; when neither is passed, the bar still
 * renders with a local highlight so the user sees the visual
 * feedback (matches the prototype).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { useAuthSession } from "../../context/AuthSessionContext";
import { supabase } from "../../lib/supabase/browserClient";
import {
  getMyHousehold,
  type HouseholdData,
} from "../../lib/household/householdClient";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "../../lib/household/memberAccents";

export type HouseholdBarProps = {
  /** Optional controlled selection. `"all"` = no filter. */
  selected?: string;
  onSelect?: (memberIdOrAll: string) => void;
  /**
   * Where the Manage link should lead. Defaults to the standalone
   * settings route — host surfaces override if they embed the
   * settings page inline or want a different navigation hook.
   */
  onManage?: () => void;
};

const BAR_TEST_ID = "household-bar";

export function HouseholdBar({ selected, onSelect, onManage }: HouseholdBarProps) {
  const { authedUserId } = useAuthSession();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [localSelected, setLocalSelected] = useState<string>(selected ?? "all");

  // Keep localSelected in sync if the host passes a new controlled value.
  useEffect(() => {
    if (selected != null) setLocalSelected(selected);
  }, [selected]);

  const load = useCallback(async () => {
    if (!authedUserId) {
      setLoading(false);
      return;
    }
    try {
      const { data: result } = await getMyHousehold(supabase as any, authedUserId);
      if (result) setData(result);
    } catch {
      // Silent — the full HouseholdPanel is the source of truth for
      // surfacing load errors. The bar hides itself rather than
      // rendering a half-broken chip row.
    }
    setLoading(false);
  }, [authedUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const members = useMemo(() => data?.members ?? [], [data]);

  const handlePick = useCallback(
    (id: string) => {
      setLocalSelected(id);
      onSelect?.(id);
    },
    [onSelect],
  );

  const handleManage = useCallback(() => {
    if (onManage) {
      onManage();
      return;
    }
    if (typeof window !== "undefined") {
      // Route into the App shell's ?view= system. HouseholdSettingsPage
      // mounts on `household-settings`; App.tsx wires the view.
      window.location.href = "/home?view=household-settings";
    }
  }, [onManage]);

  // Hide when not signed in, still loading, or the user isn't in a
  // household. The bar is purely additive — never show skeleton
  // chrome on Plan/Progress for solo users.
  if (!authedUserId || loading) return null;
  if (!data?.household || members.length === 0) return null;

  const currentSel = selected ?? localSelected;

  return (
    <div
      data-testid={BAR_TEST_ID}
      className="mb-3.5 rounded-xl border border-border bg-card p-3"
    >
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Household
        </p>
        <button
          type="button"
          onClick={handleManage}
          className="text-[11px] font-semibold text-primary-solid hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          data-testid="household-bar-manage"
        >
          Manage
        </button>
      </div>
      <div
        className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5"
        role="tablist"
        aria-label="Household members"
      >
        <button
          key="all"
          type="button"
          role="tab"
          aria-selected={currentSel === "all"}
          onClick={() => handlePick("all")}
          data-testid="household-bar-pill-all"
          className={[
            "inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-2.5 py-1.5",
            "text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            currentSel === "all"
              ? "bg-primary/15 text-primary-solid"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          ].join(" ")}
        >
          <Icons.users className="w-3 h-3" aria-hidden />
          All {members.length}
        </button>
        {members.map((m, idx) => {
          const color = householdMemberAccent(idx);
          const initials = householdMemberInitials(m.displayName);
          const first = householdMemberFirstName(m.displayName);
          const active = currentSel === m.userId;
          return (
            <button
              key={m.userId}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handlePick(m.userId)}
              data-testid={`household-bar-pill-${m.userId}`}
              className={[
                "inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full py-1 pl-1 pr-2.5",
                "text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-primary/15 text-primary-solid"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              ].join(" ")}
            >
              <span
                aria-hidden
                className="inline-grid place-items-center w-[22px] h-[22px] rounded-full text-[9px] font-bold text-foreground"
                style={{ backgroundColor: color }}
              >
                {initials}
              </span>
              {first}
            </button>
          );
        })}
      </div>
    </div>
  );
}
