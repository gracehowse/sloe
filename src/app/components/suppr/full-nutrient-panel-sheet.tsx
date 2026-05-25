"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  buildFullNutrientPanelRows,
  FULL_NUTRIENT_PANEL_ROW_COUNT,
  type FullNutrientPanelInput,
  type FullNutrientPanelRow,
  type FullNutrientPanelSection,
} from "../../../lib/nutrition/fullNutrientPanel";
import { DAILY_VALUES_SOURCE_LABEL } from "../../../lib/nutrition/dailyValues";

/**
 * FullNutrientPanelSheet — "View all 35 nutrients" dialog (web).
 *
 * Mirrors `apps/mobile/components/today/FullNutrientPanelSheet.tsx`.
 * Closes the Cronometer power-user persona gap: the 4-tile widget
 * answers the headline question; this sheet answers the breadth
 * question with all 35 curated nutrients across Macros / Vitamins /
 * Minerals, %DV-sorted descending so deficiencies surface first.
 *
 * Limit nutrients (sodium / sat fat / cholesterol) ramp:
 *   < 80%  --success
 *   80-99% --warning
 *   100%+  --destructive
 *
 * Footer: source attribution `DAILY_VALUES_SOURCE_LABEL`.
 */

export interface FullNutrientPanelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Day-summed micros — pass `sumMicrosFromLoggedMeals(meals)` directly. */
  microSum: Record<string, number> | null | undefined;
  /** Day-totalled fibre in grams (column-first path). */
  fiberG: number;
  totalFatG?: number;
  saturatedFatG?: number;
  totalCarbsG?: number;
  proteinG?: number;
  sugarG?: number;
  cholesterolMg?: number;
}

function rowColorVar(row: FullNutrientPanelRow): string {
  if (row.percentDv === null) return "var(--success)";
  if (!row.isLimit) return "var(--success)";
  if (row.percentDv >= 100) return "var(--destructive)";
  if (row.percentDv >= 80) return "var(--warning)";
  return "var(--success)";
}

function PanelRow({ row }: { row: FullNutrientPanelRow }) {
  const colorVar = rowColorVar(row);
  const barWidthPct = Math.min(100, Math.max(0, row.percentDv ?? 0));
  return (
    <div
      data-testid={`full-panel-row-${row.key}`}
      className="flex items-center gap-3 py-2"
    >
      <p className="flex-[1.6] text-sm font-semibold text-foreground truncate">
        {row.label}
      </p>
      <p className="flex-[1.0] text-xs text-muted-foreground tabular-nums text-right truncate">
        {row.amountFormatted}
      </p>
      <div
        data-testid={`full-panel-bar-${row.key}`}
        role="progressbar"
        aria-valuenow={row.percentDv ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${row.label} ${row.percentDv ?? 0}% of daily value`}
        className="flex-[1.4] h-[6px] rounded-full overflow-hidden"
        style={{
          background: `color-mix(in oklab, ${colorVar} 14%, transparent)`,
        }}
      >
        <div
          data-testid={`full-panel-bar-fill-${row.key}`}
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${barWidthPct}%`,
            background: colorVar,
          }}
        />
      </div>
      <p
        className={`w-11 text-xs font-semibold tabular-nums text-right ${
          row.percentDv === null ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {row.percentDv === null ? "—" : `${row.percentDv}%`}
      </p>
    </div>
  );
}

function SectionBlock({
  section,
  rows,
}: {
  section: FullNutrientPanelSection;
  rows: FullNutrientPanelRow[];
}) {
  return (
    <div data-testid={`full-panel-section-${section}`} className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
        {section}
      </p>
      <div className="bg-card border border-border rounded-[14px] px-3 py-1 divide-y divide-border">
        {rows.map((row) => (
          <PanelRow key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}

export function FullNutrientPanelSheet({
  open,
  onOpenChange,
  microSum,
  fiberG,
  totalFatG,
  saturatedFatG,
  totalCarbsG,
  proteinG,
  sugarG,
  cholesterolMg,
}: FullNutrientPanelSheetProps) {
  const sections = React.useMemo<
    Array<{ section: FullNutrientPanelSection; rows: FullNutrientPanelRow[] }>
  >(() => {
    const input: FullNutrientPanelInput = {
      microSum: microSum ?? {},
      fiberG,
      totalFatG,
      saturatedFatG,
      totalCarbsG,
      proteinG,
      sugarG,
      cholesterolMg,
    };
    return buildFullNutrientPanelRows(input);
  }, [microSum, fiberG, totalFatG, saturatedFatG, totalCarbsG, proteinG, sugarG, cholesterolMg]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="full-nutrient-panel-sheet"
        className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>All nutrients</DialogTitle>
          <DialogDescription>
            {FULL_NUTRIENT_PANEL_ROW_COUNT} nutrients · sorted by %DV
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto -mx-2 px-2 pb-2">
          {sections.map(({ section, rows }) => (
            <SectionBlock key={section} section={section} rows={rows} />
          ))}
          <p
            data-testid="full-panel-source-label"
            className="text-[11px] text-muted-foreground text-center mt-1"
          >
            {DAILY_VALUES_SOURCE_LABEL}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FullNutrientPanelSheet;
