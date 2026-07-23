"use client";

import { SupprRadio } from "./ui/suppr-radio";
import { CountBadge } from "./ui/count-badge";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { UI_ANATOMY_OWNERS_V1 } from "@/lib/uiAnatomyOwners";
import {
  type PlanSourceMode,
  PLAN_SOURCE_MODES,
  PLAN_SOURCE_ROW_META,
  planSourceCount,
} from "../../lib/planning/planSource.ts";

/**
 * ENG-790 — "Plan from" source selector for the web Plan tab.
 * ENG-1665: count pills migrate to `CountBadge` when `ui_anatomy_owners_v1`
 * is on; legacy inline badge when off.
 */
export interface PlanSourceSelectorProps {
  mode: PlanSourceMode;
  onChange: (mode: PlanSourceMode) => void;
  libraryCount: number;
  discoverCount: number;
}

export function PlanSourceSelector({
  mode,
  onChange,
  libraryCount,
  discoverCount,
}: PlanSourceSelectorProps) {
  const anatomyOwners = isFeatureEnabled(UI_ANATOMY_OWNERS_V1);

  return (
    <div data-testid="plan-source-selector">
      <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
        Plan from
      </span>
      <div className="flex flex-col gap-2 mt-2" role="radiogroup" aria-label="Plan from">
        {PLAN_SOURCE_MODES.map((m) => {
          const meta = PLAN_SOURCE_ROW_META[m];
          const count = planSourceCount(m, { libraryCount, discoverCount });
          const selected = m === mode;
          const empty = count === 0;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${meta.title}, ${count} recipe${count === 1 ? "" : "s"}`}
              data-testid={`plan-source-row-${m}`}
              onClick={() => onChange(m)}
              className={[
                "flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted/60",
              ].join(" ")}
            >
              <SupprRadio checked={selected} aria-hidden />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-foreground">
                    {meta.title}
                  </span>
                  {anatomyOwners ? (
                    <CountBadge count={count} active={selected} data-testid={`plan-source-count-${m}`} />
                  ) : (
                    <span
                      className={[
                        "rounded-full px-[7px] py-[1px] text-[11px] font-bold tabular-nums",
                        selected
                          ? "bg-card text-foreground"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {count}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-4 text-muted-foreground">
                  {empty ? meta.emptySubtitle : meta.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PlanSourceSelector;
