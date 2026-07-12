"use client";

import { maintenanceQualifier } from "../../../lib/nutrition/energyNumbers.ts";
import type { ResolvedMaintenance } from "../../../lib/nutrition/resolveMaintenance.ts";

/**
 * TargetsMaintenanceRow — ENG-1506: clearly-labelled MAINTENANCE row +
 * source qualifier on the web Targets calorie card (mobile targets
 * parity; the host mounts it only behind `energy_numbers_v1`). The row
 * shows the SAME resolved number the "kcal deficit/surplus" subline delta
 * was computed against, so the screen can't contradict itself.
 */
export function TargetsMaintenanceRow({ resolved }: { resolved: ResolvedMaintenance }) {
  return (
    <div
      className="mt-3 pt-3 border-t border-border self-stretch text-center"
      data-testid="targets-maintenance-row"
    >
      <p className="text-[13px] text-muted-foreground">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Maintenance</span>{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {resolved.kcal.toLocaleString()}
        </span>{" "}
        kcal / day
      </p>
      <p
        className="mt-0.5 text-[11px] text-muted-foreground"
        data-testid="targets-maintenance-qualifier"
      >
        {maintenanceQualifier(resolved.source, resolved.confidence).line}
      </p>
    </div>
  );
}

export default TargetsMaintenanceRow;
