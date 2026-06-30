"use client";

import * as React from "react";
import { AlertTriangle, X } from "lucide-react";

import { SupprButton } from "../suppr/suppr-button";
import {
  DELETE_ACCOUNT_CONFIRM_TOKEN,
  DELETE_ACCOUNT_COPY,
  DELETE_ACCOUNT_LEAVE_REASONS,
  type DeleteAccountLedgerRow,
  type DeleteAccountLeaveReason,
} from "@/lib/settings/deleteAccountFlow";

export interface DeleteAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledger: DeleteAccountLedgerRow[];
  loadingLedger?: boolean;
  deleting?: boolean;
  /** ENG-1262 — true while the complete server export is in flight; the
   *  "Download a copy first" button disables + shows progress so it can't be
   *  double-submitted before the (heavy, rate-limited) export resolves. */
  exportingFirst?: boolean;
  onExportFirst: () => void;
  onDeleteForever: (reason: DeleteAccountLeaveReason | null) => void;
}

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-4 flex gap-2" data-testid="delete-account-step-bar">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={[
            "h-1 flex-1 rounded-full",
            n <= step ? "bg-destructive" : "bg-muted",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

/** ENG-1260 / B26 — 3-step delete account sheet (web). */
export function DeleteAccountSheet({
  open,
  onOpenChange,
  ledger,
  loadingLedger = false,
  deleting = false,
  exportingFirst = false,
  onExportFirst,
  onDeleteForever,
}: DeleteAccountSheetProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [reason, setReason] = React.useState<DeleteAccountLeaveReason | null>(null);
  const [confirm, setConfirm] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setStep(1);
      setReason(null);
      setConfirm("");
    }
  }, [open]);

  if (!open) return null;

  const copy = DELETE_ACCOUNT_COPY;
  const canDelete = confirm === DELETE_ACCOUNT_CONFIRM_TOKEN;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
      role="presentation"
      onClick={() => !deleting && onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-labelledby="delete-account-title"
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="delete-account-sheet"
      >
        <div className="overflow-y-auto px-5 pt-4 pb-2">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
          <h2 id="delete-account-title" className="text-lg font-bold text-foreground">
            {copy.title}
          </h2>
          <StepBar step={step} />

          {step === 1 ? (
            <>
              <p className="font-serif text-xl text-foreground">{copy.step1.heading}</p>
              <p className="mt-2 text-sm text-muted-foreground">{copy.step1.sub}</p>
              <div className="mt-4 overflow-hidden rounded-xl border border-border" role="radiogroup">
                {DELETE_ACCOUNT_LEAVE_REASONS.map((r) => {
                  const selected = reason === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReason(r)}
                      className="flex w-full items-center border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/40"
                    >
                      <span className="flex-1 text-sm font-semibold text-foreground">{r}</span>
                      <span
                        className={[
                          "flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.8px]",
                          selected ? "border-primary" : "border-muted-foreground/60",
                        ].join(" ")}
                      >
                        {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </div>
              <p className="mt-4 text-center font-serif text-xl text-foreground">{copy.step2.heading}</p>
              <p className="mt-2 text-center text-sm text-muted-foreground">{copy.step2.body}</p>
              <SupprButton
                variant="ghost"
                className="mt-4 w-full"
                loading={exportingFirst}
                disabled={exportingFirst}
                onClick={onExportFirst}
                data-testid="delete-account-export-first"
              >
                {copy.step2.exportFirst}
              </SupprButton>
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                {loadingLedger ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
                ) : (
                  ledger.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <X className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="text-sm font-medium text-foreground">{row.label}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {copy.step3.bodyPrefix} <b>{DELETE_ACCOUNT_CONFIRM_TOKEN}</b> {copy.step3.bodySuffix}
              </p>
              <input
                className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-base font-bold tracking-[0.2em] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.toUpperCase())}
                placeholder={copy.step3.placeholder}
                autoCapitalize="characters"
                data-testid="delete-account-confirm-input"
              />
            </>
          ) : null}
        </div>

        <div className="flex gap-3 border-t border-border p-5">
          <SupprButton
            variant="ghost"
            className="flex-1"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            {copy.keepAccount}
          </SupprButton>
          {step < 3 ? (
            <SupprButton
              variant="primary"
              className="flex-1"
              onClick={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
            >
              {copy.continue}
            </SupprButton>
          ) : (
            <SupprButton
              variant="primary"
              className="flex-1"
              disabled={!canDelete}
              loading={deleting}
              onClick={() => onDeleteForever(reason)}
              data-testid="delete-account-confirm"
              style={
                canDelete
                  ? { backgroundColor: "var(--destructive)", color: "var(--destructive-foreground)" }
                  : undefined
              }
            >
              {copy.deleteForever}
            </SupprButton>
          )}
        </div>
      </div>
    </div>
  );
}
