"use client";

import {
  type PlanSourceMode,
  PLAN_SOURCE_MODES,
  PLAN_SOURCE_ROW_META,
  planSourceCount,
} from "../../lib/planning/planSource.ts";

/**
 * ENG-790 (2026-05-31) — "Plan from" source selector for the web Plan tab,
 * gated behind `plan_source_selector` at the call site
 * (`src/app/components/MealPlanner.tsx`).
 *
 * Web twin of `apps/mobile/components/plan/PlanSourceSelector.tsx`. Three
 * radio rows let the user choose where a generated plan draws recipes from:
 * their saved library, library + Suppr's discover pool (default), or
 * discovery only. Row copy + the count maths come from the shared
 * `@/lib/planning/planSource` helper so the two platforms can't drift on
 * wording or totals — the same helper also builds the pool and gates the
 * generate action, closing the pre-ENG-790 gap where web pooled saved-only
 * and mobile pooled saved+discover.
 *
 * Presentational only — the mode lives as state in `MealPlanner.tsx`; this
 * renders + reports taps. testIDs / aria mirror the mobile component so one
 * shared-shape test can cover both.
 */
export interface PlanSourceSelectorProps {
  mode: PlanSourceMode;
  onChange: (mode: PlanSourceMode) => void;
  /** Count of recipes the user has saved (the "My library" pool). */
  libraryCount: number;
  /** Count of discover recipes not already in the library (the "Discovery" pool). */
  discoverCount: number;
}

export function PlanSourceSelector({
  mode,
  onChange,
  libraryCount,
  discoverCount,
}: PlanSourceSelectorProps) {
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
              <span
                className={[
                  "flex items-center justify-center rounded-full border-[1.8px]",
                  selected ? "border-primary" : "border-muted-foreground/60",
                ].join(" ")}
                style={{ width: 18, height: 18, flex: "none" }}
                aria-hidden
              >
                {selected ? (
                  <span
                    className="rounded-full bg-primary"
                    style={{ width: 8, height: 8 }}
                  />
                ) : null}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-foreground">
                    {meta.title}
                  </span>
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
