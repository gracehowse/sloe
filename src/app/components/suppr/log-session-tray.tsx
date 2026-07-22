"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";

import { isFeatureEnabled } from "@/lib/analytics/track";
import { formatKcalDisplay, formatQualifiedKcal } from "../../../lib/nutrition/formatMacro";
import {
  sessionTrayTotals,
  trayIsFullyVerified,
  trayIsMultiSlot,
  type LogSessionTrayProps,
} from "../../../lib/nutrition/logSessionTray";
import { SupprButton } from "./suppr-button";

/**
 * ENG-1643 — the log-session tray (immediate-commit multi-add receipt). Pinned
 * to the LogSheet's bottom edge whenever ≥ 1 item was committed this
 * sheet-session. Presentational: the host owns state + the commit/removal
 * paths; this surface renders the running count/kcal, a per-item Undo, a
 * Save-as-usual-meal (≥ 2 items), and a primary Done.
 *
 * Spec: `docs/specs/2026-07-21-log-session-tray.md`. Mirror of mobile
 * `apps/mobile/components/today/LogSessionTray.tsx`.
 */
export function LogSessionTray({
  items,
  pendingUndoIds,
  onUndo,
  onDone,
  onSaveMeal,
}: LogSessionTrayProps) {
  const [expanded, setExpanded] = React.useState(false);

  // Add announcement (a11y) — announce the newest item + running count when the
  // tray grows. The visible increment IS the confirmation (no S13 card).
  const prevCount = React.useRef(0);
  const [announcement, setAnnouncement] = React.useState("");
  React.useEffect(() => {
    if (items.length > prevCount.current && items.length > 0) {
      const newest = items[items.length - 1];
      if (newest) {
        setAnnouncement(`Added ${newest.title}. ${items.length} items this session.`);
      }
    }
    prevCount.current = items.length;
  }, [items]);

  if (items.length === 0) return null;

  const totals = sessionTrayTotals(items);
  const trustFlag = isFeatureEnabled("kcal_trust_qualifier_v1");
  const kcalText = (kcal: number, verified: boolean) =>
    trustFlag ? formatQualifiedKcal(kcal, verified) : formatKcalDisplay(kcal);
  const multiSlot = trayIsMultiSlot(items);
  const totalKcal = kcalText(totals.kcal, trayIsFullyVerified(items));

  return (
    <div
      data-testid="log-session-tray"
      className="border-t border-border bg-card px-4 pb-2 pt-3"
    >
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {expanded ? (
        <div
          data-testid="log-session-tray-list"
          role="list"
          className="mb-3 max-h-60 overflow-y-auto"
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Added this session
          </p>
          {items.map((item, i) => {
            const disabled = pendingUndoIds.includes(item.mealId);
            const kcalLabel = `${kcalText(item.kcal, item.kcalIsVerified === true)} kcal`;
            return (
              <div
                key={item.mealId}
                role="listitem"
                data-testid={`log-session-tray-row-${i}`}
                className="flex items-center gap-2 py-1"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{item.title}</p>
                  <p className="truncate text-xs tabular-nums text-muted-foreground">
                    {multiSlot ? `${kcalLabel} · ${item.slot}` : kcalLabel}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid={`log-session-tray-undo-${i}`}
                  aria-label={`Undo ${item.title}`}
                  disabled={disabled}
                  onClick={() => onUndo(item)}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-success transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            );
          })}
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-xs font-semibold text-foreground">Total</span>
            <span className="text-right text-xs font-semibold tabular-nums text-muted-foreground">
              {`${totalKcal} kcal · ${totals.protein} P · ${totals.carbs} C · ${totals.fat} F`}
            </span>
          </div>
        </div>
      ) : null}

      <div data-testid="log-session-tray-bar" className="flex items-center gap-2">
        <button
          type="button"
          data-testid="log-session-tray-toggle"
          aria-expanded={expanded}
          aria-label={`${totals.count} added, ${totalKcal} kilocalories this session`}
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-4" strokeWidth={2.5} aria-hidden />
          </span>
          <span className="truncate text-xs font-semibold text-foreground">
            {`${totals.count} added · ${totalKcal} kcal`}
          </span>
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </button>
        <SupprButton
          variant="primary"
          onClick={onDone}
          aria-label="Done"
          label="Done"
          data-testid="log-session-tray-done"
          className="min-w-24"
        />
      </div>

      {expanded && items.length >= 2 && onSaveMeal ? (
        <div className="mt-2">
          <SupprButton
            variant="ghost"
            onClick={onSaveMeal}
            aria-label="Save as usual meal"
            label="Save as usual meal"
            data-testid="log-session-tray-save-meal"
            className="w-full"
          />
        </div>
      ) : null}
    </div>
  );
}

export default LogSessionTray;
