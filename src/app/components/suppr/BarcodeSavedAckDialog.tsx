"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { COMPLETE_DAY_V3_COPY } from "@/lib/completeDayV3";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

export interface BarcodeSavedAckDialogProps {
  open: boolean;
  productName: string;
  onLogNow: () => void;
}

/** ENG-1247 §A12 — v3 saved confirmation after a not-found barcode contribution flow. */
export function BarcodeSavedAckDialog({ open, productName, onLogNow }: BarcodeSavedAckDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onLogNow(); }}>
      <DialogContent className="bg-card border-border max-w-md" data-testid="barcode-saved-ack-dialog">
        <DialogHeader className="sr-only">
          <DialogTitle>{COMPLETE_DAY_V3_COPY.savedTitle}</DialogTitle>
          <DialogDescription>{COMPLETE_DAY_V3_COPY.savedThanks(productName)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft"
            aria-hidden
          >
            <Check className="h-7 w-7 text-success-solid" strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground" data-testid="barcode-saved-title">
              {COMPLETE_DAY_V3_COPY.savedTitle}
            </p>
            <p className="text-sm leading-5 text-muted-foreground">
              {COMPLETE_DAY_V3_COPY.savedThanks(productName)}
            </p>
          </div>
          <Button type="button" className="w-full" onClick={onLogNow}>
            Log it now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BarcodeSavedAckDialog;
