"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { addDays, expandDateRange, sanitizeCopyTargets } from "../../../lib/nutrition/copyMeals";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `YYYY-MM-DD` key for the day being duplicated. */
  sourceDayKey: string;
  /** Number of meals in the source day — used for factual summary copy. */
  sourceMealCount: number;
  /** Called with the target day keys and a human summary for the toast. */
  onConfirm: (targetDayKeys: string[], summary: string) => void;
};

type Mode = "single" | "range";

function formatHumanDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * DuplicateDayDialog — pick a single target day or an inclusive target
 * range. The source day is always excluded. Fires `onConfirm` with the
 * deduped list (never includes the source) so the caller can route to
 * `duplicateDay` (single) or `duplicateDayToDateRange` (multi).
 */
export function DuplicateDayDialog({
  open,
  onOpenChange,
  sourceDayKey,
  sourceMealCount,
  onConfirm,
}: Props) {
  const defaultStart = useMemo(() => addDays(sourceDayKey, 1), [sourceDayKey]);
  const defaultEnd = useMemo(() => addDays(sourceDayKey, 7), [sourceDayKey]);
  const [mode, setMode] = useState<Mode>("single");
  const [startKey, setStartKey] = useState(defaultStart);
  const [endKey, setEndKey] = useState(defaultEnd);

  useEffect(() => {
    if (open) {
      setMode("single");
      setStartKey(defaultStart);
      setEndKey(defaultEnd);
    }
  }, [open, defaultStart, defaultEnd]);

  const targetDayKeys = useMemo(() => {
    const raw = mode === "single" ? [startKey] : expandDateRange(startKey, endKey);
    return sanitizeCopyTargets(sourceDayKey, raw);
  }, [mode, startKey, endKey, sourceDayKey]);

  const canConfirm = sourceMealCount > 0 && targetDayKeys.length > 0;

  const summary = useMemo(() => {
    if (sourceMealCount === 0) return "Nothing to duplicate — this day has no meals.";
    if (targetDayKeys.length === 0) return "Nothing to duplicate";
    if (targetDayKeys.length === 1) return `Duplicated to ${formatHumanDate(targetDayKeys[0]!)}`;
    return `Duplicated to ${targetDayKeys.length} days`;
  }, [targetDayKeys, sourceMealCount]);

  const handleConfirm = () => {
    if (!canConfirm) {
      onConfirm([], summary);
      onOpenChange(false);
      return;
    }
    onConfirm(targetDayKeys, summary);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Duplicate day</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {sourceMealCount === 0
              ? "This day has no meals to duplicate."
              : `${sourceMealCount} meal${sourceMealCount === 1 ? "" : "s"} from ${formatHumanDate(sourceDayKey)} will be copied.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex rounded-lg border border-border p-1 bg-muted/50" role="tablist" aria-label="Duplicate mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "single"}
              onClick={() => setMode("single")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "single" ? "bg-card shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              Single day
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "range"}
              onClick={() => setMode("range")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "range" ? "bg-card shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              Date range
            </button>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {mode === "single" ? "Target day" : "Range start"}
            </span>
            <input
              type="date"
              value={startKey}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setStartKey(v);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm"
              aria-label={mode === "single" ? "Target day" : "Range start"}
            />
          </label>
          {mode === "range" && (
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Range end</span>
              <input
                type="date"
                value={endKey}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setEndKey(v);
                }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm"
                aria-label="Range end"
              />
            </label>
          )}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {sourceMealCount === 0
              ? "Nothing to duplicate — this day has no meals."
              : targetDayKeys.length === 0
                ? "Nothing to duplicate — pick a day other than the source."
                : targetDayKeys.length === 1
                  ? `Will duplicate ${sourceMealCount} meal${sourceMealCount === 1 ? "" : "s"} to ${formatHumanDate(targetDayKeys[0]!)}.`
                  : `Will duplicate ${sourceMealCount} meal${sourceMealCount === 1 ? "" : "s"} to ${targetDayKeys.length} days (${formatHumanDate(targetDayKeys[0]!)} – ${formatHumanDate(
                      targetDayKeys[targetDayKeys.length - 1]!,
                    )}).`}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DuplicateDayDialog;
