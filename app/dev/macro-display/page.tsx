"use client";

/**
 * Side-by-side preview of the two Today macro-display variants
 * shipped 2026-05-17 (Grace ask). Lives at `/dev/macro-display`.
 *
 * - Left column: `TodayDashboardMacroTiles` (default — the 2×2
 *   emoji-icon grid that's been in Today since 2026-04-20).
 * - Right column: `TodayDashboardMacroBars` (new — Cronometer / Lose
 *   It-style vertical list with thin colored bars; selectable via
 *   Settings → Display → Macro display).
 *
 * Public on preview + local dev; production gates this same way the
 * other `/dev/*` pages do.
 */

import * as React from "react";
import { notFound } from "next/navigation";
import { TodayDashboardMacroTiles } from "../../../src/app/components/suppr/today-dashboard-macro-tiles";
import { TodayDashboardMacroBars } from "../../../src/app/components/suppr/today-dashboard-macro-bars";

export default function MacroDisplayPreviewPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  const sharedProps = {
    trackedMacros: ["protein", "carbs", "fat", "fiber"] as string[],
    proteinCurrent: 92,
    proteinTarget: 140,
    carbsCurrent: 168,
    carbsTarget: 180,
    fatCurrent: 48,
    fatTarget: 60,
    fiberCurrent: 22,
    fiberTarget: 30,
    sugarG: 18,
    sodiumMg: 1100,
    waterCurrentMl: 1000,
    waterTargetMl: 2500,
    netCarbsLensEnabled: false,
  } as const;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Today macro display variants</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Configurable in Settings → Display → Macro display.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Tiles (default)
            </h2>
            <TodayDashboardMacroTiles
              {...sharedProps}
              formatWaterLine={(ml) => `${(ml / 1000).toFixed(1)} L`}
              onAddWaterMl={() => undefined}
            />
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Bars (new alternative)
            </h2>
            <TodayDashboardMacroBars {...sharedProps} />
          </section>
        </div>
      </div>
    </div>
  );
}
