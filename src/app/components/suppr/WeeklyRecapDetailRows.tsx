"use client";

import { Activity, Flame, Sprout, UtensilsCrossed } from "lucide-react";

import type { WeeklyRecapDetailRow } from "@/lib/nutrition-core/weeklyRecapDetailRows";

const ICONS = {
  weight: Activity,
  streak: Flame,
  "most-cooked": UtensilsCrossed,
  protein: Sprout,
} as const;

/** ENG-1259 — prototype "The detail" divided set-rows (B21). */
export function WeeklyRecapDetailRows({
  rows,
  testID = "weekly-recap-detail-rows",
}: {
  rows: WeeklyRecapDetailRow[];
  testID?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="w-full" data-testid={testID}>
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        The detail
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
        {rows.map((row) => {
          const Icon = ICONS[row.id];
          return (
            <div key={row.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklyRecapDetailRows;
