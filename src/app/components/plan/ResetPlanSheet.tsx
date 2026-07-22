"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { SupprButton } from "../suppr/suppr-button";
import { SheetShell } from "../ui/sheet-shell";
import { SupprRadio } from "../ui/suppr-radio";
import { SupprNotice } from "../ui/suppr-notice";
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
      <SupprRadio checked={checked} aria-hidden />
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

  const copy = RESET_PLAN_SHEET_COPY;

  return (
    <SheetShell
      open={open}
      onClose={() => !loading && onOpenChange(false)}
      data-testid="reset-plan-sheet"
      role="dialog"
      aria-labelledby="reset-plan-title"
      className="w-full max-w-md sm:mx-auto"
    >
      <h2 id="reset-plan-title" className="text-lg font-bold text-foreground">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.insight}</p>

      <div className="mt-4" role="radiogroup" aria-label="Reset plan mode">
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
          <SupprNotice
            tone="destructive"
            variant="inline"
            className="mt-3 text-sm text-destructive"
            data-testid="reset-plan-clear-warning"
            leading={<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          >
            {copy.clearWarning}
          </SupprNotice>
        ) : null}
      </div>

      <div className="mt-5 flex gap-3 border-t border-border pt-5">
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
    </SheetShell>
  );
}
