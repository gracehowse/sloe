"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { SupprButton } from "../suppr/suppr-button";
import {
  RESET_PLAN_SHEET_COPY,
  type ResetPlanMode,
} from "@/lib/planning/resetPlanSheet";

export interface ResetPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onConfirm: (mode: ResetPlanMode) => void;
}

function RadioRow({
  checked,
  title,
  subtitle,
  onSelect,
}: {
  checked: boolean;
  title: string;
  subtitle: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={[
        "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0",
        checked ? "bg-primary/5" : "bg-card hover:bg-muted/40",
      ].join(" ")}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={[
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.8px]",
          checked ? "border-primary" : "border-muted-foreground/60",
        ].join(" ")}
        aria-hidden
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
      </span>
    </button>
  );
}

/** ENG-1261 / B28 — keep vs clear before plan regenerate (web). */
export function ResetPlanSheet({
  open,
  onOpenChange,
  loading = false,
  onConfirm,
}: ResetPlanSheetProps) {
  const [mode, setMode] = React.useState<ResetPlanMode>("keep");

  React.useEffect(() => {
    if (open) setMode("keep");
  }, [open]);

  if (!open) return null;

  const copy = RESET_PLAN_SHEET_COPY;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
      role="presentation"
      onClick={() => !loading && onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-labelledby="reset-plan-title"
        className="w-full max-w-md rounded-t-2xl bg-card shadow-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="reset-plan-sheet"
      >
        <div className="px-5 pt-4">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
          <h2 id="reset-plan-title" className="text-lg font-bold text-foreground">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.insight}</p>
        </div>

        <div className="mt-4 px-5" role="radiogroup" aria-label="Reset plan mode">
          <div className="overflow-hidden rounded-xl border border-border">
            <RadioRow
              checked={mode === "keep"}
              title={copy.keep.title}
              subtitle={copy.keep.subtitle}
              onSelect={() => setMode("keep")}
            />
            <RadioRow
              checked={mode === "clear"}
              title={copy.clear.title}
              subtitle={copy.clear.subtitle}
              onSelect={() => setMode("clear")}
            />
          </div>
          {mode === "clear" ? (
            <div
              className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              data-testid="reset-plan-clear-warning"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{copy.clearWarning}</span>
            </div>
          ) : null}
        </div>

        <div className="flex gap-3 border-t border-border p-5">
          <SupprButton
            variant="ghost"
            className="flex-1"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {copy.cancel}
          </SupprButton>
          <SupprButton
            variant="primary"
            className="flex-1"
            loading={loading}
            onClick={() => onConfirm(mode)}
            data-testid="reset-plan-confirm"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            {copy.confirm}
          </SupprButton>
        </div>
      </div>
    </div>
  );
}
