"use client";

import * as React from "react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { Icons } from "../ui/icons";
import { SupprButton } from "./suppr-button";
import type { UserTier } from "../../../types/recipe";
import type { SidebarView } from "./desktop-sidebar";

/**
 * SidebarUpgradeSlot — the Free-tier upgrade promo card at the bottom of the
 * desktop sidebar. Extracted from `desktop-sidebar.tsx` (ENG-1293) so the
 * sidebar file stays under its screen-budget pin; behaviour unchanged.
 */
export function SidebarUpgradeSlot({
  userTier,
  onNavigate,
}: {
  userTier: UserTier;
  onNavigate: (view: SidebarView) => void;
}) {
  const gateOn = useFeatureFlagEnabled("premium-sweep-v2-p0-t12");
  if (!gateOn) return null;
  if (userTier === "pro" || userTier === "base") return null;
  return (
    <div className="p-3 pb-0">
      <div
        className="rounded-2xl p-3"
        style={{
          background: "linear-gradient(135deg, var(--north-star-bg-from), var(--north-star-bg-to))",
          border: "1px solid var(--north-star-border)",
        }}
      >
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-solid">
          <Icons.sparkles className="h-3 w-3" aria-hidden />
          Free plan
        </div>
        <div className="mb-1.5 text-sm font-semibold text-foreground">
          Unlock the meal planner
        </div>
        <p className="mb-2.5 text-xs leading-snug text-muted-foreground">
          Pro adds week planning, recipe import, and adaptive macro coaching.
        </p>
        {/* See Pro — PRIMARY (Sloe button canon, 2026-06-12). Conversion
            CTA: solid aubergine pill, white label, flat (no shadow — the
            solid fill is the affordance). `px-3 py-1.5 text-xs` keeps the
            compact sidebar-slot footprint. */}
        <SupprButton
          variant="primary"
          onClick={() => onNavigate("settings")}
          className="h-auto w-full px-3 py-1.5 text-xs"
        >
          See Pro
        </SupprButton>
      </div>
    </div>
  );
}
