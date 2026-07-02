"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { FilterChip } from "../ui/filter-chip";
import { SupprButton } from "./suppr-button";
import { formatCookScaleLabel } from "../../../lib/nutrition/recipeScale.ts";

export interface CookLogServingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchScale: number;
  baseServings: number;
  onConfirm: (servingsEaten: number) => void;
}

const PRESETS = [0.5, 0.75, 1, 1.5, 2] as const;

function clampServings(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.125, Math.min(24, n));
}

function formatServings(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** ENG-1129 — web parity for cook-mode servings-eaten confirm. */
export function CookLogServingsDialog({
  open,
  onOpenChange,
  batchScale,
  baseServings,
  onConfirm,
}: CookLogServingsDialogProps) {
  const [servingsEaten, setServingsEaten] = useState(1);

  useEffect(() => {
    if (open) setServingsEaten(1);
  }, [open]);

  const batchYield =
    baseServings > 0 ? Math.max(1, Math.round(baseServings * batchScale)) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>How much did you eat?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {batchScale !== 1
            ? `You cooked a ${formatCookScaleLabel(batchScale)} batch${
                batchYield != null ? ` — serves ~${batchYield}` : ""
              }.`
            : "Confirm servings eaten — batch size is not the same as what you ate."}
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Servings eaten
          </span>
          <span className="text-lg font-semibold tabular-nums">{formatServings(servingsEaten)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <FilterChip
              key={preset}
              label={formatServings(preset)}
              selected={servingsEaten === preset}
              size="md"
              onClick={() => setServingsEaten(preset)}
            />
          ))}
        </div>
        <div className="flex items-center justify-center gap-3">
          <SupprButton
            variant="ghost"
            type="button"
            onClick={() => setServingsEaten((v) => clampServings(v - 0.25))}
          >
            −
          </SupprButton>
          <input
            type="number"
            min={0.125}
            max={24}
            step={0.25}
            value={servingsEaten}
            onChange={(e) => setServingsEaten(clampServings(Number(e.target.value)))}
            className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-center text-sm tabular-nums"
            aria-label="Servings eaten"
          />
          <SupprButton
            variant="ghost"
            type="button"
            onClick={() => setServingsEaten((v) => clampServings(v + 0.25))}
          >
            +
          </SupprButton>
        </div>
        <SupprButton
          variant="primary"
          type="button"
          className="w-full"
          onClick={() => onConfirm(servingsEaten)}
        >
          Log to Today
        </SupprButton>
      </DialogContent>
    </Dialog>
  );
}
