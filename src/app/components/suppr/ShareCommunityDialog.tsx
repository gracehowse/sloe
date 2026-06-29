"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { BarcodeShareOptIn } from "./BarcodeShareOptIn";
import type { FoodCorrectionInput } from "../../../lib/foodCorrection/submitFoodCorrection";

/**
 * ShareCommunityDialog (web) — hosts the {@link BarcodeShareOptIn} opt-in in its
 * own dialog, opened by the host AFTER a not-found barcode has been saved as a
 * private custom food (ENG-1247). Kept separate from CreateCustomFoodDialog (which
 * closes on save) so the 470-line custom-food form isn't wrapped; the UX is the
 * same — the opt-in appears right after the save — and the consent meaning is
 * identical to the mobile in-screen flow.
 *
 * `input` is the entry to contribute; non-null opens the dialog. `onShare` is the
 * host-supplied write (web `submitFoodCorrection` with its authed client + userId);
 * `onClose` clears the input. Flag-gating lives at the host (the host only sets
 * `input` when `barcode_community_contribution` is on).
 */
export interface ShareCommunityDialogProps {
  input: FoodCorrectionInput | null;
  onShare: (
    input: FoodCorrectionInput,
  ) => Promise<{ ok: boolean; error?: string; reasons?: string[] }>;
  onClose: () => void;
}

export function ShareCommunityDialog({ input, onShare, onClose }: ShareCommunityDialogProps) {
  return (
    <Dialog
      open={input != null}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="bg-card border-border max-w-md" data-testid="share-community-dialog">
        {/* The opt-in renders its own visible heading; this title is the a11y label. */}
        <DialogHeader className="sr-only">
          <DialogTitle>Share to the community food database</DialogTitle>
          <DialogDescription>
            Optionally contribute this barcode to Sloe&rsquo;s shared food database.
          </DialogDescription>
        </DialogHeader>
        {input ? <BarcodeShareOptIn onShare={() => onShare(input)} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export default ShareCommunityDialog;
